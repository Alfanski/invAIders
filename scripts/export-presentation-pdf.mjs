import { chromium } from 'playwright';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const htmlPath = resolve(__dirname, '..', 'docs', 'presentation.html');
const outputPath = resolve(__dirname, '..', 'docs', 'presentation.pdf');

async function exportPDF() {
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1920, height: 1080 },
  });

  await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle' });

  // Use "Pitch" mode for the concise slide set
  await page.evaluate(() => setMode('pitch'));
  await page.waitForTimeout(300);

  const totalSlides = await page.evaluate(() => getVisibleIndices().length);
  console.log(`Exporting ${totalSlides} slides...`);

  const screenshots = [];
  for (let i = 0; i < totalSlides; i++) {
    await page.evaluate((idx) => {
      currentSlide = idx;
      render();
    }, i);
    await page.waitForTimeout(400);

    // Hide nav chrome for clean export
    await page.evaluate(() => {
      document.querySelector('.nav').style.display = 'none';
      document.querySelector('.mode-toggle').style.display = 'none';
      document.querySelector('.slide-counter').style.display = 'none';
      document.querySelector('.brand-corner').style.display = 'none';
    });

    const buf = await page.screenshot({ type: 'png', fullPage: false });
    screenshots.push(buf);
    console.log(`  Slide ${i + 1}/${totalSlides} captured`);

    // Restore nav for next render cycle
    await page.evaluate(() => {
      document.querySelector('.nav').style.display = '';
      document.querySelector('.mode-toggle').style.display = '';
      document.querySelector('.slide-counter').style.display = '';
      document.querySelector('.brand-corner').style.display = '';
    });
  }

  // Create PDF with one slide per page using a second page
  const pdfPage = await browser.newPage({
    viewport: { width: 1920, height: 1080 },
  });

  const imgTags = screenshots
    .map(
      (buf) =>
        `<div class="slide-page"><img src="data:image/png;base64,${buf.toString('base64')}" /></div>`
    )
    .join('\n');

  await pdfPage.setContent(`
    <html>
    <head><style>
      * { margin: 0; padding: 0; }
      @page { size: 1920px 1080px; margin: 0; }
      .slide-page { page-break-after: always; width: 1920px; height: 1080px; }
      .slide-page:last-child { page-break-after: auto; }
      img { width: 1920px; height: 1080px; display: block; }
    </style></head>
    <body>${imgTags}</body>
    </html>
  `, { waitUntil: 'load' });

  await pdfPage.pdf({
    path: outputPath,
    width: '1920px',
    height: '1080px',
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
    printBackground: true,
    preferCSSPageSize: true,
  });

  await browser.close();
  console.log(`\nPDF saved to: ${outputPath}`);
}

exportPDF().catch((err) => {
  console.error(err);
  process.exit(1);
});
