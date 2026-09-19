const RELEASES_API =
  "https://api.github.com/repos/thamodharangm/catchify/releases/latest";
const REPO_API = "https://api.github.com/repos/thamodharangm/catchify";
const ALL_RELEASES_API = "https://api.github.com/repos/thamodharangm/catchify/releases?per_page=100";
const STATS_URL = "stats.json";
const FEATURES_URL = "assets/features.txt";
let androidVersionText = "v2.4.2";
let iosVersionText = "v2.4.2";

const changelogElement = document.getElementById("changelog_element");
const featuresElement = document.getElementById("features_element");

function makeHttpRequest(url, callback, onError) {
  const xmlHttp = new XMLHttpRequest();
  xmlHttp.onreadystatechange = function () {
    if (xmlHttp.readyState === 4) {
      if (xmlHttp.status === 200) {
        callback(xmlHttp.responseText);
      } else if (onError) {
        onError();
      }
    }
  };
  xmlHttp.onerror = function () {
    if (onError) onError();
  };
  xmlHttp.open("GET", url, true);
  xmlHttp.send(null);
}

document.addEventListener("DOMContentLoaded", function () {
  const carouselEl = document.getElementById("screenshot-carousel");
  if (carouselEl && typeof Splide !== "undefined") {
    new Splide("#screenshot-carousel", {
      type: "loop",
      perPage: 3,
      gap: "2rem",
      pagination: true,
      arrows: false,
      autoplay: true,
      interval: 3000,
      pauseOnHover: true,
      breakpoints: {
        1200: { perPage: 3, gap: "2rem" },
        992: { perPage: 2, gap: "1.5rem" },
        640: {
          perPage: 1,
          gap: "1rem",
          padding: { left: "10%", right: "10%" },
        },
        380: {
          perPage: 1,
          gap: "0.5rem",
          padding: "0",
        },
      },
    }).mount();
  }
});

window.onload = function () {
  assignNavClass();
  window.addEventListener("resize", assignNavClass);
  setupNavToggle();
  // 1. Instant loading: fetch stats.json (hosted on same domain, zero API rate limits)
  fetchProjectStats();
  // 2. Fetch features list
  fetchAppFeatures(FEATURES_URL);
};

function formatNumber(n) {
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "k";
  return String(n);
}

function applyReleaseData(data) {
  if (!data) return;

  // 1. Keep Android and iOS release versions independent.
  const formatVersion = (version) => {
    if (!version) return "";
    return version.startsWith("v") ? version : "v" + version;
  };
  androidVersionText = formatVersion(data.android_version || data.version) || androidVersionText;
  iosVersionText = formatVersion(data.ios_version || data.version) || iosVersionText;
  const versionEl = document.getElementById("download-version");
  if (versionEl) versionEl.textContent = androidVersionText;
  const versionAndroidEl = document.getElementById("download-version-android");
  if (versionAndroidEl) versionAndroidEl.textContent = androidVersionText;
  const versionIosEl = document.getElementById("download-version-ios");
  if (versionIosEl) versionIosEl.textContent = iosVersionText;

  // 2. Android APK Link
  if (data.apk_url) {
    document
      .querySelectorAll("[data-download-link='android'], [data-download-link]:not([data-download-link='ios'])")
      .forEach((el) => {
        el.setAttribute("href", data.apk_url);
      });
  }

  // 3. iOS IPA Link
  if (data.ipa_url) {
    document.querySelectorAll("[data-download-link='ios']").forEach((el) => {
      el.setAttribute("href", data.ipa_url);
    });
  }

  // 4. Changelog
  if (data.changelog) {
    parseChangelog(data.changelog);
  }
}

