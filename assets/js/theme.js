(function () {
  const STORAGE_KEY = "catchify-theme";
  const root = document.documentElement;
  const themeColor = document.querySelector('meta[name="theme-color"]');

  function getPreferredTheme() {
    const storedTheme = localStorage.getItem(STORAGE_KEY);
    if (storedTheme === "light" || storedTheme === "dark") return storedTheme;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  function applyTheme(theme) {
    const isDark = theme === "dark";
    root.dataset.theme = theme;
    if (themeColor) themeColor.setAttribute("content", isDark ? "#111827" : "#fffbea");
  }

  applyTheme(getPreferredTheme());

  document.addEventListener("DOMContentLoaded", function () {
    const toggle = document.getElementById("theme-toggle");
    if (!toggle) return;

    toggle.checked = root.dataset.theme === "dark";
    toggle.setAttribute("aria-checked", String(toggle.checked));
    toggle.setAttribute("aria-label", toggle.checked ? "Use light mode" : "Use Theme mode");

    toggle.addEventListener("change", function () {
      const theme = toggle.checked ? "dark" : "light";
      applyTheme(theme);
      localStorage.setItem(STORAGE_KEY, theme);
      toggle.setAttribute("aria-checked", String(toggle.checked));
      toggle.setAttribute("aria-label", toggle.checked ? "Use light mode" : "Use Theme mode");
    });
  });
})();
