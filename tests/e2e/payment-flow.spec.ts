"""
End-to-end tests for the complete payment flow using Playwright.
Tests the entire user journey from payment creation to confirmation.
"""

import { test, expect } from '@playwright/test';

test.describe('Payment System E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Login as admin user
    await page.goto('http://localhost:8080/auth');

    await page.fill('[data-testid="email-input"]', 'admin@example.com');
    await page.fill('[data-testid="password-input"]', 'password123');
    await page.click('[data-testid="login-button"]');

    // Wait for dashboard to load
    await page.waitForURL('**/dashboard');
    await expect(page.locator('h1')).toContainText('Dashboard');
  });

  test('complete bank transfer payment flow', async ({ page }) => {
    // Navigate to payment test page
    await page.goto('http://localhost:8080/payment-test');
    await expect(page.locator('h1')).toContainText('Payment System Extension');

    // Fill payment form
    await page.selectOption('[data-testid="student-select"]', 'student1');
    await page.selectOption('[data-testid="fee-type-select"]', 'tuition');
    await page.fill('[data-testid="amount-input"]', '5000');
    await page.fill('[data-testid="payment-date-input"]', '2024-01-15');

    // Select bank transfer payment method
    await page.click('[data-testid="payment-method-bank-transfer"]');

    // Wait for bank transfer details to appear
    await expect(page.locator('[data-testid="bank-transfer-details"]')).toBeVisible();

    // Fill bank transfer details
    await page.fill('[data-testid="bank-name-input"]', 'Commercial Bank of Ethiopia');
    await page.fill('[data-testid="bank-code-input"]', '001');
    await page.fill('[data-testid="transaction-number-input"]', 'TXN123456789');

    // Add screenshot (if file input is present)
    const fileInput = page.locator('[data-testid="screenshot-input"]');
    if (await fileInput.isVisible()) {
      const file = 'tests/fixtures/test-screenshot.jpg';
      await fileInput.setInputFiles(file);

      // Wait for upload to complete
      await expect(page.locator('[data-testid="upload-success"]')).toBeVisible({ timeout: 10000 });
    }

    // Submit payment
    await page.click('[data-testid="create-payment-button"]');

    // Wait for success confirmation
    await expect(page.locator('[data-testid="payment-success"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-testid="payment-success"]')).toContainText('Payment created successfully');

    // Verify payment details in success message
    await expect(page.locator('[data-testid="payment-details"]')).toContainText('bank_transfer');
    await expect(page.locator('[data-testid="payment-details"]')).toContainText('Commercial Bank of Ethiopia');
    await expect(page.locator('[data-testid="payment-details"]')).toContainText('TXN123456789');
  });

  test('complete mobile payment flow', async ({ page }) => {
    // Navigate to payment test page
    await page.goto('http://localhost:8080/payment-test');
    await expect(page.locator('h1')).toContainText('Payment System Extension');

    // Fill payment form
    await page.selectOption('[data-testid="student-select"]', 'student2');
    await page.selectOption('[data-testid="fee-type-select"]'), 'exam_fee');
    await page.fill('[data-testid="amount-input"]', '2500');
    await page.fill('[data-testid="payment-date-input"]', '2024-01-16');

    // Select mobile payment method
    await page.click('[data-testid="payment-method-mobile-payment"]');

    // Wait for mobile payment details to appear
    await expect(page.locator('[data-testid="mobile-payment-details"]')).toBeVisible();

    // Fill mobile payment details
    await page.fill('[data-testid="transaction-id-input"]', 'MP987654321');

    // Submit payment
    await page.click('[data-testid="create-payment-button"]');

    // Wait for success confirmation
    await expect(page.locator('[data-testid="payment-success"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-testid="payment-success"]')).toContainText('Payment created successfully');

    // Verify payment details
    await expect(page.locator('[data-testid="payment-details"]')).toContainText('mobile_payment');
    await expect(page.locator('[data-testid="payment-details"]')).toContainText('MP987654321');
  });

  test('online payment flow with conditional styling', async ({ page }) => {
    // Navigate to payment test page
    await page.goto('http://localhost:8080/payment-test');

    // Fill payment form
    await page.selectOption('[data-testid="student-select"]', 'student3');
    await page.selectOption('[data-testid="fee-type-select"]', 'library_fee');
    await page.fill('[data-testid="amount-input"]', '1000');
    await page.fill('[data-testid="payment-date-input"]', '2024-01-17');

    // Select online payment method
    await page.click('[data-testid="payment-method-online-payment"]');

    // Verify online payment specific styling
    await expect(page.locator('[data-testid="mobile-payment-details"]')).toHaveClass(/purple/);
    await expect(page.locator('[data-testid="payment-method-label"]')).toContainText('Online Payment');

    // Fill online payment details
    await page.fill('[data-testid="transaction-id-input"]', 'PAY123456789');

    // Submit payment
    await page.click('[data-testid="create-payment-button"]');

    // Wait for success
    await expect(page.locator('[data-testid="payment-success"]')).toBeVisible({ timeout: 15000 });
  });

  test('cash payment flow (backward compatibility)', async ({ page }) => {
    // Navigate to payment test page
    await page.goto('http://localhost:8080/payment-test');

    // Fill payment form
    await page.selectOption('[data-testid="student-select"]', 'student1');
    await page.selectOption('[data-testid="fee-type-select"]', 'tuition');
    await page.fill('[data-testid="amount-input"]', '5000');
    await page.fill('[data-testid="payment-date-input"]', '2024-01-18');

    // Select cash payment method
    await page.click('[data-testid="payment-method-cash"]');

    // Verify no method-specific fields are shown
    await expect(page.locator('[data-testid="bank-transfer-details"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="mobile-payment-details"]')).not.toBeVisible();

    // Add notes
    await page.fill('[data-testid="notes-input"]', 'Cash payment received in person');

    // Submit payment
    await page.click('[data-testid="create-payment-button"]');

    // Wait for success
    await expect(page.locator('[data-testid="payment-success"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-testid="payment-details"]')).toContainText('cash');
  });

  test('form validation errors', async ({ page }) => {
    // Navigate to payment test page
    await page.goto('http://localhost:8080/payment-test');

    // Try to submit empty form
    await page.click('[data-testid="create-payment-button"]');

    // Verify validation errors appear
    await expect(page.locator('[data-testid="error-student"]')).toBeVisible();
    await expect(page.locator('[data-testid="error-fee-type"]')).toBeVisible();
    await expect(page.locator('[data-testid="error-amount"]')).toBeVisible();

    // Fill some fields and try bank transfer validation
    await page.selectOption('[data-testid="student-select"]', 'student1');
    await page.selectOption('[data-testid="fee-type-select"]', 'tuition');
    await page.fill('[data-testid="amount-input"]', '5000');
    await page.click('[data-testid="payment-method-bank-transfer"]');

    // Try to submit without bank details
    await page.click('[data-testid="create-payment-button"]');

    // Verify bank transfer validation errors
    await expect(page.locator('[data-testid="error-bank-name"]')).toBeVisible();
    await expect(page.locator('[data-testid="error-transaction-number"]')).toBeVisible();
  });

  test('file upload functionality', async ({ page }) => {
    // Navigate to payment test page
    await page.goto('http://localhost:8080/payment-test');

    // Fill form and select bank transfer
    await page.selectOption('[data-testid="student-select"]', 'student1');
    await page.selectOption('[data-testid="fee-type-select"]', 'tuition');
    await page.fill('[data-testid="amount-input"]', '5000');
    await page.click('[data-testid="payment-method-bank-transfer"]');

    // Fill bank details
    await page.fill('[data-testid="bank-name-input"]', 'Test Bank');
    await page.fill('[data-testid="transaction-number-input"]', 'TXN123');

    // Test file upload
    const fileInput = page.locator('[data-testid="screenshot-input"]');
    const file = 'tests/fixtures/test-screenshot.jpg';

    await fileInput.setInputFiles(file);

    // Wait for upload progress and success
    await expect(page.locator('[data-testid="upload-progress"]')).toBeVisible();
    await expect(page.locator('[data-testid="upload-success"]')).toBeVisible({ timeout: 10000 });

    // Verify uploaded file preview
    await expect(page.locator('[data-testid="file-preview"]')).toBeVisible();
    await expect(page.locator('[data-testid="view-file-link"]')).toBeVisible();

    // Test file removal
    await page.click('[data-testid="remove-file-button"]');
    await expect(page.locator('[data-testid="file-preview"]')).not.toBeVisible();
  });

  test('file upload validation', async ({ page }) => {
    // Navigate to payment test page
    await page.goto('http://localhost:8080/payment-test');

    // Set up for file upload test
    await page.selectOption('[data-testid="student-select"]', 'student1');
    await page.selectOption('[data-testid="fee-type-select"]', 'tuition');
    await page.fill('[data-testid="amount-input"]', '5000');
    await page.click('[data-testid="payment-method-bank-transfer"]');

    const fileInput = page.locator('[data-testid="screenshot-input"]');

    // Test invalid file type
    await fileInput.setInputFiles('tests/fixtures/test-document.txt');
    await expect(page.locator('[data-testid="error-file-type"]')).toBeVisible();

    // Test oversized file (mock large file)
    const largeFile = 'tests/fixtures/large-image.jpg'; // This would be a large file in fixtures
    await fileInput.setInputFiles(largeFile);
    await expect(page.locator('[data-testid="error-file-size"]')).toBeVisible();
  });

  test('payment method switching preserves basic data', async ({ page }) => {
    // Navigate to payment test page
    await page.goto('http://localhost:8080/payment-test');

    // Fill basic fields
    await page.selectOption('[data-testid="student-select"]', 'student1');
    await page.selectOption('[data-testid="fee-type-select"]', 'tuition');
    await page.fill('[data-testid="amount-input"]', '5000');
    await page.fill('[data-testid="notes-input"]', 'Test notes');

    // Switch between payment methods
    await page.click('[data-testid="payment-method-bank-transfer"]');
    await expect(page.locator('[data-testid="bank-transfer-details"]')).toBeVisible();

    // Verify basic fields are preserved
    await expect(page.locator('[data-testid="student-select"]')).toHaveValue('student1');
    await expect(page.locator('[data-testid="amount-input"]')).toHaveValue('5000');
    await expect(page.locator('[data-testid="notes-input"]')).toHaveValue('Test notes');

    // Switch to mobile payment
    await page.click('[data-testid="payment-method-mobile-payment"]');
    await expect(page.locator('[data-testid="mobile-payment-details"]')).toBeVisible();
    await expect(page.locator('[data-testid="bank-transfer-details"]')).not.toBeVisible();

    // Basic fields should still be preserved
    await expect(page.locator('[data-testid="student-select"]')).toHaveValue('student1');
    await expect(page.locator('[data-testid="amount-input"]')).toHaveValue('5000');
  });

  test('cancel payment creation', async ({ page }) => {
    // Navigate to payment test page
    await page.goto('http://localhost:8080/payment-test');

    // Fill some form data
    await page.selectOption('[data-testid="student-select"]', 'student1');
    await page.fill('[data-testid="amount-input"]', '5000');

    // Click cancel button
    await page.click('[data-testid="cancel-button"]');

    // Should navigate back to payments page
    await page.waitForURL('**/payments');
    await expect(page.locator('h1')).toContainText('Payments');
  });

  test('responsive design on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    // Navigate to payment test page
    await page.goto('http://localhost:8080/payment-test');

    // Verify mobile layout
    await expect(page.locator('[data-testid="payment-form"]')).toBeVisible();

    // Check that form is properly laid out on mobile
    await expect(page.locator('[data-testid="form-container"]')).toHaveCSS('display', 'block');

    // Test mobile-specific interactions
    await page.click('[data-testid="payment-method-mobile-payment"]');
    await expect(page.locator('[data-testid="mobile-payment-details"]')).toBeVisible();
  });

  test('accessibility compliance', async ({ page }) => {
    // Navigate to payment test page
    await page.goto('http://localhost:8080/payment-test');

    // Check for proper labels and ARIA attributes
    await expect(page.locator('[data-testid="student-select"]')).toHaveAttribute('aria-label');
    await expect(page.locator('[data-testid="amount-input"]')).toHaveAttribute('aria-label');

    // Test keyboard navigation
    await page.keyboard.press('Tab');
    await expect(page.locator(':focus')).toBeVisible();

    // Test form submission with Enter key
    await page.selectOption('[data-testid="student-select"]', 'student1');
    await page.fill('[data-testid="amount-input"]', '5000');
    await page.focus('[data-testid="create-payment-button"]');
    await page.keyboard.press('Enter');

    // Should attempt submission (may fail validation, but form should respond)
    await expect(page.locator('[data-testid="create-payment-button"]')).toBeVisible();
  });
});

