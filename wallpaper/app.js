const API = "http://127.0.0.1:51337";

/* ==========================================================================
   STATIC DATA
   ========================================================================== */

const LOGO = [
  "111111111111111   111111111111111",
  "111111111111111   111111111111111",
  "111111111111111   111111111111111",
  "111111111111111   111111111111111",
  "111111111111111   111111111111111",
  "111111111111111   111111111111111",
  "111111111111111   111111111111111",
  "",
  "111111111111111   111111111111111",
  "111111111111111   111111111111111",
  "111111111111111   111111111111111",
  "111111111111111   111111111111111",
  "111111111111111   111111111111111",
  "111111111111111   111111111111111",
  "111111111111111   111111111111111"
];

const ASCII_RAMP = "  ..,,::--==++**##%%@@WW";

/* ==========================================================================
   STATE
   ========================================================================== */

let mediaState = {
  enabled: false,
  title: "",
  artist: "",
  albumTitle: "",
  playbackState: "",
  positionSeconds: 0,
  durationSeconds: 0,
  lastTimelineUpdateMs: 0,
  thumbnail: "",
  primaryColor: "",
  secondaryColor: "",
  asciiHtml: "",
  asciiDirty: false
};

let audioSmooth = {
  bass: 0,
  mid: 0,
  treble: 0,
  volume: 0
};

let reactiveFx = {
  crtGlow: 0,
  audioFast: 0
};

let helperState = {
  online: false,
  lastOkAt: 0
};

let uiFx = {
  progressHeadPhase: 0,
  asciiRevealUntil: 0,
  asciiRevealActive: false,
  logoWaveCells: new Set(),
  logoWaveUntil: 0,
  signalFlickerActive: false,
  signalFlickerUntil: 0
};

/* ==========================================================================
   DOM HELPERS
   ========================================================================== */

function el(id) {
  return document.getElementById(id);
}

function scaleHud() {
  const scale = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
  el("hud").style.transform = `scale(${scale})`;
}

function esc(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

/* ==========================================================================
   GENERIC FORMATTERS
   ========================================================================== */

function colorLine(key, value, extraClass = "") {
  const k = `<span class="k">${esc(key)}</span>`;
  const v = `<span class="v ${extraClass}">${esc(value ?? "")}</span>`;
  return `${k}${v}`;
}

function formatUptime(value) {
  return value ?? "0h 0m 0s";
}

function formatClock(value) {
  if (!value) return "--:--:--";

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "--:--:--";

  return d.toLocaleTimeString("ru-RU", { hour12: false });
}

function formatMediaTime(totalSeconds) {
  totalSeconds = Math.max(0, Math.floor(Number(totalSeconds) || 0));

  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;

  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  return `${m}:${String(s).padStart(2, "0")}`;
}

/* ==========================================================================
   COLOR HELPERS
   ========================================================================== */

function rgbToHex(r, g, b) {
  const toHex = (v) => {
    const n = Math.max(0, Math.min(255, Math.round(v)));
    return n.toString(16).padStart(2, "0");
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function hexToRgb(hex) {
  const clean = String(hex || "").trim().replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return null;

  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16)
  };
}

function rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;

  if (max === min) {
    return { h: 0, s: 0, l };
  }

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

  let h;
  switch (max) {
    case r:
      h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
      break;
    case g:
      h = ((b - r) / d + 2) / 6;
      break;
    default:
      h = ((r - g) / d + 4) / 6;
      break;
  }

  return { h, s, l };
}

function hueToRgb(p, q, t) {
  if (t < 0) t += 1;
  if (t > 1) t -= 1;
  if (t < 1 / 6) return p + (q - p) * 6 * t;
  if (t < 1 / 2) return q;
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
  return p;
}

function hslToRgb(h, s, l) {
  let r, g, b;

  if (s === 0) {
    r = g = b = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;

    r = hueToRgb(p, q, h + 1 / 3);
    g = hueToRgb(p, q, h);
    b = hueToRgb(p, q, h - 1 / 3);
  }

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255)
  };
}

function mixRgb(a, b, t) {
  return {
    r: Math.round(a.r + (b.r - a.r) * t),
    g: Math.round(a.g + (b.g - a.g) * t),
    b: Math.round(a.b + (b.b - a.b) * t)
  };
}

