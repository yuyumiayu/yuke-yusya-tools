// ===== 総当たり =====
// Web Worker・画面・Node のどこでも動く。engine.js の build / forest / resonances をグローバルとして使う
// （画面と Worker では同じ script に続けて入れる。Node では先に Object.assign(global, require("./engine.js"))）。
// spec = {
//   w, a:   {fixed:{g, e}} か {cands:[装備…], synth:{cap:4}}（候補は強化値MAXで回す）
//           synth があれば、候補から違う装備2つを合成したものも入れる（同じ装備どうしはゲームで合成できない）。
//           合計レア度が cap 以下の組だけ。素材は強化値MAX、神の祝福は+3。
//   i1, i2: {fixed:道具|null} か {all:true}
//   items:  総当たりする道具の候補（「なし」は自動で入る）
//   sort:   {by:"forest"} か {by:"stat", key:"atk", lv:50}
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
const BLESS_MAX = 3;
function slotList(s){
  if (s.fixed) return [s.fixed];
  const out = s.cands.map(g => ({g, e:g.max_enhance || 0}));
  if (s.synth){
    const c = s.cands;
    for (let x = 0; x < c.length; x++) for (let y = x + 1; y < c.length; y++){
      if (c[x].rarity + c[y].rarity > s.synth.cap) continue;
      const r = synth(c[x], c[x].max_enhance || 0, c[y], c[y].max_enhance || 0, BLESS_MAX);
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
  const best = [];
  let pi = 0, qi = 0, done = 0, res = null;

  // 並べ替えの値。森は点数が同じなら Lv14 の HP+攻+防 が高い方を上にする。
  const keyOf = (r, f) => sort.by === "forest"
    ? [f.score, (s => s.hp + s.atk + s.def)(r.at(14))]
    : [r.at(Math.max(sort.lv, r.start))[sort.key], 0];
  const better = (x, y) => x[0] !== y[0] ? x[0] > y[0] : x[1] > y[1];

  function step(n){
    const end = Math.min(total, done + n);
    while (done < end){
      const [w, a] = pairs[pi];
      if (qi === 0) res = resonances(w.g, a.g, R);
      const items = P[qi];
      const r = build(w.g, w.e, a.g, a.e, items, res);
      const f = forest(r);
      if (!spec.need4 || f.ok4){
        const key = keyOf(r, f);
        if (best.length < top || better(key, best[best.length-1].key)){
          best.push({key, w, a, items, r, f});
          best.sort((x, y) => better(x.key, y.key) ? -1 : better(y.key, x.key) ? 1 : 0);
          if (best.length > top) best.pop();
        }
      }
      done++;
      if (++qi === P.length){ qi = 0; pi++; }
    }
    return done >= total;
  }
  // Worker から送れるように、結果は名前と数値だけにする
  const results = () => best.map(({key, w, a, items, r, f}) => ({
    key, score:f.score, ok4:f.ok4, ok8:f.ok8, start:r.start,
    w:w.g ? w.g.name : null, we:w.e, a:a.g ? a.g.name : null, ae:a.e, items:items.map(x => x ? x.name : null),
    wParts:w.g && w.g.parts || null, aParts:a.g && a.g.parts || null,
    res:r.res.map(x => x.name), lv14:r.at(14), lv50:r.at(50),
  }));
  return {total, step, results, get done(){ return done; }};
}

// 分担して回した結果をまとめる
function mergeResults(lists, top){
  const better = (x, y) => x.key[0] !== y.key[0] ? x.key[0] > y.key[0] : x.key[1] > y.key[1];
  return lists.flat().sort((x, y) => better(x, y) ? -1 : better(y, x) ? 1 : 0).slice(0, top || 30);
}

// Web Worker として読み込まれたとき
if (typeof importScripts === "function" && typeof window === "undefined"){
  self.onmessage = e => {
    const s = makeSearch(e.data.spec, e.data.R);
    while (!s.step(20000)) self.postMessage({type:"progress", done:s.done, total:s.total, results:s.results()});
    self.postMessage({type:"done", done:s.done, total:s.total, results:s.results()});
  };
}
if (typeof module !== "undefined") module.exports = {makeSearch, mergeResults, itemPairs, slotList, BLESS_MAX};
