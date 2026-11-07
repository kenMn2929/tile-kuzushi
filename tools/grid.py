# tools/shots.js で撮った盤面の画像を、名前をつけて4列に並べる（8面を1枚にして見せるとき）
# 使い方：python3 tools/grid.py 画像のフォルダ 出力ファイル 面の番号:名前 ...
#   例：python3 tools/grid.py shots out.png 441:大砲 442:噴水
import os, sys
from PIL import Image, ImageDraw, ImageFont

src_dir, out_path = sys.argv[1], sys.argv[2]
items = [a.split(':', 1) for a in sys.argv[3:]]
try:
    font = ImageFont.truetype('/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc', 34)
except OSError:
    font = ImageFont.load_default()
ims = [(n, name, Image.open(os.path.join(src_dir, n + '.png'))) for n, name in items]
w, h = ims[0][2].size
pad, lab, cols = 20, 56, 4
rows = (len(ims) + cols - 1) // cols
out = Image.new('RGB', (w * cols + pad * (cols + 1), (h + lab) * rows + pad * (rows + 1)), (216, 226, 229))
d = ImageDraw.Draw(out)
for i, (n, name, im) in enumerate(ims):
    x = pad + (i % cols) * (w + pad)
    y = pad + (i // cols) * (h + lab + pad)
    d.text((x + 6, y + 8), f'{n}  {name}', font=font, fill=(27, 50, 65))
    out.paste(im, (x, y + lab))
out.save(out_path)
print(out_path, out.size)
