// ===== 装備図鑑 =====
(function(){
  const $ = id => document.getElementById(id);
  const J = id => JSON.parse($(id).textContent);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  const K = ["hp","atk","def","eva","luk"], KL = {hp:"HP", atk:"攻", def:"防", eva:"回", luk:"運"};
  const W = J("data-w"), A = J("data-a"), I = J("data-i"), R = J("data-r"), E = J("data-e");
  const cost = {}; E.forEach(x => { cost[x.kind + "|" + x.name] = x.cost; });
  const inGame = {}; [...W, ...A].forEach(x => { inGame[x.name] = x.in_game; });
  // 入手場所：表は wiki の略称のまま、絞り込みは正式名称（メンテナー確認）。並びは絞り込みの選択肢の順
  const DUN = [["店","ショップ"], ["冒","冒険者の洞窟"], ["試","試練の塔"], ["財","財宝の島"], ["飛","飛竜の谷"], ["死","死霊の渓谷"],
    ["戦","戦略の丘"], ["染","染血の塔"], ["水","水龍の滝"], ["闇","闇のほこら"], ["王","王家の墓"], ["森","鍛錬の森"],
    ["沈","沈没船"], ["竜","竜神の古都"], ["光","光のほこら"], ["忍","忍の館"], ["漆","漆黒の古城"], ["サ","サバイバルタワー"],
    ["イベント限定","イベント"], ["イベントアイテム","イベント"]];
  const DUN_ORDER = [...new Set(DUN.map(d => d[1]))];
  const dunName = c => c.startsWith("サ") ? "サバイバルタワー" : (DUN.find(d => d[0] === c) || [c, c])[1];   // サ10・サ20 なども サバイバルタワー
  const dunNames = x => [...new Set((x.dungeons || []).map(dunName))];
  // 共鳴：装備ごとの件数（武器は weapon、防具は armor が同じ名前のもの）
  const resOf = (kind, name) => R.filter(r => (kind === "weapon" ? r.weapon : r.armor) === name);

  // 列：key（並べ替えに使う値の名前）、見出し、グループ（2段目の見出しの上にまとめる名前）、値、表示
  const num = v => v === null || v === undefined ? `<span class="q">？</span>` : v === 0 ? `<span class="z">0</span>` : String(v);
  const stat = (g, k) => ({key:g + k, label:KL[k], grp:g === "b" ? "出発時補正" : "成長補正", val:x => x[g === "b" ? "base" : "growth"][k], cls:"num"});
  const equipCols = (main, kind) => [
    {key:"name", label:"名前", val:x => x.name, cls:"name", show:x => esc(x.name)},
    {key:"rarity", label:"☆", val:x => x.rarity, cls:"num"},
    {key:"power", label:main === "atk" ? "攻撃力" : "防御力", val:x => x.base[main], cls:"num"},
    {key:"max", label:"強化上限", val:x => x.max_enhance, cls:"num"},
    {key:"maxp", label:"MAX時", val:x => x.base[main] === null ? null : x.base[main] + (x.max_enhance || 0), cls:"num"},
    ...K.filter(k => k !== main).map(k => stat("b", k)),
    ...K.map(k => stat("g", k)),
    {key:"ability", label:"アビリティ", val:x => x.ability || "", cls:"l", show:x => x.ability ? esc(x.ability) : ""},
    {key:"res", label:"共鳴", val:x => resOf(kind, x.name).length, cls:"num",
      show:x => { const n = resOf(kind, x.name).length;
        return n ? `<button type="button" class="rlink" data-res="${esc(x.name)}" data-kind="${kind}" aria-label="${esc(x.name)}の共鳴を見る">${n}件 ›</button>` : `<span class="z">0</span>`; }},
    {key:"dun", label:"入手場所", val:x => (x.dungeons || []).join("・"), cls:"l", show:x => esc((x.dungeons || []).join("・"))},
    {key:"price", label:"価格", val:x => x.price, cls:"num"},
    {key:"cost", label:"強化費用(+1)", val:x => cost[kind + "|" + x.name] ?? null, cls:"num"},
  ];
  const TABS = {
    w: {rows:W, cols:equipCols("atk", "weapon"), rarity:true, dun:true, abi:true},
    a: {rows:A, cols:equipCols("def", "armor"), rarity:true, dun:true, abi:true},
    i: {rows:I, rarity:true, dun:true, cols:[
      {key:"name", label:"名前", val:x => x.name, cls:"name", show:x => esc(x.name)},
      {key:"rarity", label:"☆", val:x => x.rarity, cls:"num"},
      ...K.map(k => stat("b", k)),
      ...K.map(k => stat("g", k)),
      {key:"text", label:"説明", val:x => [x.base_text, x.growth_text].filter(Boolean).join(" ／ "), cls:"wrap",
        show:x => esc([x.base_text && "出発時 " + x.base_text, x.growth_text && "成長 " + x.growth_text].filter(Boolean).join(" ／ "))},
      {key:"dun", label:"入手場所", val:x => (x.dungeons || []).join("・"), cls:"l", show:x => esc((x.dungeons || []).join("・"))},
      {key:"price", label:"価格", val:x => x.price, cls:"num"},
    ]},
    r: {rows:R.map(x => ({...x, in_game: inGame[x.weapon] !== false && inGame[x.armor] !== false})), calc:true, cols:[
      {key:"weapon", label:"武器", val:x => x.weapon, cls:"name", show:x => esc(x.weapon)},
      {key:"armor", label:"防具", val:x => x.armor, cls:"l", show:x => esc(x.armor)},
      {key:"rname", label:"共鳴", val:x => x.name, cls:"l", show:x => esc(x.name + (x.name_note || ""))},
      {key:"effect", label:"効果", val:x => x.effect, cls:"wrap", show:x => esc(x.effect)},
      {key:"calc", label:"ステータス", val:x => x.calc ? 1 : 0, cls:"l",
        show:x => x.calc ? `<span class="tag">${x.calc.pending ? "未反映" : "効く"}</span>` : ""},
    ]},
  };

  // ===== 状態（localStorage に保存） =====
  const KEY = "yuke-catalog-v1";
  const st = {tab:"w", game:"all", rar:"", dun:"", abi:false, calc:false, q:"", sort:{}, rfor:null};   // rfor：共鳴を絞る装備 {kind, name}
  try{ Object.assign(st, JSON.parse(localStorage.getItem(KEY) || "{}")); }catch(e){}
  if (!TABS[st.tab]) st.tab = "w";
  const save = () => { try{ localStorage.setItem(KEY, JSON.stringify(st)); }catch(e){} };

  let shownTab = null;
  function fillFilters(){
    const T = TABS[st.tab];
    $("f-rar").hidden = !T.rarity; $("f-dun").hidden = !T.dun; $("f-abi").hidden = !T.abi; $("f-calc").hidden = !T.calc;
    $("f-for").hidden = !(st.tab === "r" && st.rfor);
    if (st.rfor) $("forx").textContent = `${st.rfor.name}（${st.rfor.kind === "weapon" ? "武器" : "防具"}） ✕`;
    const rs = [...new Set(T.rows.map(x => x.rarity))].filter(v => v != null).sort((a, b) => a - b);
    $("rar").innerHTML = `<option value="">すべて</option>` + rs.map(r => `<option value="${r}">☆${r}</option>`).join("");
    if (!rs.map(String).includes(st.rar)) st.rar = "";
    $("rar").value = st.rar;
    const have = new Set(T.rows.flatMap(dunNames)), ds = DUN_ORDER.filter(d => have.has(d));
    $("dun").innerHTML = `<option value="">すべて</option>` + ds.map(d => `<option value="${esc(d)}">${esc(d)}</option>`).join("");
    if (!ds.includes(st.dun)) st.dun = "";
    $("dun").value = st.dun;
    $("abi").checked = st.abi; $("calc").checked = st.calc; $("q").value = st.q;
    document.querySelectorAll("[data-tab]").forEach(b => b.setAttribute("aria-selected", b.dataset.tab === st.tab));
    if (shownTab !== st.tab){ $("tbl").parentElement.scrollLeft = 0; shownTab = st.tab; }   // タブが変わったら表の横スクロールを左に戻す
    document.querySelectorAll("[data-game]").forEach(b => b.setAttribute("aria-checked", b.dataset.game === st.game));
  }

  // 並べ替え：数字は多い順から、文字は五十音順から。空（？）はいつも最後
  function sorted(rows, cols){
    const s = st.sort[st.tab]; if (!s) return rows;
    const c = cols.find(c => c.key === s.key); if (!c) return rows;
    const dir = s.dir === "asc" ? 1 : -1;
    return rows.map((x, i) => [x, i]).sort(([x, i], [y, j]) => {
      const a = c.val(x), b = c.val(y);
      const na = a === null || a === undefined || a === "", nb = b === null || b === undefined || b === "";
      if (na || nb) return na === nb ? i - j : na ? 1 : -1;
      const d = typeof a === "number" ? a - b : String(a).localeCompare(String(b), "ja");
      return d ? d * dir : i - j;
    }).map(([x]) => x);
  }
  function render(){
    const T = TABS[st.tab], q = st.q.trim().toLowerCase();
    let rows = T.rows.filter(x => {
      if (st.game === "in" && !x.in_game) return false;
      if (st.game === "out" && x.in_game) return false;
      if (T.rarity && st.rar && String(x.rarity) !== st.rar) return false;
      if (T.dun && st.dun && !dunNames(x).includes(st.dun)) return false;
      if (st.tab === "r" && st.rfor && (st.rfor.kind === "weapon" ? x.weapon : x.armor) !== st.rfor.name) return false;
      if (T.abi && st.abi && !x.ability) return false;
      if (T.calc && st.calc && !x.calc) return false;
      if (q && ![x.name, x.weapon, x.armor].some(n => n && n.toLowerCase().includes(q))) return false;
      return true;
    });
    rows = sorted(rows, T.cols);
    $("cnt").innerHTML = `<b>${rows.length}</b> 件（全${T.rows.length}件）`;
    const s = st.sort[st.tab] || {}, two = T.cols.some(c => c.grp);
    const head = c => `<th class="${c.cls === "num" ? "" : c.cls === "name" ? "name" : "l"}"${s.key === c.key ? ` aria-sort="${s.dir === "asc" ? "ascending" : "descending"}"` : ""}` +
      `${c.grp || !two ? "" : ` rowspan="2"`}><button type="button" data-sort="${c.key}">${c.label}${s.key === c.key ? (s.dir === "asc" ? " ▲" : " ▼") : ""}</button></th>`;
    // 見出しは2段。出発時補正・成長補正は上の段でまとめる
    let top = "", sub = "";
    T.cols.forEach((c, i) => {
      if (!c.grp){ top += head(c); return; }
      if (!T.cols[i - 1] || T.cols[i - 1].grp !== c.grp) top += `<th class="grp" colspan="${T.cols.filter(d => d.grp === c.grp).length}">${c.grp}</th>`;
      sub += head(c);
    });
    const body = rows.length ? rows.map(x => `<tr${x.in_game === false ? ' class="out"' : ""}>` +
      T.cols.map(c => `<td class="${c.cls}">${c.show ? c.show(x) : num(c.val(x))}</td>`).join("") + "</tr>").join("")
      : `<tr><td class="empty" colspan="${T.cols.length}">条件に合うものがありません。</td></tr>`;
    $("tbl").innerHTML = `<thead><tr>${top}</tr>${sub ? `<tr>${sub}</tr>` : ""}</thead><tbody>${body}</tbody>`;
    save();
  }

  // タブを押したら、装備での共鳴の絞り込みは外す（共鳴の列から来たときだけ付ける）
  document.querySelectorAll("[data-tab]").forEach(b => b.addEventListener("click", () => { st.tab = b.dataset.tab; st.rfor = null; fillFilters(); render(); }));
  $("forx").addEventListener("click", () => { st.rfor = null; fillFilters(); render(); });
  document.querySelectorAll("[data-game]").forEach(b => b.addEventListener("click", () => { st.game = b.dataset.game; fillFilters(); render(); }));
  $("rar").addEventListener("change", () => { st.rar = $("rar").value; render(); });
  $("dun").addEventListener("change", () => { st.dun = $("dun").value; render(); });
  $("abi").addEventListener("change", () => { st.abi = $("abi").checked; render(); });
  $("calc").addEventListener("change", () => { st.calc = $("calc").checked; render(); });
  $("q").addEventListener("input", () => { st.q = $("q").value; render(); });
  // 見出しを押すと並べ替え。同じ列をもう一度押すと向きが入れ替わる。3回目で元の並びに戻す
  $("tbl").addEventListener("click", e => {
    // 共鳴の列：共鳴タブに切り替えて、その装備が関係する共鳴だけを出す（名前の検索は外す）
    const r = e.target.closest("button[data-res]");
    if (r){
      st.tab = "r"; st.rfor = {kind:r.dataset.kind, name:r.dataset.res}; st.q = "";
      fillFilters(); render(); $("h-c").parentElement.scrollIntoView({behavior:"smooth", block:"start"}); return;
    }
    const b = e.target.closest("button[data-sort]"); if (!b) return;
    const key = b.dataset.sort, cur = st.sort[st.tab], c = TABS[st.tab].cols.find(c => c.key === key);
    const first = c.cls === "num" ? "desc" : "asc";
    if (!cur || cur.key !== key) st.sort[st.tab] = {key, dir:first};
    else if (cur.dir === first) st.sort[st.tab] = {key, dir:first === "desc" ? "asc" : "desc"};
    else delete st.sort[st.tab];
    render();
    const nb = $("tbl").querySelector(`button[data-sort="${key}"]`); if (nb) nb.focus();
  });
  fillFilters(); render();
})();
