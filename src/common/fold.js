// ===== 欄の折りたたみ =====
// data-fold="キー" を付けた .win は、見出しを押すと見出し以外を隠す。
// たたんだ欄のキーを localStorage（yuke-fold-v1、全ツール共通）に保存し、次に開いたときもそのままにする。初めは全部開いている。
(function(){
  const KEY = "yuke-fold-v1";
  let closed = {};
  try{ closed = JSON.parse(localStorage.getItem(KEY) || "{}") || {}; }catch(e){}
  document.querySelectorAll(".win[data-fold]").forEach(sec => {
    const k = sec.dataset.fold, h = sec.querySelector("h2");
    const b = document.createElement("button");
    b.type = "button"; b.className = "fold"; b.textContent = h.textContent;
    h.textContent = ""; h.appendChild(b);
    const set = c => { sec.classList.toggle("folded", c); b.setAttribute("aria-expanded", String(!c)); };
    set(!!closed[k]);
    b.addEventListener("click", () => {
      const c = !sec.classList.contains("folded");
      set(c);
      if (c) closed[k] = true; else delete closed[k];
      try{ localStorage.setItem(KEY, JSON.stringify(closed)); }catch(e){}
    });
  });
})();
