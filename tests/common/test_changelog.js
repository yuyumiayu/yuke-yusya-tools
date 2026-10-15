// 更新履歴（data/changelog.json）の形
const L = require("../../data/changelog.json");
const TOOLS = ["calc", "enhance", "catalog"];
let bad = 0;
const check = (ok, label, detail = "") => { console.log(ok ? "OK" : "NG", label, detail); if (!ok) bad++; };
check(Array.isArray(L) && L.length > 0, "更新履歴は1件以上の配列", `${L.length}件`);
const badRow = L.find(x => !/^\d{4}-\d{2}-\d{2}$/.test(x.date) || isNaN(Date.parse(x.date)) || !Array.isArray(x.tools) || !x.tools.length
  || x.tools.some(t => !TOOLS.includes(t)) || typeof x.text !== "string" || !x.text.trim());
check(!badRow, "各行は 日付（YYYY-MM-DD）・ツール（calc／enhance／catalog）・文章", badRow ? JSON.stringify(badRow) : "");
check(L.every((x, i) => i === 0 || L[i - 1].date >= x.date), "新しい順に並んでいる");
check(TOOLS.every(t => L.some(x => x.tools.includes(t) && x.text.startsWith("公開"))), "どのツールにも「公開」の行がある");
console.log(bad ? `${bad} NG` : "all OK");
process.exitCode = bad ? 1 : 0;
