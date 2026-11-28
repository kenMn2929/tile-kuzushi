// 7周目（601面から）の動きを確かめる。使い方：node tools/test_lap7.js 写しのフォルダ（tools/make_test_page.py で作ったもの）
// 周の決まり（601面から7周目・下りる速さ）、600面から601面へのつながりと601面の前の説明、
// 夜の面（夜風・スズメとカラスを出さない）と灯り（l）、ホタル（609面から）、歯車（q。617面から。当てるとまわり8マスが時計回りにずれる）と風船（b。633面から。上が空くと浮いていく）を試す
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
    // ---- 歯車（617面から） ----
    if (T.LAST_STAGE >= 617) {
      const settle = () => { for (const b of S.bricks) b.slideT = 0; };
      const at = (r, c) => S.bricks.find(b => b.hp > 0 && b.row === r && b.col === c);
      T.enterStage(617, false);
      const shown617 = [...document.querySelectorAll('#help [data-from]')].filter(el => !el.hidden);
      ok(S.mode === 'intro' && ovTitle.textContent.includes('歯車') && ovBtn.textContent.includes('617'), '617面の前に、歯車の説明が出る');
      ok(shown617.length >= 1 && shown617.every(el => el.dataset.from === '617'), '説明ページの617面の項目（歯車）だけが出る');
      T.startGame(617); S.mode = 'play'; away();
      const gears = S.bricks.filter(b => b.gear);
      ok(gears.length === 2 && gears.every(b => b.iron && b.hp > 0), '617面に歯車が2つあって、割れない（クリアの数に入らない）');
      ok(!T.stageDef(617).night, '617面は夜の面ではない（歯車の初登場なので分かりやすさ優先）');
      // 回る向き：まわり8マスのタイルが、時計回りに1つずれる
      const g = gears[0];
      const ringPos = [[-1, -1], [-1, 0], [-1, 1], [0, 1], [1, 1], [1, 0], [1, -1], [0, -1]].map(([dr, dc]) => [g.row + dr, g.col + dc]);
      const before = ringPos.map(([r, c]) => at(r, c));
      ok(before.every(Boolean), '617面：歯車のまわり8マスは全部タイル');
      const hard3 = before.find(b => b.max === 3), hp3 = hard3.hp, col3 = hard3.color;
      T.damage(g, false);
      const after = ringPos.map(([r, c]) => at(r, c));
      ok(after.every((b, i) => b === before[(i - 1 + before.length) % before.length]), '歯車に当てると、まわりのタイルが時計回りに1つずれる');
      ok(hard3.hp === hp3 && hard3.color === col3 && ringPos.some(([r, c]) => hard3.row === r && hard3.col === c), 'ずれたタイルの硬さと色は、タイルといっしょに移る');
      ok(g.hp > 0 && S.bricks.includes(g), '歯車は、当てても割れない');
      // もう1回当てると、またずれる
      settle();
      const before2 = ringPos.map(([r, c]) => at(r, c));
      T.damage(g, false);
      const after2 = ringPos.map(([r, c]) => at(r, c));
      ok(after2.every((b, i) => b === before2[(i - 1 + before2.length) % before2.length]), '歯車は、当てるたびに回る');
      // 対象外：鉄にしたタイルは動かない
      settle();
      const fixed = at(ringPos[0][0], ringPos[0][1]);
      fixed.iron = true;
      const fr = fixed.row, fc = fixed.col;
      T.damage(g, false);
      ok(fixed.row === fr && fixed.col === fc && fixed.hp > 0, '歯車のまわりでも、鉄（割れないもの）は回らない');
      fixed.iron = false;
      // 爆風では回らない
      settle();
      const before3 = ringPos.map(([r, c]) => at(r, c));
      T.damage(g, true, true);
      const after3 = ringPos.map(([r, c]) => at(r, c));
      ok(after3.every((b, i) => b === before3[i]) && g.hp > 0, '歯車は、爆風では回らないし割れない');
      // 端のケース：歯車を左上の角へ移しても、壊れず、盤面の外へタイルが出ない
      const g2 = gears[1];
      g2.row = 0; g2.col = 0; g2.baseX = g2.x = 8; g2.baseY = g2.y = 64;
      settle();
      let threw = false;
      try { T.damage(g2, false); } catch (e) { threw = true; }
      ok(!threw && g2.hp > 0 && S.bricks.every(b => b.row >= 0 && b.col >= 0 && b.col < T.COLS), '角の歯車に当てても壊れず、タイルが盤面の外へ出ない');
      let drew = true;
      try { T.draw(); } catch (e) { drew = false; }
      ok(drew, '歯車のある面を描ける');
    }
    // ---- 風船（633面から） ----
    if (T.LAST_STAGE >= 633) {
      const settle = () => { for (const b of S.bricks) b.slideT = 0; };
      const at = (r, c) => S.bricks.find(b => b.hp > 0 && b.row === r && b.col === c);
      T.enterStage(633, false);
      const shown633 = [...document.querySelectorAll('#help [data-from]')].filter(el => !el.hidden);
      ok(S.mode === 'intro' && ovTitle.textContent.includes('風船') && ovBtn.textContent.includes('633'), '633面の前に、風船の説明が出る');
      ok(shown633.length >= 1 && shown633.every(el => el.dataset.from === '633'), '説明ページの633面の項目（風船）だけが出る');
      T.startGame(633); S.mode = 'play'; away();
      const balloons = S.bricks.filter(b => b.balloon);
      ok(balloons.length > 0 && balloons.every(b => b.hp === 1 && !b.iron && !b.gold), '633面に風船があって、1回で割れる（金のタイルにならない）');
      ok(!T.stageDef(633).night, '633面は夜の面ではない（風船の初登場なので分かりやすさ優先）');
      ok(balloons.every(b => b.row === 0 || at(b.row - 1, b.col)), '633面：風船の真上にはタイルがある（はじめから浮かない）');
      // 上がふさがっているあいだは浮かない
      const held = balloons[0], heldRow = held.row;
      for (let i = 0; i < 90; i++) { settle(); T.floatBalloons(1 / 60); }
      ok(held.row === heldRow, '風船は、上がふさがっているあいだは浮かない');
      // 上のタイルを割ると、上へ浮いていき、つかえると止まる
      const target = balloons.find(b => { const a = at(b.row - 1, b.col); return a && !a.iron && !a.lock && !a.gear && !a.balloon; });
      ok(!!target, '633面：上のタイルを割れる風船がある');
      if (target) {
        const above = at(target.row - 1, target.col);
        T.damage(above, true);
        ok(above.hp === 0, '風船の上のタイルが割れた');
        const r0 = target.row;
        for (let i = 0; i < 300; i++) { settle(); T.floatBalloons(1 / 60); }
        ok(target.row < r0, '上のタイルが割れると、風船は上へ浮いていく');
        ok(target.row === 0 || !!at(target.row - 1, target.col), '風船は、いちばん上の行か、上のタイルにつかえると止まる');
        ok(S.bricks.every(b => b.row >= 0 && b.col >= 0 && b.col < T.COLS), '浮いた風船が盤面の外へ出ない');
      }
      // 風船自体は、ボールでも爆風でも割れる
      T.startGame(633); S.mode = 'play'; away();
      const bs = S.bricks.filter(b => b.balloon);
      T.damage(bs[0], false);
      T.damage(bs[1], true, true);
      ok(bs[0].hp === 0 && bs[1].hp === 0, '風船は、ボールでも爆風でも割れる');
      let drew = true;
      try { T.draw(); } catch (e) { drew = false; }
      ok(drew, '風船のある面を描ける');
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
