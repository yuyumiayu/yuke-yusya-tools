// 組み立て（scripts/build_html.py）：データを埋め込むときの書き換えと、CSP
const {execFileSync} = require("child_process");
const fs = require("fs"), path = require("path"), crypto = require("crypto");
const ROOT = path.join(__dirname, "../..");
let bad = 0;
const check = (ok, msg, ...v) => { console.log(ok ? "OK" : "NG", msg, ...v); if (!ok) bad++; };
// build_html.embed_json を Python で呼ぶ（読み込んだだけでは組み立てない）
const embed = obj => execFileSync("python3", ["-c", "import sys, json; sys.path.insert(0, 'scripts'); import build_html; print(build_html.embed_json(json.loads(sys.argv[1])))", JSON.stringify(obj)],
  {cwd: ROOT, encoding: "utf-8"}).trim();

// データに </script> があっても script を抜けない（< を < にする）。読み直すと元のデータに戻る
{
  const evil = {text: "</script><script>alert(1)</script><!--"};
  const out = embed(evil);
  check(!out.includes("<") && JSON.stringify(JSON.parse(out)) === JSON.stringify(evil), "データの < は \\u003c にして埋め込む", out);
}
// 組み立てたページ：CSP があり、動くスクリプトはすべてハッシュで許されている。JSON の script には < がない
{
  execFileSync("python3", ["scripts/build_html.py"], {cwd: ROOT});
  for (const f of ["index.html", "yuke-calc.html", "yuke-enhance.html", "yuke-catalog.html"]){
    const html = fs.readFileSync(path.join(ROOT, "dist", f), "utf-8");
    const m = /<meta http-equiv="Content-Security-Policy" content="([^"]+)">/.exec(html);
    const scripts = [...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)];
    const run = scripts.filter(s => !/application\/json/.test(s[1])), data = scripts.filter(s => /application\/json/.test(s[1]));
    const hash = s => "'sha256-" + crypto.createHash("sha256").update(s, "utf-8").digest("base64") + "'";
    const scriptSrc = m ? m[1].split(";").find(d => d.trim().startsWith("script-src")) : "";
    const ok = m && /default-src 'none'/.test(m[1]) && !scriptSrc.includes("unsafe")
      && run.every(s => m[1].includes(hash(s[2]))) && data.every(s => !s[2].includes("<"));
    check(ok, `${f}：CSP あり、スクリプト ${run.length} 個がハッシュで許され、データ ${data.length} 個に < がない`);
  }
}
process.exitCode = bad ? 1 : 0;
if (!bad) console.log("all OK");
