// 6周目（501面から）の動きを確かめる。使い方：node tools/test_lap6.js 写しのフォルダ（tools/make_test_page.py で作ったもの）
// ボーナスステージ（501〜510面）で、決まった所に当てると全部割れるか、金のタイル（gold）、うずまき（508面）の通り道と固さと小さいタイル、
// 「分」の出やすさ、筒から台の中へ入るか（504面）、500面と510面のクリアの画面を試す
// 面の形を前提にしているので、これらの面を作り直したときは、ここも合わせて直す。NG が出なければよい
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
    const at = (r, c) => S.bricks.find(b => b.row === r && b.col === c && b.hp > 0);
    const left = () => S.bricks.filter(b => b.hp > 0 && !b.iron).length;
    const away = () => { for (const b of S.balls) { b.x = 200; b.y = 560; b.vx = 0; b.vy = 0; } };
    // 火が走り終わるまで進める（ボールは動かさない）
    const burn = () => { for (let i = 0; i < 900 && S.fires.length; i++) T.updateFires(1 / 60); };
    // ---- 周の決まり ----
    ok(T.LAP6_FROM === 501 && T.LAST_STAGE === 510, '6周目は501面から。いまは510面まで');
    ok(T.lapOf(500) === 5 && T.lapOf(501) === 6 && T.lapOf(510) === 6, '500面は5周目、501〜510面は6周目');
    T.startGame(501);
    ok(T.COLS === 10, '6周目も10列');
    ok(Math.abs(T.dropSpeed(501) - 2.4) < 1e-9 && Math.abs(T.dropSpeed(510) - 2.4) < 1e-9, 'タイルが下りてくる速さは、499面と同じ2.4のまま');
    // ---- 決まった所に当てると全部割れる ----
    // [面, 行, 列, 当てる回数, どこか]
    const cases = [
      [501, 5, 4, 1, '先頭のピン'], [501, 2, 7, 1, 'いちばん奥の右のピン'],
      [502, 10, 0, 3, '左の線のいちばん下（2回で割って、もう1回）'],
      [503, 2, 2, 3, '左上の大爆弾'], [503, 4, 5, 3, 'まん中の大爆弾'],
      [505, 8, 0, 1, '左下の火（いちばん下の段の始まり。机のすき間の上）'],
      [507, 9, 7, 1, '土台の入り口の上の爆弾'], [507, 1, 1, 1, 'いちばん上の柱の爆弾'],
      [509, 7, 0, 3, 'いちばん下の左の延べ棒'],
      [510, 9, 8, 1, 'いちばん下の段の、机のすき間の上の火（からくりの始まり）'],
    ];
    for (const [n, r, c, k, where] of cases) {
      T.startGame(n); S.mode = 'play'; away();
      const all = left();
      for (let i = 0; i < k; i++) {
        // 鎖の面は、1枚目を割ったあとは同じマスが空くので、次はとなりの鎖に当てる
        const br = at(r, c) || S.bricks.find(b => b.chain && b.hp > 0);
        if (br) T.damage(br, false);
      }
      burn();
      ok(left() === 0 && S.mode === 'clear', n + '面：' + where + 'に' + k + '回当てると、' + all + '枚が全部割れてクリア（残り ' + left() + '）');
    }
    // 505・507・510面は、いちばん下の行の鉄にすき間が1つだけあって、下から当てられるのはきっかけのタイルだけ
    for (const [n, c] of [[505, 0], [507, 7], [510, 8]]) {
      const rows = T.stageDef(n).rows, last = rows[rows.length - 1];
      const holes = [...last].map((ch, i) => ch === '#' ? -1 : i).filter(i => i >= 0 && rows.slice(0, -1).some(r => r[i] !== '.'));
      ok(holes.length === 1 && holes[0] === c, n + '面：いちばん下の鉄のすき間は ' + c + '列の1か所だけ（' + holes + '）');
    }
    // ドミノは火が1段ずつ走るので、少し時間がかかる
    T.startGame(505); S.mode = 'play'; away();
    T.damage(at(8, 0), false);
    let t = 0;
    while (S.fires.length && t < 15) { T.updateFires(1 / 60); t += 1 / 60; }
    ok(t > 3, '505面：5段を倒しきるまで、火が' + t.toFixed(1) + '秒走る');
    // ---- 金のタイル ----
    T.startGame(508);
    const g8 = S.bricks.filter(b => b.gold);
    ok(g8.length === 2 && g8.every(b => b.row === 10 && (b.col === 9 || b.col === 10)), '508面：真ん中の2枚が金のタイル');
    T.startGame(509);
    ok(S.bricks.filter(b => b.hp > 0).every(b => b.gold && b.chain), '509面：延べ棒は全部、金で鎖のタイル');
    let rnd = 0;
    for (let i = 0; i < 30; i++) { T.startGame(507); rnd += S.bricks.filter(b => b.gold).length; }
    ok(rnd <= 30, 'gold を書かない面は、いつもどおり金のタイルは1枚まで（30回で ' + rnd + ' 枚）');
    T.startGame(509); S.mode = 'play'; away();
    const score0 = S.score;
    for (let i = 0; i < 3; i++) T.damage(at(7, 0) || S.bricks.find(b => b.chain && b.hp > 0), false);
    ok(S.score - score0 >= 40 * 500, '509面：点数が金のタイル40枚ぶん以上入る（+' + (S.score - score0) + '）');
    // クリアすると落ちてくるアイテムは消えるので、てっぺんの1枚を鎖から外して残してから数える
    T.startGame(509); S.mode = 'play'; away();
    at(2, 4).chain = false;
    for (let i = 0; i < 3; i++) T.damage(at(7, 0) || S.bricks.find(b => b.chain && b.hp > 0), false);
    const fuku = S.items.filter(it => it.type === 'fuku').length, gb = S.banners.filter(b => b.gold).length;
    ok(left() === 1 && fuku === 1 && gb === 1, '509面：39枚がいっしょに割れても、「福」は1つ、「きんの タイル」の知らせも1つ（福 ' + fuku + '、知らせ ' + gb + '）');
    // ---- うずまき（508面）：入り口は縦の通り道で、その先は抜け道のない1本道。時計回りに2周より多く回って真ん中に着く ----
    {
      const def = T.stageDef(508), rows = def.rows, R = rows.length, C = rows[0].length;
      const open = (r, c) => r >= 0 && r < R && c >= 0 && c < C && rows[r][c] === '.';
      const nb = (r, c) => [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dr, dc]) => [r + dr, c + dc]).filter(([y, x]) => open(y, x));
      const gates = [...rows[R - 1]].map((ch, c) => ch === '.' ? c : -1).filter(c => c >= 0);
      ok(rows[0] === '#'.repeat(C) && rows.every(row => row[0] === '#' && row[C - 1] === '#') && [...rows[R - 1]].every(ch => ch === '#' || ch === '.'),
        '508面：外のふちは全部鉄');
      ok(gates.length === 3 && gates[0] === 1 && gates[2] === 3, '508面：入り口は左下の3列だけ（' + gates + '列）');
      const shaft = (r, c) => gates.includes(c) && open(r, c);
      let tall = 0;
      for (let r = R - 1; r >= 0 && gates.every(c => open(r, c)); r--) tall++;
      ok(tall === R - 1, '508面：入り口から上の端まで、3列の縦の通り道が' + tall + '行のびる');
      // 縦の通り道から先へつながるのは、いちばん上の横の通り道（上から3行）だけで、右へ進む
      const links = [];
      for (let r = 0; r < R; r++) for (const c of gates) if (shaft(r, c)) for (const [y, x] of nb(r, c)) if (!shaft(y, x)) links.push([r, c, y, x]);
      ok(links.length === 3 && links.every(([r, c, y, x], i) => r === i + 1 && x === c + 1 && c === gates[2]),
        '508面：縦の通り道から先へは、いちばん上の3行で右へ曲がるところだけ ' + JSON.stringify(links));
      // その先は抜け道（輪になったところ）がない。通り道は2行か1列の幅なので、マスの数・となり合う組・2×2の空きから数える（輪がなければ 1）
      let V = 0, E = 0, F = 0;
      const way = (r, c) => open(r, c) && !shaft(r, c);
      for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
        if (!way(r, c)) continue;
        V++;
        if (way(r + 1, c)) E++;
        if (way(r, c + 1)) E++;
        if (way(r + 1, c) && way(r, c + 1) && way(r + 1, c + 1)) F++;
      }
      // 入り口からの道のり（いちばん上の行から数える）。全部のマスへつながり、いちばん奥の行き止まり（2行の幅なので2マス）は金のタイルのとなり
      const dist = new Map(), from = new Map(), todo = [[links[0][2], links[0][3]]];
      dist.set(links[0][2] + ',' + links[0][3], 0);
      for (let i = 0; i < todo.length; i++) {
        const [r, c] = todo[i], k = r + ',' + c;
        for (const [y, x] of nb(r, c)) {
          const q = y + ',' + x;
          if (shaft(y, x) || dist.has(q)) continue;
          dist.set(q, dist.get(k) + 1); from.set(q, [r, c]); todo.push([y, x]);
        }
      }
      ok(V - E + F === 1 && dist.size === V, '508面：曲がった先は1本道で、抜け道がない（' + V + 'マス、輪の数 ' + (1 - (V - E + F)) + '）');
      const far = todo[todo.length - 1], most = dist.get(far.join(','));
      const ends = todo.filter(([r, c]) => dist.get(r + ',' + c) >= most - 1);
      ok(ends.some(([r, c]) => [[0, -1], [1, 0], [-1, 0], [0, 1]].some(([dr, dc]) => (def.gold[r + dr] || '')[c + dc] === '$')), '508面：通り道のいちばん奥は、金のタイルのとなり');
      T.startGame(508);
      const cw = S.bricks.find(b => b.row === 0 && b.col === 1).x - S.bricks.find(b => b.row === 0 && b.col === 0).x;
      const ch = S.bricks.find(b => b.row === 1 && b.col === 0).y - S.bricks.find(b => b.row === 0 && b.col === 0).y;
      const g = S.bricks.filter(b => b.gold), gx = g.reduce((a, b) => a + b.col, 0) / g.length * cw, gy = g.reduce((a, b) => a + b.row, 0) / g.length * ch;
      // いちばん奥から入り口へ戻る道すじで、金のタイルのまわりを回る角度を足す（時計回りが正）
      const path = [far];
      while (from.has(path[0].join(','))) path.unshift(from.get(path[0].join(',')));
      let turn = 0;
      const ang = ([r, c]) => Math.atan2(r * ch - gy, c * cw - gx);
      for (let i = 1; i < path.length; i++) {
        let d = ang(path[i]) - ang(path[i - 1]);
        if (d > Math.PI) d -= 2 * Math.PI;
        if (d < -Math.PI) d += 2 * Math.PI;
        turn += d;
      }
      ok(turn / 2 / Math.PI > 2, '508面：入り口から真ん中まで、時計回りに' + (turn / 2 / Math.PI).toFixed(1) + '周する（前の形は1周半ほど）');
      // タイルが小さい（17列）。ボールが盤面の端と鉄のふちのすき間をすり抜けないように、端の列は盤面の端に寄せる
      const w8 = T.BRICK_W, h8 = S.bricks[0].h, side8 = S.bricks.find(b => b.col === 0).x;
      T.startGame(507);
      const w7 = T.BRICK_W, h7 = S.bricks[0].h, side7 = S.bricks.find(b => b.col === 0).x;
      T.startGame(508);
      ok(T.COLS === 17 && w8 < w7 * 0.65 && h8 < h7 * 0.6, '508面だけ17列で、タイルが小さい（横 ' + w8.toFixed(1) + '・高さ ' + h8 + '。507面は ' + w7 + '・' + h7 + '）');
      ok(side8 < S.ballR && side7 === 12, '508面は、端の列と盤面の端のすき間がボールの半径より狭い（' + side8 + '。ほかの面は ' + side7 + ' のまま）');
      // すき間が12のときは、端から3pxのところをほぼ真上へ進むボールが、壁と鉄にはさまれたまま上まですべっていった
      const sneak = [];
      for (const side of [1, -1]) for (const ang of [0.05, 0.15, 0.3, 0.5, 0.7, 0.9]) for (const dx of [0, 3, 6, 10]) {
        T.startGame(508); S.mode = 'play';
        const bottom = Math.max(...S.bricks.map(b => b.y + b.h)), b = S.balls[0];
        b.hold = 0; b.x = side > 0 ? T.W - 6.5 - dx : 6.5 + dx; b.y = bottom + 60; b.vx = side * 300 * Math.sin(ang); b.vy = -300 * Math.cos(ang);
        let got = false;
        for (let i = 0; i < 90 && !got; i++) { T.update(1 / 60); S.paddle.x = 200; if (S.balls.some(q => q.y < bottom - 30 && (q.x < 10 || q.x > T.W - 10))) got = true; }
        if (got) sneak.push([side, ang, dx]);
      }
      ok(!sneak.length, '508面：盤面の左右の端にそって上へ打っても、ボールがうずまきの横をすり抜けない（48とおり）' + (sneak.length ? JSON.stringify(sneak) : ''));
      const walls = S.bricks.filter(b => b.hp > 0 && !b.iron && !b.gold);
      const forks = walls.filter(b => b.fork);
      ok(walls.every(b => b.fork || b.max === 3), '508面：うずまきの壁は、分かれるタイルのほかは3回のタイル');
      // 分かれるタイルは、入り口の縦の通り道と、曲がってすぐの上の横の通り道（上から3行）には面していない
      // （ここに置くと、入ってすぐ16個までふえて、うずが3〜4秒で割れきってしまう）
      const topWay = (r, c) => r >= 1 && r <= 3 && open(r, c);
      const early = b => [[0, 1], [0, -1], [1, 0], [-1, 0]].some(([dr, dc]) => shaft(b.row + dr, b.col + dc) || topWay(b.row + dr, b.col + dc));
      ok(forks.length === 7 && !forks.some(early) && new Set(forks.map(b => b.row)).size >= 4 && new Set(forks.map(b => b.col)).size >= 4,
        '508面：分かれるタイルは7枚で、入り口と上の横の通り道には面さず、その先の壁のあちこちにある ' + JSON.stringify(forks.map(b => [b.row, b.col])));
      ok(T.dropSpeed(508) === 0 && T.dropSpeed(507) > 0, '508面だけ、タイルが下りてこない');
      // ボールは508面だけ16個までふえる（ほかの面は8個まで）
      const upTo = n => { T.startGame(n); S.mode = 'play'; S.balls[0].hold = 0; for (let i = 0; i < 6; i++) T.applyItem('split'); return S.balls.length; };
      const m8 = upTo(508), m7 = upTo(507);
      ok(m8 === 16 && m7 === 8, '「分」を何回取っても、ボールは508面で16個、507面で8個まで（' + m8 + '・' + m7 + '）');
    }
    // ---- 「分」の出やすさ ----
    const share = n => {
      T.startGame(n);
      let k = 0;
      for (let i = 0; i < 6000; i++) if (T.pickItem() === 'split') k++;
      return k / 6000;
    };
    const s7 = share(507), s8 = share(508);
    // 重みは4倍でも、ほかのアイテムとの割合なので、出る割合は3倍くらいになる（507面は鉄があって霧吹きの割合が上がるぶん、少しぶれる）
    ok(s8 > s7 * 2.5 && s8 > 0.22, '508面は「分」がほかの面よりずっと出やすい（4倍の重み。507面 ' + (s7 * 100).toFixed(1) + '%、508面 ' + (s8 * 100).toFixed(1) + '%）');
    // ---- ピンボール（504面）：筒に入ったボールが台の中へ入る ----
    let inTable = 0;
    for (let k = 0; k < 24; k++) {
      T.startGame(504); S.mode = 'play';
      const tube = at(6, 9), wall = at(3, 8), b = S.balls[0];
      b.x = tube.x + tube.w / 2; b.y = tube.y + tube.h + 30; b.vx = 0; b.vy = -400;
      S.paddle.x = 30;
      let got = false;
      for (let i = 0; i < 240 && !got; i++) {
        T.update(1 / 60);
        if (S.balls.some(q => q.x < wall.x && q.y < tube.y)) got = true;
      }
      if (got) inTable++;
    }
    ok(inTable >= 18, '504面：右下の筒に入れると、上のやじるしではね返って台の中へ入る（24回で ' + inTable + ' 回）');
    // ---- クリアの画面 ----
    const ovBtn = document.getElementById('ovBtn'), ovText = document.getElementById('ovText');
    T.startGame(500); S.mode = 'play';
    S.kings = []; S.bricks = [];
    T.stageClear();
    ok(ovBtn.textContent.includes('ステージ 501 へ') && ovText.textContent.includes('ボーナスステージ'), '500面をクリアすると、次の501面（ボーナスステージ）へ進める');
    T.startGame(509); S.mode = 'play';
    S.bricks = [];
    T.stageClear();
    ok(ovBtn.textContent.includes('ステージ 510 へ'), '509面のあとは510面へ');
    T.startGame(510); S.mode = 'play';
    S.bricks = [];
    T.stageClear();
    ok(ovBtn.textContent.includes('タイトルへ') && ovText.textContent.includes('ボーナスステージも'), '510面をクリアすると、全部クリアの画面からタイトルへ戻る');
    return log;
  });
  // ステージ一覧の見出し
  const heads = await page.evaluate(() => [...document.querySelectorAll('.st-lap')].map(e => e.textContent));
  out.push((heads.some(h => h.includes('6') && h.includes('ボーナスステージ')) ? 'OK ' : 'NG ') + 'ステージ一覧に6周目（ボーナスステージ）の見出しがある');
  console.log(out.join('\n'));
  const ng = out.filter(l => l.startsWith('NG')).length;
  console.log(errs.length ? errs.join('\n') : 'no errors');
  console.log(ng ? 'NG ' + ng : 'all OK (' + out.length + ')');
  await browser.close();
})();