function getRelativeLuminance(r, g, b) {
  const srgb = [r, g, b].map(v => {
    const c = v / 255;
    return c <= 0.04045
      ? c / 12.92
      : Math.pow((c + 0.055) / 1.055, 2.4);
  });

  return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
}

function normalizeAccentColor(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return "#62d8ff";

  let { h, s, l } = rgbToHsl(rgb.r, rgb.g, rgb.b);

  if (l < 0.38) l = 0.38;
  if (l < 0.46 && s < 0.35) l = 0.46;

  if (s < 0.30) s = 0.30;
  if (s < 0.42 && l < 0.55) s = 0.42;

  let out = hslToRgb(h, s, l);

  const lum = getRelativeLuminance(out.r, out.g, out.b);
  if (lum < 0.22) {
    out = mixRgb(out, { r: 98, g: 216, b: 255 }, 0.35);
  }

  return rgbToHex(out.r, out.g, out.b);
}

function setAccentColor(color) {
  const accent = normalizeAccentColor(color);
  document.documentElement.style.setProperty("--accent", accent);
}

/* ==========================================================================
   BAR BUILDERS
   ========================================================================== */

function buildBar(percent, width, color) {
  percent = Math.max(0, Math.min(100, Number(percent) || 0));

  const filled = Math.round(percent / 100 * width);
  const empty = width - filled;

  return "["
    + `<span style="color:${color}">${"#".repeat(filled)}</span>`
    + ".".repeat(empty)
    + "]";
}

function buildStorageBar(percent, width) {
  percent = Math.max(0, Math.min(100, Number(percent) || 0));

  const filled = Math.round(percent / 100 * width);
  const empty = width - filled;

  let bar = "[";

  for (let i = 0; i < filled; i++) {
    const t = i / Math.max(1, width - 1);

    let color;
    if (t < 0.5) color = "#54ff9d";
    else if (t < 0.75) color = "#ffd060";
    else color = "#ff6a6a";

    bar += `<span style="color:${color}">#</span>`;
  }

  bar += ".".repeat(empty);
  bar += "]";
  return bar;
}

function buildProgressBar(percent, width = 28) {
  percent = Math.max(0, Math.min(100, Number(percent) || 0));

  const filled = Math.round(percent / 100 * width);
  const empty = width - filled;

  let html = "[";

  for (let i = 0; i < filled; i++) {
    const t = width <= 1 ? 1 : i / (width - 1);

    let color;
    if (t < 0.5) color = "#54ff9d";
    else if (t < 0.8) color = "#ffd060";
    else color = "#ff6a6a";

    const isHead = i === filled - 1 && filled > 0 && percent > 0;
    if (isHead) {
      const pulse = 0.55 + 0.45 * (0.5 + 0.5 * Math.sin(uiFx.progressHeadPhase));
      const glow = 0.18 + pulse * 0.42;

      html += `<span class="progressHead" style="color:${color}; text-shadow:0 0 2px currentColor, 0 0 8px color-mix(in srgb, currentColor ${Math.round(glow * 100)}%, transparent)">#</span>`;
    } else {
      html += `<span style="color:${color}">#</span>`;
    }
  }

  html += ".".repeat(empty);
  html += "]";

  return html;
}

function getHeatColor(t) {
  t = Math.max(0, Math.min(1, t));

  let r, g;

  if (t < 0.5) {
    const k = t / 0.5;
    r = Math.round(255 * k);
    g = 255;
  } else {
    const k = (t - 0.5) / 0.5;
    r = 255;
    g = Math.round(255 * (1 - k));
  }

  return rgbToHex(r, g, 0);
}

function buildAudioBar(percent, width) {
  percent = Math.max(0, Math.min(100, Number(percent) || 0));

  const filled = Math.round(percent / 100 * width);
  const empty = width - filled;

  let html = "[";

  for (let i = 0; i < filled; i++) {
    const t = width <= 1 ? 1 : i / (width - 1);
    const color = getHeatColor(t);
    html += `<span style="color:${color}">#</span>`;
  }

  html += ".".repeat(empty);
  html += "]";

  return html;
}

/* ==========================================================================
   HEADER / SYSTEM RENDER
   ========================================================================== */

