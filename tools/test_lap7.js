// 7周目（601面から）の動きを確かめる。使い方：node tools/test_lap7.js 写しのフォルダ（tools/make_test_page.py で作ったもの）
// 周の決まり（601面から7周目・下りる速さ）、600面から601面へのつながりと601面の前の説明、
// 夜の面（暗くする・スズメとカラスを出さない）と灯り（l。割るとまわりが明るくなる）を試す
// 面の形を前提にしているので、601面を作り直したときは、ここも合わせて直す。NG が出なければよい
const { chromium } = require('playwright');
(async () => {
  const dir = process.argv[2];
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  await page.goto('file://' + require('path').resolve(dir) + '/test.html');
  await page.waitForTimeout(300);
  const out = await page.evaluate(() => {
    const T = window.__T, S = T.S, log = [];
    const ok = (c, m) => log.push((c ? 'OK ' : 'NG ') + m);
    const away = () => { for (const b of S.balls) { b.x = 200; b.y = 560; b.vx = 0; b.vy = 0; } };
    // ---- 周の決まり ----
    ok(T.LAP7_FROM === 601 && T.LAST_STAGE >= 601, '7周目は601面から。いまは' + T.LAST_STAGE + '面まで');
    ok(T.lapOf(600) === 6 && T.lapOf(601) === 7, '600面は6周目、601面は7周目');
    T.startGame(601);
    ok(T.COLS === 10, '7周目も10列');
    ok(Math.abs(T.dropSpeed(601) - 2.4) < 1e-9, '601面のタイルが下りてくる速さは、600面と同じ2.4');
    if (T.LAST_STAGE >= 602) ok(T.dropSpeed(T.LAST_STAGE) > 2.4 && T.dropSpeed(T.LAST_STAGE) < 2.6, '601面から先は、少しずつ速くなる（699面で2.6）');
    // ---- 600面から601面へ ----
    const ovBtn = document.getElementById('ovBtn'), ovText = document.getElementById('ovText'), ovTitle = document.getElementById('ovTitle');
    T.enterStage(601, false);
    const shown = [...document.querySelectorAll('#help [data-from]')].filter(el => !el.hidden);
    ok(S.mode === 'intro' && ovTitle.textContent.includes('夜') && ovBtn.textContent.includes('601'), '601面の前に、夜と灯りの説明が出る');
    ok(shown.length >= 2 && shown.every(el => el.dataset.from === '601'), '説明ページの601面の項目（灯り・夜）だけが出る');
    // ---- 夜の面 ----
    T.startGame(601); S.mode = 'play'; away();
    ok(S.night === true && S.lights.length === 0, '601面は夜の面で、はじめは灯りがついていない');
    const d = T.stageDef(601);
    d.sparrow = 2; d.crow = 1;
    T.startGame(601);
    ok(S.sparrows.length === 0 && S.crows.length === 0, '夜の面には、スズメとカラスは出ない');
    delete d.sparrow; delete d.crow;
    T.startGame(600);
    ok(!S.night, '600面は夜の面ではない');
    // ---- 灯り ----
    T.startGame(601); S.mode = 'play'; away();
    const lamps = S.bricks.filter(b => b.lamp);
    ok(lamps.length > 0 && lamps.every(b => b.hp === 1 && !b.iron && !b.gold), '601面に灯りのタイルがあって、1回で割れる（金のタイルにならない）');
    const lp = lamps[0];
    T.damage(lp, false);
    ok(lp.hp === 0 && S.lights.length === 1 && S.lights[0].row === lp.row && S.lights[0].col === lp.col, '灯りを割ると、そのマスに明かりがつく');
    T.damage(lamps[1], true, true);
    ok(S.lights.length === 2, '爆風で割れても、明かりがつく');
    let drew = true;
    try { T.draw(); } catch (e) { drew = false; }
    ok(drew, '夜の面を描ける');
    T.startGame(601);
    ok(S.lights.length === 0, '面をやりなおすと、明かりは消える');
    return log;
  });
  // ステージ一覧の見出しと印
  const heads = await page.evaluate(() => [...document.querySelectorAll('.st-lap')].map(e => e.textContent));
  out.push((heads.some(h => h.includes('7')) ? 'OK ' : 'NG ') + 'ステージ一覧に7周目の見出しがある');
  const mark = await page.evaluate(() => (document.querySelector('.st[data-n="601"] .st-move') || {}).textContent || '');
  out.push((mark.includes('夜') ? 'OK ' : 'NG ') + 'ステージ一覧の601面に「夜」の印がある');
  console.log(out.join('\n'));
  const ng = out.filter(l => l.startsWith('NG')).length;
  console.log(errs.length ? errs.join('\n') : 'no errors');
  console.log(ng ? 'NG ' + ng : 'all OK (' + out.length + ')');
  await browser.close();
})();
