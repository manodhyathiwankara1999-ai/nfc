import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ApiEnvironment } from '../../config/env.schema';

@Injectable()
export class WebRevalidationService {
  constructor(private readonly config: ConfigService<ApiEnvironment, true>) {}

  async revalidate(slugs: string[]): Promise<void> {
    const uniqueSlugs = [...new Set(slugs.filter((slug) => slug.length > 0))];
    if (uniqueSlugs.length === 0) return;
    const webUrl = this.config.get('WEB_APP_URL', { infer: true });
    const secret = this.config.get('REVALIDATION_SECRET', { infer: true });
    for (let offset = 0; offset < uniqueSlugs.length; offset += 100) {
      let response: Response;
      try {
        response = await fetch(new URL('/_internal/revalidate', webUrl), {
          method: 'POST',
          headers: {
            authorization: `Bearer ${secret}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({ slugs: uniqueSlugs.slice(offset, offset + 100) }),
          signal: AbortSignal.timeout(3000),
        });
      } catch (error) {
        throw new ServiceUnavailableException('Could not invalidate the public page cache.', {
          cause: error,
        });
      }
      if (!response.ok) {
        throw new ServiceUnavailableException(
          `Public page cache invalidation failed (${response.status}).`,
        );
      }
    }
  }
}