function fetchProjectStats() {
  // Always query with timestamp to avoid browser/CDN caching
  const cacheBusterUrl = STATS_URL + "?t=" + Date.now();
  makeHttpRequest(
    cacheBusterUrl,
    (res) => {
      try {
        const stats = JSON.parse(res);
        const starsEl = document.getElementById("stat-stars");
        const forksEl = document.getElementById("stat-forks");
        const downloadsEl = document.getElementById("stat-downloads");
        const downloadsSubEl = document.getElementById("stat-downloads-sub");

        if (starsEl && stats.stars !== undefined) starsEl.textContent = formatNumber(stats.stars);
        if (forksEl && stats.forks !== undefined) forksEl.textContent = formatNumber(stats.forks);
        if (downloadsEl && stats.downloads !== undefined) downloadsEl.textContent = formatNumber(stats.downloads);

        if (downloadsSubEl && Number.isFinite(Number(stats.apk_downloads)) && Number.isFinite(Number(stats.ipa_downloads))) {
          downloadsSubEl.textContent = `${Number(stats.apk_downloads)} APK · ${Number(stats.ipa_downloads)} IPA`;
        }

        applyReleaseData(stats);
      } catch (e) {
        console.warn("stats.json parse error, falling back to API:", e);
        fetchProjectStatsFromAPI();
      }
    },
    () => {
      fetchProjectStatsFromAPI();
    },
  );
}

function fetchProjectStatsFromAPI() {
  // Fallback: fetch stars & forks from GitHub API
  makeHttpRequest(
    REPO_API,
    (res) => {
      try {
        const repo = JSON.parse(res);
        const starsEl = document.getElementById("stat-stars");
        const forksEl = document.getElementById("stat-forks");
        if (starsEl) starsEl.textContent = formatNumber(repo.stargazers_count || 1);
        if (forksEl) forksEl.textContent = formatNumber(repo.forks_count || 0);
      } catch (e) {
        console.warn("Could not load repo stats:", e);
      }
    },
    () => {},
  );

  // Fallback: fetch total downloads across ALL releases
  makeHttpRequest(
    ALL_RELEASES_API,
    (res) => {
      try {
        const releases = JSON.parse(res);
        if (!Array.isArray(releases)) return;
        let total = 0;
        let apkTotal = 0;
        let ipaTotal = 0;

        releases.forEach((release) => {
          (release.assets || []).forEach((asset) => {
            const count = asset.download_count || 0;
            total += count;
            const name = (asset.name || "").toLowerCase();
            if (name.endsWith(".apk")) apkTotal += count;
            else if (name.endsWith(".ipa") || name.includes(".ipa")) ipaTotal += count;
          });
        });

        const downloadsEl = document.getElementById("stat-downloads");
        if (downloadsEl) downloadsEl.textContent = formatNumber(total);

        const downloadsSubEl = document.getElementById("stat-downloads-sub");
        if (downloadsSubEl) {
          downloadsSubEl.textContent = `${apkTotal} APK · ${ipaTotal} IPA`;
        }
      } catch (e) {
        console.warn("Could not load download stats:", e);
      }
    },
    () => {},
  );
}

function fetchLatestRelease() {
  makeHttpRequest(
    RELEASES_API,
    (res) => {
      try {
        const release = JSON.parse(res);
        if (!release || !release.assets) return;

        // 1. Android Asset Selection (.apk)
        let apkAsset = (release.assets || []).find(
          (a) =>
            a.name.endsWith(".apk") &&
            !a.name.includes("arm64") &&
            !a.name.includes("fdroid") &&
            !a.name.includes("debug"),
        ) || (release.assets || []).find((a) => a.name.endsWith(".apk"));

        // 2. iOS Asset Selection (.ipa)
        let iosAsset = (release.assets || []).find((a) => a.name.endsWith(".ipa")) ||
          (release.assets || []).find((a) => a.name.toLowerCase().includes("ios") && a.name.endsWith(".zip"));

        const versionStr = release.tag_name ? (release.tag_name.startsWith("v") ? release.tag_name : "v" + release.tag_name) : "";

        applyReleaseData({
          version: versionStr,
          apk_url: apkAsset ? apkAsset.browser_download_url : undefined,
          ipa_url: iosAsset ? iosAsset.browser_download_url : undefined,
          changelog: release.body || undefined,
        });
      } catch (error) {
        console.warn("Error fetching latest release from GitHub API:", error);
      }
    },
    () => {
      // Do nothing on rate-limit failure; static HTML & stats.json already display the content
    },
  );
}

