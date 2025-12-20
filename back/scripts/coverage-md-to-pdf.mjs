import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function convertToPDF() {
  const mdPath = path.join(process.cwd(), 'coverage', 'coverage-report.md');
  
  if (!fs.existsSync(mdPath)) {
    console.error('❌ Markdown report not found.');
    console.log('   Run "pnpm coverage:md" first to generate the markdown report.');
    process.exit(1);
  }

  try {
    console.log('📦 Loading dependencies...');
    
    // Dynamic imports para ESM modules
    const { marked } = await import('marked');
    const puppeteer = await import('puppeteer');

    console.log('📄 Converting Markdown to PDF...');

    const md = fs.readFileSync(mdPath, 'utf8');
    const htmlContent = await marked.parse(md);
    
    const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Coverage Report</title>
    <style>
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
        padding: 40px;
        max-width: 1200px;
        margin: 0 auto;
        line-height: 1.6;
        color: #333;
      }
      h1 {
        color: #2c3e50;
        border-bottom: 3px solid #3498db;
        padding-bottom: 10px;
      }
      h2 {
        color: #34495e;
        margin-top: 30px;
        border-bottom: 2px solid #ecf0f1;
        padding-bottom: 8px;
      }
      h3 {
        color: #555;
        margin-top: 20px;
      }
      table {
        border-collapse: collapse;
        width: 100%;
        margin: 20px 0;
        font-size: 14px;
      }
      table th, table td {
        border: 1px solid #ddd;
        padding: 10px 12px;
        text-align: left;
      }
      table th {
        background: #3498db;
        color: white;
        font-weight: 600;
      }
      table tr:nth-child(even) {
        background: #f9f9f9;
      }
      table tr:hover {
        background: #f0f8ff;
      }
      code {
        background: #f4f4f4;
        padding: 2px 6px;
        border-radius: 3px;
        font-family: 'Courier New', Courier, monospace;
        font-size: 13px;
      }
      pre {
        background: #f6f8fa;
        padding: 16px;
        border-radius: 6px;
        overflow-x: auto;
      }
      hr {
        border: none;
        border-top: 1px solid #e1e4e8;
        margin: 30px 0;
      }
      ul, ol {
        padding-left: 20px;
      }
      li {
        margin: 8px 0;
      }
      blockquote {
        border-left: 4px solid #3498db;
        padding-left: 16px;
        color: #666;
        margin: 16px 0;
      }
      strong {
        color: #2c3e50;
      }
      .page-break {
        page-break-after: always;
      }
    </style>
  </head>
  <body>${htmlContent}</body>
</html>`;

    const outPdf = path.join(process.cwd(), 'coverage', 'coverage-report.pdf');
    
    console.log('🚀 Launching browser...');
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    
    console.log('📝 Generating PDF...');
    await page.pdf({
      path: outPdf,
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20mm',
        right: '15mm',
        bottom: '20mm',
        left: '15mm'
      }
    });
    
    await browser.close();
    
    console.log(`\n✅ PDF report generated: coverage/coverage-report.pdf`);
    console.log(`   Size: ${(fs.statSync(outPdf).size / 1024).toFixed(2)} KB\n`);
  } catch (err) {
    console.error('❌ Error generating PDF:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

// Ejecutar
convertToPDF();
