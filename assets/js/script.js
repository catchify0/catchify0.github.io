const RELEASES_API =
  "https://api.github.com/repos/thamodharangm/catchify/releases/latest";
const IOS_RELEASES_API =
  "https://api.github.com/repos/thamodharangm/ios-catchify/releases/latest";
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
  loadGitHubStats();
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
  fetchLatestRelease();
  fetchAppFeatures(FEATURES_URL);
};

function fetchLatestRelease() {
  makeHttpRequest(
    RELEASES_API,
    (res) => {
      try {
        const release = JSON.parse(res);

        // 1. Android Asset Selection (.apk)
        let apkAsset = (release.assets || []).find(
          (a) =>
            a.name.endsWith(".apk") &&
            !a.name.includes("arm64") &&
            !a.name.includes("fdroid") &&
            !a.name.includes("debug"),
        );

        if (!apkAsset) {
          apkAsset = (release.assets || []).find((a) => a.name.endsWith(".apk"));
        }

        if (apkAsset) {
          document.querySelectorAll("[data-download-link='android'], [data-download-link]:not([data-download-link='ios'])").forEach((el) => {
            el.setAttribute("href", apkAsset.browser_download_url);
          });
        }

        // 2. iOS Asset Selection (strictly prioritize .ipa for direct Sideloadly download)
        let iosAsset = (release.assets || []).find((a) => a.name.endsWith(".ipa"));
        if (!iosAsset) {
          iosAsset = (release.assets || []).find(
            (a) => a.name.toLowerCase().includes("ios") && a.name.endsWith(".zip"),
          );
        }

        if (iosAsset) {
          document.querySelectorAll("[data-download-link='ios']").forEach((el) => {
            el.setAttribute("href", iosAsset.browser_download_url);
          });
        } else {
          // If iOS asset is not in the central repo release yet, check ios-catchify fallback
          fetchIosFallbackRelease();
        }

        const versionStr = release.tag_name ? "v" + release.tag_name.replace(/^v/, "") : "";
        const versionEl = document.getElementById("download-version");
        if (versionEl && versionStr) {
          versionEl.textContent = versionStr;
        }

        const versionAndroidEl = document.getElementById("download-version-android");
        if (versionAndroidEl && versionStr) {
          versionAndroidEl.textContent = versionStr;
        }

        const versionIosEl = document.getElementById("download-version-ios");
        if (versionIosEl && versionStr && iosAsset) {
          versionIosEl.textContent = versionStr;
        }

        if (release.body) {
          parseChangelog(release.body);
        } else {
          showChangelogFallback();
        }
      } catch (error) {
        console.error("Error fetching latest Catchify release:", error);
        showChangelogFallback();
        fetchIosFallbackRelease();
      }
    },
    () => {
      showChangelogFallback();
      fetchIosFallbackRelease();
    },
  );
}

function fetchIosFallbackRelease() {
  makeHttpRequest(
    IOS_RELEASES_API,
    (res) => {
      try {
        const release = JSON.parse(res);
        let iosAsset = (release.assets || []).find((a) => a.name.endsWith(".ipa"));
        if (!iosAsset) {
          iosAsset = (release.assets || []).find(
            (a) => a.name.toLowerCase().includes("ios") && a.name.endsWith(".zip"),
          );
        }
        if (iosAsset) {
          document.querySelectorAll("[data-download-link='ios']").forEach((el) => {
            el.setAttribute("href", iosAsset.browser_download_url);
          });
        }
        const versionIosEl = document.getElementById("download-version-ios");
        if (versionIosEl && release.tag_name) {
          versionIosEl.textContent = "v" + release.tag_name.replace(/^v/, "").replace(/-ios$/, "");
        }
      } catch (e) {
        console.warn("Could not load iOS fallback release:", e);
      }
    },
    () => {},
  );
}

function showChangelogFallback() {
  if (!changelogElement || changelogElement.childElementCount > 0) return;
  const paragraph = document.createElement("p");
  paragraph.innerHTML =
    'Could not load the latest changelog. See <a href="https://github.com/thamodharangm/catchify/releases" target="_blank" rel="noopener">GitHub Releases</a> for what\'s new.';
  changelogElement.appendChild(paragraph);
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
  "No ads, no subscriptions, no hidden costs � completely free to use",
  "Download songs and playlists to listen anywhere, even offline",
  "Create custom playlists, import them via link, and organize them into folders",
  "Fine-tune your sound with an adjustable equalizer and ready-made presets",
  "Follow along with synced lyrics while you listen",
  "An interface in 21+ languages, with curated suggestions for Tamil, Hindi, Telugu, and more",
  "Time Machine gives you a monthly recap of what you've been listening to",
  "SponsorBlock automatically skips sponsored segments in supported tracks",
];

