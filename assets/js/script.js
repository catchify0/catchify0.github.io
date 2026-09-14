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
