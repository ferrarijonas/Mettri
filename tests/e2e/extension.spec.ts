import { test, expect, type BrowserContext } from '@playwright/test';
import path from 'path';

const extensionPath = path.join(__dirname, '../../dist');

test.describe('Mettri Extension', () => {
  let context: BrowserContext;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('extension should load successfully', async () => {
    const page = await context.newPage();

    // Navigate to WhatsApp Web
    await page.goto('https://web.whatsapp.com');

    // Wait for WhatsApp to load (QR code or chat list)
    await page.waitForSelector('[data-testid="qrcode"], [data-testid="chat-list"]', {
      timeout: 30000,
    });

    // Check if Mettri panel toggle exists
    const toggleButton = page.locator('#mettri-toggle');
    await expect(toggleButton).toBeVisible({ timeout: 10000 });

    await page.close();
  });

  test('panel should be visible on WhatsApp Web', async () => {
    const page = await context.newPage();

    await page.goto('https://web.whatsapp.com');

    // Wait for WhatsApp
    await page.waitForSelector('[data-testid="qrcode"], [data-testid="chat-list"]', {
      timeout: 30000,
    });

    // Wait for Mettri panel
    const panel = page.locator('#mettri-panel');
    await expect(panel).toBeVisible({ timeout: 10000 });

    // Check panel header
    const header = panel.locator('.mettri-header h1');
    await expect(header).toHaveText('Mettri');

    await page.close();
  });

  test('panel can be hidden and shown', async () => {
    const page = await context.newPage();

    await page.goto('https://web.whatsapp.com');

    await page.waitForSelector('[data-testid="qrcode"], [data-testid="chat-list"]', {
      timeout: 30000,
    });

    const panel = page.locator('#mettri-panel');
    const toggleButton = page.locator('#mettri-toggle');
    const closeButton = page.locator('#mettri-close');

    // Panel should be visible initially
    await expect(panel).toBeVisible({ timeout: 10000 });

    // Close panel
    await closeButton.click();
    await expect(panel).not.toBeVisible();

    // Toggle button should be visible
    await expect(toggleButton).toBeVisible();

    // Re-open panel
    await toggleButton.click();
    await expect(panel).toBeVisible();

    await page.close();
  });

  test('status indicator should show capturing state', async () => {
    const page = await context.newPage();

    await page.goto('https://web.whatsapp.com');

    await page.waitForSelector('[data-testid="qrcode"], [data-testid="chat-list"]', {
      timeout: 30000,
    });

    const statusDot = page.locator('#mettri-status-dot');
    const statusText = page.locator('#mettri-status-text');

    // Status should indicate capturing
    await expect(statusDot).toHaveClass(/active/, { timeout: 10000 });
    await expect(statusText).toContainText('Capturando');

    await page.close();
  });
});
