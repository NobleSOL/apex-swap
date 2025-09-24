// theme.js
// Extract dominant brand colors from an image and apply them as CSS variables.

function quantize(value, step = 16) {
  return Math.min(255, Math.max(0, Math.round(value / step) * step));
}

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;
  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      default: h = (r - g) / d + 4;
    }
    h /= 6;
  }
  return { h, s, l };
}

function hslToRgb(h, s, l) {
  let r, g, b;
  if (s === 0) {
    r = g = b = l; // achromatic
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
}

function clamp01(v) { return Math.max(0, Math.min(1, v)); }

function toHex({ r, g, b }) {
  const c = (n) => n.toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

export async function applyBrandTheme(imgSrc) {
  const img = new Image();
  img.crossOrigin = "anonymous";
  const loaded = new Promise((res, rej) => {
    img.onload = () => res();
    img.onerror = rej;
  });
  img.src = imgSrc;
  await loaded;

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const size = 96;
  canvas.width = size;
  canvas.height = size;
  ctx.drawImage(img, 0, 0, size, size);

  const data = ctx.getImageData(0, 0, size, size).data;
  const buckets = new Map();
  for (let i = 0; i < data.length; i += 16) { // sample every 4th pixel (RGBA*4)
    const r = quantize(data[i + 0]);
    const g = quantize(data[i + 1]);
    const b = quantize(data[i + 2]);
    const a = data[i + 3];
    if (a < 128) continue; // skip transparent
    const key = `${r},${g},${b}`;
    buckets.set(key, (buckets.get(key) || 0) + 1);
  }

  let primary = { r: 0, g: 255, b: 102 }; // fallback to existing accent
  let maxCount = -1;
  for (const [key, count] of buckets.entries()) {
    if (count > maxCount) {
      maxCount = count;
      const [r, g, b] = key.split(",").map((n) => parseInt(n, 10));
      primary = { r, g, b };
    }
  }

  const pHsl = rgbToHsl(primary.r, primary.g, primary.b);

  let secondary, accent, bg;
  if (pHsl.s < 0.12) {
    // Monochrome (e.g., black/white) logo detected: enforce black/white design system
    primary = { r: 255, g: 255, b: 255 };
    secondary = { r: 209, g: 213, b: 219 };
    accent = { r: 156, g: 163, b: 175 };
    bg = { r: 10, g: 10, b: 10 };
  } else {
    secondary = hslToRgb((pHsl.h + 0.08) % 1, clamp01(pHsl.s * 0.9), clamp01(pHsl.l * 0.7));
    accent = hslToRgb((pHsl.h + 0.5) % 1, clamp01(Math.max(0.5, pHsl.s)), clamp01(0.55));
    bg = hslToRgb(pHsl.h, clamp01(pHsl.s * 0.25), 0.08);
  }

  const root = document.documentElement.style;
  root.setProperty("--brand-primary", toHex(primary));
  root.setProperty("--brand-secondary", toHex(secondary));
  root.setProperty("--brand-accent", toHex(accent));
  root.setProperty("--brand-bg", toHex(bg));
}
