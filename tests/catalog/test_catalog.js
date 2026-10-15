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
console.log(bad ? `${bad} NG` : "all OK");
process.exitCode = bad ? 1 : 0;
