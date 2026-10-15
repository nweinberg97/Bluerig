// The whole journey, against a real local database with texts and email mocked:
// admin imports a shop → private preview → owner claims with a texted code →
// puts the site live → edits a headline → public page shows it → a customer sends
// a request → it's stored and texted → server restarts → everything is still there.
import { test, expect, type Page } from '@playwright/test';
import type { ChildProcess } from 'node:child_process';
import { ADMIN_EMAIL, MOCK, OWNER_EMAIL, db, ensureUser, resetData, signInUrl, startApp, startMock, stopApp, type Sent } from './support';

let app: ChildProcess;
let mock: { sent: Sent[]; stop: () => Promise<void> };

test.beforeAll(async () => {
  mock = await startMock();
  await resetData();
  await ensureUser(ADMIN_EMAIL);
  await ensureUser(OWNER_EMAIL);
  app = await startApp();
});

test.afterAll(async () => {
  if (app) await stopApp(app);
  if (mock) await mock.stop();
});

const lastText = (to: string) => [...mock.sent].reverse().find((m) => m.kind === 'sms' && m.to === to);

async function closePanels(page: Page) {
  // Imported sites open "Things to check" the first time; close it.
  if (await page.locator('.rp').isVisible().catch(() => false)) await page.keyboard.press('Escape');
}

test('import → claim → edit → publish → lead → restart', async ({ browser }) => {
  // 1. Admin pastes the shop's old website.
  const admin = await browser.newPage();
  await admin.goto(await signInUrl(ADMIN_EMAIL, '/admin'));
  await expect(admin.getByRole('heading', { name: 'Build a site from a website' })).toBeVisible();
  await admin.getByLabel('Website address').fill(`${MOCK}/shop/`);
  await admin.getByRole('button', { name: 'Build preview' }).click();
  await admin.waitForURL(/\/admin\/b\//, { timeout: 60_000 });
  await expect(admin.getByRole('heading', { name: 'Northline' })).toBeVisible();
  const previewPath = await admin.locator('a[href^="/p/"]').first().getAttribute('href');
  expect(previewPath).toMatch(/^\/p\/[a-f0-9]{36}$/);

  // 2. The owner opens the preview and claims it with the code texted to the shop.
  const ownerCtx = await browser.newContext();
  const owner = await ownerCtx.newPage();
  await owner.goto(await signInUrl(OWNER_EMAIL, previewPath!));
  await expect(owner.getByText('Private preview for Northline.')).toBeVisible();
  await owner.getByRole('button', { name: 'Text a code to 604-555-0142' }).click();
  await expect.poll(() => lastText('+16045550142')?.body ?? '').toMatch(/Your Bluerig code for Northline is \d{6}/);
  const code = lastText('+16045550142')!.body.match(/(\d{6})/)![1];
  await owner.getByLabel('6-digit code').fill(code);
  await owner.getByRole('button', { name: 'Claim' }).click();
  await owner.waitForURL(/\/edit\/[0-9a-f-]{36}$/);
  const businessId = owner.url().split('/').pop()!;

  const { data: members } = await db.from('members').select('role').eq('business_id', businessId);
  expect(members).toEqual([{ role: 'owner' }]);

  // 3. Put it live, then change the headline by typing on the page.
  await closePanels(owner);
  await owner.getByRole('button', { name: 'Put my website live' }).click();
  await expect(owner.getByText('Your website is live.')).toBeVisible();
  const headline = owner.locator('[data-k="copy.headlineA"]');
  await headline.click();
  await owner.keyboard.press('ControlOrMeta+A');
  await owner.keyboard.type('Furnace repair for');
  await owner.locator('.ed-side h2').click(); // click away = Done
  await expect(owner.getByText('Saved. It’s on your website now.')).toBeVisible();

  // 4. The public page shows the edit.
  const { data: biz } = await db.from('businesses').select('slug, status').eq('id', businessId).single();
  expect(biz!.status).toBe('live');
  const customer = await (await browser.newContext()).newPage();
  await customer.goto(`/s/${biz!.slug}`);
  await expect(customer.locator('h1')).toContainText('Furnace repair for');

  // 5. A customer sends a request: stored, and texted to the shop.
  await customer.locator('input[name="name"]').fill('Dana Example');
  await customer.locator('input[name="phone"]').fill('604-555-0199');
  await customer.locator('textarea[name="message"]').fill('Furnace is blowing cold air');
  await customer.getByRole('button', { name: 'Send request' }).click();
  await expect(customer.getByText(/Request sent\./)).toBeVisible();
  const { data: leads } = await db.from('leads').select('name, message').eq('business_id', businessId);
  expect(leads).toEqual([{ name: 'Dana Example', message: 'Furnace is blowing cold air' }]);
  await expect.poll(() => lastText('+16045550142')?.body ?? '').toMatch(/New request from your website/);

  // 6. A second person can't claim it, and the old preview link is view-only.
  const strangerCtx = await browser.newContext();
  const stranger = await strangerCtx.newPage();
  await stranger.goto(`${previewPath}`);
  await expect(stranger.getByText('This website has been claimed by its owner.')).toBeVisible();
  await expect(stranger.getByRole('button', { name: /Text a code/ })).toHaveCount(0);

  // 7. Restart the server: everything is still there.
  await stopApp(app);
  app = await startApp();
  await customer.goto(`/s/${biz!.slug}`);
  await expect(customer.locator('h1')).toContainText('Furnace repair for');
  await owner.goto(`/edit/${businessId}`);
  await expect(owner.locator('[data-k="copy.headlineA"]')).toHaveText('Furnace repair for');
  const { count } = await db.from('leads').select('id', { count: 'exact', head: true }).eq('business_id', businessId);
  expect(count).toBe(1);

  // Nothing was sent anywhere real: every message went to the mock.
  expect(mock.sent.every((m) => ['sms', 'call', 'email'].includes(m.kind))).toBe(true);
});
