import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const id = process.argv[2];

if (!id || !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(id) || id === 'default') {
  console.error('Usage: pnpm generate:template <lowercase-kebab-case-id>');
  process.exitCode = 1;
} else {
  const sharedDefinitions = resolve(repoRoot, 'packages/shared/src/profile-templates.ts');
  const definitions = readFileSync(sharedDefinitions, 'utf8');
  if (definitions.includes(`'${id}'`)) {
    console.error(`Template "${id}" is already present in the shared template ids.`);
    process.exitCode = 1;
  } else {
    const templateDirectory = resolve(
      repoRoot,
      'apps/web/src/features/public-profile/templates',
      id,
    );
    const thumbnailPath = resolve(repoRoot, 'apps/web/public/templates', `${id}.svg`);
    if (existsSync(templateDirectory) || existsSync(thumbnailPath)) {
      console.error(`Template folder or thumbnail already exists for "${id}".`);
      process.exitCode = 1;
    }

    try {
      if (!process.exitCode) mkdirSync(templateDirectory);
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'EEXIST') {
        console.error(`Template folder already exists: ${templateDirectory}`);
        process.exitCode = 1;
      } else {
        throw error;
      }
    }

    if (!process.exitCode) {
      const name = id
        .split('-')
        .map((part) => part[0].toUpperCase() + part.slice(1))
        .join(' ');
      writeFileSync(
        resolve(templateDirectory, 'manifest.ts'),
        `export const ${toCamelCase(id)}TemplateManifest = {
  id: '${id}',
  name: '${name}',
  description: 'Describe this profile layout in one short sentence.',
  thumbnail: '/templates/${id}.svg',
} as const;
`,
      );
      writeFileSync(
        resolve(templateDirectory, `${toPascalCase(id)}Template.tsx`),
        `import Image from 'next/image';
import type { PublicProfileTemplateProps } from '../contract';
import styles from './${toPascalCase(id)}Template.module.css';

export default function ${toPascalCase(id)}Template({ viewModel, actions }: PublicProfileTemplateProps) {
  const { profile, office, products, socialLinks, sections } = viewModel;

  return (
    <main className={styles.root}>
      <article className={styles.content}>
        <header className={styles.header}>
          {profile.coverImage && (
            <Image
              src={profile.coverImage}
              alt=""
              width={1280}
              height={420}
              priority
              className={styles.cover}
            />
          )}
          <h1 className={styles.name}>{profile.fullName}</h1>
          {profile.jobTitle && <p>{profile.jobTitle}</p>}
          {profile.tagline && <p>{profile.tagline}</p>}
          {profile.avatar && (
            <Image
              src={profile.avatar}
              alt={\`\${profile.fullName}'s profile photo\`}
              width={128}
              height={128}
              className={styles.avatar}
            />
          )}
          <div className={styles.actions}>
            <button type="button" onClick={actions.downloadContact}>Download contact</button>
            {socialLinks.map((item) => (
              <a key={item.platform} href={item.url} target="_blank" rel="noopener noreferrer">
                {item.platform}
              </a>
            ))}
          </div>
        </header>

        {sections.contact && (
          <section className={styles.section} aria-labelledby="contact-heading">
            <h2 id="contact-heading">Contact</h2>
            {profile.phone && <a href={\`tel:\${profile.phone}\`}>{profile.phone}</a>}
            {profile.email && <a href={\`mailto:\${profile.email}\`}>{profile.email}</a>}
            {profile.website && <a href={profile.website}>{profile.website}</a>}
          </section>
        )}

        {sections.office && office && (
          <section className={styles.section} aria-labelledby="office-heading">
            <h2 id="office-heading">Office</h2>
            {office.companyName && <p>{office.companyName}</p>}
            {office.officeAddress && <p>{office.officeAddress}</p>}
            {office.officePhone && <a href={\`tel:\${office.officePhone}\`}>{office.officePhone}</a>}
            {office.officeEmail && <a href={\`mailto:\${office.officeEmail}\`}>{office.officeEmail}</a>}
          </section>
        )}

        {sections.products && (
          <section className={styles.section} aria-labelledby="products-heading">
            <h2 id="products-heading">Products &amp; Services</h2>
            <ul className={styles.products}>
              {products.map((product) => (
                <li key={product.id}>
                  <Image src={product.image} alt={product.name} width={640} height={480} />
                  <h3>{product.name}</h3>
                  {product.price != null && <p>{product.currency} {product.price}</p>}
                  {product.detail && <p>{product.detail}</p>}
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className={styles.section} aria-labelledby="links-heading">
          <h2 id="links-heading">Quick links</h2>
          <button type="button" onClick={actions.downloadCsv}>Download CSV</button>
        </section>
      </article>
    </main>
  );
}
`,
      );
      writeFileSync(
        resolve(templateDirectory, `${toPascalCase(id)}Template.module.css`),
        `.root {
  min-height: 100vh;
  overflow-wrap: anywhere;
  color: var(--theme-ink);
}

.content {
  box-sizing: border-box;
  width: min(100%, 72rem);
  margin-inline: auto;
  padding:
    max(1.5rem, env(safe-area-inset-top))
    max(1rem, env(safe-area-inset-right))
    max(3rem, env(safe-area-inset-bottom))
    max(1rem, env(safe-area-inset-left));
}

.header,
.section {
  min-width: 0;
  padding-block: 1.5rem;
}

.name {
  font-size: clamp(2rem, 8vw, 4.5rem);
  line-height: 1.05;
  overflow-wrap: anywhere;
}

.cover {
  width: 100%;
  height: auto;
  aspect-ratio: 3 / 1;
  object-fit: cover;
}

.avatar {
  width: 8rem;
  height: 8rem;
  border-radius: 50%;
  object-fit: cover;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-top: 1rem;
}

.actions a,
.actions button,
.section a,
.section button {
  display: inline-flex;
  min-width: 2.75rem;
  min-height: 2.75rem;
  align-items: center;
  overflow-wrap: anywhere;
}

.products {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 1rem;
  padding: 0;
  list-style: none;
}

.products img {
  width: 100%;
  height: auto;
  aspect-ratio: 4 / 3;
  object-fit: cover;
}

.products li {
  min-width: 0;
  overflow-wrap: anywhere;
}

:is(a, button):focus-visible {
  outline: 2px solid var(--theme-primary);
  outline-offset: 3px;
}

@media (min-width: 768px) {
  .products {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (min-width: 1024px) {
  .products {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (prefers-reduced-motion: reduce) {
  .root *,
  .root *::before,
  .root *::after {
    animation: none !important;
    scroll-behavior: auto !important;
    transition: none !important;
  }
}
`,
      );
      mkdirSync(dirname(thumbnailPath), { recursive: true });
      writeFileSync(
        thumbnailPath,
        `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200" viewBox="0 0 320 200"><rect width="320" height="200" rx="20" fill="#eef2ff"/><rect x="28" y="28" width="264" height="144" rx="12" fill="#fff"/><rect x="48" y="50" width="80" height="8" rx="4" fill="#4f46e5"/><rect x="48" y="72" width="160" height="6" rx="3" fill="#cbd5e1"/><rect x="48" y="92" width="220" height="6" rx="3" fill="#e2e8f0"/></svg>\n`,
      );
      console.log(`Created template starter: ${templateDirectory}`);
      console.log(`Created thumbnail: ${thumbnailPath}`);
      console.log('Next, add the id to packages/shared/src/profile-templates.ts and register the component and manifest in the web template registry.');
    }
  }
}

function toPascalCase(value) {
  return value
    .split('-')
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join('');
}

function toCamelCase(value) {
  const pascal = toPascalCase(value);
  return pascal[0].toLowerCase() + pascal.slice(1);
}
