// 5周目の仕掛けの動きを確かめる。使い方：node tools/test_lap5.js 写しのフォルダ（tools/make_test_page.py で作ったもの）
// スイッチと壁・炎・10列（401面）、強いスイッチ（409面）、押されるタイルと「逆」と tint（425面・426面）、鎖（433面・434面）を試す
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
    return log;
  });
  // マウスでの逆：右へ動かすと左へ
  const r = await page.evaluate(() => { const T = window.__T; T.startGame(425); T.S.mode = 'play'; T.applyItem('rev'); return T.S.paddle.x; });
  const box = await page.locator('canvas').boundingBox();
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
  await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.5);
  const r2 = await page.evaluate(() => window.__T.S.paddle.x);
  out.push((r2 < r ? 'OK ' : 'NG ') + 'マウスを右へ動かすと、逆のあいだは板が左へ動く（' + Math.round(r) + '→' + Math.round(r2) + '）');
  console.log(out.join('\n'));
  const ng = out.filter(l => l.startsWith('NG')).length;
  console.log(errs.length ? errs.join('\n') : 'no errors');
  console.log(ng ? 'NG ' + ng : 'all OK (' + out.length + ')');
  await browser.close();
})();
