
import { test, expect } from '@playwright/test';

import * as fs from 'fs';

test('File Upload and Playback Verification', async ({ page }) => {
  // Capture and log console output from the browser to a file
  page.on('console', msg => {
    fs.appendFileSync('console.log', `[Browser Console] ${msg.type()}: ${msg.text()}\n`);
  });

  await page.goto('http://localhost:5174');

  // Wait for the file input to be enabled
  const fileInput = page.locator('#file-input');
  await expect(fileInput).toBeEnabled({ timeout: 10000 });

  // Upload a file
  await fileInput.setInputFiles('public/4-mat_-_space_debris.mod');

  // Wait for the module to be loaded and controls to be enabled
  const playButton = page.locator('#play-button');
  await expect(playButton).toBeEnabled({ timeout: 10000 });

  // Click the play button
  await playButton.click();

  // Wait for the UI to update and show an active step light.
  // This is more robust than a fixed timeout.
  await expect(async () => {
    // The active light has a specific background color and box shadow.
    const activeLight = page.locator('div[style*="background-color: rgba(255, 223, 186, 0.8)"]');
    // We expect exactly one light to be active at a time.
    await expect(activeLight).toHaveCount(1);
  }).toPass({
    timeout: 5000 // Total timeout for the polling
  });

  // Take a screenshot to verify the UI state
  await page.screenshot({ path: 'screenshot.png' });

  // Check if VU meters are displaying data by waiting for any meter to have a non-zero height.
  await expect(async () => {
    const activeMeters = page.locator('div[style*="height:"][style*="%"]');
    const allMeters = await activeMeters.all();
    let hasActiveMeter = false;
    const heights = [];
    for (const meter of allMeters) {
      const style = await meter.getAttribute('style');
      heights.push(style);
      const heightMatch = style?.match(/height:\s*([0-9.]+)%/);
      if (heightMatch && parseFloat(heightMatch[1]) > 0) {
        hasActiveMeter = true;
        break;
      }
    }
    console.log('VU meter styles:', heights);
    expect(hasActiveMeter).toBe(true);
  }).toPass({
    timeout: 5000
  });
});
