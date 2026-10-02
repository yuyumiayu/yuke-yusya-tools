// ===== 計算エンジン =====
const K = ["hp","atk","def","eva","luk"];
const INIT = {hp:30, atk:5, def:5, eva:5, luk:5};          // 加護なし
const KAGO = 2.5;                                            // 神様の加護：武器なしで攻、防具なしで防が+2〜3（平均の2.5で計算）
const BASEGROW = {hp:5.5, atk:2.5, def:2.5, eva:2.3, luk:1.1};
const clean = x => Math.round(x*1e6)/1e6;
const up = x => Math.ceil(clean(x));                          // 切り上げ
const vec = (f) => ({hp:f("hp"), atk:f("atk"), def:f("def"), eva:f("eva"), luk:f("luk")});  // 総当たりで速いように直書き
const add = (...vs) => { const o = {hp:0, atk:0, def:0, eva:0, luk:0};
  for (const v of vs) for (const k of K) o[k] += v[k] || 0; return o; };
const mul = (v, r) => vec(k => r===1 ? v[k] : up(v[k]*r));

function mods(weapon, armor, items){
  const m = {wBase:1, wGrow:1, aBase:1, aGrow:1};
  const ab = [(weapon&&weapon.ability)||"", (armor&&armor.ability)||""].join("|");
  if (/防具基本値UP/.test(ab)) m.aBase += 0.3;
  if (/防具基本値2倍/.test(ab)) m.aBase += 1.0;
  if (/防具成長補正UP/.test(ab)) m.aGrow += 0.5;
  if (/武器基本値UP/.test(ab)) m.wBase += 0.3;
  if (/武器成長補正UP/.test(ab)) m.wGrow += 0.5;
  items.forEach(it => { if (it && /武器基本値100%増/.test(it.base_text||"")) m.wBase += 1.0; });
  return m;
}

// ===== 出発時レベル（経験値） =====
// 必要経験値（累計）。メンテナーが調べた経験値テーブル（一部）より。10×(Lv−1)² の形。
const EXP_TABLE = [[2,10],[3,40],[4,90],[5,160],[6,250]];
const expText = x => [x && x.ability, x && x.base_text].filter(Boolean).join("|");
// 装備のアビリティ（ターキーメイル）と道具（経験の木の葉／大葉）の「経験値+N」を合計する
function startExp(weapon, armor, items){
  return [weapon, armor, ...items].reduce((s,x) =>
    s + [...expText(x).matchAll(/経験値\+(\d+)/g)].reduce((a,m)=>a+ +m[1], 0), 0);
}
const startLevel = exp => EXP_TABLE.reduce((lv,[L,need]) => exp >= need ? L : lv, 1);

// ===== 共鳴 =====
// 合成装備は素材の名前を parts に持つ。武器側・防具側の素材のどれかが組み合わせに合えば発動。
const partsOf = g => g ? (g.parts || [g.name]) : [];
function resonances(weapon, armor, list){
  const wp = partsOf(weapon), ap = partsOf(armor);
  return (list||[]).filter(r => wp.includes(r.weapon) && ap.includes(r.armor));
}

// res：発動中の共鳴（resonances() の戻り値）。calc を持つものだけステータスに効く。
function build(weapon, wEnh, armor, aEnh, items, res){
  items = items.filter(Boolean);
  res = res || [];
  const m = mods(weapon, armor, items);
  const zero = vec(()=>0);
  // 負ステータス耐性：装備・道具の負の基本値・成長補正を0にする（倍率を掛ける前）
  const pos = res.some(r => r.calc && r.calc.no_negative) ? (v => vec(k => Math.max(0, v[k]))) : (v => v);
  const wB = weapon ? mul(add(pos(weapon.base), {atk:wEnh}), m.wBase) : zero;
  const aB = armor ? mul(add(pos(armor.base), {def:aEnh}), m.aBase) : zero;
  const wG = weapon ? mul(pos(weapon.growth), m.wGrow) : zero;
  const aG = armor ? mul(pos(armor.growth), m.aGrow) : zero;
  // 共鳴の出発時補正（生命アップ・運アップ・基本値アップ）は倍率の外で足す
  const resB = add(...res.map(r => (r.calc && r.calc.base) || {}));
  const base = add(wB, aB, resB, ...items.map(i=>pos(i.base)));
  const corr = add(wG, aG, ...items.map(i=>pos(i.growth)));
  const kago = {atk: weapon ? 0 : KAGO, def: armor ? 0 : KAGO};  // 装備せずに出発した欄だけ
  const init = add(INIT, base, kago);
  const grow = vec(k => clean(BASEGROW[k] + corr[k]));
  if (grow.hp < 1) grow.hp = 1;                               // HP成長は1.0未満にしない
  const memo = {};                                            // 総当たりで同じレベルを何度も引くのでキャッシュ
  const at = L => memo[L] || (memo[L] = vec(k => up(init[k] + grow[k]*(L-1))));
  const exp = startExp(weapon, armor, items);
  return {mods:m, res, resBase:resB, kago, base, corr, init, grow, at, exp, start:startLevel(exp)};
}

