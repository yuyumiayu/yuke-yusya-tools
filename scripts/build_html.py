"""src/<ツール>/template.html を組み立てて dist/ に単一HTMLを作る。

テンプレートの中の置き換え：
  __FILE:パス__   そのファイルの中身をそのまま入れる（JS・CSS）
  __JSON:パス__   JSON を1行にして入れる（data/*.json）。< は \\u003c にする（データに </script> があっても script を抜けないように）
パスはリポジトリのルートから。置き換えは1回だけ行う（入れた中身はもう一度は見ない）。

組み立てたあと、<meta charset> の直後に CSP（Content-Security-Policy）を入れる。
動くスクリプトは、このページに入っている script 要素（JSON 以外）だけを、中身のハッシュで許す。
"""
import base64, hashlib, json, pathlib, re, sys
R = pathlib.Path(__file__).resolve().parent.parent
TOOLS = {                     # ツール名: 出力ファイル
    "calc": "yuke-calc.html",
    "enhance": "yuke-enhance.html",
    "catalog": "yuke-catalog.html",
    "index": "index.html",            # ツール一覧（ウェブで公開するときの入口）
}

def embed_json(obj):
    return json.dumps(obj, ensure_ascii=False).replace("<", "\\u003c")

def expand(m):
    kind, path = m.group(1), R / m.group(2)
    text = path.read_text(encoding="utf-8")
    return embed_json(json.loads(text)) if kind == "JSON" else text

# CSP：スクリプトはハッシュで許したものだけ。総当たりの Worker は Blob から作るので worker-src blob:。
# スタイルは HTML の style 属性と Google Fonts。外への通信（fetch など）はしない
SCRIPT = re.compile(r"<script(?![^>]*application/json)[^>]*>(.*?)</script>", re.S)
def csp(html):
    hashes = sorted({"'sha256-" + base64.b64encode(hashlib.sha256(s.encode("utf-8")).digest()).decode() + "'"
                     for s in SCRIPT.findall(html)})
    return "; ".join([
        "default-src 'none'",
        "script-src " + (" ".join(hashes) or "'none'"),
        "worker-src blob:",
        "style-src 'unsafe-inline' https://fonts.googleapis.com",
        "font-src https://fonts.gstatic.com",
        "img-src data:",
        "base-uri 'none'",
        "form-action 'none'",
    ])

def build(tool):
    t = (R / "src" / tool / "template.html").read_text(encoding="utf-8")
    t = re.sub(r"__(FILE|JSON):(.+?)__", expand, t)
    head = '<meta charset="utf-8">'
    assert t.count(head) == 1, tool
    t = t.replace(head, head + f'\n<meta http-equiv="Content-Security-Policy" content="{csp(t)}">')
    (R / "dist").mkdir(exist_ok=True)
    out = R / "dist" / TOOLS[tool]
    out.write_text(t, encoding="utf-8")
    print("wrote", out.relative_to(R), len(t))

if __name__ == "__main__":
    for tool in (sys.argv[1:] or TOOLS):
        build(tool)
