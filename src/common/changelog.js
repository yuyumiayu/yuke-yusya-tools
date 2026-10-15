// ===== 更新履歴 =====
// data/changelog.json（新しい順）から、このページ（data-tool）の分だけを出す。新しい3件はいつも見せ、それより前は折りたたむ
(function(){
  const box = document.getElementById("log"), src = document.getElementById("data-log");
  if (!box || !src) return;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  const SHOW = 3;
  const rows = JSON.parse(src.textContent).filter(x => x.tools.includes(box.dataset.tool));
  if (!rows.length){ box.hidden = true; return; }
  const li = x => `<li><time datetime="${x.date}">${x.date}</time><span>${esc(x.text)}</span></li>`;
  const rest = rows.slice(SHOW);
  box.innerHTML = `<h2>更新履歴</h2><ul>${rows.slice(0, SHOW).map(li).join("")}</ul>` +
    (rest.length ? `<details><summary>それより前（${rest.length}件）</summary><ul>${rest.map(li).join("")}</ul></details>` : "");
})();