function parseChangelog(text) {
  if (!changelogElement || !text) return;
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  let currentTarget = null;
  const androidItems = [];
  const iosItems = [];
  const generalItems = [];

  lines.forEach((line) => {
    if (/^[-*_]{3,}$/.test(line)) return;

    if (/android/i.test(line) && /(release|v2|features|update)/i.test(line)) {
      currentTarget = "android";
      return;
    }
    if (/ios/i.test(line) && /(release|v2|features|update)/i.test(line)) {
      currentTarget = "ios";
      return;
    }
    if (/^#+\s*(what's\s*new|downloads)/i.test(line)) {
      return;
    }
    if (/^[-*•+]\s*\*\*.*(apk|ipa|bundle).*:\*\*/i.test(line)) {
      return;
    }

    const bulletMatch = line.match(/^([*\-+•]|\d+\.)\s+(.+)$/);
    const rawContent = bulletMatch ? bulletMatch[2] : (!line.startsWith("#") ? line : null);
    if (!rawContent) return;

    const formatted = rawContent
      .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
      .replace(/`(.+?)`/g, "<code>$1</code>");

    if (currentTarget === "android") {
      androidItems.push(formatted);
    } else if (currentTarget === "ios") {
      iosItems.push(formatted);
    } else {
      generalItems.push(formatted);
    }
  });

  const downloadLinkElement = document.querySelector("[data-download-link='android']");
  const iosDownloadLinkElement = document.querySelector("[data-download-link='ios']");
  const apkUrl = (downloadLinkElement && downloadLinkElement.href) || "https://github.com/thamodharangm/catchify/releases/latest";
  const ipaUrl = (iosDownloadLinkElement && iosDownloadLinkElement.href) || "https://github.com/thamodharangm/catchify/releases/latest";
  const androidVerText = androidVersionText || "v2.4.2";
  const iosVerText = iosVersionText || "v2.4.2";

  if (androidItems.length > 0 || iosItems.length > 0) {
    changelogElement.innerHTML = `
      <div class="changelog-grid">
        <article class="changelog-platform-card android-card">
          <div class="changelog-platform-header">
            <div class="changelog-platform-title">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M17.523 15.3414c-.5511 0-.9993-.4486-.9993-.9997s.4482-.9993.9993-.9993c.551 0 .9993.4482.9993.9993s-.4483.9997-.9993.9997m-11.046 0c-.5511 0-.9993-.4486-.9993-.9997s.4482-.9993.9993-.9993c.5511 0 .9994.4482.9994.9993s-.4483.9997-.9994.9997m11.4045-6.02l1.997-3.4592a.416.416 0 00-.1521-.5676.416.416 0 00-.5676.1521l-2.0223 3.503C15.5902 8.4116 13.8533 8.125 12 8.125s-3.5902.2866-5.1365.8247L4.8412 5.4467a.4161.4161 0 00-.5677-.1521.4157.4157 0 00-.152.5676l1.997 3.4592C2.6889 11.1867.3438 14.6586 0 18.75h24c-.3438-4.0914-2.6889-7.5633-6.1185-9.4286"/>
              </svg>
              <span>Android Release</span>
            </div>
            <span class="changelog-badge">${androidVerText}</span>
          </div>
          <ul class="changelog-list">
            ${androidItems.map((item) => `
              <li class="changelog-item">
                <span class="changelog-bullet" aria-hidden="true">&bull;</span>
                <div class="changelog-text">${item}</div>
              </li>
            `).join("")}
          </ul>
          <div class="changelog-footer">
            <a href="${apkUrl}" class="changelog-dl-link"><i>download</i> Download APK</a>
          </div>
        </article>

        <article class="changelog-platform-card ios-card">
          <div class="changelog-platform-header">
            <div class="changelog-platform-title">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 4.54c.64-.78 1.08-1.86.96-2.94-.93.04-2.06.62-2.72 1.4-.58.67-1.09 1.76-.95 2.82 1.04.08 2.07-.5 2.71-1.28z"/>
              </svg>
              <span>iOS Release</span>
            </div>
            <span class="changelog-badge">${iosVerText}</span>
          </div>
          <ul class="changelog-list">
            ${iosItems.map((item) => `
              <li class="changelog-item">
                <span class="changelog-bullet" aria-hidden="true">&bull;</span>
                <div class="changelog-text">${item}</div>
              </li>
            `).join("")}
          </ul>
          <div class="changelog-footer">
            <a href="${ipaUrl}" class="changelog-dl-link"><i>download</i> Download IPA</a>
          </div>
        </article>
      </div>
    `;
  } else if (generalItems.length > 0) {
    changelogElement.innerHTML = `
      <ul class="changelog-list">
        ${generalItems.map((item) => `
          <li class="changelog-item">
            <span class="changelog-bullet" aria-hidden="true">&bull;</span>
            <div class="changelog-text">${item}</div>
          </li>
        `).join("")}
      </ul>
    `;
  }
}

