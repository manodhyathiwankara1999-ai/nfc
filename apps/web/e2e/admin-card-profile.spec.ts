import { expect, test } from '@playwright/test';

const adminUsername = process.env.E2E_ADMIN_USERNAME;
const adminPassword = process.env.E2E_ADMIN_PASSWORD;
const ownerEmail = process.env.E2E_OWNER_EMAIL;
const ownerPassword = process.env.E2E_OWNER_PASSWORD;
const credentials =
  adminUsername && adminPassword && ownerEmail && ownerPassword
    ? { adminUsername, adminPassword, ownerEmail, ownerPassword }
    : undefined;

test.describe('authenticated card profile flow', () => {
  test.skip(
    !credentials,
    'Set E2E_ADMIN_USERNAME, E2E_ADMIN_PASSWORD, E2E_OWNER_EMAIL, and E2E_OWNER_PASSWORD to run this authenticated flow.',
  );

  test('super admin creates a card, its owner edits the profile, and the public page shows it', async ({
    page,
  }) => {
    if (!credentials) return;

    const slug = `e2e-${Date.now()}`;
    const editedName = `E2E Profile ${Date.now()}`;

    await page.goto('/super-admin/login');
    await page.getByLabel('Username').fill(credentials.adminUsername);
    await page.getByLabel('Password').fill(credentials.adminPassword);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/super-admin$/);

    await page.getByRole('link', { name: 'Cards', exact: true }).click();
    await page.getByRole('button', { name: 'Add card' }).click();
    await page.getByLabel('Find user by email').fill(credentials.ownerEmail);
    const escapedEmail = credentials.ownerEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    await page.getByRole('button', { name: new RegExp(escapedEmail, 'i') }).click();
    await page.getByLabel('Custom slug (optional)').fill(slug);
    await page.getByRole('button', { name: 'Create active card' }).click();
    await expect(page.getByText('Card created and activated')).toBeVisible();
    await expect(page.getByText(`/${slug}`, { exact: false })).toBeVisible();

    await page.getByRole('button', { name: 'Sign out' }).click();
    await page.goto('/login');
    await page.getByLabel('Email').fill(credentials.ownerEmail);
    await page.getByLabel('Password').fill(credentials.ownerPassword);
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page).toHaveURL(/\/dashboard(?:\?.*)?$/);
    await page.goto('/dashboard/profile');

    const fullName = page.getByLabel('Full name');
    await expect(fullName).toBeVisible();
    await fullName.fill(editedName);
    await page.getByRole('button', { name: 'Save card profile' }).click();
    await expect(page.getByText('Card profile saved')).toBeVisible();

    await page.goto(`/u/${slug}`);
    await expect(page.getByRole('heading', { name: editedName, level: 1 })).toBeVisible();
  });
});
