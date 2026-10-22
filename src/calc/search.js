// ===== 総当たり =====
// Web Worker・画面・Node のどこでも動く。engine.js の build / forest / resonances をグローバルとして使う
// （画面と Worker では同じ script に続けて入れる。Node では先に Object.assign(global, require("./engine.js"))）。
// spec = {
//   w, a:   {fixed:{g, e}} か {cands:[装備…], synth:{cap:4}, enh:{名前:強化値}}
//           候補は enh で指定した強化値（上限まで）で回す。指定がなければ強化値MAX。
//           synth があれば、候補から違う装備2つを合成したものも入れる（同じ装備どうしはゲームで合成できない）。
//           合計レア度が cap 以下の組だけ。素材の強化値は上と同じ（指定がなければMAX）、神の祝福は+3。
//           synth.pin = {g, e} があれば、その素材（強化値 e）と候補の装備1つの合成だけを入れる（片方の素材を固定）。素の候補は入れたまま。
//   i1, i2: {fixed:道具|null} か {all:true}
//   items:  総当たりする道具の候補（「なし」は自動で入る）
//   sort:   {by:"forest"} か {by:"stat", key:"atk", lv:50}
//           同じ武器・防具で同じ値なら、道具が下位互換の組（なしを含む）を上位互換の組のすぐ上に並べる（itemOrder）
//   need4:  4F切捨基準を満たすものだけ残す, top: 残す件数
//   shard, shards: 並列で回すときの分担（武器×防具の組を shards 個に振り分ける）
// }
function itemPairs(spec){
  const pool = [null, ...(spec.items || [])];
  const f1 = !spec.i1.all, f2 = !spec.i2.all;
  if (f1 && f2) return [[spec.i1.fixed, spec.i2.fixed]];
  if (f1) return pool.map(x => [spec.i1.fixed, x]);
  if (f2) return pool.map(x => [x, spec.i2.fixed]);
  const out = [];                                   // 両方回すときは順番違いを1つにまとめる
  for (let x = 0; x < pool.length; x++) for (let y = x; y < pool.length; y++) out.push([pool[x], pool[y]]);
  return out;
}
// 道具の組の上下。同じ点数なら、道具を使わない・下位互換の道具を使う組を先に並べるのに使う（メンテナーの方針：在庫を減らさない）。
// 道具 x が y の上位互換か同じ：エンジンが読む値（基本値・成長補正・経験値・倍率）がどれも y 以上。
// 「なし」は一番下（道具を使えば、なしより上）。負の値を持つ道具（毒草）はほかと比べない。
// 組 X が組 Y の上位互換：並べ方のどちらかで、2つとも上位互換か同じ（中身が同じ組は除く）。
// dom[i]：組 P[i] の上位互換の組の番号。cost[i]：組の格（道具の格の合計。上位互換なら必ず大きい）
function itemOrder(P){
  const items = [...new Set(P.flat())], at = new Map(items.map((x, i) => [x, i]));
  const vals = items.map(x => { if (!x) return null;
    const b = build(null, 0, null, 0, [x], []);
    return [...K.map(k => b.base[k]), ...K.map(k => b.corr[k]), b.exp, ...Object.values(b.mods)]; });
  const neg = items.map(x => !!x && K.some(k => x.base[k] < 0 || x.growth[k] < 0));
  const ge = items.map((x, i) => items.map((y, j) => i === j ? true : !y ? !neg[i] : !x || neg[i] || neg[j] ? false
    : vals[i].every((v, k) => v >= vals[j][k])));
  const rank = [];                                            // 道具の格：なしは0、ほかは下位互換の格の一番上＋1
  const rankOf = i => rank[i] != null ? rank[i] : (rank[i] = !items[i] ? 0
    : 1 + Math.max(0, ...items.map((_, j) => j !== i && ge[i][j] && !ge[j][i] ? rankOf(j) : 0)));
  const Q = P.map(([x, y]) => [at.get(x), at.get(y)]);
  const geSet = (X, Y) => (ge[X[0]][Y[0]] && ge[X[1]][Y[1]]) || (ge[X[0]][Y[1]] && ge[X[1]][Y[0]]);
  const dom = Q.map(Y => Q.reduce((o, X, j) => { if (geSet(X, Y) && !geSet(Y, X)) o.push(j); return o; }, []));
  return {dom, cost:Q.map(X => rankOf(X[0]) + rankOf(X[1]))};
}
const BLESS_MAX = 3;
function slotList(s){
  if (s.fixed) return [s.fixed];
  const enhOf = g => { const mx = g.max_enhance || 0, v = s.enh && s.enh[g.name];
    return v == null ? mx : Math.max(0, Math.min(mx, v)); };
  const out = s.cands.map(g => ({g, e:enhOf(g)}));
  if (s.synth && s.synth.pin){
    const pin = s.synth.pin;
    for (const g of s.cands){
      if (g.name === pin.g.name || pin.g.rarity + g.rarity > s.synth.cap) continue;
      const r = synth(pin.g, pin.e, g, enhOf(g), BLESS_MAX);
      out.push({g:r.gear, e:r.total});
    }
  } else if (s.synth){
    const c = s.cands;
    for (let x = 0; x < c.length; x++) for (let y = x + 1; y < c.length; y++){
      if (c[x].rarity + c[y].rarity > s.synth.cap) continue;
      const r = synth(c[x], enhOf(c[x]), c[y], enhOf(c[y]), BLESS_MAX);
      out.push({g:r.gear, e:r.total});
    }
  }
  return out;
}

