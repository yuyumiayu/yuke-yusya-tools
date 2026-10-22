const {build, forest, synth, resonances, startLevel} = require("../../src/calc/engine.js");
const W = require("../../data/weapons.json"), A = require("../../data/armors.json"), I = require("../../data/items.json");
const w = n => W.find(x=>x.name===n), a = n => A.find(x=>x.name===n), i = n => I.find(x=>x.name===n);
const ab = {生大:"生命の木の大葉",体大:"体力の木の大葉",豪大:"豪腕の木の大葉",守大:"守りの木の大葉",守実:"守りの木の実",護大:"守護の木の大葉"};
// wiki 4F表の列順（道具の組み合わせ）
const cols = [[],["生大","体大"],["生大","豪大"],["生大","守大"],["生大","守実"],["生大","護大"],["生大"],
 ["体大","体大"],["体大","豪大"],["体大","守大"],["体大","守実"],["体大","護大"],["体大"],
 ["豪大","豪大"],["豪大","守大"],["豪大","守実"],["豪大","護大"],["豪大"],
 ["守大","守大"],["守大","守実"],["守大","護大"],["守大"],
 ["守実","守実"],["守実","護大"],["守実"]];
const rows = {
 "正宗|0":"20 61 54 53 53 46 39 64 57 49 49 49 42 50 49 49 42 35 36 36 34 34 36 34 34",
 "正宗|117":"57 83 76 90 90 83 76 71 64 71 71 71 64 57 71 71 64 57 73 73 71 71 73 71 71",
 "ブラッドソード|0":"20 59 52 46 46 39 32 64 57 54 54 54 47 50 54 54 47 40 36 36 34 34 36 34 34",
 "妖刀黒雫|0":"25 59 52 51 51 44 37 71 64 54 54 54 47 57 54 54 47 40 41 41 39 39 41 39 39",
 "妖刀黒雫|96":"57 76 69 83 83 76 69 71 64 71 71 71 64 57 71 71 64 57 73 73 71 71 73 71 71",
 "水龍の剣|0":"51 88 88 65 65 63 63 85 83 78 78 78 76 83 78 78 76 76 53 53 53 53 53 53 53",
 "アークブレイド|0":"54 85 83 70 70 70 68 78 78 71 71 71 71 76 71 71 71 69 56 56 56 56 56 56 56",
 "竜神の剣|0":"56 85 85 70 70 70 70 78 78 71 71 71 71 78 71 71 71 71 56 56 56 56 56 56 56",
 "光輝の剣|0":"51 85 85 70 70 70 70 73 73 66 66 66 66 73 66 66 66 66 51 51 51 51 51 51 51",
 "鉄の斧|0":"20 66 59 53 53 46 39 64 57 54 54 54 47 50 54 54 47 40 36 36 34 34 36 34 34",
 "セラミックソード|0":"40 83 76 73 73 66 59 71 64 71 71 71 64 57 71 71 64 57 56 56 54 54 56 54 54",
 "オニの金棒|0":"55 55 51 51 36 36 36 36 51 36 36 36 36",
 "桜橘の刀|0":"55 55 56 56 41 41 41 41 56 41 41 41 41",
 "盗賊のナイフ|0":"49 42 35",
};
let bad=0, total=0;
for (const [key, s] of Object.entries(rows)) {
  const [wn, e] = key.split("|"); const exp = s.split(" ").map(Number);
  const got = cols.map(c => { const r = build(w(wn), +e, a("ハイランドメイル"), 60, c.map(x=>i(ab[x]))); const f = forest(r); return f.ok4 ? f.score : null; }).filter(x=>x!==null);
  total++; const same = JSON.stringify(got)===JSON.stringify(exp);
  if(!same){bad++; console.log("NG", key, "\n exp", exp.join(" "), "\n got", got.join(" "));} else console.log("OK", key);
}
console.log(`${total-bad}/${total} rows match`);

