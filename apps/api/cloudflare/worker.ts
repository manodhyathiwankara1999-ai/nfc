import { DurableObject } from 'cloudflare:workers';

const API_PORT = 4000;
const CONTAINER_INACTIVITY_TIMEOUT = 5 * 60 * 1000;
const STARTUP_ATTEMPTS = 120;
const STARTUP_RETRY_DELAY = 500;

interface ApiWorkerEnvironment {
  API_CONTAINER: DurableObjectNamespace<ApiContainer>;
  CORS_ORIGINS: string;
  DATABASE_URL: string;
  DIRECT_URL: string;
  IP_HASH_SALT: string;
  REVALIDATION_SECRET: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_URL: string;
  WEB_APP_URL: string;
  ANALYTICS_RAW_RETENTION_DAYS?: string;
  GALLERY_MAX_IMAGES?: string;
  MAX_CARDS_PER_USER?: string;
  PORT?: string;
  R2_ACCESS_KEY_ID?: string;
  R2_ACCOUNT_ID?: string;
  R2_BUCKET_NAME?: string;
  R2_PUBLIC_BASE_URL?: string;
  R2_SECRET_ACCESS_KEY?: string;
  SENTRY_DSN?: string;
  TRUSTED_PROXY_IPS?: string;
}

export class ApiContainer extends DurableObject<ApiWorkerEnvironment> {
  private starting: Promise<void> | undefined;

  async fetch(request: Request): Promise<Response> {
    const container = this.ctx.container;
    if (!container) {
      throw new Error('Cloudflare Container binding is unavailable.');
    }

    this.starting ??= this.startAndWaitForReadiness(container).finally(() => {
      this.starting = undefined;
    });
    await this.starting;

    const url = new URL(request.url);
    url.protocol = 'http:';
    url.hostname = 'container';
    const forwarded = new Request(url, request);
    forwarded.headers.delete('host');
    return container.getTcpPort(API_PORT).fetch(forwarded);
  }

  private async startAndWaitForReadiness(
    container: NonNullable<typeof this.ctx.container>,
  ): Promise<void> {
    const requiredBindings: Array<[string, string | undefined]> = [
      ['CORS_ORIGINS', this.env.CORS_ORIGINS],
      ['DATABASE_URL', this.env.DATABASE_URL],
      ['DIRECT_URL', this.env.DIRECT_URL],
      ['IP_HASH_SALT', this.env.IP_HASH_SALT],
      ['REVALIDATION_SECRET', this.env.REVALIDATION_SECRET],
      ['SUPABASE_ANON_KEY', this.env.SUPABASE_ANON_KEY],
      ['SUPABASE_URL', this.env.SUPABASE_URL],
      ['WEB_APP_URL', this.env.WEB_APP_URL],
    ];
    const missingBindings = requiredBindings
      .filter(([, value]) => value === undefined || value.length === 0)
      .map(([name]) => name);
    if (missingBindings.length > 0) {
      throw new Error(`Missing required API Worker bindings: ${missingBindings.join(', ')}.`);
    }

    const image = container.images.base;
    const storedImage = await this.ctx.storage.get<string>('container-image');
    if (container.running && storedImage !== image) {
      await container.destroy();
    }

    if (!container.running) {
      container.start({
        image,
        instance: 'lite',
        enableInternet: true,
        env: {
          ANALYTICS_RAW_RETENTION_DAYS: this.env.ANALYTICS_RAW_RETENTION_DAYS ?? '365',
          CORS_ORIGINS: this.env.CORS_ORIGINS,
          DATABASE_URL: this.env.DATABASE_URL,
          DIRECT_URL: this.env.DIRECT_URL,
          GALLERY_MAX_IMAGES: this.env.GALLERY_MAX_IMAGES ?? '30',
          IP_HASH_SALT: this.env.IP_HASH_SALT,
          MAX_CARDS_PER_USER: this.env.MAX_CARDS_PER_USER ?? '5',
          PORT: this.env.PORT ?? String(API_PORT),
          R2_ACCESS_KEY_ID: this.env.R2_ACCESS_KEY_ID ?? '',
          R2_ACCOUNT_ID: this.env.R2_ACCOUNT_ID ?? '',
          R2_BUCKET_NAME: this.env.R2_BUCKET_NAME ?? '',
          R2_PUBLIC_BASE_URL: this.env.R2_PUBLIC_BASE_URL ?? '',
          R2_SECRET_ACCESS_KEY: this.env.R2_SECRET_ACCESS_KEY ?? '',
          REVALIDATION_SECRET: this.env.REVALIDATION_SECRET,
          SENTRY_DSN: this.env.SENTRY_DSN ?? '',
          SUPABASE_ANON_KEY: this.env.SUPABASE_ANON_KEY,
          SUPABASE_URL: this.env.SUPABASE_URL,
          TRUSTED_PROXY_IPS: this.env.TRUSTED_PROXY_IPS ?? '',
          WEB_APP_URL: this.env.WEB_APP_URL,
        },
      });
      await this.ctx.storage.put('container-image', image);
    }

    await container.setInactivityTimeout(CONTAINER_INACTIVITY_TIMEOUT);
    const healthUrl = 'http://container/api/v1/health';
    let lastFailure: unknown;

    for (let attempt = 0; attempt < STARTUP_ATTEMPTS; attempt += 1) {
      try {
        const response = await container.getTcpPort(API_PORT).fetch(healthUrl, {
          signal: AbortSignal.timeout(1000),
        });
        await response.body?.cancel();
        if (response.ok) return;
        lastFailure = new Error(`API readiness endpoint returned ${response.status}.`);
      } catch (error: unknown) {
        lastFailure = error;
      }

      await new Promise<void>((resolve) => setTimeout(resolve, STARTUP_RETRY_DELAY));
    }

    throw new Error('Cloudflare API container did not become ready.', { cause: lastFailure });
  }
}

const worker = {
  async fetch(request: Request, env: ApiWorkerEnvironment): Promise<Response> {
    return env.API_CONTAINER.getByName('api').fetch(request);
  },
};

export default worker;
