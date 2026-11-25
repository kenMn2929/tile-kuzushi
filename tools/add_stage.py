# 下書き（JSON）を、7周目の面のいちばん後ろ（STAGES7 の最後）に書き足す。使い方：
#   python3 tools/add_stage.py 下書き.json 'コメント（絵と仕掛けの説明）' [下書き.json 'コメント' ...]
# コメントは「// 」をつけて面の上に入れる。2行以上にするときは、コメントの中で \n を使う
# 書き足したあとは、check_stages.py・test_lap7.js・test_lap6.js・check_up.js を流す
import json, os, sys
here = os.path.dirname(os.path.abspath(__file__))
path = os.path.join(here, '..', 'index.html')
s = open(path, encoding='utf-8').read()
start = s.index('const STAGES7 = [')
end = s.index('\n];', start)
strs = lambda a: '[' + ','.join("'%s'" % x for x in a) + ']'
def fmt(d, note):
    lines = ['  // ' + l for l in note.split('\\n')]
    lines.append('  {rows: ' + strs(d['rows']) + ',')
    for k in ('tint', 'gold'):
        if k in d: lines.append('   %s: %s,' % (k, strs(d[k])))
    rest = []
    for k, v in d.items():
        if k in ('rows', 'tint', 'gold'): continue
        if isinstance(v, dict): rest.append('%s: {%s}' % (k, ', '.join('%s: %s' % kv for kv in v.items())))
        elif isinstance(v, list) and v and isinstance(v[0], str): rest.append('%s: [%s]' % (k, ', '.join("'%s'" % x for x in v)))
        elif isinstance(v, bool): rest.append('%s: %s' % (k, 'true' if v else 'false'))
        else: rest.append('%s: %s' % (k, json.dumps(v)))
    if rest: lines.append('   ' + ', '.join(rest) + '},')
    else: lines[-1] = lines[-1][:-1] + '},'
    return '\n'.join(lines)
a = sys.argv[1:]
if not a or len(a) % 2: sys.exit('使い方：python3 tools/add_stage.py 下書き.json コメント [...]')
add = [fmt(json.load(open(a[i], encoding='utf-8')), a[i + 1]) for i in range(0, len(a), 2)]
s = s[:end] + '\n' + '\n'.join(add) + s[end:]
open(path, 'w', encoding='utf-8').write(s)
print('書き足した：', len(add), '面')
