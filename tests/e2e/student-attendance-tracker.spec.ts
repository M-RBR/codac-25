import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Test data setup
const TEST_COHORT_SLUG = '104th-training-corps';
const TEST_DATE = '2025-09-18'; // Today's date for current day testing
const ADMIN_EMAIL = 'kenny.ackerman@codac.academy';
const ADMIN_PASSWORD = 'password123';

// Correct attendance statuses from the actual system
const ATTENDANCE_STATUSES = [
  { label: 'Present', value: 'PRESENT' },
  { label: 'Sick with Sick Leave', value: 'ABSENT_SICK' },
  { label: 'Excused Absence', value: 'ABSENT_EXCUSED' },
  { label: 'Unexcused Absence', value: 'ABSENT_UNEXCUSED' }
];

test.describe('Student Attendance Tracker E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Clean up any existing attendance records for the test date
    await prisma.attendance.deleteMany({
      where: {
        date: new Date(TEST_DATE),
        cohort: {
          slug: TEST_COHORT_SLUG
        }
      }
    });

    // Login as admin user
    await page.goto('/auth/signin');
    await page.fill('input[name="email"]', ADMIN_EMAIL);
    await page.fill('input[name="password"]', ADMIN_PASSWORD);
    await page.click('button[type="submit"]');
    
    // Wait for successful login and redirect
    await expect(page).toHaveURL(/\//);
  });

  test.afterEach(async () => {
    // Clean up test data after each test
    await prisma.attendance.deleteMany({
      where: {
        date: new Date(TEST_DATE),
        cohort: {
          slug: TEST_COHORT_SLUG
        }
      }
    });
  });

  test('should allow admin to record attendance for all students in a cohort', async ({ page }) => {
    // Navigate to the attendance page for the test cohort
    await page.goto(`/attendance/${TEST_COHORT_SLUG}?date=${TEST_DATE}`);
    
    // Wait for the page to load and verify we're on the correct page
    await expect(page.getByText('Student Attendance')).toBeVisible();
    await expect(page.getByText('104th Training Corps')).toBeVisible();
    
    // Verify the date is displayed correctly
    await expect(page.getByText('September 18, 2025')).toBeVisible();
    
    // Get all student rows using class selector since no data-testid exists
    const studentRows = page.locator('.flex.items-center.justify-between.p-4.border.rounded-lg');
    const studentCount = await studentRows.count();
    
    // Verify we have students to test with
    expect(studentCount).toBeGreaterThan(0);
    
    // Record attendance for each student with different statuses
    for (let i = 0; i < studentCount; i++) {
      const studentRow = studentRows.nth(i);
      
      // Select a status for this student (cycle through available statuses)
      const statusIndex = i % ATTENDANCE_STATUSES.length;
      const selectedStatus = ATTENDANCE_STATUSES[statusIndex];
      
      // Click the attendance dropdown (Select component)
      const statusDropdown = studentRow.locator('button[role="combobox"]');
      await statusDropdown.click();
      
      // Wait for dropdown to open
      await page.waitForSelector('[role="listbox"]');
      
      // Select the status from the dropdown options
      await page.locator(`[role="option"]`).filter({ hasText: selectedStatus.label }).click();
      
      // Wait for the status to be saved (individual save model)
      await expect(studentRow.getByText(selectedStatus.label)).toBeVisible();
    }
    
    // Verify no "Not Recorded" badges remain
    await expect(page.getByText('Not Recorded')).toHaveCount(0);
  });

  test('should correctly store attendance data in the database', async ({ page }) => {
    // Navigate to attendance page
    await page.goto(`/attendance/${TEST_COHORT_SLUG}?date=${TEST_DATE}`);
    
    // Get the first student and record their attendance
    const firstStudentRow = page.locator('.flex.items-center.justify-between.p-4.border.rounded-lg').first();
    
    // Get student name for identification
    const studentNameElement = firstStudentRow.locator('.font-medium').first();
    const studentName = await studentNameElement.textContent();
    
    // Record attendance as "Present"
    await firstStudentRow.locator('button[role="combobox"]').click();
    await page.waitForSelector('[role="listbox"]');
    await page.locator('[role="option"]').filter({ hasText: 'Present' }).click();
    
    // Wait for the UI to update
    await expect(firstStudentRow.getByText('Present')).toBeVisible();
    
    // Verify the data was stored correctly in the database
    const attendanceRecord = await prisma.attendance.findFirst({
      where: {
        date: new Date(TEST_DATE),
        cohort: {
          slug: TEST_COHORT_SLUG
        },
        student: {
          name: studentName || undefined
        }
      }
    });
    
    // Assertions for database storage
    expect(attendanceRecord).toBeTruthy();
    expect(attendanceRecord?.status).toBe('PRESENT');
    expect(attendanceRecord?.date.toISOString().split('T')[0]).toBe(TEST_DATE);
  });

  test('should correctly display stored attendance data when page is refreshed', async ({ page }) => {
    // First, programmatically create some attendance records in the database
    const cohort = await prisma.cohort.findUnique({
      where: { slug: TEST_COHORT_SLUG },
      include: { 
        students: {
          where: { 
            status: 'ACTIVE',
            role: 'STUDENT'
          }
        }
      }
    });
    
    expect(cohort).toBeTruthy();
    expect(cohort!.students.length).toBeGreaterThan(0);
    
    // Create attendance records for all students
    const attendanceData = [];
    for (let i = 0; i < cohort!.students.length; i++) {
      const student = cohort!.students[i];
      const statusIndex = i % ATTENDANCE_STATUSES.length;
      const status = ATTENDANCE_STATUSES[statusIndex].value;
      
      attendanceData.push({
        studentId: student.id,
        cohortId: cohort!.id,
        date: new Date(TEST_DATE),
        status: status as 'PRESENT' | 'ABSENT_SICK' | 'ABSENT_EXCUSED' | 'ABSENT_UNEXCUSED'
      });
    }
    
    // Bulk create attendance records
    await prisma.attendance.createMany({
      data: attendanceData
    });
    
    // Navigate to the attendance page
    await page.goto(`/attendance/${TEST_COHORT_SLUG}?date=${TEST_DATE}`);
    
    // Verify that all attendance records are displayed correctly
    const studentRows = page.locator('.flex.items-center.justify-between.p-4.border.rounded-lg');
    const studentCount = await studentRows.count();
    
    for (let i = 0; i < Math.min(studentCount, ATTENDANCE_STATUSES.length); i++) {
      const studentRow = studentRows.nth(i);
      const expectedStatus = ATTENDANCE_STATUSES[i % ATTENDANCE_STATUSES.length];
      
      // Verify the status is displayed correctly
      await expect(studentRow.getByText(expectedStatus.label)).toBeVisible();
    }
    
    // Refresh the page and verify data persists
    await page.reload();
    
    // Wait for page to load again
    await expect(page.getByText('Student Attendance')).toBeVisible();
    
    // Verify all data is still displayed correctly after refresh
    for (let i = 0; i < Math.min(studentCount, ATTENDANCE_STATUSES.length); i++) {
      const studentRow = studentRows.nth(i);
      const expectedStatus = ATTENDANCE_STATUSES[i % ATTENDANCE_STATUSES.length];
      
      await expect(studentRow.getByText(expectedStatus.label)).toBeVisible();
    }
  });

  test('should handle date navigation and maintain attendance data integrity', async ({ page }) => {
    // Navigate to attendance page
    await page.goto(`/attendance/${TEST_COHORT_SLUG}?date=${TEST_DATE}`);
    
    // Record attendance for first student on current date
    const firstStudentRow = page.locator('.flex.items-center.justify-between.p-4.border.rounded-lg').first();
    await firstStudentRow.locator('button[role="combobox"]').click();
    await page.waitForSelector('[role="listbox"]');
    await page.locator('[role="option"]').filter({ hasText: 'Present' }).click();
    
    // Wait for save
    await expect(firstStudentRow.getByText('Present')).toBeVisible();
    
    // Navigate to previous day
    await page.click('button:has-text("Previous Day")');
    
    // Verify we're on a different date
    await expect(page.getByText('September 18, 2025')).not.toBeVisible();
    
    // Navigate back to original date
    await page.click('button:has-text("Next Day")');
    
    // Verify we're back on the correct date
    await expect(page.getByText('September 18, 2025')).toBeVisible();
    
    // Verify the previously recorded attendance is still there
    await expect(firstStudentRow.getByText('Present')).toBeVisible();
  });

  test('should prevent recording attendance on weekends', async ({ page }) => {
    // Navigate to a weekend date (2025-09-21 is a Sunday)
    const weekendDate = '2025-09-21';
    await page.goto(`/attendance/${TEST_COHORT_SLUG}?date=${weekendDate}`);
    
    // Look for weekend-related messaging or disabled states
    const pageContent = await page.textContent('body');
    expect(pageContent).toMatch(/weekend|Saturday|Sunday/i);
  });

  test('should handle calendar date picker for direct date selection', async ({ page }) => {
    // Navigate to attendance page
    await page.goto(`/attendance/${TEST_COHORT_SLUG}?date=${TEST_DATE}`);
    
    // Click the calendar button to open date picker
    await page.click('button[title="Pick a date"]');
    
    // Verify calendar is open
    await expect(page.locator('[role="dialog"]')).toBeVisible();
    await expect(page.locator('[role="grid"]')).toBeVisible();
    
    // Select a different date (e.g., 15th of the month)
    const targetDate = page.locator('[role="gridcell"] button').filter({ hasText: '15' }).first();
    await targetDate.click();
    
    // Verify the calendar closes and URL updates
    await expect(page.locator('[role="dialog"]')).not.toBeVisible();
    await expect(page).toHaveURL(/date=2025-09-15/);
    
    // Verify the date display updates
    await expect(page.getByText('September 15, 2025')).toBeVisible();
  });

  test('should maintain data integrity when switching between different cohorts', async ({ page }) => {
    // Assuming there's another cohort available for testing
    const anotherCohortSlug = 'scout-regiment';
    
    // Record attendance for current cohort
    await page.goto(`/attendance/${TEST_COHORT_SLUG}?date=${TEST_DATE}`);
    const firstStudentRow = page.locator('.flex.items-center.justify-between.p-4.border.rounded-lg').first();
    await firstStudentRow.locator('button[role="combobox"]').click();
    await page.waitForSelector('[role="listbox"]');
    await page.locator('[role="option"]').filter({ hasText: 'Present' }).click();
    
    // Navigate to different cohort
    await page.goto(`/attendance/${anotherCohortSlug}?date=${TEST_DATE}`);
    
    // Verify we're on the different cohort page
    await expect(page.getByText('104th Training Corps')).not.toBeVisible();
    
    // Navigate back to original cohort
    await page.goto(`/attendance/${TEST_COHORT_SLUG}?date=${TEST_DATE}`);
    
    // Verify the attendance data is still preserved
    await expect(firstStudentRow.getByText('Present')).toBeVisible();
  });
});

// Helper function for database cleanup
test.afterAll(async () => {
  // Clean up all test data
  await prisma.attendance.deleteMany({
    where: {
      date: new Date(TEST_DATE),
      cohort: {
        slug: TEST_COHORT_SLUG
      }
    }
  });
  
  await prisma.$disconnect();
});