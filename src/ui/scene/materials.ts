import * as THREE from 'three';

// Cozy low-poly palette
export const C = {
  floorA: '#c8956a',
  floorB: '#b98258',
  base: '#5b4636',
  wallBack: '#efe3d3',
  wallLeft: '#e6d6c3',
  trim: '#fbf7f1',
  sofa: '#5f7f8f',
  sofaDark: '#4d6a78',
  cushion: '#6f93a3',
  pillowA: '#e9b872',
  pillowB: '#d97a5c',
  rug: '#d9c7a7',
  rugBorder: '#a8644a',
  wood: '#8a5a3b',
  woodLight: '#b07a4f',
  dark: '#2b2a30',
  metal: '#3a3a40',
  plant: '#4f8f5b',
  plantDark: '#3c7348',
  pot: '#d8d1c7',
  shade: '#f3e4c8',
};

let plankTex: THREE.CanvasTexture | null = null;

/** Procedural wood-plank texture (no image assets needed). */
export function plankTexture(): THREE.CanvasTexture {
  if (plankTex) return plankTex;
  const w = 512;
  const h = 512;
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const g = cv.getContext('2d')!;
  const rows = 8;
  const rh = h / rows;
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let r = 0; r < rows; r++) {
    let x = -rnd() * 200;
    while (x < w) {
      const len = 160 + rnd() * 180;
      const shade = 0.9 + rnd() * 0.18;
      const base = new THREE.Color(r % 2 ? C.floorA : C.floorB).multiplyScalar(shade);
      g.fillStyle = `#${base.getHexString()}`;
      g.fillRect(x, r * rh, len, rh);
      // grain lines
      g.strokeStyle = 'rgba(80,45,20,0.10)';
      g.lineWidth = 1;
      for (let i = 0; i < 3; i++) {
        const y = r * rh + rh * (0.25 + rnd() * 0.5);
        g.beginPath();
        g.moveTo(x + 4, y);
        g.bezierCurveTo(x + len * 0.3, y + 3, x + len * 0.6, y - 3, x + len - 4, y);
        g.stroke();
      }
      g.fillStyle = 'rgba(60,35,15,0.35)';
      g.fillRect(x + len - 2, r * rh, 2, rh);
      x += len;
    }
    g.fillStyle = 'rgba(60,35,15,0.4)';
    g.fillRect(0, r * rh, w, 2);
  }
  plankTex = new THREE.CanvasTexture(cv);
  plankTex.wrapS = plankTex.wrapT = THREE.RepeatWrapping;
  plankTex.repeat.set(2, 2);
  plankTex.colorSpace = THREE.SRGBColorSpace;
  plankTex.anisotropy = 8;
  return plankTex;
}

let artTex: THREE.CanvasTexture | null = null;

/** Abstract sunset painting for the wall art. */
export function artTexture(): THREE.CanvasTexture {
  if (artTex) return artTex;
  const cv = document.createElement('canvas');
  cv.width = 256;
  cv.height = 192;
  const g = cv.getContext('2d')!;
  const grad = g.createLinearGradient(0, 0, 0, 192);
  grad.addColorStop(0, '#f6c28b');
  grad.addColorStop(0.55, '#e9876b');
  grad.addColorStop(1, '#6b4c7a');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 192);
  g.fillStyle = '#ffe3a8';
  g.beginPath();
  g.arc(160, 98, 30, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#4a3a5e';
  g.beginPath();
  g.moveTo(0, 150);
  g.lineTo(70, 105);
  g.lineTo(130, 140);
  g.lineTo(200, 95);
  g.lineTo(256, 130);
  g.lineTo(256, 192);
  g.lineTo(0, 192);
  g.fill();
  g.fillStyle = '#2f2742';
  g.beginPath();
  g.moveTo(0, 175);
  g.lineTo(90, 140);
  g.lineTo(170, 170);
  g.lineTo(256, 150);
  g.lineTo(256, 192);
  g.lineTo(0, 192);
  g.fill();
  artTex = new THREE.CanvasTexture(cv);
  artTex.colorSpace = THREE.SRGBColorSpace;
  return artTex;
}

export function skyColor(daylight: number, minuteOfDay: number): THREE.Color {
  const night = new THREE.Color('#0e1433');
  const dusk = new THREE.Color('#ff9466');
  const day = new THREE.Color('#9fd4ff');
  const h = minuteOfDay / 60;
  // golden-hour tint near sunrise/sunset
  const golden = Math.max(0, 1 - Math.min(Math.abs(h - 18.9), Math.abs(h - 6.6)) / 1.1);
  const c = night.clone().lerp(day, daylight);
  return c.lerp(dusk, golden * 0.75);
}
