import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function generateOGImage() {
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1200, height: 630 }
  });

  const htmlPath = join(__dirname, '../public/og-image-generator.html');
  await page.goto(`file://${htmlPath}`);

  const outputPath = join(__dirname, '../public/og-image.png');
  await page.screenshot({
    path: outputPath,
    type: 'png'
  });

  await browser.close();
  console.log('✓ OpenGraph image generated at public/og-image.png');
}

generateOGImage().catch(console.error);
