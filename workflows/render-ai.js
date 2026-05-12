const { chromium } = require('playwright');
const path = require('path');

async function screenshot(htmlFile, pngFile) {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const filePath = path.resolve(__dirname, htmlFile);
  await page.goto(`file://${filePath}`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);
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
  await screenshot('workflow-5-ai-roadmap.html', 'workflow-5-ai-roadmap.png');
  console.log('AI Roadmap diagram rendered!');
})();