test.describe('Payment System Error Handling', () => {
  test('handles network errors gracefully', async ({ page }) => {
    // Mock network failure
    await page.route('**/api/payments/extended', route => route.abort());

    // Login and navigate to payment test page
    await page.goto('http://localhost:8080/auth');
    await page.fill('[data-testid="email-input"]', 'admin@example.com');
    await page.fill('[data-testid="password-input"]', 'password123');
    await page.click('[data-testid="login-button"]');
    await page.waitForURL('**/dashboard');

    await page.goto('http://localhost:8080/payment-test');

    // Fill and submit form
    await page.selectOption('[data-testid="student-select"]', 'student1');
    await page.fill('[data-testid="amount-input"]', '5000');
    await page.click('[data-testid="payment-method-cash"]');
    await page.click('[data-testid="create-payment-button"]');

    // Should show network error message
    await expect(page.locator('[data-testid="network-error"]')).toBeVisible({ timeout: 10000 });
  });

  test('handles server errors gracefully', async ({ page }) => {
    // Mock server error response
    await page.route('**/api/payments/extended', route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ detail: 'Internal server error' })
      });
    });

    // Login and navigate
    await page.goto('http://localhost:8080/auth');
    await page.fill('[data-testid="email-input"]', 'admin@example.com');
    await page.fill('[data-testid="password-input"]', 'password123');
    await page.click('[data-testid="login-button"]');
    await page.waitForURL('**/dashboard');

    await page.goto('http://localhost:8080/payment-test');

    // Fill and submit form
    await page.selectOption('[data-testid="student-select"]', 'student1');
    await page.fill('[data-testid="amount-input"]', '5000');
    await page.click('[data-testid="payment-method-cash"]');
    await page.click('[data-testid="create-payment-button"]');

    // Should show server error message
    await expect(page.locator('[data-testid="server-error"]')).toBeVisible({ timeout: 10000 });
  });
});