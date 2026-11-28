// 面の下書きをまとめて試す。並べ方のチェックと自動プレイを、CPU の数だけ並べて流し、1面1行の表だけを出す
// 使い方：node tools/tune.js 作業用フォルダ 回数 下書き.json ... [--base=面の番号]
//   下書き：1ファイルに1面の定義を JSON で書く（index.html の面と同じ中身。キーは "rows" "tint" "move" "sparrow" など）
//     例：{"rows":["..33......","..."],"tint":["..RR......","..."],"move":{"9":60},"thrower":true,"sparrow":2}
//   下書きのかわりに面の番号（例：529）を書くと、index.html にあるその面をそのまま測る（比べるため）
//   作業用フォルダ：確かめ用のページ（test.html）を作るフォルダ。毎回 index.html から作りなおす
//   回数：決めるときは128。形をしぼるあいだは64でよい（64回では0.2〜0.3個上下する）
//   --base：下書きを置きかえて遊ばせる面の番号（はじめは、いまの最後の面）。列の数や下りる速さは、この面の周の決まりになる
// 出力：名前  チェック（ok か、NG の中身）  タイルの枚数  硬さの合計  行数  失ったボール（1回あたり）  クリアまでの平均秒数  クリアできた回数
const { execFileSync, execFile } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const tools = __dirname;
const args = process.argv.slice(2);
const opt = k => (args.find(a => a.startsWith('--' + k + '=')) || '').split('=')[1];
const [dir, runsArg, ...items] = args.filter(a => !a.startsWith('--'));
if (!dir || !runsArg || !items.length) { console.log('使い方：node tools/tune.js 作業用フォルダ 回数 下書き.json ... [--base=面の番号]'); process.exit(1); }
const runs = +runsArg;
execFileSync('python3', [path.join(tools, 'make_test_page.py'), dir]);
const html = fs.readFileSync(path.join(dir, 'test.html'), 'utf8');
// いまの最後の面の番号（7周目の面の数から）
const lap7 = html.slice(html.indexOf('const STAGES7 = ['));
const last = 600 + (lap7.slice(0, lap7.indexOf('\n];')).match(/^\s*\{rows: /gm) || []).length;
const base = +(opt('base') || last);
const HP = {'*': 1, '#': 0, r: 2, R: 3, v: 2, z: 3, t: 2, B: 3, V: 3, '?': 2, k: 1, L: 2, m: 1, J: 2, M: 2, g: 2, p: 1, P: 1, f: 1, e: 1,
  '<': 2, '>': 2, u: 1, n: 1, '[': 3, ']': 3, N: 1, y: 2, a: 1, d: 2, s: 0, S: 0, '+': 0, '-': 0, h: 1, c: 2, i: 0, '~': 1, W: 1, T: 1, '@': 0, C: 0, l: 1, q: 0, o: 0, O: 0, w: 0, x: 0, X: 0};
const hard = rows => rows.join('').split('').reduce((a, ch) => a + (ch === '.' ? 0 : /\d/.test(ch) ? +ch : HP[ch] ?? 1), 0);
const jobs = items.map(it => {
  if (/^\d+$/.test(it)) return {name: it, stage: +it};
  const def = JSON.parse(fs.readFileSync(it, 'utf8'));
  const chk = execFileSync('python3', [path.join(tools, 'check_stages.py'), '--draft', it]).toString().trim().split('\n');
  const bad = chk.filter(l => !/ tiles \d+ rows /.test(l) && !/^ok /.test(l));
  const info = chk.find(l => / tiles \d+ rows /.test(l)) || '';
  return {name: path.basename(it, '.json'), stage: base, json: JSON.stringify(def), check: bad.length ? bad.join(' / ') : 'ok',
    tiles: +(info.match(/tiles (\d+)/) || [])[1], hp: hard(def.rows), rows: def.rows.length};
});
// 面の番号で測るものは、index.html の中身から枚数と硬さを出さない（チェックは check_stages.py で全部の面を見る）
const res = new Array(jobs.length);
let next = 0;
const worker = () => new Promise(done => {
  const go = () => {
    const i = next++;
    if (i >= jobs.length) return done();
    const j = jobs[i];
    const a = [path.join(tools, 'autoplay.js'), dir, String(j.stage), String(runs)];
    if (j.json) a.push(j.json);
    execFile('node', a, {maxBuffer: 1 << 24}, (err, out) => {
      const line = (out || '').split('\n').find(l => / clear \d+\/\d+ lost /.test(l)) || '';
      const m = line.match(/clear (\d+)\/(\d+) lost ([\d.]+) time (\d+)/);
      res[i] = m ? {clear: m[1] + '/' + m[2], lost: m[3], time: m[4]} : {clear: '-', lost: '-', time: '-', err: (err && err.message || out || '').slice(0, 200)};
      go();
    });
  };
  go();
});
(async () => {
  await Promise.all(Array.from({length: Math.max(1, Math.min(os.cpus().length, jobs.length))}, worker));
  console.log(['名前', 'チェック', '枚数', '硬さ', '行', '失ったボール', '秒', 'クリア'].join('\t'));
  jobs.forEach((j, i) => {
    const r = res[i];
    console.log([j.name, j.check || '-', j.tiles || '-', j.hp || '-', j.rows || '-', r.lost, r.time, r.clear].join('\t') + (r.err ? '\t' + r.err : ''));
  });
})();