function assignNavClass() {
  const nav = document.getElementById("navigation-bar");
  if (!nav) return;
  if (window.innerWidth > 992) {
    nav.classList.remove("top", "nav-open");
    nav.classList.add("left");
    const toggle = document.getElementById("nav-toggle");
    if (toggle) toggle.setAttribute("aria-expanded", "false");
    const backdrop = document.getElementById("nav-backdrop");
    if (backdrop) backdrop.classList.remove("active");
  } else {
    nav.classList.remove("left");
    nav.classList.add("top");
  }
}

function setupNavToggle() {
  const nav = document.getElementById("navigation-bar");
  const toggle = document.getElementById("nav-toggle");
  const backdrop = document.getElementById("nav-backdrop");
  if (!nav || !toggle) return;

  function toggleMenu(force) {
    const shouldOpen = typeof force === "boolean" ? force : !nav.classList.contains("nav-open");
    if (shouldOpen) {
      nav.classList.add("nav-open");
      toggle.setAttribute("aria-expanded", "true");
      if (backdrop) backdrop.classList.add("active");
    } else {
      nav.classList.remove("nav-open");
      toggle.setAttribute("aria-expanded", "false");
      if (backdrop) backdrop.classList.remove("active");
    }
  }

  toggle.addEventListener("click", function (e) {
    e.stopPropagation();
    toggleMenu();
  });

  if (backdrop) {
    backdrop.addEventListener("click", function () {
      toggleMenu(false);
    });
  }

  // Close when clicking outside of nav
  document.addEventListener("click", function (e) {
    if (nav.classList.contains("nav-open") && !nav.contains(e.target)) {
      toggleMenu(false);
    }
  });

  // Close on Escape key
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && nav.classList.contains("nav-open")) {
      toggleMenu(false);
      toggle.focus();
    }
  });

  nav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", function () {
      toggleMenu(false);
    });
  });
}

const FEATURE_ICONS = [
  "ad_off",
  "cloud_download",
  "playlist_add",
  "equalizer",
  "lyrics",
  "language",
  "insights",
  "block",
];

const FALLBACK_FEATURES = [
  "No ads, no subscriptions, no hidden costs — 100% free forever",
  "Download songs and playlists to listen anywhere, even offline",
  "Create custom playlists, import them via link, and organize them into folders",
  "Fine-tune your sound with an adjustable equalizer and ready-made presets",
  "Follow along with synced live lyrics while you listen",
  "An interface in 21+ languages, with curated suggestions for Tamil, Hindi, Telugu, and more",
  "Time Machine gives you a monthly recap of what you've been listening to",
  "SponsorBlock automatically skips sponsored segments in supported tracks",
];

function renderFeatureCards(features) {
  if (!featuresElement) return;
  featuresElement.innerHTML = "";
  features.forEach((feature, index) => {
    const card = document.createElement("article");
    card.className = "feature-card";

    const icon = document.createElement("i");
    icon.textContent = FEATURE_ICONS[index % FEATURE_ICONS.length];

    const text = document.createElement("span");
    text.textContent = feature;

    card.appendChild(icon);
    card.appendChild(text);
    featuresElement.appendChild(card);
  });
}

function fetchAppFeatures(featuresUrl) {
  makeHttpRequest(
    featuresUrl,
    (res) => {
      try {
        const lines = res.split(/\r?\n/).filter((line) => line.trim() !== "");

        const features = lines
          .slice(1)
          .map((line) =>
            line
              .trim()
              .replace(/^\*\s*/, "")
              .trim(),
          )
          .filter((line) => line.length > 0);

        renderFeatureCards(features.length ? features : FALLBACK_FEATURES);
      } catch (error) {
        console.error("Error processing app features:", error);
        renderFeatureCards(FALLBACK_FEATURES);
      }
    },
    () => renderFeatureCards(FALLBACK_FEATURES),
  );
}
