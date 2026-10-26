import { test, expect } from '@playwright/test';
import { mockApi } from './helpers';

test.beforeEach(async ({ page }) => {
  await mockApi(page);
  await page.goto('/');
});

test.describe('Empty state', () => {
  test('shows welcome screen with fox emoji and prompt suggestions', async ({ page }) => {
    await expect(page.getByText('What can I help with?')).toBeVisible();
    await expect(page.getByText('What PRs need my review?')).toBeVisible();
    await expect(page.getByText('Help me debug')).toBeVisible();
  });

  test('shows sidebar with new chat button and conversations', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'New chat' })).toBeVisible();
    await expect(page.getByText('Test conversation')).toBeVisible();
  });

  test('shows composer with mode toggle', async ({ page }) => {
    await expect(page.getByPlaceholder('Message Kitsune...')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Auto' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Local/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Cloud/ })).toBeVisible();
  });
});

test.describe('Model selector', () => {
  test('Cloud dropdown shows Claude models grouped by family', async ({ page }) => {
    await page.getByRole('button', { name: /Cloud/ }).click();
    await expect(page.getByText('Auto (best available)')).toBeVisible();
    await expect(page.getByText('Opus 4.6')).toBeVisible();
    await expect(page.getByText('Sonnet 4.5')).toBeVisible();
    await expect(page.getByText('Haiku 3.5')).toBeVisible();
    await expect(page.getByText('CLAUDE-4')).toBeVisible();
    await expect(page.getByText('CLAUDE-3.5')).toBeVisible();
  });

  test('Local dropdown shows models with sizes', async ({ page }) => {
    await page.getByRole('button', { name: /Local/ }).click();
    await expect(page.getByText('qwen3:4b')).toBeVisible();
    await expect(page.getByText('2.5GB')).toBeVisible();
    await expect(page.getByText('llama3:8b')).toBeVisible();
    await expect(page.getByText('4.7GB')).toBeVisible();
  });

  test('selecting a model updates the button label', async ({ page }) => {
    await page.getByRole('button', { name: /Cloud/ }).click();
    await page.getByText('Opus 4.6').click();
    await expect(page.getByRole('button', { name: 'Opus 4.6' })).toBeVisible();
  });

  test('clicking Auto resets to auto mode', async ({ page }) => {
    await page.getByRole('button', { name: /Cloud/ }).click();
    await page.getByText('Sonnet 4.5').click();
    await page.getByRole('button', { name: 'Auto' }).click();
    await expect(page.getByRole('button', { name: 'Auto' })).toBeVisible();
  });

  test('dropdown closes when clicking outside', async ({ page }) => {
    await page.getByRole('button', { name: /Cloud/ }).click();
    await expect(page.getByText('Opus 4.6')).toBeVisible();
    await page.getByPlaceholder('Message Kitsune...').click();
    await expect(page.getByText('Opus 4.6')).not.toBeVisible();
  });
});

test.describe('Sending a message', () => {
  test('sends message and shows streamed response', async ({ page }) => {
    await page.getByPlaceholder('Message Kitsune...').fill('Hello world');
    await page.getByPlaceholder('Message Kitsune...').press('Enter');
    await expect(page.getByText('Hello world')).toBeVisible();
    await expect(page.getByText('Hello from mock')).toBeVisible({ timeout: 5000 });
  });

  test('send button activates when text is entered', async ({ page }) => {
    const sendBtn = page.locator('button').filter({ has: page.locator('svg') }).last();
    await expect(sendBtn).toBeDisabled();
    await page.getByPlaceholder('Message Kitsune...').fill('test');
    await expect(sendBtn).toBeEnabled();
  });
});

test.describe('Sidebar', () => {
  test('new chat button clears the view', async ({ page }) => {
    await page.getByText('Test conversation').click();
    await page.getByRole('button', { name: 'New chat' }).click();
    await expect(page.getByText('What can I help with?')).toBeVisible();
  });
});

test.describe('Keyboard shortcuts', () => {
  test('Cmd+/ cycles through modes', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Auto' })).toHaveCSS('border-style', 'solid');
    await page.getByPlaceholder('Message Kitsune...').press('Meta+/');
    await expect(page.getByRole('button', { name: /Local/ })).toHaveCSS('border-color', /./);
  });
});
