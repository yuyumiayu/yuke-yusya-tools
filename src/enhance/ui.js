(function(){
  const E = JSON.parse(document.getElementById("data-e").textContent);
  const M = [...JSON.parse(document.getElementById("data-w").textContent), ...JSON.parse(document.getElementById("data-a").textContent)];
  const rarity = Object.fromEntries(M.map(x => [x.name, x.rarity]));
  const $ = id => document.getElementById(id);
  const n0 = v => Math.round(v).toLocaleString("ja-JP");
  const pct = p => p >= 0.9995 ? "100%" : p >= 0.001 ? (p * 100).toFixed(1) + "%" : p > 0 ? "0.1%未満" : "0%";
  const esc = s => String(s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  const duration = min => { const h = Math.floor(min / 60), m = min % 60;
    let s = (h ? `${h}時間` : "") + (m || !h ? `${m}分` : ""); if (h >= 48) s += `（約${(min / 1440).toFixed(1)}日）`; return s; };
  const SVGNS = "http://www.w3.org/2000/svg";

  // ===== 入力 =====
  const st = {kind:"weapon", g:"正宗", ba:100, bb:100, lv:30, ore:60, bless:3, tg:240, rq:REVERSE_PCT, ps:"", pl:""};
  const KEY = "yuke-enhance-v1";
  try{ Object.assign(st, JSON.parse(localStorage.getItem(KEY) || "{}")); }catch(e){}
  const save = () => { try{ localStorage.setItem(KEY, JSON.stringify(st)); }catch(e){} };

  const list = () => E.filter(x => x.kind === st.kind);
  const gear = () => list().find(x => x.name === st.g) || list()[0];
  function fillGear(){
    const groups = {};
    list().forEach(x => (groups[rarity[x.name]] ||= []).push(x));
    $("g").innerHTML = Object.keys(groups).sort().map(r => `<optgroup label="☆${r}">` +
      groups[r].map(x => `<option value="${esc(x.name)}">${esc(x.name)}</option>`).join("") + "</optgroup>").join("");
    if (!list().some(x => x.name === st.g)) st.g = list()[0].name;
    $("g").value = st.g;
  }
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, isNaN(v) ? lo : v));
  // 数字の欄：入力中（フォーカスがある間）は欄に書き戻さない。範囲外なら端の値で計算し、欄から離れたら整える。
  // 空欄のあいだは、打ち直す前（欄に入ったとき）の値で計算し、空欄のまま離れたらその値に戻す
  let editing = null, before = {};
  document.addEventListener("focusin", e => { editing = e.target; before = {...st}; });
  const num = (id, cur, lo, hi) => { const v = parseInt($(id).value, 10);
    return clamp(isNaN(v) ? ($(id) === editing ? before[id] : cur) : v, lo, hi); };
  const put = (id, v) => { if ($(id) !== editing) $(id).value = v; };
  function readInputs(){
    const g = gear();
    st.ba = num("ba", st.ba, 0, g.max);
    st.bb = num("bb", st.bb, 0, g.max);
    st.lv = num("lv", st.lv, 1, 99);
    st.tg = num("tg", st.tg, 0, g.max);
    st.rq = num("rq", st.rq, 1, 100);
    st.ps = readStart();
    const pl = parseInt($("pl").value, 10); st.pl = isNaN(pl) ? "" : clamp(pl, 0, g.max);
  }
  function writeInputs(){
    const g = gear();
    [["ba", st.ba], ["bb", st.bb], ["tg", st.tg]].forEach(([id, v]) => { put(id, v); $(id).max = g.max; });
    put("lv", st.lv); $("lvr").value = st.lv;
    put("rq", st.rq);
    put("pl", st.pl); $("pl").max = g.max;
    document.querySelectorAll("[data-kind]").forEach(b => b.setAttribute("aria-checked", b.dataset.kind === st.kind));
    document.querySelectorAll("[data-ore]").forEach(b => b.setAttribute("aria-checked", +b.dataset.ore === st.ore));
    document.querySelectorAll("[data-bless]").forEach(b => b.setAttribute("aria-checked", +b.dataset.bless === st.bless));
  }

  // ===== SVG の小道具 =====
  const el = (name, attrs, text) => { const e = document.createElementNS(SVGNS, name);
    for (const k in attrs) e.setAttribute(k, attrs[k]); if (text !== undefined) e.textContent = text; return e; };
  // 上の角だけ丸い棒（下は基準線にまっすぐ）
  const barPath = (x, y, w, h, r) => { r = Math.min(r, w / 2, h);
    return `M${x},${y+h}V${y+r}Q${x},${y} ${x+r},${y}H${x+w-r}Q${x+w},${y} ${x+w},${y+r}V${y+h}Z`; };
  const niceStep = (span, want) => { const raw = span / want, p = Math.pow(10, Math.floor(Math.log10(raw)));
    return [1, 2, 5, 10].map(m => m * p).find(s => s >= raw) || 10 * p; };
  function tipAt(box, tip, x, y, html){ tip.innerHTML = html; tip.hidden = false;
    const w = box.clientWidth, half = tip.offsetWidth / 2;
    tip.style.left = Math.max(half, Math.min(w - half, x)) + "px"; tip.style.top = y + "px"; }

  // ===== 分布のグラフ =====
  function drawDist(r){
    const box = $("dchart"); box.innerHTML = "";
    const W = Math.max(280, box.clientWidth), H = 240, mL = 46, mR = 12, mT = 46, mB = 26;
    const lo = r.bottom(1e-4), hi = r.top(1e-4);                // 確率0.01%未満の端は描かない（表には全部ある）
    const vis = r.dist.filter(d => d.v >= lo && d.v <= hi);
    const n = hi - lo + 1, bw = (W - mL - mR) / n;
    const gap = bw >= 6 ? 2 : bw >= 3 ? 1 : 0, bwid = Math.min(24, bw - gap);
    const pmax = Math.max(...vis.map(d => d.p)), yStep = niceStep(pmax, 4), ytop = Math.ceil(pmax / yStep) * yStep;
    const xc = v => mL + (v - lo + 0.5) * bw, y = p => mT + (H - mT - mB) * (1 - p / ytop);
    const svg = el("svg", {width:W, height:H, viewBox:`0 0 ${W} ${H}`, role:"img", "aria-label":"結果の強化値の分布"});
    for (let t = 0; t <= ytop + 1e-12; t += yStep){
      svg.append(el("line", {class:"grid", x1:mL, x2:W - mR, y1:y(t), y2:y(t)}));
      svg.append(el("text", {class:"tick", x:mL - 6, y:y(t) + 4, "text-anchor":"end"}, `${+(t * 100).toFixed(1)}%`));
    }
    const xStep = Math.max(1, niceStep(n, Math.max(3, Math.floor((W - mL - mR) / 60))));
    for (let v = Math.ceil(lo / xStep) * xStep; v <= hi; v += xStep)
      svg.append(el("text", {class:"tick", x:xc(v), y:H - 8, "text-anchor":"middle"}, `+${v}`));
    const tg = st.tg;
    vis.forEach(d => {
      const h = y(0) - y(d.p);
      if (h > 0.2) svg.append(el("path", {d:barPath(xc(d.v) - bwid / 2, y(d.p), bwid, h, bwid >= 8 ? 4 : 1),
        fill: d.v >= tg ? "var(--gold)" : "var(--muted)"}));
    });
    svg.append(el("line", {class:"axis", x1:mL, x2:W - mR, y1:y(0), y2:y(0)}));
    // 期待値・上位10%・上位1% の線。ラベルは最大3段で、横に重ならない段に置く
    const refs = [["期待値", r.mean], ["上位10%", r.top(0.1)], ["上位1%", r.top(0.01)]].filter(([, v]) => v >= lo && v <= hi);
    const rowEnd = [-1e9, -1e9, -1e9];
    refs.forEach(([name, v]) => {
      const x = xc(v), label = `${name} +${Number.isInteger(v) ? v : v.toFixed(1)}`, half = label.length * 3.4 + 4;
      const anchor = x + half > W ? "end" : x - half < 0 ? "start" : "middle";
      const left = anchor === "end" ? x - 2 * half : anchor === "start" ? x : x - half;
      let row = rowEnd.findIndex(e => left >= e + 6); if (row < 0) row = rowEnd.indexOf(Math.min(...rowEnd));
      rowEnd[row] = left + 2 * half;
      const ty = mT - 36 + row * 13;
      svg.append(el("line", {class:"ref", x1:x, x2:x, y1:ty + 3, y2:y(0)}));
      svg.append(el("text", {class:"reflbl", x, y:ty, "text-anchor":anchor}, label));
    });
    // マウス・タップ用の当たり判定（棒より広く、縦いっぱい）
    const tip = document.createElement("div"); tip.className = "tip"; tip.hidden = true;
    const above = v => r.atLeast(v);
    vis.forEach(d => {
      const hit = el("rect", {class:"hit", x:xc(d.v) - bw / 2, y:mT, width:bw, height:y(0) - mT});
      const show = () => tipAt(box, tip, xc(d.v), y(d.p), `<b>+${d.v}</b>　確率 ${pct(d.p)}<br>+${d.v}以上 ${pct(above(d.v))}`);
      hit.addEventListener("pointerenter", show); hit.addEventListener("pointerdown", show);
      hit.addEventListener("pointerleave", () => tip.hidden = true);
      svg.append(hit);
    });
    box.append(svg, tip);
    $("dleg").innerHTML = tg > r.min
      ? `<span><i style="background:var(--gold)"></i>目標 +${tg} 以上</span><span><i style="background:var(--muted)"></i>目標未満</span>`
      : `<span><i style="background:var(--gold)"></i>結果の確率（全部が目標 +${tg} 以上）</span>`;
    $("dtbl").innerHTML = r.dist.map(d => `<tr><td>+${d.v}</td><td>${pct(d.p)}</td><td>${pct(above(d.v))}</td></tr>`).join("");
  }

  // ===== Lvごとのグラフ =====
  function drawLevels(L, cur){
    const box = $("lchart"); box.innerHTML = "";
    const W = Math.max(280, box.clientWidth), H = 220, mL = 46, mR = 14, mT = 12, mB = 26;
    const vmin = Math.min(...L.map(d => d.lo)), vmax = Math.max(...L.map(d => d.hi));
    const yStep = niceStep(Math.max(1, vmax - vmin), 4);
    const y0 = Math.floor(vmin / yStep) * yStep, y1 = Math.max(y0 + yStep, Math.ceil(vmax / yStep) * yStep);
    const x = lv => mL + (W - mL - mR) * (lv - 1) / 98, y = v => mT + (H - mT - mB) * (1 - (v - y0) / (y1 - y0));
    const svg = el("svg", {width:W, height:H, viewBox:`0 0 ${W} ${H}`, role:"img", "aria-label":"強化屋Lvごとの期待値と振れ幅"});
    for (let t = y0; t <= y1 + 1e-9; t += yStep){
      svg.append(el("line", {class:"grid", x1:mL, x2:W - mR, y1:y(t), y2:y(t)}));
      svg.append(el("text", {class:"tick", x:mL - 6, y:y(t) + 4, "text-anchor":"end"}, `+${t}`));
    }
    [1, 20, 40, 60, 80, 99].forEach(lv => svg.append(el("text", {class:"tick", x:x(lv), y:H - 8, "text-anchor":"middle"}, `Lv${lv}`)));
    const band = L.map(d => `${x(d.lv)},${y(d.hi)}`).join("L") + "L" + L.slice().reverse().map(d => `${x(d.lv)},${y(d.lo)}`).join("L");
    svg.append(el("path", {d:`M${band}Z`, fill:"var(--gold)", "fill-opacity":0.35}));
    svg.append(el("path", {d:"M" + L.map(d => `${x(d.lv)},${y(d.mean)}`).join("L"), fill:"none", stroke:"var(--gold)", "stroke-width":2, "stroke-linejoin":"round", "stroke-linecap":"round"}));
    const c = L[cur - 1];
    svg.append(el("circle", {cx:x(cur), cy:y(c.mean), r:5, fill:"var(--text)", stroke:"var(--win)", "stroke-width":2}));
    // 十字線とツールチップ
    const tip = document.createElement("div"); tip.className = "tip"; tip.hidden = true;
    const cross = el("line", {class:"ref", y1:mT, y2:H - mB, visibility:"hidden"});
    const dot = el("circle", {r:4, fill:"var(--gold)", stroke:"var(--win)", "stroke-width":2, visibility:"hidden"});
    svg.append(cross, dot);
    const area = el("rect", {class:"hit", x:mL, y:mT, width:W - mL - mR, height:H - mT - mB});
    const move = ev => {
      const rect = svg.getBoundingClientRect(), px = (ev.clientX - rect.left) * W / rect.width;
      const lv = Math.max(1, Math.min(99, Math.round(1 + (px - mL) / (W - mL - mR) * 98))), d = L[lv - 1];
      cross.setAttribute("x1", x(lv)); cross.setAttribute("x2", x(lv)); cross.setAttribute("visibility", "visible");
      dot.setAttribute("cx", x(lv)); dot.setAttribute("cy", y(d.mean)); dot.setAttribute("visibility", "visible");
      tipAt(box, tip, x(lv), y(d.hi), `<b>Lv${lv}</b>（クリティカル率 ${Math.round(critRate(lv) * 100)}%）<br>期待値 +${d.mean.toFixed(1)}　下位10% +${d.lo}　上位10% +${d.hi}`);
    };
    area.addEventListener("pointermove", move); area.addEventListener("pointerdown", move);
    area.addEventListener("pointerleave", () => { tip.hidden = true; cross.setAttribute("visibility", "hidden"); dot.setAttribute("visibility", "hidden"); });
    svg.append(area);
    box.append(svg, tip);
    $("ltbl").innerHTML = L.map(d => `<tr${d.lv === cur ? ' style="color:var(--gold)"' : ""}><td>Lv${d.lv}</td><td>+${d.mean.toFixed(1)}</td><td>+${d.lo}</td><td>+${d.hi}</td><td>+${d.top1}</td></tr>`).join("");
  }

  // ===== まとめて描く =====
  let last = null;
  function render(){
    readInputs(); writeInputs(); save();
    const g = gear();
    $("gh").textContent = `上限 +${g.max} ／ +1あたり ${n0(g.cost)}G` + (g.note ? ` ／ ${g.note}` : "");
    $("lvh").textContent = st.lv >= 2 ? `クリティカル率 ${st.lv}%（判定1回ごとに、この確率で+2）` : "Lv1 ではクリティカルは起きません（Lv2 から）";
    const opt = {a:st.ba, b:st.bb, max:g.max, lv:st.lv, bless:st.bless, cost:g.cost, ore:st.ore};
    const r = enhance(opt);
    $("mean").textContent = "+" + r.mean.toFixed(1);
    $("meanl").textContent = `（+${st.ba} に +${st.bb} を使う${st.bless ? "・祝福+3" : ""}）`;
    $("tiles").innerHTML = [["最低", r.min], ["下位10%", r.bottom(0.1)], ["期待値", r.mean.toFixed(1)], ["上位10%", r.top(0.1)], ["上位1%", r.top(0.01)], ["最高", r.max]]
      .map(([k, v]) => `<div class="tile"><span>${k}</span><b>+${v}</b></div>`).join("");
    $("facts").innerHTML =
      `<dt>目標 +${st.tg} 以上</dt><dd>${pct(r.atLeast(st.tg))}</dd>` +
      `<dt>クリティカル</dt><dd>平均 ${r.expectedCrit.toFixed(1)} 回（判定 ${st.bb} 回）</dd>` +
      // 「届く」は上限ちょうども含む。「超えて無駄が出る」は祝福まで足して上限を超え、切り捨てられた場合だけ
      `<dt>上限 +${g.max} に届く</dt><dd>${pct(r.atLeast(g.max))}` +
        (r.capP > 0 ? `<span class="${r.capP >= 0.5 ? "ng" : ""}">（うち超えて無駄が出る ${pct(r.capP)}${r.waste >= 0.05 ? `、無駄になる分は平均 ${r.waste.toFixed(1)}` : ""}）</span>` : "") + `</dd>` +
      `<dt>費用</dt><dd>${n0(r.totalCost)}G（${n0(g.cost)}G × ${st.bb}）</dd>` +
      `<dt>時間</dt><dd>${duration(r.minutes)}</dd>`;
    last = {r, L: byLevel(opt)};
    renderReverse();
    renderProgress();
    draw();
  }
  const draw = () => { if (!last) return; drawDist(last.r); drawLevels(last.L, st.lv); };

  // ===== 進行中の強化 =====
  const pad = v => String(v).padStart(2, "0");
  const when = ms => { const d = new Date(ms), t = new Date();
    const md = d.toDateString() === t.toDateString() ? "今日" : `${d.getMonth() + 1}/${d.getDate()}`;
    return `${md} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  const localInput = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  // 始めた日時は 年/月/日 時:分 の5つの欄。桁が埋まったら次の欄へ進む（年は4桁、ほかは2桁）
  const DT = ["psY", "psM", "psD", "psH", "psI"];
  function readStart(){
    const [y, mo, d, h, mi] = DT.map(id => $(id).value);
    if (y.length !== 4 || !mo || !d || h === "" || mi === "") return "";
    const dt = new Date(+y, +mo - 1, +d, +h, +mi);
    if (dt.getMonth() !== +mo - 1 || dt.getDate() !== +d || +h > 23 || +mi > 59) return "";
    return localInput(dt);
  }
  function setStart(s){
    const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(s || "");
    DT.forEach((id, i) => $(id).value = m ? m[i + 1] : "");
  }
  DT.forEach((id, i) => {
    const inp = $(id);
    inp.addEventListener("input", () => {
      inp.value = inp.value.replace(/\D/g, "").slice(0, inp.maxLength);
      if (inp.value.length >= inp.maxLength && i < DT.length - 1){ $(DT[i + 1]).focus(); $(DT[i + 1]).select(); }
      render();
    });
    inp.addEventListener("keydown", e => { if (e.key === "Backspace" && !inp.value && i > 0){ e.preventDefault(); $(DT[i - 1]).focus(); } });
    inp.addEventListener("focus", () => inp.select());
  });
  function renderReverse(){
    const g = gear();
    const probs = reverseProbs(st.rq), rows = reverse({a:st.ba, max:g.max, lv:st.lv, bless:st.bless, target:st.tg}, probs);
    // 最後の行が入力した確率（いつも一番下、決まった確率と同じでも別の行）
    $("rout").innerHTML = `<table><thead><tr><th>届く確率</th><th>必要な素材</th><th>そのときの確率</th></tr></thead><tbody>` +
      rows.map((r, i) => `<tr${i === rows.length - 1 ? ' class="mine"' : ""}><td>${Math.round(r.q * 100)}%${i === rows.length - 1 ? "（入力）" : ""}</td><td>${r.b === null ? "届かない" : "+" + r.b}</td><td>${r.b === null ? `上限+${g.max}でも ${pct(r.p)}` : pct(r.p)}</td></tr>`).join("") +
      `</tbody></table><p class="guide">目標 +${st.tg}（上の「目標の強化値」）、ベース +${st.ba}、強化屋Lv${st.lv}、祝福${st.bless ? "+3" : "なし"}。素材は上限 +${g.max} まで。</p>`;
  }
  function renderProgress(){
    const out = $("pout");
    if (!st.ps){ out.innerHTML = `<p class="guide">始めた日時を入れてください（年は4桁、ほかは数字だけでよい）。</p>`; return; }
    const g = gear(), start = new Date(st.ps).getTime(), now = Date.now();
    if (isNaN(start)){ out.innerHTML = ""; return; }
    if (start > now){ out.innerHTML = `<p class="perr">始めた日時が今より後になっています。</p>`; return; }
    const pr = progress({a:st.ba, b:st.bb, max:g.max, lv:st.lv, ore:st.ore, start, now, latest: st.pl === "" ? null : st.pl, bless:st.bless});
    let h = `<dl class="facts"><dt>判定</dt><dd>${pr.n} / ${st.bb} 回終わった` + (pr.done ? "（完了）" : "") + `</dd>` +
      (pr.next ? `<dt>次の判定</dt><dd>${when(pr.next)}</dd>` : "") +
      `<dt>${pr.done ? "完了" : "完了予定"}</dt><dd>${when(pr.end)}</dd></dl>`;
    if (pr.k === undefined){
      h += `<p class="guide">最新ログの数字を入れると、クリティカルを何回引いたかが出ます。` + (pr.n === 0 ? "（まだ1回目の判定前です）" : "") + `</p>`;
    } else if (pr.error){
      h += `<p class="perr">この数字だと、判定 ${pr.n} 回でのクリティカルが ${pr.k} 回になって合いません。始めた日時・ベース・素材・強化鉱・最新ログの数字を確かめてください。</p>`;
    } else {
      const ks = pr.cap ? `${pr.k}回以上` : `${pr.k}回`;
      const bl = st.bless ? "祝福込み" : "祝福なし";              // 上の「神の祝福」の選択に従う
      let cls = "mid", verdict = "ほぼ期待どおり", detail = "";
      if (pr.p === 0){ verdict = "Lv1 はクリティカルなし"; }
      else if (pr.upper <= 0.25){ cls = "up"; verdict = "上振れ"; detail = `クリティカルがこの回数以上になる確率は ${pct(pr.upper)}`; }
      else if (pr.lower <= 0.25){ cls = "down"; verdict = "下振れ"; detail = `クリティカルがこの回数以下になる確率は ${pct(pr.lower)}`; }
      else detail = `クリティカルがこの回数以上になる確率 ${pct(pr.upper)}、以下になる確率 ${pct(pr.lower)}`;
      h += `<div class="pverdict"><span class="n ${cls}">${verdict}</span><span class="l">クリティカル ${ks}（${pr.n}回中、期待値 ${pr.expected.toFixed(1)}回）</span></div>` +
        (detail ? `<p class="guide" style="margin-top:0">${detail}</p>` : "") +
        `<dl class="facts" style="margin-top:8px"><dt>最終の見込み</dt><dd>` + (pr.done ? `+${st.pl}（完了）` :
          `期待値 +${pr.final.mean.toFixed(1)}（80%の範囲 +${pr.final.lo}〜+${pr.final.hi}、${bl}）`) + `</dd>` +
        (pr.done ? "" : `<dt>はじめの見込み</dt><dd>期待値 +${enhance({a:st.ba, b:st.bb, max:g.max, lv:st.lv, bless:st.bless}).mean.toFixed(1)}（始める前の計算、${bl}）</dd>`) + `</dl>`;
    }
    out.innerHTML = h;
  }
  $("pl").addEventListener("input", render);
  $("psnow").addEventListener("click", () => { setStart(localInput(new Date())); render(); });
  setStart(st.ps);
  setInterval(() => { if (st.ps) renderProgress(); }, 20000);   // 開いている間は時刻を進める

  fillGear();
  document.querySelectorAll("[data-kind]").forEach(b => b.addEventListener("click", () => { st.kind = b.dataset.kind; fillGear(); writeInputs(); render(); }));
  document.querySelectorAll("[data-ore]").forEach(b => b.addEventListener("click", () => { st.ore = +b.dataset.ore; render(); }));
  document.querySelectorAll("[data-bless]").forEach(b => b.addEventListener("click", () => { st.bless = +b.dataset.bless; render(); }));
  $("g").addEventListener("change", () => { st.g = $("g").value; render(); });
  ["ba", "bb", "tg", "lv", "rq"].forEach(id => $(id).addEventListener("input", render));
  $("lvr").addEventListener("input", () => { $("lv").value = $("lvr").value; render(); });
  ["ba", "bb", "tg", "lv", "rq", "pl"].forEach(id => $(id).addEventListener("focusout", () => { editing = null; render(); }));
  document.querySelectorAll(".enh button[data-t]").forEach(b => b.addEventListener("click", () => {
    const inp = $(b.dataset.t), cur = parseInt(inp.value, 10);
    inp.value = b.dataset.d === "max" ? gear().max : (isNaN(cur) ? +st[b.dataset.t] || 0 : cur) + (+b.dataset.d);
    render();
  }));
  writeInputs(); render();
  // 幅が変わったとき（折りたたんだ欄を開いたときも）に描き直す
  if (window.ResizeObserver){ const ro = new ResizeObserver(() => draw()); ro.observe($("dchart")); ro.observe($("lchart")); }
})();
