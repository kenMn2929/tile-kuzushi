// 板を自動で動かして面を遊ばせ、失ったボールの数とクリアまでの時間を測る
// 使い方：node tools/autoplay.js 写しのフォルダ 面の番号（,区切り） [回数] [面の書きかえ（JSON）] [--trail] [--max=秒]
//   写しのフォルダ：tools/make_test_page.py で test.html を作ったフォルダ
//   面の書きかえ：最初の面の定義をこの JSON に置きかえて遊ばせる（形を試すとき。例：'{"rows":[...],"bug":60}'）
//   --trail：ボールを失うたびに、その前の1.5秒のボールの動き（[秒, x, y, vx, vy, 板のx]）を出す
//   --max=秒：打ち切るまでの秒数（はじめは600。500面のように長い面を測るとき）
// 出力：面 clear クリアできた回数 lost 1回あたりの失ったボール time 平均の秒数 flips スイッチが切りかわった回数 | 回ごとの「失った数/秒」
// 板の動かし方：いちばん先に落ちてくるボールの落ちる場所へ、毎秒560pxで動く（壁ではね返るのだけ考え、タイルや虫は考えない）
// ボールがないときは、いいアイテムを取りに行く。「逆」などの効き目は受けない（板の位置を直接動かすため）
// ボールは6つから始め、3つより少なくなったら6つに戻す（終わらせずに、失った数を数えるため）。600秒（--max で変えられる）で打ち切る
const { chromium } = require('playwright');
(async () => {
  const dir = process.argv[2];
  const stages = process.argv[3].split(',').map(Number);
  const runs = +(process.argv[4] || 8);
  const over = process.argv[5] && !process.argv[5].startsWith('--') ? JSON.parse(process.argv[5]) : null;
  const trail = process.argv.includes('--trail');
  const maxArg = process.argv.find(a => a.startsWith('--max='));
  const maxT = maxArg ? +maxArg.slice(6) : 600;
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('console', m => { const t = m.text(); if (t.startsWith('LEFT') || t.startsWith('LOSS')) console.log(t); });
  const errs = [];
  page.on('pageerror', e => errs.push('pageerror: ' + e.message + '\n' + e.stack));
  await page.goto('file://' + require('path').resolve(dir) + '/test.html');
  await page.waitForTimeout(300);
  const res = await page.evaluate(({stages, runs, over, trail, maxT}) => {
    const T = window.__T, S = T.S, dt = 1 / 60;
    if (over) { const d = T.stageDef(stages[0]); for (const k of Object.keys(d)) delete d[k]; Object.assign(d, over); }
    const landX = b => {
      const tt = (T.PADDLE_Y - b.y) / b.vy;
      let x = b.x + b.vx * tt;
      const L = T.W;
      x = ((x % (2 * L)) + 2 * L) % (2 * L);
      return x > L ? 2 * L - x : x;
    };
    const bad = ['shrink', 'fast', 'yaku', 'heavy', 'rev'];
    const out = [];
    for (const n of stages) {
      const rs = [];
      for (let k = 0; k < runs; k++) {
        T.startGame(n);
        S.lives = 6;
        let t = 0, lost = 0, prev = S.lives, aimOff = 0, wait = 0, flips = 0, side = S.wallSide, hist = [];
        while (t < maxT) {
          if (S.mode === 'ready') { wait += dt; if (wait > 0.3) { wait = 0; T.launch(); aimOff = (Math.random() - 0.5) * S.paddle.w * 0.6; } }
          const p = S.paddle;
          let best = null, bt = Infinity;
          for (const b of S.balls) {
            if (b.hold > 0 || b.vy <= 0) continue;
            const tt = (T.PADDLE_Y - b.y) / b.vy;
            if (tt < bt) { bt = tt; best = b; }
          }
          let target = T.W / 2;
          if (best) target = landX(best) + aimOff;
          else {
            const good = S.items.filter(it => !bad.includes(it.type));
            if (good.length) target = good.sort((a, b) => b.y - a.y)[0].x;
          }
          const v = 560 * dt;
          p.x = Math.max(p.w / 2, Math.min(T.W - p.w / 2, p.x + Math.max(-v, Math.min(v, target - p.x))));
          for (const b of S.balls) if (b.hold > 0) b.hold = Math.min(b.hold, 0.05);
          T.update(dt);
          t += dt;
          if (trail && S.balls[0]) {
            const b = S.balls[0];
            hist.push([+t.toFixed(2), Math.round(b.x), Math.round(b.y), Math.round(b.vx), Math.round(b.vy), Math.round(p.x)]);
            if (hist.length > 90) hist.shift();
          }
          if (S.wallSide !== side) { flips++; side = S.wallSide; }
          if (S.lives < prev) {
            lost += prev - S.lives;
            if (trail) console.log('LOSS ' + n + ' run' + k + ' t=' + t.toFixed(1) + ' drop=' + Math.round(S.drop) + ' trail=' + JSON.stringify(hist.filter((h, i) => i % 10 === 0)));
            hist = [];
          }
          if (S.lives < 3) S.lives = 6;
          prev = S.lives;
          if (best && best.vy < 0) aimOff = (Math.random() - 0.5) * p.w * 0.6;
          if (S.mode === 'clear' || S.mode === 'over') break;
        }
        rs.push({clear: S.mode === 'clear', t: Math.round(t), lost, flips});
        // 打ち切ったときは、残ったタイル（行, 列, 硬さ）を出す
        if (S.mode !== 'clear') console.log('LEFT ' + n + ' ' + JSON.stringify(S.bricks.filter(b => b.hp > 0 && !b.iron).map(b => [b.row, b.col, b.hp])) + ' drop ' + Math.round(S.drop));
      }
      out.push({n, clear: rs.filter(r => r.clear).length + '/' + rs.length,
        lost: (rs.reduce((a, r) => a + r.lost, 0) / rs.length).toFixed(1),
        t: Math.round(rs.reduce((a, r) => a + r.t, 0) / rs.length),
        flips: Math.round(rs.reduce((a, r) => a + r.flips, 0) / rs.length),
        each: rs.map(r => r.lost + '/' + r.t + (r.clear ? '' : 'x')).join(' ')});
    }
    return out;
  }, {stages, runs, over, trail, maxT});
  for (const r of res) console.log(r.n, 'clear', r.clear, 'lost', r.lost, 'time', r.t, 'flips', r.flips, '|', r.each);
  if (errs.length) console.log(errs.join('\n'));
  await browser.close();
})();
