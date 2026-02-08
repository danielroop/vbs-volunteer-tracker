import { test, expect } from '@playwright/test';
import { exec } from 'child_process';
import util from 'util';
import path from 'path';
import { fileURLToPath } from 'url';

const execAsync = util.promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('Edit Student Feature', () => {
    // Setup admin user before tests run
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
        // Login
        await page.goto('/login');
        await page.fill('input[type="email"]', 'admin@vbstrack.local');
        await page.fill('input[type="password"]', 'Admin123!VBS');
        await page.click('button:has-text("Sign In")');
        await page.waitForURL(/admin|events/);
    });

    test('should edit student details from the detail page', async ({ page }) => {
        // 1. Create an event first
        console.log('Navigating to Events page...');
        await page.goto('/admin/events');

        const eventName = `Edit Student E2E ${Date.now()}`;
        const createBtn = page.getByRole('button', { name: '+ Create New Event' });
        await createBtn.waitFor({ state: 'visible', timeout: 10000 });
        await createBtn.click();

        await page.fill('input[placeholder="e.g. VBS 2026"]', eventName);
        await page.fill('input[placeholder="e.g. Church Name"]', 'Test Org');

        const activities = page.locator('.space-y-3 > div');
        await activities.nth(0).locator('input[placeholder="Activity Name"]').fill('Morning Shift');
        await activities.nth(0).locator('input[type="time"]').first().fill('09:00');
        await activities.nth(0).locator('input[type="time"]').last().fill('11:00');

        await page.click('button:has-text("Save Event")');
        await expect(page.locator('div[role="dialog"]')).toBeHidden();

        // Select the event
        const targetEventCard = page.locator('div.bg-white.rounded-2xl', { hasText: eventName }).first();
        const selectBtn = targetEventCard.getByRole('button', { name: 'Select Event' });
        await selectBtn.waitFor({ state: 'visible', timeout: 5000 });
        await selectBtn.click();
        await expect(page.locator('header')).toContainText(`Active Event: ${eventName}`);

        // 2. Navigate to Students and create a test student
        console.log('Navigating to Students...');
        await page.getByRole('link', { name: 'Students' }).click();
        await page.waitForURL(/\/students/);

        // Create a new student
        console.log('Creating test student...');
        await page.click('button:has-text("+ Add Student")');

        await waitForModalAndFillForm(page, {
            firstName: 'EditTest',
            lastName: 'Original',
            schoolName: 'Original School',
            gradeLevel: '10',
            gradYear: '2028'
        });

        await page.click('button:has-text("Add Student")');
        await page.waitForTimeout(1000);

        // 3. Navigate to the student's detail page
        console.log('Navigating to student detail...');
        // Find the row with our student name and click View Detail
        const studentRow = page.locator('tbody tr', { hasText: 'Original, EditTest' }).first();
        await expect(studentRow).toBeVisible({ timeout: 5000 });
        await studentRow.getByRole('button', { name: /View Detail/i }).click();
        await page.waitForURL(/\/students\//);

        // 4. Verify original student info is shown
        await expect(page.locator('h1')).toContainText('EditTest Original');
        await expect(page.locator('text=Original School')).toBeVisible();

        // 5. Click Edit Student button
        console.log('Clicking Edit Student...');
        const editBtn = page.getByRole('button', { name: 'Edit Student' });
        await expect(editBtn).toBeVisible();
        await editBtn.click();

        // 6. Verify modal opens with current values
        const modal = page.locator('.bg-white.rounded-lg.shadow-xl', { hasText: 'Edit Student' });
        await expect(modal).toBeVisible();

        // Verify form is pre-populated
        const firstNameInput = modal.locator('input').first();
        await expect(firstNameInput).toHaveValue('EditTest');

        // 7. Edit the student's name and school
        console.log('Editing student details...');
        await firstNameInput.fill('EditedFirst');

        const lastNameInput = modal.locator('input').nth(1);
        await lastNameInput.fill('EditedLast');

        const schoolInput = modal.locator('input').nth(2);
        await schoolInput.fill('New School Name');

        // 8. Save changes
        console.log('Saving changes...');
        await modal.getByRole('button', { name: 'Save Changes' }).click();

        // Modal should close
        await expect(modal).toBeHidden({ timeout: 10000 });

        // 9. Verify the updated info is displayed
        await expect(page.locator('h1')).toContainText('EditedFirst EditedLast');
        await expect(page.locator('text=New School Name')).toBeVisible();

        console.log('Edit Student test passed!');
    });
});

async function waitForModalAndFillForm(page, { firstName, lastName, schoolName, gradeLevel, gradYear }) {
    await page.waitForSelector('text=Register Volunteer', { state: 'visible', timeout: 5000 });

    const modal = page.locator('.fixed.inset-0', { hasText: 'Register Volunteer' });

    const inputs = modal.locator('input');
    await inputs.nth(0).fill(firstName);
    await inputs.nth(1).fill(lastName);
    await inputs.nth(2).fill(schoolName);

    if (gradeLevel) {
        await modal.locator('select').selectOption(gradeLevel);
    }

    if (gradYear) {
        await inputs.nth(3).fill(gradYear);
    }
}
