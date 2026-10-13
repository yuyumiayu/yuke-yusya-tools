(function(){
  const W = JSON.parse(document.getElementById("data-w").textContent).filter(x=>x.base.atk!==null);
  const A = JSON.parse(document.getElementById("data-a").textContent).filter(x=>x.base.def!==null);
  const I = JSON.parse(document.getElementById("data-i").textContent);
  const R = JSON.parse(document.getElementById("data-r").textContent);
  const $ = id => document.getElementById(id);
  const LBL = {hp:"HP",atk:"攻",def:"防",eva:"回",luk:"運"};
  const KEY_LV = new Set([1,8,10,12,14,50]);
  const listOf = t => t[0]==="w" ? W : A;
  const mode = {w:"plain", a:"plain"};
  const esc = s => String(s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));

  function fill(sel, list, none){
    const groups = {};
    list.forEach((x,idx)=>{ (groups[x.rarity] ||= []).push([x,idx]); });
    let h = `<option value="">${none}</option>`;
    Object.keys(groups).sort().forEach(r=>{
      h += `<optgroup label="☆${r}">` + groups[r].map(([x,idx])=>`<option value="${idx}">${esc(x.name)}</option>`).join("") + "</optgroup>";
    });
    sel.innerHTML = h;
  }
  ["w","a"].forEach(t=>{ fill($(t), listOf(t), "なし"); fill($(t+"1"), listOf(t), "選ぶ"); fill($(t+"2"), listOf(t), "選ぶ"); });
  fill($("i1"), I, "なし"); fill($("i2"), I, "なし");

  const pick = id => { const v = $(id).value; return v === "" ? null : (id[0]==="i" ? I : listOf(id))[+v]; };
  const maxOf = x => x && x.max_enhance ? x.max_enhance : 0;
  // 合成（"ws"/"as"）の最大は、素材が強化値MAXのときの合成後の値＋神の祝福+3
  const synthOf = t => { const g1 = pick(t+"1"), g2 = pick(t+"2");
    return g1 && g2 ? synth(g1, maxOf(g1), g2, maxOf(g2), 0) : null; };
  const maxFor = t => { if (t.length === 2 && t[1] === "s"){ const s = synthOf(t[0]); return s ? s.enh + BLESS_MAX : 0; } return maxOf(pick(t)); };
  // 数字の欄：入力中（フォーカスがある間）は欄に書き戻さない。範囲外なら端の値で計算し、欄から離れたら整える。
  // 空欄のあいだは、打ち直す前（欄に入ったとき）の値で計算し、空欄のまま離れたらその値に戻す
  const lastEnh = {};                                         // 強化値の欄（"w"/"a"/"ws"/"as"）の最後に使った値
  let editing = null, beforeEnh = {}, beforeXlv = 50;
  document.addEventListener("focusin", e => { editing = e.target; beforeEnh = {...lastEnh}; beforeXlv = xlvLast; });
  function clampEnh(t){
    const inp = $(t+"e"), mx = maxFor(t);
    let v = parseInt(inp.value,10); if (isNaN(v)) v = (inp === editing ? beforeEnh[t] : lastEnh[t]) ?? 0;
    v = Math.max(0, Math.min(mx, v)); lastEnh[t] = v;
    if (inp !== editing) inp.value = v;
    inp.max = mx; return v;
  }
  const sgn = v => (v>0?"+":"") + v;
  const fmt = v => Number.isInteger(v) ? String(v) : v.toFixed(1);
  const vecText = (v, main) => K.filter(k=>k!==main && v[k]!==0).map(k=>LBL[k]+sgn(v[k])).join(" ");
  const strip = s => s.replace(/\*\d+/g,"");
  function gearHint(x, main){
    if(!x) return "";
    const p = [(main==="atk" ? "攻撃力" : "防御力") + x.base[main]];
    const b = vecText(x.base, main); if (b) p.push("出発時 " + b);
    const g = vecText(x.growth); if (g) p.push("成長 " + g);
    if (x.ability) p.push(strip(x.ability));
    return p.join(" ／ ");
  }
  function itemHint(x){
    if(!x) return "";
    const p = [];
    if (x.base_text) p.push(strip(x.base_text));
    if (x.growth_text) p.push("成長 " + x.growth_text);
    return p.join(" ／ ");
  }
  function duration(min){
    const h = Math.floor(min/60), m = min%60;
    let s = (h ? `${h}時間` : "") + (m || !h ? `${m}分` : "");
    if (h >= 48) s += `（約${(min/1440).toFixed(1)}日）`;
    return s;
  }

  // 武器・防具スロットの装備と強化値を決める
  function slot(t){
    const main = t==="w" ? "atk" : "def";
    if (mode[t] === "plain"){
      const g = pick(t), e = clampEnh(t);
      $(t+"h").textContent = g ? gearHint(g, main) + ` ／ 最大+${maxOf(g)}` : "";
      return {g, e};
    }
    const s = synthOf(t), e = clampEnh(t+"s");
    if (!s){
      $(t+"sr").innerHTML = "素材を2つ選ぶと合成結果が出ます。";
      $(t+"h").textContent = "";
      return {g:null, e:0};
    }
    const mx = s.enh + BLESS_MAX;
    $(t+"sr").innerHTML =
      `<span class="big">☆${s.gear.rarity} +${e}</span>` +
      `<dl><dt>強化値</dt><dd>+${e}${e >= mx ? "（MAX）" : `（最大 +${mx}）`}</dd>` +
      `<dt>合成鉱</dt><dd>合成鉱${s.ore}以上</dd>` +
      `<dt>合成時間</dt><dd>${duration(s.minutes)}（素材が強化値MAXのとき）</dd>` +
      `<dt>合成金額</dt><dd>${s.cost.toLocaleString("ja-JP")}G（同上）</dd></dl>`;
    $(t+"h").textContent = gearHint(s.gear, main);
    return {g: s.gear, e};
  }

  let xlvLast = 50;                                           // 並べ替えのレベル（1〜99）。空欄なら打ち直す前の値
  const xlvVal = () => { const v = parseInt($("xlv").value,10);
    xlvLast = isNaN(v) ? ($("xlv") === editing ? beforeXlv : xlvLast) : Math.max(1, Math.min(99, v)); return xlvLast; };
  const FIELDS = ["w","we","a","ae","i1","i2","w1","w2","wse","a1","a2","ase"];
  const PICKS = ["w","a","i1","i2","w1","w2","a1","a2"];
  const listFor = k => k[0]==="i" ? I : listOf(k);
  // 名前で保存する前の保存内容は、道具を番号で持っている。グミ4つを消す前の並びで名前に戻す
  const OLD_ITEMS = (n => [...n.slice(0,26), "生命グミ","豪腕グミ","守りグミ","回避グミ", ...n.slice(26)])(I.map(g=>g.name));
  const SWEEP = ["w","a","i1","i2"];
  function save(){
    const s = {mode, sweep:SWEEP.filter(k=>$(k+"x").checked), xs:$("xs").value, xlv:$("xlv").value, xn4:$("xn4").checked,
               xsw:$("xsw").checked, xsa:$("xsa").checked, xcap:$("xcap").value};
    FIELDS.forEach(k=>s[k]=$(k).value);
    ["w","a","ws","as"].forEach(t=>{ if (s[t+"e"] === "" && lastEnh[t] != null) s[t+"e"] = String(lastEnh[t]); });   // 入力中の空欄は直前の値で保存
    s.xlv = String(xlvVal());
    // 装備・道具は名前でも保存する（データの行が増減しても選択がずれないように）
    s.names = {}; PICKS.forEach(k=>{ const g = pick(k); s.names[k] = g ? g.name : ""; });
    try{ localStorage.setItem("yuke-calc-v2", JSON.stringify(s)); }catch(e){}
  }
  function load(){
    let s=null; try{ s = JSON.parse(localStorage.getItem("yuke-calc-v2")||"null"); }catch(e){}
    if(!s){ s = {w:String(W.findIndex(x=>x.name==="正宗")),we:"0",a:String(A.findIndex(x=>x.name==="ハイランドメイル")),ae:"60",i1:String(I.findIndex(x=>x.name==="生命の木の大葉")),i2:String(I.findIndex(x=>x.name==="体力の木の大葉"))}; }
    if (s.names) PICKS.forEach(k=>{ const n = s.names[k]; if (n !== undefined) s[k] = n ? String(listFor(k).findIndex(g=>g.name===n)) : ""; });
    else ["i1","i2"].forEach(k=>{ if (s[k]) s[k] = String(I.findIndex(g=>g.name===OLD_ITEMS[+s[k]])); });
    FIELDS.forEach(k=>{ if(s[k]!==undefined) $(k).value = s[k] === "-1" ? "" : s[k]; });
    if (s.mode) Object.assign(mode, s.mode);
    if (s.sweep) SWEEP.forEach(k=>$(k+"x").checked = s.sweep.includes(k));
    if (s.xs) $("xs").value = s.xs;
    if (s.xlv) $("xlv").value = s.xlv;
    if (s.xn4 !== undefined) $("xn4").checked = s.xn4;
    if (s.xsw !== undefined) $("xsw").checked = s.xsw;
    if (s.xsa !== undefined) $("xsa").checked = s.xsa;
    if (s.xcap) $("xcap").value = s.xcap;
  }
  function syncControls(){
    ["w","a"].forEach(t=>{
      $(t+"-plain").hidden = mode[t] !== "plain"; $(t+"-synth").hidden = mode[t] !== "synth";
      document.querySelectorAll(`[data-slot="${t}"]`).forEach(b=>b.setAttribute("aria-checked", b.dataset.mode===mode[t]));
    });
  }

  let cur = null;                                             // 今の選択（総当たりで固定する欄に使う）
  function render(){
    syncControls();
    const ws = slot("w"), as = slot("a");
    const i1 = pick("i1"), i2 = pick("i2");
    cur = {ws, as, i1, i2};
    $("i1h").textContent = itemHint(i1); $("i2h").textContent = itemHint(i2);
    const res = resonances(ws.g, as.g, R);
    const r = build(ws.g, ws.e, as.g, as.e, [i1,i2], res);
    const m = r.mods, fx = [];
    if (m.wBase!==1) fx.push(`武器の基本値 ×${fmt(m.wBase)}`);
    if (m.wGrow!==1) fx.push(`武器の成長補正 ×${fmt(m.wGrow)}`);
    if (m.aBase!==1) fx.push(`防具の基本値 ×${fmt(m.aBase)}`);
    if (m.aGrow!==1) fx.push(`防具の成長補正 ×${fmt(m.aGrow)}`);
    if (r.exp) fx.push(`出発時レベル Lv${r.start}（経験値+${r.exp}）`);
    if (r.kago.atk) fx.push("戦いの神様の加護（武器なし。攻+2〜3、計算は+2.5）");
    if (r.kago.def) fx.push("守りの神様の加護（防具なし。防+2〜3、計算は+2.5）");
    $("fx").textContent = fx.length ? "効果中：" + fx.join("、") : "";
    const resTxt = x => x.calc && x.calc.pending ? `${x.name}（ステータスへの効果は未反映）`
      : x.calc ? `${x.name}（${x.effect}）` : x.name;
    $("rx").textContent = res.length ? "共鳴：" + res.map(resTxt).join("、") : "";

    const f = forest(r);
    $("scn").textContent = f.score;
    $("sc").classList.toggle("off", !f.ok4);
    const cutTxt = arr => arr.map(c=>`${c.name} ${c.conds.map(([L,v],j)=>`Lv${L} ${c.vals[j]}/${v}`).join("・")}`).join("、");
    $("c4").innerHTML = f.ok4 ? `<b class="ok">4F切捨基準クリア</b>`
      : `<b class="ng">4F切捨基準に届かない</b>（wikiの表では空欄＝推奨外）<br><span class="ng">${cutTxt(f.cut4.filter(c=>!c.ok))}</span>`;
    $("c8").innerHTML = (f.ok8 ? `<b class="ok">8F切捨基準クリア</b>` : `<b class="ng">8F切捨基準に届かない</b>`) + `<br><span style="color:var(--muted)">${cutTxt(f.cut8)}</span>`;
    const maxes = {hp:26, atk:37, def:36};
    $("bars").innerHTML = ["hp","atk","def"].map(k=>`<span>${LBL[k]}</span><span class="bar"><i style="width:${f.sub[k]/maxes[k]*100}%"></i></span><span class="v">${f.sub[k]}/${maxes[k]}</span>`).join("");
    $("crit").innerHTML = f.crit.map(c=>`<li class="${c.ok?"":"off"}"><span>${c.ok?"✓":"・"}</span><span class="pt">${c.pt}点</span><span>${LBL[c.key]} ${c.conds.map(([L,v],j)=>`Lv${L}≥${v}（${c.vals[j]}）`).join(" かつ ")}<small>${c.note}</small></span></li>`).join("");

    const rows = [["基本値", r.base, sgn], ["成長補正", r.corr, sgn], ["Lv1", r.at(1), String], ["成長値", r.grow, fmt]];
    if (K.some(k=>r.resBase[k])) rows.splice(1, 0, ["うち共鳴", r.resBase, sgn]);
    if (r.start > 1) rows.splice(rows.length-1, 0, [`出発時 Lv${r.start}`, r.at(r.start), String]);
    $("st").innerHTML = rows.map(([n,v,f2])=>`<tr><td class="lbl">${n}</td>${K.map(k=>`<td>${f2(v[k])}</td>`).join("")}</tr>`).join("");
    let h = "";
    for (let L=r.start; L<=99; L++){ const s = r.at(L); h += `<tr class="${KEY_LV.has(L)||L===r.start?"key":""}"><td>${L}${L===r.start && L>1 ? "（出発）" : ""}</td>${K.map(k=>`<td>${s[k]}</td>`).join("")}</tr>`; }
    $("lv").innerHTML = h;
    sweepInfo();
    save();
  }

  document.querySelectorAll(".enh button").forEach(b=>b.addEventListener("click",()=>{
    const t = b.dataset.t, inp = $(t+"e"), cur = parseInt(inp.value,10);
    inp.value = b.dataset.d==="max" ? maxFor(t) : (isNaN(cur) ? beforeEnh[t] ?? lastEnh[t] ?? 0 : cur) + (+b.dataset.d);
    render();
  }));
  document.querySelectorAll("[data-slot]").forEach(b=>b.addEventListener("click",()=>{ mode[b.dataset.slot] = b.dataset.mode; render(); }));
  FIELDS.forEach(id=>$(id).addEventListener(/e$/.test(id) ? "input" : "change", render));
  FIELDS.filter(id=>/e$/.test(id)).forEach(id=>$(id).addEventListener("focusout", () => { editing = null; render(); }));
  // ===== 総当たり =====
  const CK = "yuke-calc-cands";                               // 候補から外した装備・道具の名前と、指定した強化値（enh）
  const CL = {w:W, a:A, i:I};
  let off = {w:[], a:[], i:[], enh:{w:{}, a:{}}};
  try{ off = Object.assign(off, JSON.parse(localStorage.getItem(CK)||"{}")); }catch(e){}
  off.enh = Object.assign({w:{}, a:{}}, off.enh);
  const candsOf = t => CL[t].filter(x => !off[t].includes(x.name));
  const saveCands = () => { try{ localStorage.setItem(CK, JSON.stringify(off)); }catch(e){} };
  function fillCands(t){
    const groups = {};
    CL[t].forEach(x => (groups[x.rarity] ||= []).push(x));
    $("c"+t).querySelector(".clist").innerHTML = Object.keys(groups).sort().map(r => `<b data-r="${r}" role="button" tabindex="0">☆${r}</b>` +
      groups[r].map(x => {
        const ck = `<label><input type="checkbox" value="${esc(x.name)}"${off[t].includes(x.name) ? "" : " checked"}> ${esc(x.name)}</label>`;
        if (t === "i") return ck;
        // 武器・防具：強化値の欄。空欄なら強化値MAX
        const v = off.enh[t][x.name], mx = x.max_enhance || 0;
        return `<div class="crow">${ck}<input type="number" class="cenh" min="0" max="${mx}" inputmode="numeric" data-n="${esc(x.name)}" placeholder="MAX" value="${v == null ? "" : v}" aria-label="${esc(x.name)}の強化値（空欄なら上限+${mx}）" title="空欄なら上限+${mx}"></div>`;
      }).join("")).join("");
  }
  ["w","a","i"].forEach(t => {
    fillCands(t);
    const box = $("c"+t);
    box.querySelector(".clist").addEventListener("change", e => {
      if (e.target.classList.contains("cenh")){                // 強化値：上限を超えたら上限に、空欄なら指定なし（MAX）
        const n = e.target.dataset.n, mx = +e.target.max, v = parseInt(e.target.value, 10);
        if (isNaN(v)){ delete off.enh[t][n]; e.target.value = ""; }
        else { off.enh[t][n] = Math.max(0, Math.min(mx, v)); e.target.value = off.enh[t][n]; }
        saveCands(); return;
      }
      const n = e.target.value; off[t] = off[t].filter(x => x !== n); if (!e.target.checked) off[t].push(n);
      saveCands(); sweepInfo();
    });
    // ☆の見出し：そのレア度が全部入っていれば全部外し、そうでなければ全部入れる
    const toggleRarity = r => {
      const names = CL[t].filter(x => String(x.rarity) === r).map(x => x.name);
      const allOn = names.every(n => !off[t].includes(n));
      off[t] = off[t].filter(n => !names.includes(n)); if (allOn) off[t].push(...names);
      saveCands(); fillCands(t); sweepInfo();
    };
    box.querySelector(".clist").addEventListener("click", e => { const b = e.target.closest("b[data-r]"); if (b) toggleRarity(b.dataset.r); });
    box.querySelector(".clist").addEventListener("keydown", e => { const b = e.target.closest("b[data-r]"); if (b && (e.key === "Enter" || e.key === " ")){ e.preventDefault(); toggleRarity(b.dataset.r); } });
    box.querySelectorAll("[data-all]").forEach(b => b.addEventListener("click", () => {
      off[t] = b.dataset.all === "1" ? [] : CL[t].map(x => x.name); saveCands(); fillCands(t); sweepInfo();
    }));
  });

  function spec(){
    const x = k => $(k+"x").checked, cap = +$("xcap").value;
    const s = {
      w: x("w") ? {cands:candsOf("w"), synth:$("xsw").checked ? {cap} : null, enh:off.enh.w} : {fixed:{g:cur.ws.g, e:cur.ws.e}},
      a: x("a") ? {cands:candsOf("a"), synth:$("xsa").checked ? {cap} : null, enh:off.enh.a} : {fixed:{g:cur.as.g, e:cur.as.e}},
      i1: x("i1") ? {all:true} : {fixed:cur.i1},
      i2: x("i2") ? {all:true} : {fixed:cur.i2},
      items: candsOf("i"),
      sort: $("xs").value === "forest" ? {by:"forest"} : {by:"stat", key:$("xs").value, lv:xlvVal()},
      need4: $("xn4").checked, top: 30,
    };
    const nP = itemPairs(s).length, nW = slotList(s.w).length, nA = slotList(s.a).length;
    return {s, nW, nA, nP, total: nW * nA * nP, any: SWEEP.some(x)};
  }
  const nWorkers = Math.max(1, Math.min(navigator.hardwareConcurrency || 2, 8));
  // 1通りあたりの秒数。前に回したときの実測（この端末・ブラウザ）があればそれを使う。なければ 11µs を並列数で割る
  const SK = "yuke-calc-speed";
  const LONG_SEC = 30;                                        // これ以上かかりそうなら注意を出す
  const perCombo = () => { try{ const v = +localStorage.getItem(SK); if (v > 0) return v; }catch(e){} return 11e-6 / nWorkers; };
  // 短い実行は Worker の起動時間が大きく効いて遅めに出るので、2秒以上かかったときだけ覚える
  const learnSpeed = (total, ms) => { if (total > 0 && ms >= 2000) try{ localStorage.setItem(SK, String(ms / 1000 / total)); }catch(e){} };
  let running = null;
  function sweepInfo(){
    if (!cur) return;
    SWEEP.forEach(k => $(k).closest(".field").classList.toggle("on", $(k+"x").checked));
    ["w","a","i"].forEach(t => $("c"+t).querySelector("summary span").textContent = `${candsOf(t).length}/${CL[t].length}`);
    $("xlvl").hidden = $("xs").value === "forest";
    if (running) return;
    const p = spec(), n = v => v.toLocaleString("ja-JP");
    if (!p.any){ $("xc").textContent = "「そうび」で総当たりする欄にチェックを入れてください。"; $("xc").classList.remove("long"); $("xw").hidden = true; $("xgo").disabled = true; return; }
    const sec = p.total * perCombo();
    const est = sec < 1 ? "1秒未満" : sec < 90 ? `約${Math.ceil(sec)}秒` : `約${Math.ceil(sec/60)}分`;
    const long = sec >= LONG_SEC;
    $("xc").textContent = `${long ? "⚠ " : ""}武器 ${n(p.nW)} × 防具 ${n(p.nA)} × 道具 ${n(p.nP)} ＝ ${n(p.total)}通り（目安 ${est}）`;
    $("xc").classList.toggle("long", long); $("xw").hidden = !long;
    $("xgo").disabled = p.total === 0;
  }

  function showResults(list, sp){
    const byForest = sp.sort.by === "forest";
    $("xr").innerHTML = list.map((x, k) => {
      const v = byForest ? `${x.score}点` : x.key[0];
      const it = x.items.filter(Boolean).join("・") || "道具なし";
      const syn = [x.wParts && "武器は合成", x.aParts && "防具は合成"].filter(Boolean).join("・");
      const sub = [it, syn && `${syn}（祝福+${BLESS_MAX}込み）`, x.res.length ? "共鳴：" + x.res.join("・") : "", x.start > 1 ? `出発Lv${x.start}` : ""].filter(Boolean).join(" ／ ");
      const s = x.lv14;
      return `<li><span class="v">${v}</span><span>${esc(x.w || "武器なし")} +${x.we} ／ ${esc(x.a || "防具なし")} +${x.ae}` +
        `<small>${esc(sub)}</small><small>Lv14 HP${s.hp} 攻${s.atk} 防${s.def}${byForest ? "" : ` ／ Lv${sp.sort.lv} ${LBL[sp.sort.key]}${x.key[0]}`}</small></span>` +
        `<button type="button" data-k="${k}">反映</button></li>`;
    }).join("");
    $("xr").onclick = e => {
      const b = e.target.closest("button[data-k]"); if (!b) return;
      const x = list[+b.dataset.k];
      const put = (t, name, e, parts) => {
        const L = listOf(t), idx = n => String(L.findIndex(g => g.name === n));
        if (parts){                                              // 合成：素材2つと合成後の強化値（祝福+3込み）
          mode[t] = "synth"; parts.forEach((n, j) => $(t+(j+1)).value = idx(n)); $(t+"se").value = e;
        } else { mode[t] = "plain"; $(t).value = idx(name); $(t+"e").value = e; }
      };
      if ($("wx").checked) put("w", x.w, x.we, x.wParts);
      if ($("ax").checked) put("a", x.a, x.ae, x.aParts);
      ["i1","i2"].forEach((k, j) => { if ($(k+"x").checked) $(k).value = x.items[j] ? String(I.findIndex(g => g.name === x.items[j])) : ""; });
      render();
      $("h-eq").scrollIntoView({behavior:"smooth"});
    };
  }

  function finish(lists, sp, t0, stopped){
    const list = mergeResults(lists, sp.top);
    if (!stopped) learnSpeed(running && running.total, Date.now() - t0);
    showResults(list, sp);
    $("xmsg").textContent = (stopped ? "途中でやめました。ここまでの上位です。" : `${((Date.now()-t0)/1000).toFixed(1)}秒で終わりました。`) +
      (list.length ? "" : "条件に合う組み合わせがありません。");
    stopRun();
  }
  function stopRun(){
    if (running && running.workers) running.workers.forEach(w => w.terminate());
    if (running && running.timer) clearTimeout(running.timer);
    running = null; $("xgo").hidden = false; $("xstop").hidden = true; sweepInfo();
  }
  function progress(done, total){ $("xp").style.width = (total ? done / total * 100 : 100) + "%"; }

  // 画面側で少しずつ回す（Worker が使えないときの予備）
  function runHere(sp, t0){
    const s = makeSearch(sp, R);
    const tick = () => {
      if (!running) return;
      const fin = s.step(20000); progress(s.done, s.total);
      if (fin) finish([s.results()], sp, t0); else running.timer = setTimeout(tick, 0);
    };
    running.partial = () => [s.results()];
    tick();
  }
  function run(){
    const p = spec(); if (!p.any || !p.total) return;
    const sp = p.s, t0 = Date.now();
    running = {total:p.total}; $("xgo").hidden = true; $("xstop").hidden = false; $("xr").innerHTML = ""; progress(0, 1);
    $("xmsg").textContent = "探しています…";
    let url;
    try{
      url = URL.createObjectURL(new Blob([$("core").textContent], {type:"text/javascript"}));
      running.workers = [...Array(nWorkers)].map(() => new Worker(url));
    }catch(e){ running.workers = null; }
    if (!running.workers){ runHere(sp, t0); return; }
    const done = Array(nWorkers).fill(0), lists = Array(nWorkers).fill(null).map(() => []);
    let fin = 0, got = false;
    running.workers.forEach((w, k) => {
      w.onmessage = e => {
        got = true;
        done[k] = e.data.done;
        progress(done.reduce((a,b)=>a+b,0), p.total);
        lists[k] = e.data.results;                            // 途中経過の上位も毎回届く（「やめる」用）
        if (e.data.type === "done" && ++fin === nWorkers) finish(lists, sp, t0);
      };
      w.onerror = () => { if (!got && running && running.workers){ running.workers.forEach(x => x.terminate()); running.workers = null; runHere(sp, t0); } };
      w.postMessage({spec:{...sp, shard:k, shards:nWorkers}, R});
    });
    running.partial = () => lists;
  }
  $("xgo").addEventListener("click", run);
  $("xstop").addEventListener("click", () => { if (running) finish(running.partial ? running.partial() : [], spec().s, 0, true); });
  SWEEP.forEach(k => $(k+"x").addEventListener("change", render));
  ["xs","xlv","xn4","xsw","xsa","xcap"].forEach(id => $(id).addEventListener(id === "xlv" ? "input" : "change", () => { sweepInfo(); save(); }));
  $("xlv").addEventListener("focusout", () => { editing = null; $("xlv").value = xlvVal(); save(); });

  load(); render();
})();
