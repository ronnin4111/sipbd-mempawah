const { chromium } = require('playwright');
const path = require('path');

async function screenshot(htmlFile, pngFile) {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  const filePath = path.resolve(__dirname, htmlFile);
  await page.goto(`file://${filePath}`, { waitUntil: 'networkidle', timeout: 30000 });
  
  // Wait for fonts to load
  await page.waitForTimeout(2000);
  
  // Get the full body dimensions
  const bodyBox = await page.evaluate(() => {
    const body = document.body;
    return { width: body.scrollWidth, height: body.scrollHeight };
  });
  
  await page.setViewportSize({ width: bodyBox.width, height: bodyBox.height });
  await page.waitForTimeout(500);
  
  await page.screenshot({
    path: path.resolve(__dirname, pngFile),
    fullPage: true,
    deviceScaleFactor: 2,
  });
  
  await browser.close();
  console.log(`✓ ${pngFile} (${bodyBox.width}x${bodyBox.height})`);
}

(async () => {
  await screenshot('workflow-1-system.html', 'workflow-1-system.png');
  await screenshot('workflow-2-user-journey.html', 'workflow-2-user-journey.png');
  await screenshot('workflow-3-data-flow.html', 'workflow-3-data-flow.png');
  await screenshot('workflow-4-api-nav.html', 'workflow-4-api-nav.png');
  console.log('\nAll 4 workflow diagrams rendered!');
})();
