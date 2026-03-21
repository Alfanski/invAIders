import { expect, test } from '@playwright/test';

test.describe('Dashboard navigation', () => {
  test('landing page loads and links to dashboard', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/mAIcoach/);
    await expect(page.getByRole('link', { name: 'Open Dashboard' })).toBeVisible();
  });

  test('dashboard workout tab is active by default', async ({ page }) => {
    await page.goto('/dashboard');
    const workoutTab = page.getByRole('link', { name: 'Workout' });
    await expect(workoutTab).toBeVisible();
  });

  test('tab navigation works between views', async ({ page }) => {
    await page.goto('/dashboard');

    await page.getByRole('link', { name: 'Week' }).click();
    await expect(page.getByText('Week of Mar 15')).toBeVisible();

    await page.getByRole('link', { name: 'Training Pulse' }).click();
    await expect(page.getByText('Balanced')).toBeVisible();

    await page.getByRole('link', { name: 'Workout' }).click();
    await expect(page.getByText('Morning Run')).toBeVisible();
  });

  test('stat cards render on workout page', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByText('10.2 km')).toBeVisible();
    await expect(page.getByText('154 bpm')).toBeVisible();
  });

  test('dynamic workout route renders activity id', async ({ page }) => {
    await page.goto('/dashboard/workout/12345');
    await expect(page.getByText('Workout 12345')).toBeVisible();
  });
});
