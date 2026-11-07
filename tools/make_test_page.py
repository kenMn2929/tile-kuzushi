# 確かめるための写しのページを作る。使い方：python3 tools/make_test_page.py 出力フォルダ
# index.html はゲーム全体が1つの関数の中にあるので、外から S（ゲームの状態）や関数にさわれない。
# 写しの最後に window.__T を足して、自動プレイやテストから使えるようにする。リポジトリの index.html は変えない
import os, sys

here = os.path.dirname(os.path.abspath(__file__))
src_path = os.path.join(here, '..', 'index.html')
out_dir = sys.argv[1] if len(sys.argv) > 1 else '.'
s = open(src_path, encoding='utf-8').read()
hook = """
window.__T = {S, stageClear, update, loadStage, startGame, startStage, launch, stageDef, applyItem, enterStage, freeCell, LAST_STAGE, LAP5_FROM, lapOf, dropSpeed, stageSpeed, W, H, PADDLE_Y, draw, showHelp, showTitle, setPick, goTitle,
  get onPrimary(){ return onPrimary; }, get COLS(){ return COLS; }, get BRICK_W(){ return BRICK_W; }};
if (window.claude && window.claude.hot && typeof window.claude.hot.snapshot === 'function') {"""
old = "\nif (window.claude && window.claude.hot && typeof window.claude.hot.snapshot === 'function') {"
if s.count(old) != 1:
    sys.exit('index.html の終わりの形が変わっていて、window.__T を足せない')
s = s.replace(old, hook)
os.makedirs(out_dir, exist_ok=True)
out = os.path.join(out_dir, 'test.html')
open(out, 'w', encoding='utf-8').write(s)
print(out)