// ===== 合成（wiki「合成屋」の例） =====
{
  const s = synth(w("ヘビーソード"),80,w("ドラゴンソード"),45,0);
  const ok = s.gear.base.atk===35 && s.gear.base.def===5 && s.gear.base.eva===0 && s.gear.growth.atk===3 && s.gear.growth.def===1
    && s.gear.rarity===3 && s.enh===63 && s.ore===3 && s.minutes===1875 && s.cost===68200;
  console.log(ok ? "OK" : "NG", "合成 ヘビーソード+80＋ドラゴンソード+45"); if(!ok) bad++;
  const t = synth(w("光輝の剣"),14,w("ナイトソード"),45,0);
  const ok2 = t.enh===30 && t.isMax; console.log(ok2 ? "OK" : "NG", "合成 光輝+14＋ナイト+45 → +30(MAX)"); if(!ok2) bad++;
}
// ===== 切り捨てで計算した値との照合：こちらは切り上げなので各+1 =====
{
  const r = build(w("アークブレイド"),8,a("龍鱗の鎧"),5,[i("守りの木の実"),i("体力の木の大葉")]);
  const got = r.at(18), exp = {hp:273,atk:261,def:330,eva:96,luk:24};
  const ok = Object.keys(exp).every(k=>got[k]===exp[k]); console.log(ok?"OK":"NG","Lv18 アクブレ+8/龍鱗+5/守実/体大（切り捨てなら272/260/329/95/23）"); if(!ok) bad++;
}
// ===== 共鳴（Lv1 の値。実機での確認は docs/実機テスト.md） =====
{
  const R = require("../../data/resonances.json");
  const lv1 = (wg, ag, items=[]) => { const res = resonances(wg, ag, R); return {names: res.map(r=>r.name), s: build(wg, 0, ag, 0, items, res).at(1)}; };
  const sw = (x,y) => synth(w(x),0,w(y),0,0).gear, sa = (x,y) => synth(a(x),0,a(y),0,0).gear;
  const cases = [
    ["鉄の剣×鉄の鎧", lv1(w("鉄の剣"), a("鉄の鎧")), ["運アップ(微)"], {luk:15}],
    ["金の剣×金の鎧", lv1(w("金の剣"), a("金の鎧")), ["運アップ(中)"], {luk:65}],
    ["セラミック一式", lv1(w("セラミックソード"), a("セラミックメイル")), ["基本値アップ"], {atk:185, def:185}],
    ["ダーク一式", lv1(w("ダークブレイド"), a("ダークメイル")), ["負ステータス耐性"], {hp:30, atk:70, def:70, eva:5}],
    ["バスター一式", lv1(w("バスターソード"), a("バスターメイル")), ["生命アップ"], {hp:60}],
    ["鉄の剣＋金の剣×鉄の鎧＋金の鎧", lv1(sw("鉄の剣","金の剣"), sa("鉄の鎧","金の鎧")), ["運アップ(微)","運アップ(中)"], {luk:75}],
    ["鉄のナイフ＋金の斧×鉄の鎧＋金の鎧", lv1(sw("鉄のナイフ","金の斧"), sa("鉄の鎧","金の鎧")), ["連続攻撃(微)","金貨泥棒(強)"], {luk:35}],
    ["鉄のナイフ＋金のナイフ×鉄の鎧＋金の鎧", lv1(sw("鉄のナイフ","金のナイフ"), sa("鉄の鎧","金の鎧")), ["連続攻撃(微)","連続攻撃(中)"], {luk:25}],
    ["鉄の剣×銀の鎧（共鳴なし）", lv1(w("鉄の剣"), a("銀の鎧")), [], {luk:5}],
    ["正宗×太陽の鎧＋力餅（倍率の足し算）", lv1(w("正宗"), a("太陽の鎧"), [i("力餅")]), [], {atk:86}],
  ];
  for (const [label, got, names, exp] of cases){
    const ok = JSON.stringify(got.names)===JSON.stringify(names) && Object.keys(exp).every(k=>got.s[k]===exp[k]);
    console.log(ok?"OK":"NG", "共鳴", label, got.names.join("/"), JSON.stringify(got.s)); if(!ok) bad++;
  }
}
// ===== 神様の加護（武器なしで攻、防具なしで防が+2〜3。平均の2.5で計算） =====
{
  const both = build(w("正宗"),0,a("ハイランドメイル"),60,[]);
  const noW = build(null,0,a("ハイランドメイル"),60,[]), noA = build(w("正宗"),0,null,0,[]), none = build(null,0,null,0,[]);
  const ok = both.kago.atk === 0 && both.kago.def === 0
    && noW.kago.atk === 2.5 && noW.kago.def === 0 && noW.at(1).atk === 8 && noW.at(1).def === both.at(1).def
    && noA.kago.atk === 0 && noA.kago.def === 2.5 && noA.at(1).def === 8 && noA.at(1).atk === both.at(1).atk
    && none.at(1).atk === 8 && none.at(1).def === 8 && none.at(1).hp === 30
    && none.at(14).atk === Math.ceil(7.5 + 2.5*13) && none.at(14).def === Math.ceil(7.5 + 2.5*13);
  console.log(ok?"OK":"NG", "神様の加護：装備しない欄だけ+2.5（Lv1 は切り上げで8）、HPは変わらない"); if(!ok) bad++;
}
// ===== 出発時レベル（経験値テーブル：Lv2=10, Lv3=40, Lv4=90, Lv5=160, Lv6=250） =====
{
  const lvs = [0,10,39,40,50,89,90,100,150,200,300].map(startLevel).join(",");
  const ok = lvs === "1,2,2,3,3,3,4,4,4,5,6"; console.log(ok?"OK":"NG", "経験値→出発時レベル", lvs); if(!ok) bad++;
  const cases = [
    [[], null, 1], [["経験の木の葉"], null, 3], [["経験の木の大葉"], null, 4],
    [["経験の木の葉","経験の木の大葉"], null, 4], [["経験の木の大葉","経験の木の大葉"], null, 5],
    [["経験の木の大葉","経験の木の大葉"], "ターキーメイル", 6],
  ];
  for (const [its, arm, exp] of cases){
    const r = build(w("正宗"), 0, a(arm||"ハイランドメイル"), 0, its.map(i));
    const ok = r.start === exp; console.log(ok?"OK":"NG", "出発時", its.join("＋")||"なし", arm||"", "→ Lv"+r.start); if(!ok) bad++;
  }
  // 森：「Lv1」の条件（4F切捨 HP≥50、加点1 HP≥70）は出発時レベルで判定する
  const f0 = forest(build(w("正宗"),0,a("ハイランドメイル"),60,[]));
  const f3 = forest(build(w("正宗"),0,a("ハイランドメイル"),60,[i("経験の木の葉")]));
  const ok2 = !f0.crit[0].ok && f0.crit[0].vals[0]===60 && f3.crit[0].ok && f3.crit[0].conds[0][0]===3 && f3.crit[0].vals[0]===73
    && f3.cut4[0].conds[0][0]===3 && f0.score===20 && f3.score===25;
  console.log(ok2?"OK":"NG", "森 正宗+0/ハイメ+60：葉なし HP60（加点1なし）→ 経験の木の葉 Lv3 HP73（加点1あり）"); if(!ok2) bad++;
}
// ===== 総当たり =====
{
  Object.assign(global, require("../../src/calc/engine.js"));
  const {makeSearch, mergeResults} = require("../../src/calc/search.js");
  const R = require("../../data/resonances.json");
  const run = sp => { const s = makeSearch(sp, R); while (!s.step(5000)); return s; };
  // 正宗+0／ハイメ+60 で道具2つを総当たり → wiki 4F表の正宗+0行の最高点 64
  const base = {w:{fixed:{g:w("正宗"), e:0}}, a:{fixed:{g:a("ハイランドメイル"), e:60}}, i1:{all:true}, i2:{all:true}, items:I, need4:true, top:5};
  const s1 = run(base), r1 = s1.results();
  const ok1 = s1.total === (I.length+1)*(I.length+2)/2 && r1[0].score === 64;   // 「なし」込みで順番違いをまとめた数
  console.log(ok1?"OK":"NG", "総当たり 道具2つ", s1.total, "通り 最高", r1[0].score); if(!ok1) bad++;
  // 分担して回しても1本で回したのと同じ上位になる
  const cands = {w:{cands:W.filter(x=>x.rarity===4)}, a:{cands:A.filter(x=>x.rarity<=2 && x.base.def!==null)}, i1:{fixed:i("生命の木の大葉")}, i2:{all:true}, items:I.slice(0,20), need4:false, top:10};
  const one = run(cands).results(), many = mergeResults([0,1,2].map(k => run({...cands, shard:k, shards:3}).results()), 10);
  const key = l => l.map(x => x.score + x.w + x.a + x.items.join()).join("|");
  const ok2 = key(one) === key(many); console.log(ok2?"OK":"NG", "総当たり 3分割＝1本"); if(!ok2) bad++;
  // 上位は forest() を直接呼んだ結果と一致する
  const ok3 = one.every(x => forest(build(w(x.w), x.we, a(x.a), x.ae, x.items.map(n=>n&&i(n)), resonances(w(x.w), a(x.a), R))).score === x.score);
  console.log(ok3?"OK":"NG", "総当たり 上位の点数を個別計算で確認"); if(!ok3) bad++;
  // 合成も探す：違う装備2つで合計レア度が上限以下の組だけ（同じ装備どうしは合成できない）。素材MAX・祝福+3
  const {slotList, BLESS_MAX} = require("../../src/calc/search.js");
  const c3 = ["ショートソード","水龍の剣","正宗"].map(w);   // ☆1・☆3・☆3
  const names = cap => slotList({cands:c3, synth:{cap}}).map(x => x.g.name + "+" + x.e).join(",");
  const ok4 = names(4) === "ショートソード+200,水龍の剣+75,正宗+500,ショートソード＋水龍の剣+141,ショートソード＋正宗+353"
    && slotList({cands:c3, synth:{cap:6}}).length === 3 + 3 && slotList({cands:c3}).length === 3 && BLESS_MAX === 3;
  console.log(ok4?"OK":"NG", "総当たり 合成候補（上限4）", names(4)); if(!ok4) bad++;
  const sw = run({...base, w:{cands:c3, synth:{cap:4}}, i2:{fixed:null}, top:3}).results()[0];
  const sg = synth(w(sw.wParts[0]), w(sw.wParts[0]).max_enhance, w(sw.wParts[1]), w(sw.wParts[1]).max_enhance, 3);
  const direct = forest(build(sg.gear, sg.total, a("ハイランドメイル"), 60, sw.items.map(n=>n&&i(n)), resonances(sg.gear, a("ハイランドメイル"), R))).score;
  const ok5 = sw.score === direct && sw.we === sg.total; console.log(ok5?"OK":"NG", "総当たり 合成の結果を個別計算で確認", sw.w, "+"+sw.we, sw.score+"点"); if(!ok5) bad++;
  // 強化値の指定（#7）：指定した装備はその値（0〜上限に収める）、指定なしはMAX。合成の素材も同じ値で平均を取り、祝福+3
  const en = {"正宗":100, "ショートソード":999, "水龍の剣":-5};
  const namesE = slotList({cands:c3, synth:{cap:4}, enh:en}).map(x => x.g.name + "+" + x.e).join(",");
  const ok6 = namesE === "ショートソード+200,水龍の剣+0,正宗+100,ショートソード＋水龍の剣+103,ショートソード＋正宗+153"
    && slotList({cands:c3, enh:{}}).map(x => x.e).join() === "200,75,500";
  console.log(ok6?"OK":"NG", "総当たり 強化値の指定", namesE); if(!ok6) bad++;
  const se = run({...base, w:{cands:[w("正宗")], enh:{"正宗":120}}, i2:{fixed:null}, top:1}).results()[0];
  const ok7 = se.we === 120 && se.score === forest(build(w("正宗"), 120, a("ハイランドメイル"), 60, se.items.map(n=>n&&i(n)), resonances(w("正宗"), a("ハイランドメイル"), R))).score;
  console.log(ok7?"OK":"NG", "総当たり 指定した強化値で回す（正宗+120）", se.score+"点"); if(!ok7) bad++;
  // 片方の素材を固定（synth.pin）：固定した素材＋候補1つの合成だけ（同じ装備・上限を超える組は除く）。素の候補は入れたまま
  const pin = {g:w("正宗"), e:500};
  const namesP = cap => slotList({cands:c3, synth:{cap, pin}}).map(x => x.g.name + "+" + x.e).join(",");
  const ok8 = namesP(4) === "ショートソード+200,水龍の剣+75,正宗+500,正宗＋ショートソード+353"
    && namesP(6) === "ショートソード+200,水龍の剣+75,正宗+500,正宗＋ショートソード+353,正宗＋水龍の剣+291"
    && slotList({cands:c3, synth:{cap:4, pin:{g:w("正宗"), e:100}}}).pop().e === Math.ceil((100+200)/2) + 3;
  console.log(ok8?"OK":"NG", "総当たり 片方の素材を固定（正宗+500）", namesP(6)); if(!ok8) bad++;
  // 結果に合成鉱（合計レア度、最低2）。素の装備は null
  const sp = run({...base, w:{cands:c3, synth:{cap:4, pin}}, i1:{fixed:null}, i2:{fixed:null}, need4:false, top:10}).results();   // 素3つ＋合成1つの4通り
  const syn = sp.find(x => x.wParts), plain = sp.find(x => !x.wParts);
  const ok9 = sp.length === 4 && syn && syn.wOre === 4 && syn.wParts.join() === "正宗,ショートソード" && plain && plain.wOre === null && sp.every(x => x.aOre === null);
  console.log(ok9?"OK":"NG", "総当たり 結果に合成鉱（正宗＋ショートソード → 合成鉱4）"); if(!ok9) bad++;
  // 道具の上下（itemOrder）：同じ点数なら、道具なし・下位互換の道具の組を上に並べる（メンテナーの方針：在庫を減らさない）
  const {itemOrder, itemPairs} = require("../../src/calc/search.js");
  const P = itemPairs({i1:{all:true}, i2:{all:true}, items:I}), {dom, cost} = itemOrder(P);
  const nm = x => x && x.name;
  const idx = (x, y) => P.findIndex(p => (nm(p[0]) === x && nm(p[1]) === y) || (nm(p[0]) === y && nm(p[1]) === x));
  const above = (hi, lo) => dom[idx(...lo)].includes(idx(...hi));   // 組 hi が組 lo の上位互換
  const okA = dom.every((d, k) => d.every(j => cost[j] > cost[k]))    // 上位互換の組は必ず格が上
    && above(["体力の木の大葉", null], ["豪腕の木の大葉", null]) && !above(["豪腕の木の大葉", null], ["体力の木の大葉", null])
    && above(["豪腕の木の大葉", null], ["豪腕の木の葉", null]) && above(["力餅", null], [null, null])
    && above(["スタミナドリンク", "ニンニク"], ["豪腕の木の実", "生命の木の実"])   // 並べ方を入れ替えても比べる
    && !above(["毒草", null], [null, null]) && !above([null, null], ["毒草", null])
    && !above(["力餅", null], ["豪腕の木の葉", null]) && !above(["豪腕の木の葉", null], ["力餅", null]);
  console.log(okA?"OK":"NG", "総当たり 道具の上下（体力の大葉＞豪腕の大葉＞豪腕の葉、力餅＞なし、毒草と力餅はほかと比べない）"); if(!okA) bad++;
  const dr = {w:{fixed:{g:w("竜神の剣"), e:75}}, i1:{fixed:i("スタミナドリンク")}, i2:{all:true}, need4:true, top:10};
  const order = sp => run(sp).results().map(x => `${x.score}:${x.items[1] || "なし"}`).join(",");
  const oB1 = order({...dr, a:{fixed:{g:a("龍鱗の鎧"), e:75}}, items:["体力の木の大葉","豪腕の木の大葉","豪腕の木の葉"].map(i)});
  const oB2 = order({...dr, a:{fixed:{g:a("アークメイル"), e:75}}, items:[i("力餅"), i("毒草")]});
  const okB = oB1 === "99:豪腕の木の葉,99:豪腕の木の大葉,99:体力の木の大葉,92:なし" && oB2 === "97:なし,97:力餅,95:毒草";
  console.log(okB?"OK":"NG", "総当たり 同じ点数なら下位互換・なしが上", oB1, "／", oB2); if(!okB) bad++;
}
// ===== 今のゲームにあるか（in_game、#16） =====
{
  const D = f => require(`../../data/${f}.json`);
  const cnt = d => [d.length, d.filter(x => x.in_game).length];
  const all = ["weapons", "armors", "items"].map(f => D(f));
  const ok = all.every(d => d.every(x => typeof x.in_game === "boolean"))
    && cnt(all[0]).join() === "50,37" && cnt(all[1]).join() === "41,27" && cnt(all[2]).join() === "38,25"
    && !all[0].find(x => x.name === "レイピア").in_game && all[0].find(x => x.name === "正宗").in_game
    && all.every(d => d.filter(x => (x.dungeons || []).some(g => g === "イベント限定" || g === "イベントアイテム")).every(x => !x.in_game));
  console.log(ok?"OK":"NG", "今のゲームにあるもの：武器37/50・防具27/41・道具25/38、イベント限定はすべて「ない」"); if(!ok) bad++;
}
process.exitCode = bad ? 1 : 0;
