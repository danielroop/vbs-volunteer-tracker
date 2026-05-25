import { test, expect } from '@playwright/test';
import { exec } from 'child_process';
import util from 'util';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import os from 'os';

const execAsync = util.promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('PDF Template Export/Import', () => {
    test.beforeAll(async () => {
        try {
            const scriptPath = path.resolve(__dirname, '../../../scripts/setup-admin.js');
            await execAsync(`node "${scriptPath}"`);
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

    test('should show Import Mapping button on PDF Templates page', async ({ page }) => {
        await page.goto('/admin/pdf-templates');
        await page.waitForSelector('h1:has-text("PDF Templates")');

        const importBtn = page.getByRole('button', { name: 'Import Mapping' });
        await expect(importBtn).toBeVisible();
    });

    test('should open import modal when Import Mapping is clicked', async ({ page }) => {
        await page.goto('/admin/pdf-templates');
        await page.waitForSelector('h1:has-text("PDF Templates")');

        await page.getByRole('button', { name: 'Import Mapping' }).click();

        await expect(page.locator('text=Import PDF Mapping')).toBeVisible({ timeout: 5000 });
        await expect(page.locator('[data-testid="import-json-input"]')).toBeVisible();
    });

    test('should show parse error for invalid JSON', async ({ page }) => {
        await page.goto('/admin/pdf-templates');
        await page.waitForSelector('h1:has-text("PDF Templates")');

        await page.getByRole('button', { name: 'Import Mapping' }).click();
        await expect(page.locator('[data-testid="import-json-input"]')).toBeVisible({ timeout: 5000 });

        // Upload an invalid JSON file
        const tmpFile = path.join(os.tmpdir(), 'invalid_export.json');
        fs.writeFileSync(tmpFile, 'not valid json');

        await page.locator('[data-testid="import-json-input"]').setInputFiles(tmpFile);

        await expect(page.locator('text=Invalid export file')).toBeVisible({ timeout: 5000 });
        fs.unlinkSync(tmpFile);
    });

    test('should show template preview after loading valid export JSON', async ({ page }) => {
        await page.goto('/admin/pdf-templates');
        await page.waitForSelector('h1:has-text("PDF Templates")');

        await page.getByRole('button', { name: 'Import Mapping' }).click();
        await expect(page.locator('[data-testid="import-json-input"]')).toBeVisible({ timeout: 5000 });

        const exportData = {
            version: '1',
            exportedAt: new Date().toISOString(),
            templates: [{
                name: 'E2E Test Template',
                fileName: 'e2e_test.pdf',
                pageWidth: 612,
                pageHeight: 792,
                pageCount: 1,
                fields: [
                    { id: 'f1', type: 'static', fieldKey: 'studentName', label: 'Student Name', xPercent: 10, yPercent: 10, fontSize: 12, page: 0 },
                ],
            }],
        };
        const tmpFile = path.join(os.tmpdir(), 'valid_export.json');
        fs.writeFileSync(tmpFile, JSON.stringify(exportData));

        await page.locator('[data-testid="import-json-input"]').setInputFiles(tmpFile);

        await expect(page.locator('text=E2E Test Template')).toBeVisible({ timeout: 5000 });
        await expect(page.locator('text=1 field(s)')).toBeVisible({ timeout: 5000 });

        fs.unlinkSync(tmpFile);
    });

    test('should close import modal when Cancel is clicked', async ({ page }) => {
        await page.goto('/admin/pdf-templates');
        await page.waitForSelector('h1:has-text("PDF Templates")');

        await page.getByRole('button', { name: 'Import Mapping' }).click();
        await expect(page.locator('text=Import PDF Mapping')).toBeVisible({ timeout: 5000 });

        await page.getByRole('button', { name: 'Cancel' }).click();

        await expect(page.locator('text=Import PDF Mapping')).not.toBeVisible({ timeout: 5000 });
    });

    test('should show Export button and Export All for existing templates', async ({ page }) => {
        await page.goto('/admin/pdf-templates');
        await page.waitForSelector('h1:has-text("PDF Templates")');

        const templateCards = page.locator('.bg-white.rounded-2xl');
        const count = await templateCards.count();

        if (count > 0) {
            // Per-template Export button
            const exportBtn = templateCards.first().getByRole('button', { name: 'Export' });
            await expect(exportBtn).toBeVisible();

            // Page-level Export All button
            const exportAllBtn = page.getByRole('button', { name: 'Export All' });
            await expect(exportAllBtn).toBeVisible();
        } else {
            // Just verify Import Mapping is still there (export buttons only appear with templates)
            await expect(page.getByRole('button', { name: 'Import Mapping' })).toBeVisible();
        }
    });

    test('should trigger a file download when Export is clicked', async ({ page }) => {
        await page.goto('/admin/pdf-templates');
        await page.waitForSelector('h1:has-text("PDF Templates")');

        const templateCards = page.locator('.bg-white.rounded-2xl');
        const count = await templateCards.count();

        if (count > 0) {
            const [download] = await Promise.all([
                page.waitForEvent('download'),
                templateCards.first().getByRole('button', { name: 'Export' }).click(),
            ]);

            expect(download.suggestedFilename()).toMatch(/_mapping\.json$/);

            // Verify the downloaded file is valid JSON with correct structure
            const filePath = await download.path();
            const content = fs.readFileSync(filePath, 'utf-8');
            const data = JSON.parse(content);
            expect(data.version).toBe('1');
            expect(Array.isArray(data.templates)).toBe(true);
            expect(data.templates[0]).toHaveProperty('name');
            expect(data.templates[0]).toHaveProperty('fields');
            expect(data.templates[0]).not.toHaveProperty('storagePath');
            expect(data.templates[0]).not.toHaveProperty('downloadURL');
        }
    });

    test('should trigger a file download for Export All', async ({ page }) => {
        await page.goto('/admin/pdf-templates');
        await page.waitForSelector('h1:has-text("PDF Templates")');

        const templateCards = page.locator('.bg-white.rounded-2xl');
        const count = await templateCards.count();

        if (count > 0) {
            const [download] = await Promise.all([
                page.waitForEvent('download'),
                page.getByRole('button', { name: 'Export All' }).click(),
            ]);

            expect(download.suggestedFilename()).toBe('vbs_pdf_templates_export.json');

            const filePath = await download.path();
            const content = fs.readFileSync(filePath, 'utf-8');
            const data = JSON.parse(content);
            expect(data.version).toBe('1');
            expect(data.templates.length).toBeGreaterThanOrEqual(1);
        }
    });
});
