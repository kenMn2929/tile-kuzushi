# 5周目（STAGES5）と6周目（STAGES6）の面の並べ方を調べる。使い方：python3 tools/check_stages.py [index.html]
# 調べること：
#   - 壁がどちらの向きでも、割るタイルに下から届くか。スイッチに下から当てられるか（ボールが閉じこめられないか）
#   - 動く行・動く列（の動く範囲）に、置いてはいけないものがないか
#   - かざぐるまの真上と真下が空いているか、ワープが4行目までか、落ちるタイルの下にタイルがあるか、ふたごとワープが2つずつか
#   - 筒の真上のマスが空いていて、動く行や動く列の動く範囲でないか（撃ち出したボールの通り道）
#   - 割れないもの（スイッチ・壁・鉄・錠・筒）が、割るタイルのいちばん下の行より下にないか（501面からのボーナスステージは調べない）
#   - tint の字と長さ。gold（金のタイルにするマス）の字と長さ
# あわせて、面ごとの割るタイルの枚数と、並べ方の型（上や下の行が横一列か、左右対称か、両端だけの行があるか）を数える
import re, sys, os
path = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'index.html')
src = open(path, encoding='utf-8').read()
def stage_defs(name):
    block = src[src.index('const ' + name + ' = ['):]
    block = block[:block.index('\n];')] + '\n'
    return re.findall(r"\{rows: \[((?:'[^']*',?\s*)*)\](.*?)\},?\n", block, re.S)
defs = [(401 + i, d) for i, d in enumerate(stage_defs('STAGES5'))]
defs += [(501 + i, d) for i, d in enumerate(stage_defs('STAGES6'))]
ok = True
stats = {'top': 0, 'bottom': 0, 'sym': 0, 'frame': 0}
for n, (rows_s, rest) in defs:
    rows = re.findall(r"'([^']*)'", rows_s)
    moving = set(int(k) for k in re.findall(r"(\d+):", ' '.join(re.findall(r"(?<![a-z])(?:move|loop): \{([^}]*)\}", rest))))
    vcols = set(int(k) for k in re.findall(r"(\d+):", ' '.join(re.findall(r"vmove: \{([^}]*)\}", rest))))
    R, Cn = len(rows), len(rows[0])
    vb = re.search(r"vband: \[(\d+), (\d+)\]", rest)
    vtop, vbot = (int(vb.group(1)), int(vb.group(2))) if vb else (0, R - 1)
    inv = lambda r, c: c in vcols and vtop <= r <= vbot
    for r, row in enumerate(rows):
        if len(row) != Cn: print(n, 'row length', r, row); ok = False
        for c, ch in enumerate(row):
            if ch in '+-sSwoOnNdexXveLJkhci' and (r in moving or inv(r, c)):
                print(n, 'fixed thing in moving row/col', r, c, ch); ok = False
            if ch in 'xX':
                for rr in (r - 1, r + 1):
                    if 0 <= rr < R and (rows[rr][c] != '.' or rr in moving or inv(rr, c)):
                        print(n, 'kaze needs empty still cell above/below', r, c); ok = False
            if ch == 'i' and (r == 0 or rows[r - 1][c] != '.' or (r - 1) in moving or inv(r - 1, c)):
                print(n, 'tube needs an empty still cell above', r, c); ok = False
            if ch in 'oO' and r > 4:
                print(n, 'warp below row 4', r, c); ok = False
            if ch == 'd' and (r + 1 >= R or rows[r + 1][c] in '.+-'):
                print(n, 'faller without tile below', r, c); ok = False
    for ch in 'pPoO':
        k = sum(row.count(ch) for row in rows)
        if k not in (0, 2): print(n, 'pair count', ch, k); ok = False
    for side in (0, 1):
        def block_(r, c):
            ch = rows[r][c]
            if ch in '#LJsSi': return True
            if ch == '+': return side == 0
            if ch == '-': return side == 1
            return False
        seen = set()
        stack = [(R, c) for c in range(Cn)]
        while stack:
            r, c = stack.pop()
            for dr, dc in ((1,0),(-1,0),(0,1),(0,-1)):
                q = (r + dr, c + dc)
                if not (0 <= q[0] < R and 0 <= q[1] < Cn) or q in seen or block_(*q): continue
                seen.add(q); stack.append(q)
        for r in range(R):
            for c in range(Cn):
                ch = rows[r][c]
                if not block_(r, c) and ch not in '.+-' and (r, c) not in seen:
                    print(n, 'side', side, 'unreachable tile', r, c, ch); ok = False
                if ch in 'sS':
                    nb = [(r+1,c),(r-1,c),(r,c+1),(r,c-1)]
                    if not any(q in seen or q[0] == R for q in nb):
                        print(n, 'side', side, 'switch unreachable', r, c); ok = False
    t = re.search(r"tint: \[((?:'[^']*',?\s*)*)\]", rest)
    if t:
        tint = re.findall(r"'([^']*)'", t.group(1))
        if len(tint) > R: print(n, 'tint has more rows than rows'); ok = False
        for r, (tr, row) in enumerate(zip(tint, rows)):
            if len(tr) != len(row): print(n, 'tint row length', r); ok = False
            for c, ch in enumerate(tr):
                if ch == '.': continue
                if ch not in 'RYGABSPVK': print(n, 'bad tint letter', r, c, ch); ok = False
                elif c < len(row) and row[c] == '.': print(n, 'tint on empty cell', r, c); ok = False
    g = re.search(r"gold: \[((?:'[^']*',?\s*)*)\]", rest)
    if g:
        gold = re.findall(r"'([^']*)'", g.group(1))
        if len(gold) > R: print(n, 'gold has more rows than rows'); ok = False
        for r, (gr, row) in enumerate(zip(gold, rows)):
            if len(gr) != len(row): print(n, 'gold row length', r); ok = False
            for c, ch in enumerate(gr):
                if ch == '.': continue
                if ch != '$': print(n, 'bad gold letter', r, c, ch); ok = False
                elif c < len(row) and row[c] in '.+-sS#wxXoOLJi': print(n, 'gold on a cell without a breakable tile', r, c); ok = False
    tiles = sum(1 for row in rows for ch in row if ch not in '.+-sS#wxXoOi')
    # 割れないもの（スイッチ・壁・鉄・錠・筒）は、割るタイルのいちばん下の行より下に置かない
    low_tile = max(r for r, row in enumerate(rows) if any(ch not in '.+-sS#wxXoOLJi' for ch in row))
    low_hard = max([r for r, row in enumerate(rows) if any(ch in '+-sS#LJi' for ch in row)] or [-1])
    # 6周目のボーナスステージ（501面から）は、きっかけのタイルだけ下から当てられるように、いちばん下に鉄の机や土台を置いてよい
    if low_hard > low_tile and n < 501:
        print(n, 'unbreakable below lowest tile row', low_hard, '>', low_tile); ok = False
    shape = lambda r: ''.join('.' if ch == '.' else 'X' for ch in r)
    top = '.' not in rows[0]
    bot = '.' not in rows[-1]
    sym = all(shape(r) == shape(r)[::-1] for r in rows)
    frame = any(re.fullmatch(r"[^.]\.{%d}[^.]" % (Cn - 2), r) for r in rows)
    for k, v in (('top', top), ('bottom', bot), ('sym', sym), ('frame', frame)): stats[k] += v
    print(n, 'tiles', tiles, 'rows', R, 'top-full' if top else '', 'bottom-full' if bot else '', 'symmetric' if sym else '', 'frame' if frame else '')
print('ok' if ok else 'NG', len(defs), 'stages', stats)