function renderFeatureCards(features) {
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

function parseChangelog(text) {
  const lines = text.split(/\r?\n/).filter((line) => line.trim() !== "");
  let hasBullet = false;

  lines.forEach((line) => {
    const itemMatch = line.match(/^\*\s+(.+)$/);
    if (itemMatch) {
      hasBullet = true;
      const processedText = itemMatch[1].replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
      const listItem = document.createElement("p");
      listItem.innerHTML = `� ${processedText}`;
      changelogElement.appendChild(listItem);
    }
  });

  if (!hasBullet) {
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

// Smooth Count Up Animation for Statistics
function animateCount(element, target, suffix) {
  if (!element) return;
  suffix = suffix || "";
  const start = 0;
  if (target === 0) {
    element.textContent = "0" + suffix;
    return;
  }
  const duration = 1100;
  const startTime = performance.now();

  function step(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const ease = 1 - Math.pow(1 - progress, 3);
    const currentVal = Math.round(start + (target - start) * ease);
    element.textContent = currentVal.toLocaleString() + suffix;
    if (progress < 1) {
      requestAnimationFrame(step);
    } else {
      element.textContent = target.toLocaleString() + suffix;
    }
  }
  requestAnimationFrame(step);
}

// Fetch Live GitHub Statistics (Stars, Forks, Total Downloads) with Fallbacks & Cache
function loadGitHubStats() {
  const starsEl = document.getElementById("stats-stars");
  const forksEl = document.getElementById("stats-forks");
  const downloadsEl = document.getElementById("stats-downloads");

  // 1. Instant Cache Render from localStorage
  let cached = null;
  try {
    const raw = localStorage.getItem("catchify_stats_cache");
    if (raw) cached = JSON.parse(raw);
  } catch (e) {}

  if (cached && typeof cached.stars === "number") {
    animateCount(starsEl, cached.stars, "");
    animateCount(forksEl, cached.forks, "");
    animateCount(downloadsEl, cached.downloads, "");
  }

  function saveCache(stars, forks, downloads) {
    try {
      const current = cached || {};
      const updated = {
        stars: typeof stars === "number" ? stars : (current.stars || 1),
        forks: typeof forks === "number" ? forks : (current.forks || 0),
        downloads: typeof downloads === "number" ? downloads : (current.downloads || 89),
        time: Date.now()
      };
      localStorage.setItem("catchify_stats_cache", JSON.stringify(updated));
    } catch (e) {}
  }

  // 2. Fetch Live Repo Info (Stars, Forks)
  fetch("https://api.github.com/repos/thamodharangm/catchify", { cache: "no-store" })
    .then(function (res) {
      if (!res.ok) throw new Error("GitHub API status: " + res.status);
      return res.json();
    })
    .then(function (data) {
      if (data) {
        if (starsEl && typeof data.stargazers_count === "number") {
          animateCount(starsEl, data.stargazers_count, "");
        }
        if (forksEl && typeof data.forks_count === "number") {
          animateCount(forksEl, data.forks_count, "");
        }
        saveCache(data.stargazers_count, data.forks_count, null);
      }
    })
    .catch(function (err) {
      console.warn("Could not load repo stars/forks from GitHub API, checking check.json fallback:", err);
      fetchFallbackStats();
    });

  // 3. Fetch Live Releases Info (Downloads) across all releases
  fetch("https://api.github.com/repos/thamodharangm/catchify/releases?per_page=100", { cache: "no-store" })
    .then(function (res) {
      if (!res.ok) throw new Error("GitHub Releases status: " + res.status);
      return res.json();
    })
    .then(function (releases) {
      if (Array.isArray(releases) && releases.length > 0) {
        let total = 0;
        releases.forEach(function (rel) {
          if (Array.isArray(rel.assets)) {
            rel.assets.forEach(function (asset) {
              total += asset.download_count || 0;
            });
          }
        });
        if (downloadsEl && total > 0) {
          animateCount(downloadsEl, total, "");
          saveCache(null, null, total);
        }
      }
    })
    .catch(function (err) {
      console.warn("Could not load release downloads from GitHub API, checking check.json fallback:", err);
      fetchFallbackStats();
    });

  // Fallback: check.json is always hosted on the website domain without GitHub rate limits
  function fetchFallbackStats() {
    fetch("check.json?_t=" + Date.now())
      .then(function (res) { return res.ok ? res.json() : null; })
      .then(function (checkData) {
        if (checkData && checkData.stats) {
          if (starsEl && typeof checkData.stats.stars === "number") {
            animateCount(starsEl, checkData.stats.stars, "");
          }
          if (forksEl && typeof checkData.stats.forks === "number") {
            animateCount(forksEl, checkData.stats.forks, "");
          }
          if (downloadsEl && typeof checkData.stats.downloads === "number") {
            animateCount(downloadsEl, checkData.stats.downloads, "");
          }
        }
      })
      .catch(function () {});
  }
}