function updateHeader(s) {
  const lines = [];

  lines.push(`<span class="host">${esc(s.userHost ?? "")}</span>`);
  lines.push("");

  lines.push(colorLine("OS:      ", s.osDescription));
  lines.push(colorLine("HOST:    ", s.machineName));
  lines.push(colorLine("KERNEL:  ", s.kernelVersion));
  lines.push(colorLine("ARCH:    ", s.architecture));
  lines.push(colorLine("UPTIME:  ", formatUptime(s.uptimeText)));
  lines.push(colorLine("CPU:     ", s.cpuName));
  lines.push(colorLine("GPU:     ", s.gpuName));
  lines.push(colorLine("MEMORY:  ", `${(s.memoryUsedGb ?? 0).toFixed(1)} / ${(s.memoryTotalGb ?? 0).toFixed(1)} GiB`));
  lines.push(colorLine("DISPLAY: ", `${s.screenWidth ?? 0}x${s.screenHeight ?? 0} @ ${s.refreshRate ?? 0} Hz`));
  lines.push(colorLine("IP:      ", s.localIp));
  lines.push(colorLine("PROCESSES: ", s.processCount));
  lines.push(colorLine("TIME:    ", formatClock(s.localTime)));

  el("sysinfo").innerHTML = lines.join("\n");
}

function updateLoad(s) {
  const cpu = Number(s.cpuUsagePercent) || 0;
  const ram = Number(s.memoryUsagePercent) || 0;

  const lines = [
    "----- LOAD ---------------------------------------------------------",
    `CPU  ${buildBar(cpu, 18, "#54ff9d")} ${cpu.toFixed(1).replace(".", ",")}%`,
    `RAM  ${buildBar(ram, 18, "#ff6a6a")} ${ram.toFixed(1).replace(".", ",")}%`
  ];

  el("loadSection").innerHTML = lines.join("\n").trim();
}

function updateStorage(s) {
  const lines = ["----- STORAGE ------------------------------------------------------"];
  const drives = Array.isArray(s.drives) ? s.drives : [];

  for (const d of drives) {
    const usage = Number(d.usagePercent) || 0;
    const used = Number(d.usedGb) || 0;
    const total = Number(d.totalGb) || 0;

    lines.push(
      `${d.name ?? ""}  ${buildStorageBar(usage, 18)} ${Math.round(usage)}%  ${used.toFixed(1)} / ${total.toFixed(1)} GiB`
    );
  }

  el("storageSection").innerHTML = lines.join("\n").trim();
}

async function fetchStats() {
  try {
    const r = await fetch(API + "/stats");
    const s = await r.json();

    helperState.online = true;
    helperState.lastOkAt = performance.now();

    updateHeader(s);
    updateLoad(s);
    updateStorage(s);
    renderStatusLine();
  } catch (e) {
    helperState.online = false;
    renderStatusLine();
    console.error("helper offline", e);
  }
}

/* ==========================================================================
   MEDIA / NOW PLAYING
   ========================================================================== */

function getLiveMediaPositionSeconds() {
  let pos = Number(mediaState.positionSeconds) || 0;

  const state = (mediaState.playbackState || "").toLowerCase();
  if (state === "playing" && mediaState.lastTimelineUpdateMs > 0) {
    const elapsed = (performance.now() - mediaState.lastTimelineUpdateMs) / 1000;
    pos += elapsed;
  }

  const dur = Number(mediaState.durationSeconds) || 0;
  if (dur > 0) pos = Math.min(pos, dur);

  return Math.max(0, pos);
}

function renderNowPlaying() {
  const title = mediaState.title || "WAITING FOR WALLPAPER ENGINE";
  const artist = mediaState.artist || "";
  const album = mediaState.albumTitle || "";
  const state = mediaState.playbackState || "";
  const pos = getLiveMediaPositionSeconds();
  const dur = Number(mediaState.durationSeconds) || 0;

  const timeLine = dur > 0
    ? `${formatMediaTime(pos)} / ${formatMediaTime(dur)}`
    : formatMediaTime(pos);

  const progressPercent = dur > 0
    ? Math.max(0, Math.min(100, (pos / dur) * 100))
    : 0;

  const progressBar = buildProgressBar(progressPercent, 28);

  const lines = [
    "----- NOW PLAYING --------------------------------------------------",
    `TITLE:     ${title.toUpperCase()}`,
    `ARTIST:    ${(artist || "-").toUpperCase()}`,
    `ALBUM:     ${(album || "-").toUpperCase()}`,
    `STATE:     ${(state || "-").toUpperCase()}`,
    `TIME:      ${timeLine}`,
    `PROGRESS:  ${progressBar} ${Math.round(progressPercent)}%`
  ];

  el("nowPlayingSection").innerHTML = lines.join("\n");
}

