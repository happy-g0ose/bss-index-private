const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'dist', 'api', 'v1', 'docs.html');
const html = fs.readFileSync(file, 'utf8');

const tags = ['html', 'head', 'body', 'div', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'ul', 'li', 'pre', 'code', 'p', 'h1', 'h2', 'h3', 'h4', 'header', 'footer', 'span', 'style'];
let bad = 0;
for (const t of tags) {
  const open = (html.match(new RegExp(`<${t}(\\s|>)`, 'g')) || []).length;
  const close = (html.match(new RegExp(`</${t}>`, 'g')) || []).length;
  if (open !== close) {
    bad++;
    console.log(`  MISMATCH <${t}>: ${open} open vs ${close} close`);
  }
}
console.log(bad === 0 ? 'HTML tags balanced' : `${bad} tag mismatch(es)`);

console.log('size:', (Buffer.byteLength(html, 'utf8') / 1024).toFixed(1), 'KB');
console.log('has doctype:', html.startsWith('<!doctype html>'));
console.log('charset meta:', /<meta charset="utf-8">/.test(html));
console.log('viewport meta:', /name="viewport"/.test(html));
console.log('canonical link:', /rel="canonical"/.test(html));
console.log('no <script>:', !/<script/i.test(html));
console.log('no external http(s) resources:', !/(src|href)="https?:\/\/(?!bss-index)/i.test(html));
console.log('no template placeholders left:', !/\$\{/.test(html) && !/undefined/.test(html));
console.log('lang attr:', /<html lang="en">/.test(html));

// Plain-text preview of the visible content
const text = html
  .replace(/<style[\s\S]*?<\/style>/g, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&quot;/g, '"')
  .replace(/&amp;/g, '&')
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&#39;/g, "'")
  .replace(/\s+/g, ' ')
  .trim();
console.log('\n--- visible text (first 1400 chars) ---\n');
console.log(text.slice(0, 1400));
console.log('\n--- visible text (last 700 chars) ---\n');
console.log(text.slice(-700));
