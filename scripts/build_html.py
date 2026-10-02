"""src/<ツール>/template.html を組み立てて dist/ に単一HTMLを作る。

テンプレートの中の置き換え：
  __FILE:パス__   そのファイルの中身をそのまま入れる（JS・CSS）
  __JSON:パス__   JSON を1行にして入れる（data/*.json）
パスはリポジトリのルートから。置き換えは1回だけ行う（入れた中身はもう一度は見ない）。
"""
import json, pathlib, re, sys
R = pathlib.Path(__file__).resolve().parent.parent
TOOLS = {                     # ツール名: 出力ファイル
    "calc": "yuke-calc.html",
    "enhance": "yuke-enhance.html",
    "index": "index.html",            # ツール一覧（ウェブで公開するときの入口）
}

def expand(m):
    kind, path = m.group(1), R / m.group(2)
    text = path.read_text(encoding="utf-8")
    return json.dumps(json.loads(text), ensure_ascii=False) if kind == "JSON" else text

def build(tool):
    t = (R / "src" / tool / "template.html").read_text(encoding="utf-8")
    t = re.sub(r"__(FILE|JSON):(.+?)__", expand, t)
    (R / "dist").mkdir(exist_ok=True)
    out = R / "dist" / TOOLS[tool]
    out.write_text(t, encoding="utf-8")
    print("wrote", out.relative_to(R), len(t))

for tool in (sys.argv[1:] or TOOLS):
    build(tool)