function mapPlaybackState(value) {
  if (window.wallpaperMediaIntegration) {
    if (value === window.wallpaperMediaIntegration.PLAYBACK_PLAYING) return "PLAYING";
    if (value === window.wallpaperMediaIntegration.PLAYBACK_PAUSED) return "PAUSED";
    if (value === window.wallpaperMediaIntegration.PLAYBACK_STOPPED) return "STOPPED";
  }

  return "";
}

function wallpaperMediaStatusListener(event) {
  mediaState.enabled = !!event.enabled;
  renderNowPlaying();
  renderStatusLine();
}

function wallpaperMediaPropertiesListener(event) {
  mediaState.title = event.title || "";
  mediaState.artist = event.artist || "";
  mediaState.albumTitle = event.albumTitle || "";
  renderNowPlaying();
  renderStatusLine();
}

function wallpaperMediaPlaybackListener(event) {
  mediaState.playbackState = mapPlaybackState(event.state);
  renderNowPlaying();
  renderStatusLine();
}

function wallpaperMediaTimelineListener(event) {
  mediaState.positionSeconds = Number(event.position) || 0;
  mediaState.durationSeconds = Number(event.duration) || 0;
  mediaState.lastTimelineUpdateMs = performance.now();
  renderNowPlaying();
}

function wallpaperMediaThumbnailListener(event) {
  mediaState.thumbnail = event.thumbnail || "";
  mediaState.primaryColor = event.primaryColor || "";
  mediaState.secondaryColor = event.secondaryColor || "";
  mediaState.asciiDirty = true;

  uiFx.asciiRevealActive = true;
  uiFx.asciiRevealUntil = performance.now() + 420;

  if (event.primaryColor) {
    setAccentColor(event.primaryColor);
  }
}

function renderStatusLine() {
  const helperText = helperState.online ? "HELPER ONLINE" : "HELPER OFFLINE";
  const mediaText = mediaState.playbackState
    ? `MEDIA ${mediaState.playbackState}`
    : "MEDIA IDLE";

  const now = new Date();
  const timeText = now.toLocaleTimeString("ru-RU", { hour12: false });

  const helperClass = helperState.online ? "ok" : "bad";
  const mediaClass =
    mediaState.playbackState === "PLAYING"
      ? "ok"
      : mediaState.playbackState === "PAUSED"
        ? "warn"
        : "dim";

  const html = [
    `<span class="statusAccent">FASTFETCH WALLPAPER</span>`,
    `<span class="statusSep">//</span>`,
    `<span class="${helperClass}">${helperText}</span>`,
    `<span class="statusSep">//</span>`,
    `<span class="${mediaClass}">${mediaText}</span>`,
    `<span class="statusSep">//</span>`,
    `<span class="statusClock">${timeText}</span>`
  ].join(" ");

  el("statusLine").innerHTML = html;
}

/* ==========================================================================
   AUDIO
   ========================================================================== */

function avgRange(arr, start, end) {
  let sum = 0;
  let count = 0;

  for (let i = start; i <= end; i++) {
    const v = Math.abs(Number(arr[i]) || 0);
    sum += v;
    count++;
  }

  return count > 0 ? sum / count : 0;
}

function lerp(from, to, t) {
  return from + (to - from) * t;
}