const CUT4 = [
  ["HP","hp",[[1,50]]], ["ATK","atk",[[10,98],[14,116]]], ["DEF","def",[[10,219],[14,272]]]];
const CUT8 = [["HP","hp",[[50,400]]], ["ATK","atk",[[50,324]]], ["DEF","def",[[50,440]]]];
const CRIT = [
  [1,"hp",5,[[1,70]],"開幕ゼンマイラッシュ対策"],
  [2,"hp",7,[[14,195]],"ハイメ＋生命グミ相当"],
  [3,"hp",7,[[14,245]],"ハイメ＋生命大葉相当"],
  [4,"hp",5,[[14,295]],"ハイメ＋生命大葉＋50相当"],
  [5,"hp",2,[[14,345]],"ハイメ＋生命大葉＋100相当"],
  [6,"atk",5,[[8,102],[12,120]],"ブンブン3確＋"],
  [7,"atk",10,[[8,123],[12,147]],"ブンブン2確"],
  [8,"atk",5,[[8,138],[12,163]],"ブンブン以外半1確"],
  [9,"atk",10,[[8,165],[12,192]],"ブンブン以外全1確"],
  [10,"atk",7,[[8,196],[12,229]],"ブンブン1確"],
  [11,"def",10,[[10,219]],"3Fブンブン最低ダメ"],
  [12,"def",10,[[14,272]],"4Fブンブン最低ダメ"],
  [13,"def",7,[[8,219]],"3Fブンブン最低ダメ＋"],
  [14,"def",7,[[12,272]],"4Fブンブン最低ダメ＋"],
  [15,"def",2,[[14,321]],"幼虫最低ダメ"]];
const meets = (r, key, conds) => conds.every(([L,v]) => r.at(L)[key] >= v);

function forest(r){
  // 「Lv1」の条件は出発時の値を見るので、経験の木の葉などで出発時レベルが上がればそのレベルで判定する
  const st = c => c.map(([L,v]) => [L===1 ? (r.start||1) : L, v]);
  const cut4 = CUT4.map(([n,k,c0]) => { const c = st(c0); return {name:n, ok:meets(r,k,c), conds:c, vals:c.map(([L])=>r.at(L)[k])}; });
  const cut8 = CUT8.map(([n,k,c]) => ({name:n, ok:meets(r,k,c), conds:c, vals:c.map(([L])=>r.at(L)[k])}));
  const crit = CRIT.map(([no,k,pt,c0,note]) => { const c = st(c0); return {no,key:k,pt,conds:c,note,ok:meets(r,k,c),vals:c.map(([L])=>r.at(L)[k])}; });
  const sub = {hp:0,atk:0,def:0}; crit.forEach(c=>{ if(c.ok) sub[c.key]+=c.pt; });
  return {cut4, cut8, crit, sub, score: sub.hp+sub.atk+sub.def,
          ok4: cut4.every(c=>c.ok), ok8: cut8.every(c=>c.ok)};
}

// ===== 合成 =====
// 基本値・出発時補正・成長補正はステータスごとに高い方、強化値は平均の切り上げ。
// 合成結果のレア度＝合計、最大強化値＝最大値の平均の切り上げ（MAX判定用）。
function synth(g1, e1, g2, e2, bless){
  const base = vec(k => Math.max(g1.base[k], g2.base[k]));
  const growth = vec(k => Math.max(g1.growth[k], g2.growth[k]));
  const abil = [g1.ability, g2.ability].filter(Boolean);
  const rarity = g1.rarity + g2.rarity;
  const enhSum = e1 + e2;
  const enh = Math.ceil(enhSum / 2);
  const max = Math.ceil(((g1.max_enhance||0) + (g2.max_enhance||0)) / 2);
  return {
    gear: {name:`${g1.name}＋${g2.name}`, parts:[...partsOf(g1), ...partsOf(g2)], rarity, base, growth,
           ability: abil.length ? [...new Set(abil)].join("／") : null, max_enhance: max},
    enh, total: enh + bless, isMax: enh >= max, ore: Math.max(2, rarity),
    minutes: rarity * enhSum * 5,
    cost: Math.round((g1.price + g2.price) * (rarity * 0.2 + enhSum * 0.02)),
  };
}
if (typeof module !== "undefined") module.exports = {build, forest, synth, resonances, startExp, startLevel, K};
