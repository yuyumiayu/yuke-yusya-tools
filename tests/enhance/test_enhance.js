const {BLESS, critRate, critDist, enhance, byLevel, progress, reverse, reverseProbs, REVERSE_PCT} = require("../../src/enhance/engine.js");
const E = require("../../data/enhance.json"), W = require("../../data/weapons.json"), A = require("../../data/armors.json");
let bad = 0;
const check = (ok, label, detail="") => { console.log(ok ? "OK" : "NG", label, detail); if (!ok) bad++; };
const near = (x, y, eps=1e-9) => Math.abs(x - y) <= eps;
const e = n => E.find(x => x.name === n);

// ===== データ =====
{
  const M = [...W, ...A].filter(x => x.max_enhance !== null);
  const miss = M.filter(x => !e(x.name)).map(x => x.name);
  const maxNg = E.filter(x => [...W, ...A].find(m => m.name === x.name).max_enhance !== x.max).map(x => x.name);
  check(E.length === 89 && !miss.length && !maxNg.length, "強化データ 89件・マスタと上限が一致", miss.concat(maxNg).join(","));
  const half = E.filter(x => !x.note && [...W, ...A].find(m => m.name === x.name).price !== x.cost * 2).map(x => x.name);
  check(!half.length, "費用は価格の半分（注記つきの漆黒の鎧・端午の鎧を除く）", half.join(","));
}
// ===== クリティカル率 =====
check(critRate(1) === 0 && critRate(2) === 0.02 && critRate(99) === 0.99, "クリティカル率 Lv1=0, Lv2=2%, Lv99=99%");
// ===== 二項分布 =====
{
  const d = critDist(500, 0.99), s = d.reduce((a, b) => a + b, 0);
  check(near(s, 1, 1e-9) && d.every(Number.isFinite), "判定500回・99%でも確率の合計が1", s);
  const d2 = critDist(4, 0.5); check(near(d2[2], 6/16), "判定4回・50%で2回クリティカル＝6/16");
}
// ===== 強化の結果 =====
{
  const r = enhance({a:1, b:2, max:200, lv:1});
  check(r.min === 6 && r.max === 6 && near(r.mean, 6), "ショートソード+1＋+2、Lv1、祝福あり → +6（1+2+3）");
  const r2 = enhance({a:100, b:98, max:200, lv:1});
  check(r2.max === 200 && near(r2.capP, 1) && near(r2.waste, 1), "198になったショートソードは祝福+3でも200（1無駄）");
  const r3 = enhance({a:0, b:100, max:500, lv:30});
  check(near(r3.mean, 100 + 30 + BLESS, 1e-9), "正宗+0＋+100、Lv30 → 期待値133（100＋100×30%＋3）", r3.mean);
  const r4 = enhance({a:0, b:100, max:500, lv:30, bless:0});
  check(near(r4.mean, 130) && r4.min === 100 && r4.max === 200, "祝福なしなら期待値130、最低100・最高200");
  const r5 = enhance({a:190, b:10, max:200, lv:50});
  check(r5.max === 200 && r5.min === 200 && near(r5.capP, 1), "上限に届いたら全部200");
  check(r3.totalCost === 0 && enhance({a:0, b:10, max:500, lv:1, cost:22500, ore:40}).totalCost === 225000
    && enhance({a:0, b:10, max:500, lv:1, ore:40}).minutes === 400, "費用＝費用×b、時間＝強化鉱の分×b");
  // 上位・下位の値：Lv50・判定2回・祝福なし → +2（25%）・+3（50%）・+4（25%）
  const q = enhance({a:0, b:2, max:500, lv:50, bless:0});
  check(q.top(0.25) === 4 && q.top(0.5) === 3 && q.bottom(0.25) === 2 && q.median === 3 && near(q.atLeast(3), 0.75),
    "上位25%=+4・中央値+3・下位25%=+2・+3以上の確率75%");
}
// ===== 乱数で試した結果と一致するか =====
{
  // mulberry32（Tommy Ettinger によるパブリックドメインの乱数。種を決めて毎回同じ結果にする）
  let s = 12345;
  const rnd = () => { s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const opt = {a:40, b:60, max:120, lv:37}, r = enhance(opt), N = 200000, cnt = new Map();
  let sum = 0;
  for (let t = 0; t < N; t++){
    let v = opt.a; for (let i = 0; i < opt.b; i++) v += rnd() < 0.37 ? 2 : 1;
    v = Math.min(opt.max, Math.min(opt.max, v) + BLESS); sum += v; cnt.set(v, (cnt.get(v)||0) + 1);
  }
  const maxDiff = Math.max(...r.dist.map(d => Math.abs(d.p - (cnt.get(d.v)||0)/N)));
  check(near(sum/N, r.mean, 0.05) && maxDiff < 0.005, "乱数20万回と正確な計算が一致（上限つき）", `期待値 ${(sum/N).toFixed(3)} / ${r.mean.toFixed(3)}、確率の差 最大${maxDiff.toFixed(4)}`);
}
// ===== Lvごと =====
{
  const L = byLevel({a:0, b:100, max:500, bless:0});
  check(L.length === 99 && near(L[0].mean, 100) && near(L[98].mean, 199) && L.every((x, i) => i === 0 || x.mean >= L[i-1].mean),
    "Lv1〜99 の期待値が 100→199 で単調に増える");
}
// ===== 進行中の強化（ゲーム画面の例：鉄の鎧+8 に +4、強化鉱60、9:22開始） =====
{
  const T = (h, m) => new Date(2026, 8, 27, h, m).getTime();
  const base = {a:8, b:4, max:15, lv:30, ore:60, start:T(9, 22)};
  const p1 = progress({...base, now:T(12, 30), latest:12});
  check(p1.n === 3 && p1.k === 1 && p1.next === T(13, 22) && p1.end === T(13, 22) && !p1.done, "12:30に見る：判定3回・+12 → クリティカル1回、次は13:22");
  check(near(p1.expected, 0.9) && near(p1.upper, 1 - 0.7 ** 3) && near(p1.lower, 0.7 ** 3 + 3 * 0.3 * 0.7 ** 2), "クリティカル1回以上の確率・1回以下の確率");
  check(near(p1.final.mean, 13.3) && p1.final.min === 13 && p1.final.max === 14, "残り1回：最終は+13（70%）か+14（30%）");
  const pb = progress({...base, now:T(12, 30), latest:12, bless:3});
  check(pb.final.min === 15 && pb.final.max === 15, "祝福込みなら+16/+17だが上限15で止まる");
  const p2 = progress({...base, now:T(12, 21), latest:11});
  check(p2.n === 2 && p2.k === 1, "12:21はまだ判定2回（12:22の判定前）");
  const p3 = progress({...base, now:T(20, 0), latest:13});
  check(p3.n === 4 && p3.done && p3.k === 1 && p3.next === null, "完了後は判定4回で打ち止め");
  check(progress({...base, now:T(12, 30), latest:20}).error && progress({...base, now:T(12, 30), latest:10}).error, "ありえない数字はエラー");
  const p4 = progress({...base, start:T(9, 22) - 3 * 86400000, b:100, max:500, now:T(9, 22), latest:8 + 72 + 20});
  check(p4.n === 72 && p4.k === 20, "3日前に始めた強化（日付をまたぐ）：判定72回");
  const p5 = progress({a:10, b:10, max:15, lv:50, ore:20, start:0, now:20 * 60000 * 4, latest:15});
  check(p5.cap && p5.k === 1 && !p5.error && near(p5.lower, 1), "上限に届いた場合は「1回以上」扱い");
}
// ===== 逆引き =====
{
  const opt = {a:100, max:500, lv:30, bless:3, target:300};
  const R = reverse(opt);
  const ok = R.every(r => r.b !== null && enhance({...opt, b:r.b}).atLeast(300) >= r.q - 1e-12 && (r.b === 0 || enhance({...opt, b:r.b - 1}).atLeast(300) < r.q));
  const mono = R.every((r, i) => i === 0 || r.b <= R[i-1].b);
  check(ok && mono, "逆引き：各確率で目標に届く一番小さい素材（1つ少ないと届かない）", R.map(r => `${r.q*100}%→+${r.b}`).join(" "));
  const R1 = reverse({a:10, max:15, lv:1, bless:0, target:20});
  check(R1.every(r => r.b === null), "Lv1・上限15で+20は届かない");
  const R2 = reverse({a:10, max:15, lv:1, bless:0, target:12});
  check(R2.every(r => r.b === 2), "Lv1 なら確率によらず目標−ベースの素材（+2）");
  const R3 = reverse({a:100, max:200, lv:30, bless:3, target:50});
  check(R3.every(r => r.b === 0), "もう目標を超えていれば素材+0");
  // 入力した届く確率（#11）：決まった3つのあとに必ず1行足す。1〜100% の整数にそろえる
  const P = q => reverseProbs(q).join(",");
  check(P(10) === "0.9,0.75,0.5,0.1" && P(75) === "0.9,0.75,0.5,0.75" && P(0) === "0.9,0.75,0.5,0.01" && P(150) === "0.9,0.75,0.5,1"
    && P(33.4) === "0.9,0.75,0.5,0.33" && P("") === "0.9,0.75,0.5,0.01" && P(undefined) === `0.9,0.75,0.5,${REVERSE_PCT/100}`,
    "入力した確率：一番下に足す（同じ値も2回）・範囲外は1〜100%・整数にそろえる", P(75));
  const RQ = reverse(opt, reverseProbs(75));
  check(RQ.length === 4 && RQ[3].b === RQ[1].b && RQ[3].q === 0.75, "入力した75%の行は、決まった75%の行と同じ素材");
  // 100%：クリティカルが1回も出なくても届く素材（目標−ベース−祝福）
  const R100 = reverse(opt, reverseProbs(100))[3];
  check(R100.b === 300 - 100 - 3 && Math.abs(R100.p - 1) < 1e-12, "入力した100%は、クリティカルなしでも届く素材", "+" + R100.b);
}
console.log(bad ? `${bad} NG` : "all OK");
process.exitCode = bad ? 1 : 0;
