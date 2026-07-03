/**
 * Converts docs/FLOWCHART.md to PDF with rendered Mermaid diagrams.
 * Run: npm run docs:flowchart-pdf
 *
 * Requires: puppeteer, marked (devDependencies)
 */

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { marked } from "marked";
import puppeteer from "puppeteer";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");
const mdPath = join(rootDir, "docs", "FLOWCHART.md");
const pdfPath = join(rootDir, "docs", "FLOWCHART.pdf");

// Custom renderer: output mermaid code blocks as <div class="mermaid"> for rendering
const renderer = new marked.Renderer();
const originalCode = renderer.code.bind(renderer);
renderer.code = function (code, language) {
  if (language === "mermaid") {
    return `<div class="mermaid">\n${code}\n</div>\n`;
  }
  return originalCode(code, language);
};

marked.setOptions({ renderer });

const md = readFileSync(mdPath, "utf-8");
const bodyHtml = marked.parse(md);

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Workzen HRIS – Application & User Flow</title>
  <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; line-height: 1.6; max-width: 900px; margin: 0 auto; padding: 2rem; color: #1a1a1a; }
    h1 { font-size: 1.75rem; border-bottom: 2px solid #333; padding-bottom: 0.5rem; }
    h2 { font-size: 1.25rem; margin-top: 2rem; color: #333; }
    table { border-collapse: collapse; width: 100%; margin: 1rem 0; }
    th, td { border: 1px solid #ccc; padding: 0.5rem 0.75rem; text-align: left; }
    th { background: #f5f5f5; }
    .mermaid { margin: 1.5rem 0; text-align: center; }
    .mermaid svg { max-width: 100%; height: auto; }
    hr { border: none; border-top: 1px solid #ddd; margin: 2rem 0; }
    code { background: #f0f0f0; padding: 0.2em 0.4em; border-radius: 4px; font-size: 0.9em; }
    pre { background: #f5f5f5; padding: 1rem; overflow-x: auto; border-radius: 6px; }
    p { margin: 0.75rem 0; }
    strong { font-weight: 600; }
  </style>
</head>
<body>
${bodyHtml}
  <script>
    mermaid.initialize({ startOnLoad: true, theme: 'neutral', securityLevel: 'loose' });
  </script>
</body>
</html>`;

async function main() {
  const browser = await puppeteer.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    await page.evaluate(async () => {
      const diagrams = document.querySelectorAll(".mermaid");
      for (const div of diagrams) {
        const code = div.textContent;
        try {
          const { svg } = await mermaid.render("mermaid-" + Math.random().toString(36).slice(2), code);
          div.innerHTML = svg;
        } catch (e) {
          div.innerHTML = "<pre style='color:red'>" + (e.message || "Diagram error") + "</pre>";
        }
      }
    });
    await page.pdf({
      path: pdfPath,
      format: "A4",
      printBackground: true,
      margin: { top: "20mm", right: "15mm", bottom: "20mm", left: "15mm" },
    });
    console.log("PDF written to:", pdfPath);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
