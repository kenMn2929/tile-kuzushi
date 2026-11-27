// 7周目（601面から）の動きを確かめる。使い方：node tools/test_lap7.js 写しのフォルダ（tools/make_test_page.py で作ったもの）
// 周の決まり（601面から7周目・下りる速さ）、600面から601面へのつながりと601面の前の説明、
// 夜の面（暗くする・スズメとカラスを出さない）と灯り（l。割るとまわりが明るくなる）、ホタル（609面から）を試す
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
    // ---- 夜の面（夜風） ----
    T.startGame(601); S.mode = 'play'; away();
    ok(S.night === true && S.wind && S.wind.phase === 'calm' && Math.abs(S.wind.t - T.WIND_FIRST) < 1e-9, '601面は夜の面で、はじめは風が止んでいる');
    const d = T.stageDef(601);
    d.sparrow = 2; d.crow = 1;
    T.startGame(601);
    ok(S.sparrows.length === 0 && S.crows.length === 0, '夜の面には、スズメとカラスは出ない');
    delete d.sparrow; delete d.crow;
    T.startGame(600);
    ok(!S.night && S.wind === null, '600面は夜の面ではなく、風は吹かない');
    // 風の移りかわり：静か → 知らせ → 吹く → 静か
    T.startGame(601); S.mode = 'play'; away();
    const w = S.wind;
    w.t = 0.01; T.updateWind(1 / 60);
    ok(w.phase === 'warn' && (w.dir === 1 || w.dir === -1), '静かなあとは、風の筋で知らせる');
    w.t = 0.01; T.updateWind(1 / 60);
    ok(w.phase === 'gust' && Math.abs(w.t - T.WIND_GUST) < 1e-9, '知らせのあとに吹く');
    // 吹いているあいだ、まっすぐ落ちるボールは風下へ曲がり、速さは変わらない
    const b = S.balls[0];
    b.hold = 0; b.x = 200; b.y = 250; b.vx = 0; b.vy = S.speed;
    w.dir = 1; w.t = T.WIND_GUST / 2;
    for (let i = 0; i < 30; i++) T.updateWind(1 / 60);
    ok(b.vx > 0 && b.vy > 0 && Math.abs(Math.hypot(b.vx, b.vy) - S.speed) < 1e-6, '風が吹くと、ボールは風下へ曲がり、速さは変わらない');
    ok(Math.abs(b.vy) >= 0.3 * S.speed - 1e-6, '風で曲がっても、真横に近い向きにはならない');
    // 時止めのあいだは止む
    const vx = b.vx, t0 = w.t;
    S.stopT = 3;
    T.updateWind(1 / 60);
    ok(b.vx === vx && w.t === t0, '時止めのあいだは、風が止む');
    S.stopT = 0;
    let drew = true;
    try { T.draw(); } catch (e) { drew = false; }
    ok(drew, '風の吹いている夜の面を描ける');
    w.t = 0.01; T.updateWind(1 / 60);
    ok(w.phase === 'calm' && T.windPower() === 0, '吹き終わると、また静かになる');
    // 同じ向きは3回まで
    T.startGame(601);
    const dirs = [];
    for (let i = 0; i < 40; i++) { S.wind.phase = 'calm'; S.wind.t = 0.001; T.updateWind(1 / 60); dirs.push(S.wind.dir); }
    ok(!dirs.some((x, i) => i >= 3 && dirs.slice(i - 3, i + 1).every(y => y === x)), '風の向きは、同じ向きが4回続かない');
    // ---- 灯り ----
    T.startGame(601); S.mode = 'play'; away();
    const lamps = S.bricks.filter(b => b.lamp);
    ok(lamps.length > 0 && lamps.every(b => b.hp === 1 && !b.iron && !b.gold), '601面に灯りのタイルがあって、1回で割れる（金のタイルにならない）');
    T.damage(lamps[0], false);
    T.damage(lamps[1], true, true);
    ok(lamps[0].hp === 0 && lamps[1].hp === 0, '灯りは、ボールでも爆風でも割れる');
    // ---- ホタル（609面から） ----
    if (T.LAST_STAGE >= 609) {
      T.startGame(609);
      const n = T.stageDef(609).firefly;
      ok(S.night && n > 0 && S.fireflies.length === n, '609面は夜の面で、ホタルが' + n + '匹出る');
      S.mode = 'play'; away();
      const y0 = S.fireflies.map(f => f.y);
      for (let i = 0; i < 300; i++) T.moveFireflies(1 / 60);
      const top = 64, low = S.bugZone.bottom;
      ok(S.fireflies.every(f => f.x >= 0 && f.x <= T.W && f.y >= top && f.y <= low), 'ホタルは盤面の中のタイルのあたりをただよう');
      ok(S.fireflies.some((f, i) => Math.abs(f.y - y0[i]) > 1), 'ホタルは動く');
      const f = S.fireflies[0], b = S.balls[0];
      b.x = f.x + 20; b.y = f.y; b.vx = -300; b.vy = 0;
      const fx = f.x;
      T.moveFireflies(1 / 60);
      for (let i = 0; i < 20; i++) T.moveFireflies(1 / 60);
      ok(f.x < fx, 'ボールが近づくと、ホタルはボールから離れる');
      let drew = true;
      try { T.draw(); } catch (e) { drew = false; }
      ok(drew, 'ホタルのいる夜の面を描ける');
      const d = T.stageDef(601); d.firefly = 2;
      T.startGame(601);
      ok(S.fireflies.length === 2, '夜の面なら、ほかの面にもホタルを出せる');
      delete d.firefly;
      const e = T.stageDef(600); e.firefly = 2;
      T.startGame(600);
      ok(S.fireflies.length === 0, '夜でない面には、ホタルは出ない');
      delete e.firefly;
      T.enterStage(609, false);
      ok(S.mode === 'intro' && ovTitle.textContent.includes('ホタル'), '609面の前に、ホタルの説明が出る');
    }
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
