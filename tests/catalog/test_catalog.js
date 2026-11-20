// 装備図鑑：注釈（data/notes.json）とデータの整合
const N = require("../../data/notes.json");
let bad = 0;
const check = (ok, label, detail = "") => { console.log(ok ? "OK" : "NG", label, detail); if (!ok) bad++; };
const refs = (rows, fields) => new Set(rows.flatMap(x => fields.flatMap(k => (String(x[k] || "").match(/\*(\d+)/g) || []).map(m => m.slice(1)))));
const SRC = {
  weapon: [require("../../data/weapons.json"), ["ability", "base_text", "growth_text", "note"]],
  armor: [require("../../data/armors.json"), ["ability", "base_text", "growth_text", "note"]],
  item: [require("../../data/items.json"), ["base_text", "growth_text", "note"]],
  resonance: [require("../../data/resonances.json"), ["name", "effect", "name_note"]],
};
check(Object.keys(N).sort().join() === Object.keys(SRC).sort().join(), "注釈の分類は 武器・防具・道具・共鳴");
for (const [k, [rows, fields]] of Object.entries(SRC)){
  const used = refs(rows, fields), have = Object.keys(N[k] || {});
  const extra = have.filter(n => !used.has(n));                    // データにない番号（打ち間違い）
  const missing = have.length ? [...used].filter(n => !have.includes(n)) : [];   // 入れ始めた分類は全部そろえる
  check(!extra.length && !missing.length && have.every(n => String(N[k][n]).trim()),
    `注釈（${k}）：データの番号と注釈がそろっている`, `注釈${have.length}件／データ${used.size}件` + (extra.length ? ` 余り:${extra}` : "") + (missing.length ? ` 不足:${missing}` : ""));
}
// 共鳴の「ない」の説明は、片方だけ今のゲームにない共鳴があるときだけ置く（メンテナー判断）。なくなったら説明を消す
{
  const g = {}; [...SRC.weapon[0], ...SRC.armor[0]].forEach(x => { g[x.name] = x.in_game; });
  const one = SRC.resonance[0].filter(r => (g[r.weapon] === false) !== (g[r.armor] === false)).map(r => r.name);
  const html = require("fs").readFileSync(require("path").join(__dirname, "../../src/catalog/template.html"), "utf8");
  check(one.length > 0 === html.includes('id="note-res"'), "共鳴の「ない」の説明：片方だけ今のゲームにない共鳴があるときだけ出す",
    one.length ? `今は ${one.join("・")}` : "片方だけの共鳴がなくなったので、src/catalog/template.html の note-res を消す");
}
console.log(bad ? `${bad} NG` : "all OK");
process.exitCode = bad ? 1 : 0;
