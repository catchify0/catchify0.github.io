const RELEASES_API =
  "https://api.github.com/repos/thamodharangm/catchify/releases/latest";
const REPO_API = "https://api.github.com/repos/thamodharangm/catchify";
const ALL_RELEASES_API = "https://api.github.com/repos/thamodharangm/catchify/releases?per_page=100";
const STATS_URL = "stats.json";
const FEATURES_URL = "assets/features.txt";

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
      699: { perPage: 2, gap: "1.5rem" },
      560: { perPage: 1, gap: "1rem" },
    },
  }).mount();
});

window.onload = function () {
  assignNavClass();
  window.addEventListener("resize", assignNavClass);
  setupNavToggle();
  // 1. Instant loading: fetch stats.json (immune to GitHub API rate limits)
  fetchProjectStats();
  // 2. Fetch features list
  fetchAppFeatures(FEATURES_URL);
  // 3. Background check for fresh GitHub API data (if not rate limited)
  fetchLatestRelease();
};

function formatNumber(n) {
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "k";
  return String(n);
}

function applyReleaseData(data) {
  if (!data) return;

  // 1. Version Update
  if (data.version) {
    const versionStr = data.version.startsWith("v") ? data.version : "v" + data.version;
    const versionEl = document.getElementById("download-version");
    if (versionEl) versionEl.textContent = versionStr;
    const versionAndroidEl = document.getElementById("download-version-android");
    if (versionAndroidEl) versionAndroidEl.textContent = versionStr;
    const versionIosEl = document.getElementById("download-version-ios");
    if (versionIosEl) versionIosEl.textContent = versionStr;
  }

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

        if (downloadsSubEl) {
          if (stats.apk_downloads && stats.ipa_downloads) {
            downloadsSubEl.textContent = `${stats.apk_downloads} APK · ${stats.ipa_downloads} IPA`;
          } else {
            downloadsSubEl.textContent = "Android APK & iOS IPA";
          }
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
        if (downloadsSubEl && apkTotal && ipaTotal) {
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
  const lines = text.split(/\r?\n/).filter((line) => line.trim() !== "");
  let items = [];

  lines.forEach((line) => {
    const itemMatch = line.match(/^\*\s+(.+)$/);
    if (itemMatch) {
      const processedText = itemMatch[1].replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
      items.push(processedText);
    }
  });

  if (items.length > 0) {
    changelogElement.innerHTML = "";
    items.forEach((item) => {
      const listItem = document.createElement("p");
      listItem.innerHTML = `&bull; ${item}`;
      changelogElement.appendChild(listItem);
    });
  } else if (text.trim().length > 0) {
    changelogElement.innerHTML = "";
    const paragraph = document.createElement("p");
    paragraph.innerHTML = text.trim().replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
    changelogElement.appendChild(paragraph);
  }
}

function assignNavClass() {
  const nav = document.getElementById("navigation-bar");
  if (window.innerWidth > 760) {
    nav.classList.remove("top", "nav-open");
    nav.classList.add("left");
    const toggle = document.getElementById("nav-toggle");
    if (toggle) toggle.setAttribute("aria-expanded", "false");
  } else {
    nav.classList.remove("left");
    nav.classList.add("top");
  }
}

function setupNavToggle() {
  const nav = document.getElementById("navigation-bar");
  const toggle = document.getElementById("nav-toggle");
  if (!nav || !toggle) return;

  toggle.addEventListener("click", function () {
    const isOpen = nav.classList.toggle("nav-open");
    toggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
  });

  nav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", function () {
      nav.classList.remove("nav-open");
      toggle.setAttribute("aria-expanded", "false");
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
