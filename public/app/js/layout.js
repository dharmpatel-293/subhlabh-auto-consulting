// UI-only helpers: mobile menu backdrop, table labels for phone card view,
// and hiding the setup notice once config is filled in. No data logic here.
(function () {
  var sidebar = document.getElementById("sidebar");
  var backdrop = document.createElement("div");
  backdrop.className = "sidebar-backdrop";
  document.body.appendChild(backdrop);

  function sync() { backdrop.classList.toggle("show", sidebar.classList.contains("open")); }
  new MutationObserver(sync).observe(sidebar, { attributes: true, attributeFilter: ["class"] });
  backdrop.addEventListener("click", function () { sidebar.classList.remove("open"); });
  document.getElementById("mainNav").addEventListener("click", function (e) {
    if (e.target.closest(".nav-link") && window.innerWidth < 992) sidebar.classList.remove("open");
  });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") sidebar.classList.remove("open"); });

  function label(table) {
    var heads = Array.prototype.map.call(table.querySelectorAll("thead th"), function (th) { return th.textContent.trim(); });
    table.querySelectorAll("tbody tr").forEach(function (tr) {
      Array.prototype.forEach.call(tr.children, function (td, i) {
        if (!td.hasAttribute("colspan")) td.setAttribute("data-label", heads[i] || "");
      });
    });
  }
  function labelAll() { document.querySelectorAll("table.table").forEach(label); }
  new MutationObserver(labelAll).observe(document.body, { childList: true, subtree: true, characterData: true });
  labelAll();

  var cfg = window.APP_CONFIG || {};
  if (cfg.supabaseUrl && cfg.supabaseUrl.indexOf("YOUR_") !== 0) {
    var notice = document.querySelector(".auth-card .alert-warning");
    if (notice) notice.remove();
  }
})();
