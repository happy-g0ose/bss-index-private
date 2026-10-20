/**
 * Checks the live deployment: endpoints, bundle size and the runtime payload.
 */
import zlib from 'zlib';

const ORIGIN = 'https://bss-index.vercel.app';

async function main() {
  const urls = [
    '/',
    '/data/items.json',
    '/api/values.json',
    '/item/bee-cub/',
    '/ru/item/bee-cub/',
    '/w/bee-cub/',
    '/sitemap.xml',
  ];

  console.log('endpoints:');
  for (const p of urls) {
    try {
      const res = await fetch(ORIGIN + p);
      console.log('  ' + res.status + '  ' + p);
    } catch (e) {
      console.log('  FAIL  ' + p + '  ' + e.message);
    }
  }

  const html = await (await fetch(ORIGIN + '/')).text();
  const m = html.match(/src="\.\/assets\/(index-[^"]+\.js)"/);
  if (m) {
    const buf = Buffer.from(await (await fetch(ORIGIN + '/assets/' + m[1])).arrayBuffer());
    console.log('\nbundle: ' + (buf.length / 1024).toFixed(0) + ' KB raw / ' +
      (zlib.gzipSync(buf, { level: 9 }).length / 1024).toFixed(0) + ' KB gzip');
  } else {
    console.log('\nbundle tag not found');
  }

  const data = Buffer.from(await (await fetch(ORIGIN + '/data/items.json')).arrayBuffer());
  const items = JSON.parse(data.toString());
  console.log('data   : ' + (data.length / 1024).toFixed(0) + ' KB raw / ' +
    (zlib.gzipSync(data, { level: 9 }).length / 1024).toFixed(0) + ' KB gzip, ' + items.length + ' items');
  console.log('sample : ' + JSON.stringify(items[0]).slice(0, 120));
}

main();