function wallpaperAudioListener(arr) {
  const bassRaw = (avgRange(arr, 0, 7) + avgRange(arr, 64, 71)) * 0.5;
  const midRaw = (avgRange(arr, 10, 24) + avgRange(arr, 74, 88)) * 0.5;
  const trebleRaw = (avgRange(arr, 38, 63) + avgRange(arr, 102, 127)) * 0.5;
  const volumeRaw = (avgRange(arr, 0, 63) + avgRange(arr, 64, 127)) * 0.5;

  let bass = Math.min(100, bassRaw * 360 * 5);
  let mid = Math.min(100, midRaw * 520 * 5);
  let treble = Math.min(100, trebleRaw * 220 * 4);
  let volume = Math.min(100, volumeRaw * 380 * 5);

  bass = Math.pow(bass / 100, 0.78) * 100;
  mid = Math.pow(mid / 100, 0.82) * 100;
  treble = Math.pow(treble / 100, 0.92) * 100;
  volume = Math.pow(volume / 100, 0.85) * 100;

  audioSmooth.bass = lerp(audioSmooth.bass, bass, 0.35);
  audioSmooth.mid = lerp(audioSmooth.mid, mid, 0.30);
  audioSmooth.treble = lerp(audioSmooth.treble, treble, 0.22);
  audioSmooth.volume = lerp(audioSmooth.volume, volume, 0.28);

  const fastSignal = bass / 100;

  const fastAttack = 0.60;
  const fastRelease = 0.22;
  const fastT = fastSignal > reactiveFx.audioFast ? fastAttack : fastRelease;

  reactiveFx.audioFast = lerp(reactiveFx.audioFast, fastSignal, fastT);

  const lines = [
    "----- AUDIO --------------------------------------------------------",
    `BASS   ${buildAudioBar(audioSmooth.bass, 18)} ${Math.round(audioSmooth.bass)}%`,
    `MID    ${buildAudioBar(audioSmooth.mid, 18)} ${Math.round(audioSmooth.mid)}%`,
    `TREBLE ${buildAudioBar(audioSmooth.treble, 18)} ${Math.round(audioSmooth.treble)}%`,
    `VOLUME ${buildAudioBar(audioSmooth.volume, 18)} ${Math.round(audioSmooth.volume)}%`
  ];

  el("audioSection").innerHTML = lines.join("\n").trim();
}

/* ==========================================================================
   ASCII ART
   ========================================================================== */

async function buildAsciiFromThumbnail(src, targetWidth = 64) {
  if (!src) return "";

  const img = new Image();
  img.crossOrigin = "anonymous";

  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
    img.src = src;
  });

  const srcWidth = img.naturalWidth || img.width;
  const srcHeight = img.naturalHeight || img.height;

  if (!srcWidth || !srcHeight) return "";

  const targetHeight = Math.max(
    1,
    Math.round((srcHeight / srcWidth) * targetWidth * 0.52)
  );

  const canvas = el("asciiCanvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });

  canvas.width = targetWidth;
  canvas.height = targetHeight;

  ctx.clearRect(0, 0, targetWidth, targetHeight);
  ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

  const imageData = ctx.getImageData(0, 0, targetWidth, targetHeight);
  const pixels = imageData.data;

  const BAYER_4X4 = [
    [0, 8, 2, 10],
    [12, 4, 14, 6],
    [3, 11, 1, 9],
    [15, 7, 13, 5]
  ];

  let html = "\n";

  for (let y = 0; y < targetHeight; y++) {
    for (let x = 0; x < targetWidth; x++) {
      const index = (y * targetWidth + x) * 4;

      let r = pixels[index + 0];
      let g = pixels[index + 1];
      let b = pixels[index + 2];
      const a = pixels[index + 3];

      if (a < 8) {
        html += " ";
        continue;
      }

      const boost = 1.08;
      r = Math.round(Math.min(255, r * boost));
      g = Math.round(Math.min(255, g * boost));
      b = Math.round(Math.min(255, b * boost));

      let luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      let l = luminance / 255.0;

      l = Math.pow(l, 0.86);
      l = ((l - 0.5) * 1.22) + 0.5;

      const threshold = BAYER_4X4[y % 4][x % 4];
      const dither = ((threshold / 15) - 0.5) * 0.16;
      l += dither;

      l = Math.max(0, Math.min(1, l));

      const rampIndex = Math.max(
        0,
        Math.min(ASCII_RAMP.length - 1, Math.round(l * (ASCII_RAMP.length - 1)))
      );

      const symbol = ASCII_RAMP[rampIndex];
      const minChannel = 34;
      const color = rgbToHex(
        Math.max(r, minChannel),
        Math.max(g, minChannel),
        Math.max(b, minChannel)
      );

      html += `<span style="color:${color}">${escapeHtml(symbol)}</span>`;
    }

    html += "\n";
  }

  return html;
}

async function updateAsciiArt() {
  if (!mediaState.asciiDirty) return;

  mediaState.asciiDirty = false;

  try {
    if (!mediaState.thumbnail) return;

    const html = await buildAsciiFromThumbnail(mediaState.thumbnail, 54);
    mediaState.asciiHtml = html;

    if (html) {
      el("asciiArtSection").innerHTML = html;
    }
  } catch (e) {
    console.error("ascii conversion failed", e);
  }
}

