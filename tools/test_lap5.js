// 5周目の仕掛けの動きを確かめる。使い方：node tools/test_lap5.js 写しのフォルダ（tools/make_test_page.py で作ったもの）
// スイッチと壁・炎・10列（401面）、強いスイッチ（409面）、押されるタイルと「逆」と tint（425面・426面）、鎖（433面・434面）、筒（441面）、
// 虫JOKER（498面・499面）と500面の連戦、続きから遊ぶときの戻し方を試す
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
    const away = () => { const b = S.balls[0]; b.x = 200; b.y = 560; b.vx = 0; b.vy = 0; };
    // ---- スイッチと壁・炎・10列 ----
    // 401面：4行目の左4枚が赤い壁、右4枚が青い壁。6行目の3列目と6列目がスイッチ
    T.startGame(401); S.mode = 'play';
    ok(T.COLS === 10 && Math.abs(T.BRICK_W - 34) < 0.01, '5周目は10列で、タイルの幅は34');
    const red = at(4, 0), blue = at(4, 9), sw = at(6, 3);
    ok(red.wall === 1 && red.shown && blue.wall === 2 && !blue.shown, 'はじめは赤が出て青が引っこむ');
    ok(!S.bricks.filter(b => b.hp > 0 && !b.iron).some(b => b.toggle || b.wall), '壁とスイッチはクリアの数に入らない');
    const b = S.balls[0];
    b.x = sw.x + sw.w / 2; b.y = sw.y - 10; b.vx = 0; b.vy = 300;
    for (let i = 0; i < 10 && S.wallSide === 0; i++) T.update(1 / 60);
    ok(S.wallSide === 1 && !red.shown && blue.shown, 'スイッチに上から当てると入れかわる');
    ok(sw.hp > 0, 'スイッチは割れない');
    b.x = red.x + red.w / 2; b.y = red.y + red.h / 2; b.vx = 0; b.vy = 0;
    S.wallSide = 0; T.update(1 / 60);
    ok(!red.shown, 'ボールが重なっている壁は出てこない');
    away(); T.update(1 / 60);
    ok(red.shown, 'ボールが離れると出てくる');
    // 爆風：スイッチは切りかわらず、壁も壊れない
    T.startGame(401); S.mode = 'play'; away();
    const side0 = S.wallSide;
    for (const [r, c] of [[3, 3], [7, 2]]) {
      const bm = at(r, c); bm.bomb = true; bm.big = true; bm.hp = 1; bm.max = 1;
      S.lasers.push({x: bm.x + bm.w / 2, y: bm.y + bm.h + 2});
      T.update(1 / 60);
      ok(bm.hp <= 0, '光で大爆弾が割れた (' + r + ',' + c + ')');
    }
    ok(S.wallSide === side0, '爆風ではスイッチが切りかわらない');
    ok(at(4, 1) && at(4, 2) && at(4, 3) && at(6, 3), '爆風で壁もスイッチも壊れない');
    const sw2 = at(6, 6);
    S.lasers.push({x: sw2.x + sw2.w / 2, y: sw2.y + sw2.h + 2});
    T.update(1 / 60);
    ok(S.wallSide !== side0, '光をスイッチに当てると切りかわる');
    // 霧：壁は変わらない
    T.startGame(401); S.mode = 'play'; away();
    S.paddle.x = 30;
    T.applyItem('spray');
    for (let i = 0; i < 120; i++) { away(); T.update(1 / 60); }
    const r40 = at(4, 0);
    ok(r40 && r40.iron && !r40.rust && r40.wall === 1, '霧で壁がさびない');
    // 炎
    T.startGame(401); S.mode = 'play';
    T.applyItem('flame');
    ok(S.flame === 3, '炎で3回ぶんたまる');
    T.applyItem('flame'); T.applyItem('flame');
    ok(S.flame === 6, '炎は6回ぶんまで');
    const tgt = at(8, 3), b3 = S.balls[0];
    b3.x = tgt.x + tgt.w / 2; b3.y = tgt.y + tgt.h + 8; b3.vx = 0; b3.vy = -300;
    const sum = () => S.bricks.filter(x => x.row === 8 && x.hp > 0).reduce((a, x) => a + x.hp, 0);
    const before = sum();
    for (let i = 0; i < 4; i++) T.update(1 / 60);
    ok(S.flame === 5, '当てると1回へる');
    for (let i = 0; i < 60; i++) { away(); T.update(1 / 60); }
    ok(before - sum() >= 5, '火が行のタイルを1回ぶんずつ割った（' + before + '→' + sum() + '）');
    // 火は出ている壁で止まる
    T.startGame(401); S.mode = 'play'; away();
    const w0 = at(4, 6);
    S.fires.push({x: w0.x + w0.w / 2, y: w0.y + w0.h / 2, dir: -1, t: 0, hit: new Set([w0])});
    for (let i = 0; i < 60; i++) { away(); T.update(1 / 60); }
    ok(S.fires.length === 0 && at(4, 3), '出ている赤い壁で火が止まる');
    // 強いスイッチ（409面）
    T.startGame(409); S.mode = 'play'; away();
    ok(S.switchAuto === true, '409面は強いスイッチの面');
    const steps = sec => { for (let i = 0; i < Math.round(sec * 60); i++) { away(); T.update(1 / 60); } };
    steps(3.9);
    ok(S.wallSide === 0, '3.9秒ではまだ切りかわらない');
    steps(0.2);
    ok(S.wallSide === 1, '4秒で勝手に切りかわる');
    // 当てると切りかわり、そこから4秒を数えなおす
    steps(2);
    const ss = S.bricks.find(x => x.toggle && x.hp > 0 && x.big);
    S.lasers.push({x: ss.x + ss.w / 2, y: ss.y + ss.h + 2});
    T.update(1 / 60);
    ok(S.wallSide === 0, '光を当てると切りかわる');
    steps(3.8);
    ok(S.wallSide === 0, '当ててから3.8秒では、まだ切りかわらない');
    steps(0.3);
    ok(S.wallSide === 1, '当ててから4秒で切りかわる');
    // 「止」のあいだは数えない
    T.applyItem('stop');
    steps(5);
    ok(S.wallSide === 1, '「止」のあいだは切りかわらない');
    // ふつうのスイッチの面は、勝手には切りかわらない
    T.startGame(401); S.mode = 'play'; away();
    steps(9);
    ok(S.switchAuto === false && S.wallSide === 0, 'ふつうのスイッチは勝手に切りかわらない');
    // 8列の面に戻ると、マスの大きさも戻る
    T.startGame(400);
    ok(T.COLS === 8 && Math.abs(T.BRICK_W - 43.5) < 0.01, '400面は8列のまま');
    T.startGame(301);
    ok(S.bricks.every(b => b.w === 43.5 && b.h === 22), '4周目のタイルの大きさは変わらない');
    // ---- 押されるタイル・tint・逆 ----
    {
    const shoot = (br, from) => {
      const b = S.balls[0];
      if (from === 'below') { b.x = br.x + br.w / 2; b.y = br.y + br.h + 7; b.vx = 0; b.vy = -400; }
      if (from === 'left') { b.x = br.x - 7; b.y = br.y + br.h / 2; b.vx = 400; b.vy = 0.0001; }
      T.update(1 / 60);
    };
    // 425面：(9,0) の星を下から押すと、上の (8,0) へすべる
    T.startGame(425); S.mode = 'play';
    let star = at(9, 0);
    ok(star && star.push && star.hp === 1, '425面の (9,0) は押されるタイル');
    shoot(star, 'below');
    ok(star.hp === 1 && star.row === 8 && star.col === 0, '下から当てると上へすべって、割れない');
    away();
    for (let i = 0; i < 20; i++) T.update(1 / 60);
    // 上の (7,0) は空き、(6,0) に星がある：(7,0) へすべり、次は (6,0) がふさいでいるので割れる
    shoot(star, 'below'); away(); for (let i = 0; i < 20; i++) T.update(1 / 60);
    ok(star.row === 7 && star.hp === 1, 'もう一度押すと、もう1マスすべる');
    shoot(star, 'below'); away(); for (let i = 0; i < 20; i++) T.update(1 / 60);
    ok(star.hp <= 0, 'すべる先に星があると割れる');
    // 横から：(3,9) の星を左から押すと、右は盤面のはしなので割れる
    T.startGame(425); S.mode = 'play';
    const s39 = at(3, 9);
    shoot(s39, 'left'); away();
    ok(s39.hp <= 0, '右が盤面のはしなら、横から押すと割れる');
    // 横から：(4,2) の星を左から押すと、右の (4,3) へすべる
    const s42 = at(4, 2);
    shoot(s42, 'left'); away();
    ok(s42.hp === 1 && s42.row === 4 && s42.col === 3, '横から当てると横へすべる');
    // 光では割れる
    T.startGame(425); S.mode = 'play'; away();
    const s90 = at(9, 4);
    S.lasers.push({x: s90.x + s90.w / 2, y: s90.y + s90.h + 2});
    T.update(1 / 60);
    ok(s90.hp <= 0, '光では、すべらずに割れる');
    // つきぬけでは割れる
    T.startGame(425); S.mode = 'play';
    S.pierce = 3;
    const s80 = at(8, 1);
    shoot(s80, 'below'); away();
    ok(s80.hp <= 0, 'つきぬけでは、すべらずに割れる');
    // 動く行へはすべらない：426面 (3,1) の煙を上から押しても、下の (4,1) は動く行なので割れる
    T.startGame(426); S.mode = 'play';
    const sm = at(3, 1), b = S.balls[0];
    b.x = sm.x + sm.w / 2; b.y = sm.y - 7; b.vx = 0; b.vy = 400; T.update(1 / 60); away();
    ok(sm.hp <= 0, '動く行へはすべらず、割れる');
    // 色：425面の三日月は黄色、空の帯は青
    T.startGame(425);
    ok(at(2, 6).color === 't-yamabuki' && at(1, 0).color === 't-ai', 'tint で色がつく');
    ok(at(0, 0).max === 3, '3回のタイルはそのまま');
    // 逆：キーの右で左へ動く
    T.startGame(425); S.mode = 'play'; away();
    T.applyItem('rev');
    ok(S.revT > 7.9, '逆で8秒');
    const x0 = S.paddle.x;
    window.dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowRight'}));
    for (let i = 0; i < 10; i++) { away(); T.update(1 / 60); }
    window.dispatchEvent(new KeyboardEvent('keyup', {key: 'ArrowRight'}));
    ok(S.paddle.x < x0, '逆のあいだは、右キーで板が左へ動く（' + Math.round(x0) + '→' + Math.round(S.paddle.x) + '）');
    for (let i = 0; i < 8 * 60; i++) { away(); T.update(1 / 60); }
    const x1 = S.paddle.x;
    window.dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowRight'}));
    for (let i = 0; i < 10; i++) { away(); T.update(1 / 60); }
    window.dispatchEvent(new KeyboardEvent('keyup', {key: 'ArrowRight'}));
    ok(S.paddle.x > x1, '8秒たつと元に戻る');
    }
    // ---- 鎖 ----
    {
    const laser = br => { S.lasers.push({x: br.x + br.w / 2, y: br.y + br.h + 2}); T.update(1 / 60); };
    // 433面：ネックレスの鎖は16枚で1本につながっている
    T.startGame(433); S.mode = 'play'; away();
    const chains = () => S.bricks.filter(b => b.chain && b.hp > 0);
    ok(chains().length === 16 && chains().every(b => b.hp === 2), '433面の鎖は16枚、どれも2回');
    // (4,4) を光で2回当てて割る → ほかの15枚に1回ぶんずつ当たる
    const c44 = at(4, 4);
    laser(c44); away(); laser(c44); away();
    ok(c44.hp <= 0, '鎖のタイルを割った');
    ok(chains().length === 15 && chains().every(b => b.hp === 1), '同じ鎖の残り15枚に1回ぶんずつ当たった');
    // もう1枚割ると、残り全部が割れる（割れた鎖からは、もう伝わらない）
    // (4,4) が割れて、鎖は左右の2本に切れている。右の (4,5) を割ると、右の鎖だけが全部割れる
    laser(at(4, 5)); away();
    ok(chains().every(b => b.col <= 4) && chains().length === 7, 'まん中が切れた鎖は2本に分かれ、割った側だけが全部割れる（残り ' + chains().length + ' 枚）');
    laser(at(4, 3)); away();
    ok(chains().length === 0, 'もう片方も、1枚割ると全部割れる');
    ok(at(5, 4) && at(5, 4).hp === 2, '鎖でないタイル（宝石）には当たらない');
    // 434面：ブランコの鎖2本は、別々の鎖
    T.startGame(434); S.mode = 'play'; away();
    const left = () => S.bricks.filter(b => b.chain && b.hp > 0 && b.col === 5);
    const right = () => S.bricks.filter(b => b.chain && b.hp > 0 && b.col === 8);
    const c55 = at(5, 5);
    laser(c55); away(); laser(c55); away();
    ok(left().every(b => b.hp === 1) && left().length === 3, '左の鎖の残り3枚に当たる');
    ok(right().every(b => b.hp === 2), '右の鎖には伝わらない');
    // 爆風で割れても伝わる：440面の振り子の棒 (6,4) のとなりのタイルを大爆弾にして割る
    T.startGame(433); S.mode = 'play'; away();
    const gem = at(5, 4); gem.bomb = true; gem.hp = 1; gem.max = 1;
    laser(gem); away();
    const after = chains();
    ok(after.length > 0 && after.some(b => b.hp === 1), '爆風で割れた鎖からも伝わる（残り ' + after.length + ' 枚）');
    }
    // ---- 筒 ----
    {
    const step = (k = 1) => { for (let i = 0; i < k; i++) T.update(1 / 60); };
    // 441面：(9,2) と (9,7) が筒。真上の (8,2) と (8,7) は空いている
    const fromBelow = (b, t) => { b.x = t.x + t.w / 2; b.y = t.y + t.h + 8; b.vx = 0; b.vy = -400; };
    const fromAbove = (b, t) => { b.x = t.x + t.w / 2; b.y = t.y - 12; b.vx = 0; b.vy = 400; };
    T.startGame(441); S.mode = 'play';
    let t1 = at(9, 2), t2 = at(9, 7), b = S.balls[0];
    ok(t1 && t1.tube && t1.iron && t2 && t2.tube, '441面の (9,2) と (9,7) は筒');
    ok(!S.bricks.filter(x => x.hp > 0 && !x.iron).some(x => x.tube), '筒はクリアの数に入らない');
    fromBelow(b, t1); step(3);
    ok(b.tubeT > 0 && b.tube === t1, '下から当てると筒に入る');
    step(20);
    ok(b.tubeT > 0 && Math.abs(b.x - (t1.x + t1.w / 2)) < 0.01 && Math.abs(b.y - (t1.y + t1.h / 2)) < 0.01, '0.3秒ではまだ筒の中にいて、筒といっしょに動く');
    ok(S.lives === 3 && S.mode === 'play', '筒の中にいるあいだは、ボールを失わない');
    step(12);
    ok(!(b.tubeT > 0) && b.vy < 0 && b.y < t1.y, '0.5秒ほどで、筒の口から上へ撃ち出す');
    const tilt = Math.asin(Math.abs(b.vx) / Math.hypot(b.vx, b.vy));
    ok(tilt > 0.099 && tilt < 0.201, '向きは真上から少しだけかたむく（' + tilt.toFixed(3) + ' rad）');
    // 撃ち出してすぐは、同じ筒にははね返る。ほかの筒には入る
    fromAbove(b, t1); step(3);
    ok(!(b.tubeT > 0) && b.vy < 0, '撃ち出してすぐは、同じ筒に上から当ててもはね返る');
    fromAbove(b, t2); step(3);
    ok(b.tubeT > 0 && b.tube === t2, 'ほかの筒には、すぐに入る');
    // 1秒たつと、同じ筒にもまた入る
    T.startGame(441); S.mode = 'play';
    t1 = at(9, 2); b = S.balls[0];
    fromBelow(b, t1); step(40);
    ok(!(b.tubeT > 0), '撃ち出した');
    for (let i = 0; i < 62; i++) { away(); step(); }
    fromAbove(b, t1); step(3);
    ok(b.tubeT > 0 && b.tube === t1, '1秒たつと、同じ筒にもまた入る');
    // 筒の中にいるときに「分」を取ると、ふえたボールは筒の口から上へ出る
    T.applyItem('split');
    const nb = S.balls.find(x => x !== b);
    ok(nb && nb.vy < 0 && nb.y < t1.y && nb.tubeFrom === t1, 'ふえたボールは筒の口から上へ出る');
    step();
    ok(nb && !(nb.tubeT > 0), 'ふえたボールは、すぐには同じ筒に入らない');
    // 光は止まり、爆風でも壊れない。火も止まる。霧でもさびない
    T.startGame(441); S.mode = 'play'; away();
    t1 = at(9, 2);
    S.lasers.push({x: t1.x + t1.w / 2, y: t1.y + t1.h + 2}); step();
    ok(S.lasers.length === 0 && t1.hp > 0 && t1.tube, '光は筒で止まり、筒は壊れない');
    const g = at(10, 1); g.bomb = true; g.big = true; g.hp = 1; g.max = 1;
    S.lasers.push({x: g.x + g.w / 2, y: g.y + g.h + 2}); step();
    ok(g.hp <= 0 && at(9, 2) === t1 && t1.tube, '大爆弾の爆風でも筒は壊れない');
    S.fires.push({x: 1, y: t1.y + t1.h / 2, dir: 1, t: 0, hit: new Set()});
    let maxX = 0;
    for (let i = 0; i < 90; i++) { away(); step(); for (const f of S.fires) maxX = Math.max(maxX, f.x); }
    ok(S.fires.length === 0 && maxX < t1.x + t1.w, '火は筒で止まる');
    S.paddle.x = t1.x + t1.w / 2;
    T.applyItem('spray');
    for (let i = 0; i < 120; i++) { away(); step(); }
    ok(t1.tube && t1.iron && !t1.rust, '霧で筒はさびない');
    // 筒の真上のマスには、投げこむ虫などがタイルを置かない
    ok(!T.freeCell(8, 2) && !T.freeCell(8, 7) && T.freeCell(8, 4), '筒の真上のマスは、タイルを置けるマスに入らない');
    }
    // ---- 虫JOKERと500面の連戦 ----
    {
      const dt = 1 / 60, R = 24;
      const step = (n = 1) => { for (let i = 0; i < n; i++) { away(); T.update(dt); } };
      // 下からボールを当てる（当たるまで数フレーム進める）
      const hit = k => {
        const b = S.balls[0], hp = k.hp, n = S.kings.length, w = S.wave;
        b.x = k.x; b.y = k.y + R + S.ballR + 3; b.vx = 0; b.vy = -S.speed;
        for (let i = 0; i < 6 && k.hp === hp && k.flash <= 0.2 && S.kings.length === n && S.wave === w; i++) T.update(dt);
      };
      const thrownPush = () => S.bricks.filter(b => b.push && b.thrown && b.hp > 0).length + S.flying.filter(f => f.pusher).length;
      // 498面：残りが6割になったら虫JOKERが通りかかって、押されるタイルを3枚投げていく
      T.startGame(498); S.mode = 'play'; away();
      const j8 = S.kings[0];
      ok(j8 && j8.joker && j8.state === 'wait' && j8.lay === 'pusher', '498面の虫JOKERは、はじめは出てこない');
      const plain = S.bricks.filter(b => b.hp > 0 && !b.iron);
      for (const b of plain.slice(0, Math.ceil(plain.length * 0.45))) b.hp = 0;
      step(60 * 6);
      ok(S.kingSeen && thrownPush() === 3, '虫JOKERが通りかかって、押されるタイルを3枚投げた（' + thrownPush() + '）');
      // 499面：歩いている虫JOKERは、当ててもへらないが、少しして離れたところへ消えて出てくる
      T.startGame(499); S.mode = 'play'; away();
      const j9 = S.kings[0];
      ok(j9.joker && j9.state === 'walk' && !j9.boss, '499面の虫JOKERは歩いていて、やっつけられない');
      const x0 = j9.x;
      hit(j9);
      ok(j9.warpT > 0 && j9.hp === j9.max, '当てると、消える用意をする（体力はへらない）');
      step(30);
      // 499面では、当たっても止まらずに0.4秒歩いてから消える（そのぶん、当てた場所からは少し近いことがある）
      ok(Math.abs(j9.x - x0) >= 90 && j9.warpCool > 0, '0.5秒のうちに、離れたところへ出てきた（' + Math.round(x0) + '→' + Math.round(j9.x) + '）');
      const x1 = j9.x;
      hit(j9); step(30);
      ok(Math.abs(j9.x - x1) < 30, '出てきてすぐは、当てても消えない');
      T.startGame(499); S.mode = 'play'; away();
      step(60 * 25);
      ok(thrownPush() >= 2, '歩きながら、押されるタイルを投げる（25秒で ' + thrownPush() + ' 枚）');
      // 500面：虫KING → 虫QUEEN → 2匹同時 → 虫JOKER
      T.startGame(500); S.mode = 'play'; away();
      let k = S.kings[0];
      ok(S.kings.length === 1 && !k.queen && !k.joker && k.boss && k.hp === 12 && k.lay === 'egg', '500面は、はじめに虫KING（体力12、たまご）');
      k.hp = 1; hit(k);
      k = S.kings[0];
      ok(S.mode === 'play' && S.wave === 1 && k.queen && k.state === 'in' && k.lay === 'runner' && S.kingsGone.length === 1, '虫KINGをやっつけると、虫QUEEN（逃げるタイル）が歩いてくる');
      step(60 * 3);
      ok(k.state === 'walk', '虫QUEENが歩きはじめた');
      k.plate = 0; k.plateT = 99; k.hp = 1; hit(k);
      ok(S.wave === 2 && S.kings.length === 2 && S.kings.every(q => q.lay === 'faller' && q.hp === 12 && q.state === 'in'), '次は虫KINGと虫QUEENが2匹同時に歩いてくる（2匹とも落ちるタイル）');
      ok(S.kings[0].x < 0 && S.kings[1].x > T.W, '2匹は左右から歩いてくる');
      step(60 * 3);
      let near = Infinity;
      for (let i = 0; i < 60 * 30; i++) {
        step();
        const [a, c] = S.kings;
        if (a.state === 'walk' && c.state === 'walk') near = Math.min(near, Math.abs(a.x - c.x));
      }
      ok(near >= R * 2, '2匹は重ならずに歩く（いちばん近づいて ' + Math.round(near) + '）');
      const [kk, qq] = S.kings;
      kk.hurtT = 0; kk.hp = 1; hit(kk);
      ok(S.mode === 'play' && S.wave === 2 && S.kings.length === 1 && S.kings[0] === qq, '1匹やっつけても、もう1匹とのたたかいは続く');
      qq.plate = 0; qq.plateT = 99; qq.hurtT = 0; qq.hp = 1; hit(qq);
      k = S.kings[0];
      ok(S.wave === 3 && S.kings.length === 1 && k.joker && k.boss && k.lay === 'pusher' && k.hp === 12, '2匹ともやっつけると、虫JOKER（体力12、押されるタイル）が出てくる');
      step(60 * 3);
      const xj = k.x;
      hit(k); step(30);
      ok(k.hp === 11 && Math.abs(k.x - xj) >= 110, '虫JOKERは当たると体力がへって、離れたところへ消えて出てくる');
      step(60 * 3);
      k.hurtT = 0; k.hp = 1; hit(k);
      ok(S.mode === 'finale', '虫JOKERをやっつけると、終わりの演出になる');
      for (let i = 0; i < 60 * 15 && S.mode === 'finale'; i++) T.update(dt);
      ok(S.mode === 'clear' && document.getElementById('ovText').textContent.includes('JOKER'), '全部クリアの画面に虫JOKERが出てくる');
    }
    return log;
  });
  // マウスでの逆：右へ動かすと左へ
  const r = await page.evaluate(() => { const T = window.__T; T.startGame(425); T.S.mode = 'play'; T.applyItem('rev'); return T.S.paddle.x; });
  const box = await page.locator('canvas').boundingBox();
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
  await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.5);
  const r2 = await page.evaluate(() => window.__T.S.paddle.x);
  out.push((r2 < r ? 'OK ' : 'NG ') + 'マウスを右へ動かすと、逆のあいだは板が左へ動く（' + Math.round(r) + '→' + Math.round(r2) + '）');
  // 続きから：500面の2匹同時で、虫KINGをやっつけて虫QUEENが残り5のとき
  const page2 = await browser.newPage();
  page2.on('pageerror', e => errs.push('pageerror: ' + e.message));
  await page2.addInitScript(() => {
    window.claude = {hot: {data: {mode: 'play', stage: 500, bricks: [], lives: 3, score: 0, kingWave: 2, kingLeft: [['queen', 5]]},
      snapshot: f => { window.__snap = f; }}};
  });
  await page2.goto('file://' + require('path').resolve(dir) + '/test.html');
  await page2.waitForTimeout(300);
  const rs = await page2.evaluate(() => {
    const S = window.__T.S, k = S.kings[0], sn = window.__snap();
    return {n: S.kings.length, wave: S.wave, queen: !!(k && k.queen), hp: k && k.hp, lay: k && k.lay, snap: JSON.stringify([sn.kingWave, sn.kingLeft])};
  });
  out.push((rs.n === 1 && rs.wave === 2 && rs.queen && rs.hp === 5 && rs.lay === 'faller' && rs.snap === '[2,[["queen",5]]]' ? 'OK ' : 'NG ') +
    '続きから遊ぶと、500面の2匹同時の残りの虫QUEEN（体力5）から始まる ' + JSON.stringify(rs));
  // 前の形のデータ（400面で虫QUEENが残り7）
  const page3 = await browser.newPage();
  page3.on('pageerror', e => errs.push('pageerror: ' + e.message));
  await page3.addInitScript(() => { window.claude = {hot: {data: {mode: 'play', stage: 400, bricks: [], lives: 3, score: 0, kingHp: 7, kingQueen: true}}}; });
  await page3.goto('file://' + require('path').resolve(dir) + '/test.html');
  await page3.waitForTimeout(300);
  const r3 = await page3.evaluate(() => { const S = window.__T.S, k = S.kings[0]; return {n: S.kings.length, queen: !!(k && k.queen), hp: k && k.hp}; });
  out.push((r3.n === 1 && r3.queen && r3.hp === 7 ? 'OK ' : 'NG ') + '前の形のデータでも、400面の虫QUEEN（体力7）から続けられる ' + JSON.stringify(r3));
  console.log(out.join('\n'));
  const ng = out.filter(l => l.startsWith('NG')).length;
  console.log(errs.length ? errs.join('\n') : 'no errors');
  console.log(ng ? 'NG ' + ng : 'all OK (' + out.length + ')');
  await browser.close();
})();
