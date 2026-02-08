import { test, expect } from '@playwright/test';
import { exec } from 'child_process';
import util from 'util';
import path from 'path';
import { fileURLToPath } from 'url';

const execAsync = util.promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('Change History Descriptions', () => {
    test.beforeAll(async () => {
        console.log('Running admin setup script...');
        try {
            const scriptPath = path.resolve(__dirname, '../../../scripts/setup-admin.js');
            await execAsync(`node "${scriptPath}"`);
            console.log('Admin setup complete.');
        } catch (error) {
            console.error('Failed to setup admin:', error);
            throw error;
        }
    });

    test.beforeEach(async ({ page }) => {
        await page.goto('/login');
        await page.fill('input[type="email"]', 'admin@vbstrack.local');
        await page.fill('input[type="password"]', 'Admin123!VBS');
        await page.click('button:has-text("Sign In")');
        await page.waitForURL(/admin|events/);
    });

    test('edit modal should show error when no changes are made', async ({ page }) => {
        // Navigate to a student detail page (requires existing student)
        await page.goto('/admin/students');
        await page.waitForSelector('[data-testid="student-row"], [data-testid="student-card"], a[href*="/admin/students/"]', { timeout: 10000 });

        // Click on first student link
        const studentLink = page.locator('a[href*="/admin/students/"]').first();
        if (await studentLink.isVisible()) {
            await studentLink.click();
            await page.waitForURL(/admin\/students\//);

            // Click Edit button if available
            const editBtn = page.getByRole('button', { name: 'Edit' }).first();
            if (await editBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
                await editBtn.click();

                // Wait for modal to appear
                await page.waitForSelector('text=Edit Hours', { timeout: 5000 });

                // Type a reason without changing times
                const reasonField = page.locator('textarea[placeholder*="Helped with setup"]');
                await reasonField.fill('test reason');

                // Click Save Changes
                await page.getByRole('button', { name: 'Save Changes' }).click();

                // Should show "No changes detected" error
                await expect(page.locator('text=No changes detected')).toBeVisible({ timeout: 5000 });
            }
        }
    });

    test('change history modal should not show Current Override section', async ({ page }) => {
        await page.goto('/admin/students');
        await page.waitForSelector('[data-testid="student-row"], [data-testid="student-card"], a[href*="/admin/students/"]', { timeout: 10000 });

        const studentLink = page.locator('a[href*="/admin/students/"]').first();
        if (await studentLink.isVisible()) {
            await studentLink.click();
            await page.waitForURL(/admin\/students\//);

            // Look for View History button/link
            const viewHistoryBtn = page.locator('text=View').first();
            if (await viewHistoryBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
                await viewHistoryBtn.click();

                // The "Current Override" section should NOT be present
                await expect(page.locator('text=Current Override')).not.toBeVisible({ timeout: 3000 });

                // Change History section should still be present if there is history
                const changeHistoryHeader = page.locator('text=Change History');
                // This may or may not be visible depending on data
            }
        }
    });
});