function updateAsciiRevealFx() {
  const ascii = el("asciiArtSection");
  if (!ascii) return;

  const now = performance.now();

  if (uiFx.asciiRevealActive && now < uiFx.asciiRevealUntil) {
    const remaining = uiFx.asciiRevealUntil - now;
    const t = 1 - (remaining / 420);

    const opacity = 0.35 + t * 0.65;
    const translateY = (1 - t) * 6;
    const blur = (1 - t) * 1.2;

    ascii.style.opacity = String(opacity);
    ascii.style.transform = `translateY(${translateY}px)`;
    ascii.style.filter = `blur(${blur}px)`;
  } else {
    uiFx.asciiRevealActive = false;
    ascii.style.opacity = "1";
    ascii.style.transform = "translateY(0px)";
    ascii.style.filter = "none";
  }
}

function updateMusicReactiveFx() {
  const glow = el("crtGlow");
  if (!glow) return;

  const slowBass = Math.max(0, Math.min(1, audioSmooth.bass / 100));
  const fastBass = Math.max(0, Math.min(1, reactiveFx.audioFast));

  const target =
    slowBass * 0.28 +
    fastBass * 0.92;

  const clampedTarget = Math.max(0, Math.min(1, target));

  // Быстрый удар, плавный спад
  const attack = 0.46;
  const release = 0.11;
  const t = clampedTarget > reactiveFx.crtGlow ? attack : release;

  reactiveFx.crtGlow = lerp(reactiveFx.crtGlow, clampedTarget, t);

  const intensity = reactiveFx.crtGlow;

  const opacity = 0.22 + intensity * 0.58;
  const brightness = 1.0 + intensity * 0.58;
  const scale = 1.0 + intensity * 0.030;

  glow.style.opacity = opacity.toFixed(3);
  glow.style.transform = `scale(${scale.toFixed(4)})`;
  glow.style.filter =
    `brightness(${brightness.toFixed(3)}) saturate(${(1 + intensity * 0.38).toFixed(3)})`;

  document.documentElement.style.setProperty("--crt-reactive", intensity.toFixed(3));
}

/* ==========================================================================
   LOGO FX
   ========================================================================== */

function renderLogoMarkup() {
  let html = "";

  for (let y = 0; y < LOGO.length; y++) {
    const row = LOGO[y] || "";

    for (let x = 0; x < row.length; x++) {
      const ch = row[x];

      if (ch === " ") {
        html += " ";
        continue;
      }

      html += `<span class="logoCell" data-x="${x}" data-y="${y}" data-char="${escapeHtml(ch)}">${escapeHtml(ch)}</span>`;
    }

    if (y < LOGO.length - 1) {
      html += "\n";
    }
  }

  return html;
}

function applyLogoWaveFrame() {
  const logo = el("logo");
  if (!logo) return;

  const cells = logo.querySelectorAll(".logoCell");
  if (!cells.length) return;

  for (const cell of cells) {
    const key = `${cell.dataset.x}:${cell.dataset.y}`;
    const isWaveOn = uiFx.logoWaveCells.has(key);

    cell.classList.toggle("waveOn", isWaveOn);

    if (isWaveOn) {
      cell.textContent = "#";
    } else {
      cell.textContent = cell.dataset.char || "1";
    }
  }
}

function startLogoWave() {
  const diagonals = [];
  const maxY = LOGO.length;
  const maxX = Math.max(...LOGO.map(x => x.length));

  for (let d = 0; d < maxX + maxY - 1; d++) {
    const diag = [];

    for (let y = 0; y < maxY; y++) {
      const row = LOGO[y] || "";
      const x = d - y;

      if (x >= 0 && x < row.length && row[x] !== " ") {
        diag.push(`${x}:${y}`);
      }
    }

    diagonals.push(diag);
  }

  const stepMs = 52;
  uiFx.logoWaveUntil = performance.now() + diagonals.length * stepMs + 220;

  diagonals.forEach((diag, index) => {
    setTimeout(() => {
      uiFx.logoWaveCells = new Set(diag);
      applyLogoWaveFrame();
    }, index * stepMs);
  });

  setTimeout(() => {
    uiFx.logoWaveCells = new Set();
    applyLogoWaveFrame();
  }, diagonals.length * stepMs + 180);
}