function makeSearch(spec, R){
  const W = slotList(spec.w), A = slotList(spec.a), P = itemPairs(spec);
  const shards = spec.shards || 1, shard = spec.shard || 0, top = spec.top || 30;
  const pairs = [];
  for (let i = 0; i < W.length; i++) for (let j = 0; j < A.length; j++)
    if ((i * A.length + j) % shards === shard) pairs.push([W[i], A[j]]);
  const total = pairs.length * P.length;
  const sort = spec.sort || {by:"forest"};
  const {dom, cost} = itemOrder(P);
  const best = [];
  let pi = 0, qi = 0, done = 0, res = null;

  // 並べ替えの値。森は点数が同じなら Lv14 の HP+攻+防 が高い方を上にする（ステータスで並べるときは見ない）。
  const keyOf = (r, f) => sort.by === "forest"
    ? [f.score, (s => s.hp + s.atk + s.def)(r.at(14))]
    : [r.at(Math.max(sort.lv, r.start))[sort.key], 0];
  // 武器・防具の1組ぶん（道具の組をすべて）ためてから順位表に入れる。キーは
  // [点数, 同じ点数の上位互換の組も含めた Lv14 の一番上, −組の格, Lv14]。下位互換の組は上位互換の組のすぐ上に来る。
  // ためるのは数字だけにして、順位表に入る組だけ計算し直す（計算結果を持ち続けると遅くなる）
  const bK = [], bS = [], bOk = [];
  function flush(w, a){
    for (let i = 0; i < P.length; i++){
      if (!bOk[i] || (best.length >= top && bK[i] < best[best.length-1].key[0])) continue;
      let eff = bS[i];
      for (const j of dom[i]) if (bOk[j] && bK[j] === bK[i] && bS[j] > eff) eff = bS[j];
      const key = [bK[i], eff, -cost[i], bS[i]];
      if (best.length < top || better(key, best[best.length-1].key)){
        const r = build(w.g, w.e, a.g, a.e, P[i], res);
        best.push({key, w, a, items:P[i], r, f:forest(r)});
        best.sort((x, y) => better(x.key, y.key) ? -1 : better(y.key, x.key) ? 1 : 0);
        if (best.length > top) best.pop();
      }
    }
  }

  function step(n){
    const end = Math.min(total, done + n);
    while (done < end){
      const [w, a] = pairs[pi];
      if (qi === 0) res = resonances(w.g, a.g, R);
      const r = build(w.g, w.e, a.g, a.e, P[qi], res);
      const f = forest(r), key = keyOf(r, f);
      bK[qi] = key[0]; bS[qi] = key[1]; bOk[qi] = !spec.need4 || f.ok4;
      done++;
      if (++qi === P.length){ flush(w, a); qi = 0; pi++; }
    }
    return done >= total;
  }
  // Worker から送れるように、結果は名前と数値だけにする
  const results = () => best.map(({key, w, a, items, r, f}) => ({
    key, score:f.score, ok4:f.ok4, ok8:f.ok8, start:r.start,
    w:w.g ? w.g.name : null, we:w.e, a:a.g ? a.g.name : null, ae:a.e, items:items.map(x => x ? x.name : null),
    wParts:w.g && w.g.parts || null, aParts:a.g && a.g.parts || null,
    wOre:w.g && w.g.parts ? Math.max(2, w.g.rarity) : null, aOre:a.g && a.g.parts ? Math.max(2, a.g.rarity) : null,   // 合成鉱（合計レア度、最低2）
    res:r.res.map(x => x.name), lv14:r.at(14), lv50:r.at(50),
  }));
  return {total, step, results, get done(){ return done; }};
}

// 分担して回した結果をまとめる
function mergeResults(lists, top){
  return lists.flat().sort((x, y) => better(x.key, y.key) ? -1 : better(y.key, x.key) ? 1 : 0).slice(0, top || 30);
}
// キー（数の並び）を前から比べて、x の方が上なら true
function better(x, y){
  for (let k = 0; k < x.length; k++) if (x[k] !== y[k]) return x[k] > y[k];
  return false;
}

// Web Worker として読み込まれたとき
if (typeof importScripts === "function" && typeof window === "undefined"){
  self.onmessage = e => {
    const s = makeSearch(e.data.spec, e.data.R);
    while (!s.step(20000)) self.postMessage({type:"progress", done:s.done, total:s.total, results:s.results()});
    self.postMessage({type:"done", done:s.done, total:s.total, results:s.results()});
  };
}
if (typeof module !== "undefined") module.exports = {makeSearch, mergeResults, itemPairs, itemOrder, slotList, BLESS_MAX};
