// ===== 強化屋 =====
// 同じ装備を2つ使う。ベースが+a、素材が+bなら判定は b 回で、1回ごとに+1（クリティカルなら+2）。
// 結果は a＋b＋クリティカル回数。そのあと神の祝福で+3。どちらも強化上限で止まる。
// 費用は「+1あたりの費用」×b、時間は「強化鉱の分数」×b。上限を超えた分もかかる。
const BLESS = 3;
const critRate = lv => lv >= 2 ? Math.min(lv, 99) / 100 : 0;   // 強化屋Lv2以上で約Lv%（Lv1は0%）

// 判定 n 回でクリティカルが k 回になる確率（k = 0..n）。二項分布を対数で計算してアンダーフローを避ける
function critDist(n, p){
  const out = new Array(n + 1).fill(0);
  if (p <= 0){ out[0] = 1; return out; }
  if (p >= 1){ out[n] = 1; return out; }
  const lf = [0]; for (let i = 1; i <= n; i++) lf[i] = lf[i-1] + Math.log(i);
  const lp = Math.log(p), lq = Math.log(1 - p);
  for (let k = 0; k <= n; k++) out[k] = Math.exp(lf[n] - lf[k] - lf[n-k] + k * lp + (n - k) * lq);
  return out;
}

// 強化1回ぶんの結果。{a, b, max, lv, bless(0か3), cost(+1あたり), ore(分)}
function enhance({a, b, max, lv, bless = BLESS, cost = 0, ore = 20}){
  const p = critRate(lv), ck = critDist(b, p);
  const byV = new Map();                                       // 最終の強化値 → 確率
  let mean = 0, capP = 0, waste = 0;
  ck.forEach((pk, k) => {
    if (pk === 0) return;                                      // 起こらない値（Lv1 のクリティカルなど）は入れない
    const raw = a + b + k + bless, v = Math.min(max, raw);
    byV.set(v, (byV.get(v) || 0) + pk);
    mean += v * pk;
    if (raw > max){ capP += pk; waste += (raw - max) * pk; }
  });
  const dist = [...byV].sort((x, y) => x[0] - y[0]).map(([v, pr]) => ({v, p:pr}));
  // 上位 t（0〜1）：「これ以上になる確率が t 以上」になる一番高い値。下位 t はその逆
  const top = t => { let s = 0; for (let i = dist.length - 1; i >= 0; i--){ s += dist[i].p; if (s >= t - 1e-12) return dist[i].v; } return dist[0].v; };
  const bottom = t => { let s = 0; for (const d of dist){ s += d.p; if (s >= t - 1e-12) return d.v; } return dist[dist.length-1].v; };
  const atLeast = x => dist.reduce((s, d) => s + (d.v >= x ? d.p : 0), 0);
  return {
    p, dist, mean, top, bottom, atLeast,
    min: dist[0].v, max: dist[dist.length-1].v, median: top(0.5),
    capP, waste, expectedCrit: b * p,
    totalCost: b * cost, minutes: b * ore,
  };
}

// 強化屋Lv 1〜99 それぞれの期待値と振れ幅（下位10%〜上位10%）
function byLevel(opt){
  const out = [];
  for (let lv = 1; lv <= 99; lv++){
    const r = enhance({...opt, lv});
    out.push({lv, mean:r.mean, lo:r.bottom(0.1), hi:r.top(0.1), top1:r.top(0.01)});
  }
  return out;
}
// ===== 進行中の強化 =====
// 開始から強化鉱の分数ごとに1回判定される（開始が9:22・強化鉱60なら 10:22, 11:22, …）。
// {a, b, max, lv, ore, start(ms), now(ms), latest(最新ログの「+○○へ強化された」の数字、なければ null), bless(最終の見込みに足す祝福)}
function progress({a, b, max, lv, ore, start, now, latest, bless = 0}){
  const step = ore * 60000, p = critRate(lv);
  const n = Math.max(0, Math.min(b, Math.floor((now - start) / step)));   // 判定済みの回数
  const out = {n, b, p, next: n < b ? start + (n + 1) * step : null, end: start + b * step, done: n >= b};
  if (latest === null || latest === undefined || isNaN(latest)) return out;
  const cap = latest >= max;                                   // 上限に届いたらそれ以上は数えられない
  const k = latest - a - n;                                    // クリティカルの回数（上限なら「これ以上」）
  out.cap = cap; out.k = k;
  if (k < 0 || k > n || (!cap && latest > max)){ out.error = true; return out; }
  const dk = critDist(n, p);
  out.expected = n * p;
  out.upper = dk.slice(k).reduce((s, x) => s + x, 0);           // これ以上クリティカルを引く確率（小さいほど上振れ）
  out.lower = cap ? 1 : dk.slice(0, k + 1).reduce((s, x) => s + x, 0);   // これ以下の確率（小さいほど下振れ）
  // 残りの判定を確率どおりに進めたときの最終値（祝福 bless を足して上限で止める）
  const m = b - n, dm = critDist(m, p);
  let mean = 0; const byV = new Map();
  dm.forEach((pk, j) => { if (!pk) return; const v = Math.min(max, latest + m + j + bless); mean += v * pk; byV.set(v, (byV.get(v) || 0) + pk); });
  const dist = [...byV].sort((x, y) => x[0] - y[0]);
  const q = t => { let s = 0; for (const [v, pr] of dist){ s += pr; if (s >= t - 1e-12) return v; } return dist[dist.length-1][0]; };
  out.final = {mean, lo: q(0.1), hi: q(0.9), min: dist[0][0], max: dist[dist.length-1][0]};
  return out;
}
// ===== 逆引き =====
// 目標 target 以上になる確率が q 以上になる、一番小さい素材の強化値 b（0〜上限）。届かなければ null。
// b を増やすほど確率は上がる（判定が増え、どれも+1以上）ので二分探索でよい。
const REVERSE_PROBS = [0.9, 0.75, 0.5, 0.1];
function reverse({a, max, lv, bless = BLESS, target}, probs = REVERSE_PROBS){
  const pAt = b => enhance({a, b, max, lv, bless}).atLeast(target);
  const top = pAt(max);
  return probs.map(q => {
    if (top < q - 1e-12) return {q, b: null, p: top};
    let lo = 0, hi = max;
    while (lo < hi){ const mid = (lo + hi) >> 1; if (pAt(mid) >= q - 1e-12) hi = mid; else lo = mid + 1; }
    return {q, b: lo, p: pAt(lo)};
  });
}
if (typeof module !== "undefined") module.exports = {BLESS, critRate, critDist, enhance, byLevel, progress, REVERSE_PROBS, reverse};
