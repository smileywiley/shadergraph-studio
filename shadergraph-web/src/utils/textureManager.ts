import * as THREE from 'three';

export interface TextureEntry {
  key: string;
  label: string;
  dataUrl: string;
  texture: THREE.Texture;
}

const textureCache = new Map<string, TextureEntry>();
const listeners = new Set<() => void>();

export function subscribeTextures(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function notifyListeners() {
  listeners.forEach((cb) => cb());
}

function createCanvasTexture(
  key: string,
  label: string,
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void
): TextureEntry {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  draw(ctx, 256, 256);

  const dataUrl = canvas.toDataURL('image/png');
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.needsUpdate = true;

  return { key, label, dataUrl, texture };
}

export function initBuiltinTextures(): void {
  if (textureCache.size > 0) return;

  // 1. UV Checker Grid
  textureCache.set(
    'uvgrid',
    createCanvasTexture('uvgrid', 'UV Checker Grid', (ctx, w, h) => {
      const cells = 8;
      const cw = w / cells;
      const ch = h / cells;
      for (let y = 0; y < cells; y++) {
        for (let x = 0; x < cells; x++) {
          const isEven = (x + y) % 2 === 0;
          const r = Math.round((x / (cells - 1)) * 200 + 35);
          const g = Math.round((y / (cells - 1)) * 200 + 35);
          const b = isEven ? 225 : 95;
          ctx.fillStyle = isEven
            ? `rgb(${r}, ${g}, ${b})`
            : `rgb(${Math.round(r * 0.55)}, ${Math.round(g * 0.55)}, ${Math.round(b * 0.55)})`;
          ctx.fillRect(x * cw, y * ch, cw, ch);
          ctx.strokeStyle = 'rgba(255,255,255,0.22)';
          ctx.strokeRect(x * cw + 0.5, y * ch + 0.5, cw - 1, ch - 1);
        }
      }
    })
  );

  // 2. Organic Perlin Clouds
  textureCache.set(
    'clouds',
    createCanvasTexture('clouds', 'Organic Perlin Clouds', (ctx, w, h) => {
      const img = ctx.createImageData(w, h);
      const data = img.data;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const nx = (x / w) * Math.PI * 2;
          const ny = (y / h) * Math.PI * 2;
          const v1 = Math.sin(nx * 2 + Math.cos(ny * 2)) * 0.5 + 0.5;
          const v2 = Math.sin(nx * 4 - Math.sin(ny * 5) * 1.5) * 0.25 + 0.25;
          const v3 = Math.cos((nx + ny) * 8) * 0.125 + 0.125;
          const val = Math.min(255, Math.max(0, Math.round((v1 + v2 + v3) * 230)));
          const idx = (y * w + x) * 4;
          data[idx] = val;
          data[idx + 1] = val;
          data[idx + 2] = Math.min(255, val + 18);
          data[idx + 3] = 255;
        }
      }
      ctx.putImageData(img, 0, 0);
    })
  );

  // 3. Cyber Circuit Hex
  textureCache.set(
    'hex',
    createCanvasTexture('hex', 'Cyber Circuit Hex', (ctx, w, h) => {
      ctx.fillStyle = '#09131c';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#00e5ff';
      ctx.lineWidth = 2;
      const step = 32;
      for (let y = 0; y <= h; y += step) {
        for (let x = 0; x <= w; x += step) {
          const offset = (y / step) % 2 === 0 ? 0 : step / 2;
          const cx = x + offset;
          const cy = y;
          ctx.beginPath();
          for (let i = 0; i < 6; i++) {
            const ang = (Math.PI / 3) * i;
            const px = cx + Math.cos(ang) * 14;
            const py = cy + Math.sin(ang) * 14;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.closePath();
          ctx.stroke();
        }
      }
    })
  );

  // 4. Weathered Stone
  textureCache.set(
    'stone',
    createCanvasTexture('stone', 'Weathered Stone', (ctx, w, h) => {
      const img = ctx.createImageData(w, h);
      const data = img.data;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const hash = Math.abs(Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1;
          const wave =
            Math.sin((x / w) * Math.PI * 6) * Math.cos((y / h) * Math.PI * 6) * 35;
          const base = Math.max(40, Math.min(220, Math.round(125 + wave + (hash - 0.5) * 45)));
          const idx = (y * w + x) * 4;
          data[idx] = base;
          data[idx + 1] = Math.round(base * 0.96);
          data[idx + 2] = Math.round(base * 0.91);
          data[idx + 3] = 255;
        }
      }
      ctx.putImageData(img, 0, 0);
    })
  );

  // 5. Radial Gradient Mask
  textureCache.set(
    'radial',
    createCanvasTexture('radial', 'Radial Gradient Mask', (ctx, w, h) => {
      const grad = ctx.createRadialGradient(w / 2, h / 2, 4, w / 2, h / 2, w / 2);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.55, '#7dd3fc');
      grad.addColorStop(1, '#000000');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    })
  );

  // 6. Tangent Normal Map
  textureCache.set(
    'normal',
    createCanvasTexture('normal', 'Tangent Normal Map', (ctx, w, h) => {
      const img = ctx.createImageData(w, h);
      const data = img.data;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const u = (x / w) * Math.PI * 8;
          const v = (y / h) * Math.PI * 8;
          const nx = Math.cos(u) * 0.35;
          const ny = Math.cos(v) * 0.35;
          const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
          const idx = (y * w + x) * 4;
          data[idx] = Math.round((nx * 0.5 + 0.5) * 255);
          data[idx + 1] = Math.round((ny * 0.5 + 0.5) * 255);
          data[idx + 2] = Math.round((nz * 0.5 + 0.5) * 255);
          data[idx + 3] = 255;
        }
      }
      ctx.putImageData(img, 0, 0);
    })
  );
}

export function getTextureEntry(key: string): TextureEntry {
  initBuiltinTextures();
  return textureCache.get(key) || textureCache.get('uvgrid')!;
}

export function getAllTextureEntries(): TextureEntry[] {
  initBuiltinTextures();
  return Array.from(textureCache.values());
}

export function registerUploadedTexture(file: File): Promise<TextureEntry> {
  initBuiltinTextures();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result);
      const img = new Image();
      img.onload = () => {
        const key = `custom_${file.name.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 20)}_${Date.now()
          .toString()
          .slice(-4)}`;
        const tex = new THREE.Texture(img);
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        tex.needsUpdate = true;
        const entry: TextureEntry = {
          key,
          label: `Uploaded: ${file.name}`,
          dataUrl,
          texture: tex,
        };
        textureCache.set(key, entry);
        notifyListeners();
        resolve(entry);
      };
      img.onerror = reject;
      img.src = dataUrl;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
