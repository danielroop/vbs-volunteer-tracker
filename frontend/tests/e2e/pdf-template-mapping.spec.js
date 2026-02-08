import { test, expect } from '@playwright/test';
import { exec } from 'child_process';
import util from 'util';
import path from 'path';
import { fileURLToPath } from 'url';

const execAsync = util.promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('PDF Template Mapping Enhancements', () => {
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
        // Login as admin
        await page.goto('/login');
        await page.fill('input[type="email"]', 'admin@vbstrack.local');
        await page.fill('input[type="password"]', 'Admin123!VBS');
        await page.click('button:has-text("Sign In")');
        await page.waitForURL(/admin|events/);
    });

    test('should show new placeable field options in the static field dropdown', async ({ page }) => {
        await page.goto('/admin/pdf-templates');
        await page.waitForSelector('h1:has-text("PDF Templates")');

        // Check if templates exist; if any, open the mapper on the first one
        const templateCards = page.locator('.bg-white.rounded-2xl');
        const count = await templateCards.count();

        if (count > 0) {
            // Click Map Fields on first template
            await templateCards.first().getByRole('button', { name: 'Map Fields' }).click();

            // Wait for the mapper modal
            await expect(page.locator('text=Map Fields:')).toBeVisible({ timeout: 10000 });

            // Check the static field dropdown contains new field options
            const fieldDropdown = page.locator('select').first();
            await expect(fieldDropdown).toBeVisible();

            const options = await fieldDropdown.locator('option').allTextContents();
            expect(options).toContain('Contact Person');
            expect(options).toContain('Contact Phone');
            expect(options).toContain('Event Description');
            expect(options).toContain('Non-Profit Organization');
        }
    });

    test('should display Place Detail Table button in the mapper toolbar', async ({ page }) => {
        await page.goto('/admin/pdf-templates');
        await page.waitForSelector('h1:has-text("PDF Templates")');

        const templateCards = page.locator('.bg-white.rounded-2xl');
        const count = await templateCards.count();

        if (count > 0) {
            await templateCards.first().getByRole('button', { name: 'Map Fields' }).click();
            await expect(page.locator('text=Map Fields:')).toBeVisible({ timeout: 10000 });

            // Verify Detail Table button exists
            const detailTableBtn = page.getByRole('button', { name: 'Place Detail Table' });
            await expect(detailTableBtn).toBeVisible();

            // Click it and verify configuration panel shows
            await detailTableBtn.click();

            // Should show detail table configuration
            await expect(page.locator('text=Detail Table Configuration')).toBeVisible();
            await expect(page.locator('text=Shows individual time entries')).toBeVisible();

            // Cancel placement
            const cancelBtn = page.getByRole('button', { name: 'Cancel' }).first();
            await cancelBtn.click();
        }
    });

    test('should display Place Custom Field button and configuration panel', async ({ page }) => {
        await page.goto('/admin/pdf-templates');
        await page.waitForSelector('h1:has-text("PDF Templates")');

        const templateCards = page.locator('.bg-white.rounded-2xl');
        const count = await templateCards.count();

        if (count > 0) {
            await templateCards.first().getByRole('button', { name: 'Map Fields' }).click();
            await expect(page.locator('text=Map Fields:')).toBeVisible({ timeout: 10000 });

            // Verify Custom Field button exists
            const customFieldBtn = page.getByRole('button', { name: 'Place Custom Field' });
            await expect(customFieldBtn).toBeVisible();

            // Click it and verify configuration panel shows
            await customFieldBtn.click();

            // Should show custom static field configuration
            await expect(page.locator('text=Custom Static Field')).toBeVisible();
            await expect(page.locator('text=Create a field with your own label and value')).toBeVisible();

            // Verify label and value inputs are present
            await expect(page.locator('input[placeholder="e.g., Supervisor Title"]')).toBeVisible();
            await expect(page.locator('input[placeholder="e.g., Program Director"]')).toBeVisible();

            // Should show warning when label is empty
            await expect(page.locator('text=Please enter a label before placing the field')).toBeVisible();

            // Fill in label
            await page.fill('input[placeholder="e.g., Supervisor Title"]', 'Test Label');

            // Warning should go away, placement instruction should show
            await expect(page.locator('text=Click on the PDF to place the custom field')).toBeVisible();
        }
    });

    test('should show Activity Table as summary type in field list', async ({ page }) => {
        await page.goto('/admin/pdf-templates');
        await page.waitForSelector('h1:has-text("PDF Templates")');

        const templateCards = page.locator('.bg-white.rounded-2xl');
        const count = await templateCards.count();

        if (count > 0) {
            await templateCards.first().getByRole('button', { name: 'Map Fields' }).click();
            await expect(page.locator('text=Map Fields:')).toBeVisible({ timeout: 10000 });

            // Verify both table type buttons exist
            const activityBtn = page.getByRole('button', { name: 'Place Activity Table' });
            const detailBtn = page.getByRole('button', { name: 'Place Detail Table' });

            await expect(activityBtn).toBeVisible();
            await expect(detailBtn).toBeVisible();
        }
    });
});
