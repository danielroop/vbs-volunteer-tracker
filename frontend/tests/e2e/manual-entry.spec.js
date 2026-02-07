import { test, expect } from '@playwright/test';
import { exec } from 'child_process';
import util from 'util';
import path from 'path';
import { fileURLToPath } from 'url';

const execAsync = util.promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('Manual Time Entry', () => {
    // Setup admin user before tests run
    test.beforeAll(async () => {
        console.log('Running admin setup script...');
        try {
            // Run from project root
            const scriptPath = path.resolve(__dirname, '../../../scripts/setup-admin.js');
            await execAsync(`node "${scriptPath}"`);
            console.log('Admin setup complete.');
        } catch (error) {
            console.error('Failed to setup admin:', error);
            throw error;
        }
    });

    test.beforeEach(async ({ page }) => {
        // 1. Login
        await page.goto('/login');
        await page.fill('input[type="email"]', 'admin@vbstrack.local');
        await page.fill('input[type="password"]', 'Admin123!VBS');
        await page.click('button:has-text("Sign In")');

        // Wait for navigation to complete (dashboard or event selection)
        await page.waitForURL(/admin|events/);
    });

    test('should create a manual time entry with correct activity defaults', async ({ page }) => {
        // 2. Ensure the correct event is selected
        console.log('Navigating to Events page to ensure correct event selection...');
        await page.goto('/admin/events');

        page.on('console', msg => console.log('PAGE LOG:', msg.text()));

        const eventName = `E2E Test Event ${Date.now()}`;
        console.log(`Creating new event: ${eventName}`);

        const createBtn = page.getByRole('button', { name: '+ Create New Event' });
        await createBtn.waitFor({ state: 'visible', timeout: 10000 });
        await createBtn.click();

        await page.fill('input[placeholder="e.g. VBS 2026"]', eventName);
        await page.fill('input[placeholder="e.g. Church Name"]', 'Test Org');

        // Configure Activity 1
        const activities = page.locator('.space-y-3 > div');
        await activities.nth(0).locator('input[placeholder="Activity Name"]').fill('Morning Shift');
        await activities.nth(0).locator('input[type="time"]').first().fill('09:00');
        await activities.nth(0).locator('input[type="time"]').last().fill('11:00');

        // Add Activity 2
        await page.click('button:has-text("+ ADD BUCKET")');
        await activities.nth(1).locator('input[placeholder="Activity Name"]').fill('Afternoon Shift');
        await activities.nth(1).locator('input[type="time"]').first().fill('13:00');
        await activities.nth(1).locator('input[type="time"]').last().fill('15:00');

        await page.click('button:has-text("Save Event")');
        // Wait for modal to close
        await expect(page.locator('div[role="dialog"]')).toBeHidden();

        // Select the newly created event
        // Use more specific selector to avoid matching parent containers
        const targetEventCard = page.locator('div.bg-white.rounded-2xl', { hasText: eventName }).first();
        const selectBtn = targetEventCard.getByRole('button', { name: 'Select Event' });

        // It should definitely act as "Select Event" because we just created it and didn't select it?
        // Wait, does creating auto-select? No.
        await selectBtn.waitFor({ state: 'visible', timeout: 5000 });
        await selectBtn.click();

        // Verify header
        await expect(page.locator('header')).toContainText(`Active Event: ${eventName}`);

        // 3. Navigate to Students
        console.log('Navigating to Students...');
        await page.getByRole('link', { name: 'Students' }).click();
        await page.waitForURL(/\/students/);
        await page.waitForSelector('table', { state: 'visible', timeout: 5000 });

        // 4. Create a student if needed
        const noStudents = await page.getByText('No students found').isVisible();
        if (noStudents) {
            console.log('No students found, creating one...');
            await page.click('button:has-text("+ New Student")');
            await page.fill('input[name="firstName"]', 'Test');
            await page.fill('input[name="lastName"]', 'Student');
            await page.selectOption('select[name="gradeLevel"]', '10');
            await page.click('button:has-text("Add Student")');
            await page.waitForTimeout(1000); // Wait for list refresh
        }

        // 5. Click on the first student's "View Detail" button
        console.log('Selecting first student...');
        // The row itself isn't clickable, we must click the button
        const firstRow = page.locator('tbody tr').first();
        await expect(firstRow).toBeVisible();
        await firstRow.getByRole('button', { name: /View Detail/i }).click();

        // Wait for details page
        await page.waitForURL(/\/students\//);
        console.log('Navigated to student details page.');
        // await page.screenshot({ path: 'student-details-debug.png' });

        // 6. Click "+ Add Time Entry"
        console.log('Clicking + Add Time Entry...');
        await page.waitForTimeout(1000);
        const addBtn = page.getByRole('button', { name: '+ Add Time Entry' });
        await expect(addBtn).toBeVisible({ timeout: 5000 });
        await addBtn.click();

        // 7. Verify defaults for first activity (Morning Shift)
        // Target the modal container that has the title
        const modal = page.locator('.bg-white.rounded-lg.shadow-xl', { hasText: 'Log Manual Hours' });
        await expect(modal).toBeVisible();

        // Check Time Inputs
        console.log('Verifying default times...');
        await expect(modal.locator('input[type="time"]').first()).toHaveValue('09:00');
        await expect(modal.locator('input[type="time"]').last()).toHaveValue('11:00');

        // 8. Change Activity
        console.log('Changing activity...');
        await modal.locator('select').selectOption({ label: 'Afternoon Shift' });

        // 9. Verify defaults updated (13:00 - 15:00)
        console.log('Verifying updated times...');
        await expect(modal.locator('input[type="time"]').first()).toHaveValue('13:00');
        await expect(modal.locator('input[type="time"]').last()).toHaveValue('15:00');

        // 10. Save and Verify
        console.log('Saving entry...');
        await page.click('button:has-text("Save Entry")');
        await expect(modal).toBeHidden({ timeout: 10000 });

        // Verify row added
        const timeTable = page.locator('table').filter({ hasText: 'Hours' });
        await expect(timeTable).toContainText('Afternoon Shift');
        await expect(timeTable).toContainText('2.00');
    });
});
