// ボールが盤面のいちばん上へ移ったとき（アイテムの「上」）と、筒から撃ち出されたときに、下の板のほうへ戻れるかを、全部の面で調べる。
// 使い方：node tools/check_up.js 写しのフォルダ（tools/make_test_page.py で作ったもの）。最後に all OK と出ればよい
// 割れない鉄で上がふさがっている面で「上」を取ると、ボールが全部上に行ったまま降りてこられず、何もできなくなる
// （タイルが線まで来てボールがへるまで待つしかない。タイルの下りない面では、ずっとそのまま）。そういう面には without: ['up'] を書く
// 調べ方：上（0行目の全部）から、通れるマス（空き・割れるタイル）を広げていき、いちばん下の行に着けば戻れる。
//   鉄・スイッチ・筒は通れない。爆弾・大爆弾・火・導火線に届けば、爆風の届く鉄は壊れたものとする。鍵に全部届けば錠は開く。
//   スイッチに当てられるか、強いスイッチ（時間で切りかわる）があれば、壁は通れるものとする。ワープの穴は2つをつなぐ。筒に当てると筒の上のマスへ出る。
//   動く行・動く列のマスは通れるものとする。盤面の端のすき間（12、17列は6）はボールより狭いので通れないものとする
const { chromium } = require('playwright');
(async () => {
  const dir = process.argv[2];
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('file://' + require('path').resolve(dir) + '/test.html');
  await page.waitForTimeout(300);
  const out = await page.evaluate(() => {
    const T = window.__T, res = [];
    for (let n = 1; n <= T.LAST_STAGE; n++) {
      const def = T.stageDef(n), rows = def.rows, R = rows.length, C = rows[0].length;
      const moving = new Set(Object.keys(Object.assign({}, def.move || {}, def.loop || {})).map(Number));
      const vcols = new Set(Object.keys(def.vmove || {}).map(Number));
      const [vt, vb] = def.vband || [0, R - 1];
      const mov = (r, c) => moving.has(r) || (vcols.has(c) && r >= vt && r <= vb);
      const ch = (r, c) => rows[r][c];
      const hasKeys = rows.some(s => s.includes('k'));
      const autoSw = rows.some(s => s.includes('S'));
      // ball がいるところから下へ戻れるか。start は始めのマスの並び（top のときは0行目の全部）
      const solve = start => {
        const gone = new Set();         // 爆風で壊れた鉄
        const fired = new Set();        // 爆発した爆弾・火のついたもの
        let reach = new Set(), changed = true, keysOpen = !hasKeys, swReach = false, notes = new Set();
        const K = (r, c) => r * 100 + c;
        const blocked = (r, c) => {
          const x = ch(r, c);
          if (mov(r, c)) { if (x !== '.' && '#sSi+-LJ'.includes(x)) notes.add('動く行'); return false; }
          if (x === '#') return !gone.has(K(r, c));
          if (x === 's' || x === 'S' || x === 'i') return true;
          if (x === '+' || x === '-') return !(swReach || autoSw);
          if (x === 'L' || x === 'J') return !keysOpen;
          return false;
        };
        const boom = (r, c) => {
          if (fired.has(K(r, c))) return; fired.add(K(r, c));
          const x = ch(r, c);
          if (x === '*' || x === 'B' || x === 'T') {
            const d = x === 'B' ? 2 : 1;
            for (let i = r - d; i <= r + d; i++) for (let j = c - d; j <= c + d; j++) {
              if (i < 0 || j < 0 || i >= R || j >= C) continue;
              const y = ch(i, j);
              if (y === '#') gone.add(K(i, j));
              if (y === '*' || y === 'B' || y === 'T' || y === 'f' || y === '~') boom(i, j);
            }
          } else if (x === 'f') {
            for (const dir of [-1, 1]) for (let j = c + dir; j >= 0 && j < C; j += dir) {
              const y = ch(r, j);
              if (y === '#' && !gone.has(K(r, j))) break;
              if ('sSi+-'.includes(y)) break;
              if ((y === 'L' || y === 'J') && !keysOpen) break;
              if (y === '*' || y === 'T' || y === 'f' || y === '~') boom(r, j);
            }
          } else if (x === '~') {
            for (const [i, j] of [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]]) {
              if (i < 0 || j < 0 || i >= R || j >= C) continue;
              const y = ch(i, j);
              if (y === '~' || y === '*' || y === 'B' || y === 'T' || y === 'f') boom(i, j);
            }
          }
        };
        let down = false, iter = 0;
        while (changed && iter++ < 50) {
          changed = false;
          reach = new Set();
          const st = [];
          for (const [r, c] of start) if (!blocked(r, c)) st.push([r, c]);
          // 当たれるもの（通れないが、となりにボールが来るもの）
          const touch = new Set();
          while (st.length) {
            const [r, c] = st.pop();
            if (reach.has(K(r, c))) continue;
            reach.add(K(r, c));
            if (r === R - 1) down = true;
            const x = ch(r, c);
            if ('*Bf~'.includes(x) && !fired.has(K(r, c))) { boom(r, c); changed = true; }
            for (const [i, j] of [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]]) {
              if (i < 0 || j < 0 || i >= R || j >= C) continue;
              if (blocked(i, j)) { touch.add(K(i, j)); continue; }
              st.push([i, j]);
            }
          }
          // スイッチに当てられるか
          for (const k of touch) { const y = ch(Math.floor(k / 100), k % 100); if ((y === 's' || y === 'S') && !swReach) { swReach = true; changed = true; } }
          // 鍵が全部届けば錠が開く
          if (!keysOpen) {
            let all = true;
            for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) if (ch(r, c) === 'k' && !reach.has(K(r, c))) all = false;
            if (all) { keysOpen = true; changed = true; }
          }
          // ワープ
          for (const p of 'oO') {
            const cells = [];
            for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) if (ch(r, c) === p) cells.push([r, c]);
            if (cells.length === 2 && cells.some(([r, c]) => reach.has(K(r, c))) && !cells.every(([r, c]) => reach.has(K(r, c)))) {
              start = start.concat(cells); changed = true;
            }
          }
          // 筒に当たると、筒の上のマスへ出る
          for (const k of touch) { const r = Math.floor(k / 100), c = k % 100;
            if (ch(r, c) === 'i' && r > 0 && !reach.has(K(r - 1, c)) && !start.some(([a, b]) => a === r - 1 && b === c)) { start = start.concat([[r - 1, c]]); changed = true; } }
          if (down) break;
        }
        return {down, notes: [...notes]};
      };
      const top = [...Array(C).keys()].map(c => [0, c]);
      const r1 = solve(top);
      // 筒：下から入れる筒の上のマスから戻れるか
      const tubes = [];
      for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) if (ch(r, c) === 'i' && r > 0) {
        const t = solve([[r - 1, c]]);
        if (!t.down) tubes.push([r, c]);
      }
      const upOn = itemNo => (!T.ITEMS.up.from || itemNo >= T.ITEMS.up.from) && !(def.without || []).includes('up');
      if (!r1.down || tubes.length) res.push({n, top: !r1.down, up: upOn(T.itemNo(n)), tubes, notes: r1.notes});
    }
    return res;
  });
  let ng = 0;
  for (const x of out) {
    const bad = (x.top && x.up) || x.tubes.length;
    if (bad) ng++;
    const what = [x.top ? (x.up ? '上から戻れないのに「上」が出る' : '上から戻れない（「上」は出ない）') : '', x.tubes.length ? '筒から出たボールが戻れない ' + JSON.stringify(x.tubes) : '', x.notes.join(',')].filter(Boolean).join('。');
    console.log((bad ? 'NG ' : 'OK ') + x.n + '面：' + what);
  }
  console.log(ng ? 'NG ' + ng + '面' : 'all OK');
  process.exitCode = ng ? 1 : 0;
  await browser.close();
})();
