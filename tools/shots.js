// 面の盤面を画像にする。使い方：node tools/shots.js 写しのフォルダ 面の番号（,区切り） [出力フォルダ] [--dark]
// 出力：出力フォルダ/面の番号.png（盤面だけを切りぬいたもの。2倍の細かさ）。並べるときは tools/grid.py を使う
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const dir = process.argv[2];
  const list = process.argv[3].split(',').map(Number);
  const outDir = process.argv[4] && !process.argv[4].startsWith('--') ? process.argv[4] : dir;
  const dark = process.argv.includes('--dark');
  require('fs').mkdirSync(outDir, {recursive: true});
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 420, height: 760 }, deviceScaleFactor: 2, colorScheme: dark ? 'dark' : 'light' });
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto('file://' + path.resolve(dir) + '/test.html');
  await page.waitForTimeout(300);
  for (const n of list) {
    await page.evaluate(n => { window.__T.startGame(n); }, n);
    await page.waitForTimeout(150);
    await page.screenshot({ path: path.join(outDir, n + '.png'), clip: {x: 16, y: 140, width: 388, height: 330} });
  }
  console.log(errs.length ? errs : 'no errors');
  await browser.close();
})();