function startLogoWaveLoop() {
  const tick = () => {
    startLogoWave();
    const next = 9000 + Math.random() * 9000;
    setTimeout(tick, next);
  };

  setTimeout(tick, 4000);
}

function runLogoShimmer() {
  const shimmer = el("logoShimmer");
  if (!shimmer) return;

  shimmer.animate(
    [
      { transform: "translateY(0px)", opacity: 0 },
      { transform: "translateY(18px)", opacity: 0.22, offset: 0.5 },
      { transform: "translateY(36px)", opacity: 0 }
    ],
    {
      duration: 900,
      easing: "ease-in-out"
    }
  );
}

function startLogoShimmerLoop() {
  const tick = () => {
    runLogoShimmer();
    const next = 5000 + Math.random() * 4000;
    setTimeout(tick, next);
  };

  setTimeout(tick, 2500);
}

/* ==========================================================================
   SIGNAL FLICKER FX
   ========================================================================== */

function setSignalFlickerActive(active) {
  const logo = el("logo");
  const ascii = el("asciiArtSection");

  if (logo) logo.classList.toggle("signalFlicker", active);
  if (ascii) ascii.classList.toggle("signalFlicker", active);
}

function triggerSignalFlicker(duration = 120) {
  uiFx.signalFlickerActive = true;
  uiFx.signalFlickerUntil = performance.now() + duration;
  setSignalFlickerActive(true);
}

function startSignalFlickerLoop() {
  const tick = () => {
    const duration = 90 + Math.random() * 70;
    triggerSignalFlicker(duration);

    const next = 12000 + Math.random() * 18000;
    setTimeout(tick, next);
  };

  setTimeout(tick, 6000);
}

/* ==========================================================================
   STATIC RENDER
   ========================================================================== */

function renderStatic() {
  el("logo").innerHTML = renderLogoMarkup();
  renderNowPlaying();

  el("audioSection").innerHTML = [
    "----- AUDIO --------------------------------------------------------",
    `BASS   ${buildAudioBar(0, 18)} 0%`,
    `MID    ${buildAudioBar(0, 18)} 0%`,
    `TREBLE ${buildAudioBar(0, 18)} 0%`,
    `VOLUME ${buildAudioBar(0, 18)} 0%`
  ].join("\n");

  el("asciiArtSection").textContent = "";
  renderStatusLine();
}

/* ==========================================================================
   MAIN UI ANIMATION LOOP
   ========================================================================== */

function animateUiFx() {
  uiFx.progressHeadPhase += 0.18;

  if (uiFx.signalFlickerActive && performance.now() >= uiFx.signalFlickerUntil) {
    uiFx.signalFlickerActive = false;
    setSignalFlickerActive(false);
  }

  renderNowPlaying();
  renderStatusLine();
  updateAsciiRevealFx();
  updateMusicReactiveFx();

  requestAnimationFrame(animateUiFx);
}

/* ==========================================================================
   BOOTSTRAP
   ========================================================================== */

window.addEventListener("resize", scaleHud);

scaleHud();
renderStatic();
fetchStats();

setInterval(fetchStats, 500);
setInterval(updateAsciiArt, 500);

startLogoShimmerLoop();
startLogoWaveLoop();
startSignalFlickerLoop();
requestAnimationFrame(animateUiFx);

/* ==========================================================================
   WALLPAPER ENGINE HOOKS
   ========================================================================== */

if (window.wallpaperRegisterMediaStatusListener) {
  window.wallpaperRegisterMediaStatusListener(wallpaperMediaStatusListener);
}

if (window.wallpaperRegisterMediaPropertiesListener) {
  window.wallpaperRegisterMediaPropertiesListener(wallpaperMediaPropertiesListener);
}

if (window.wallpaperRegisterMediaPlaybackListener) {
  window.wallpaperRegisterMediaPlaybackListener(wallpaperMediaPlaybackListener);
}

if (window.wallpaperRegisterMediaTimelineListener) {
  window.wallpaperRegisterMediaTimelineListener(wallpaperMediaTimelineListener);
}

if (window.wallpaperRegisterMediaThumbnailListener) {
  window.wallpaperRegisterMediaThumbnailListener(wallpaperMediaThumbnailListener);
}

if (window.wallpaperRegisterAudioListener) {
  window.wallpaperRegisterAudioListener(wallpaperAudioListener);
}