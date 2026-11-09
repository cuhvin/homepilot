// Pixel-art street view outside the house, synced to the simulated clock and device state.
// Everything is drawn procedurally with fillRect at a tiny resolution and scaled up crisply.
//   - sky, sun/moon, stars and streetlights follow the SIM clock
//   - living-room window shows lights / TV flicker / blinds
//   - front door opens when unlocked, porch light shows the lock state
//   - the dog walker (and dog) walk up while the door is unlocked
//   - a delivery van pulls up while the garage is open
//   - chimney smoke when heating, music notes when the speaker plays, LEDs for alarm + camera
import { useEffect, useRef } from 'react';
import { useStore } from '../store';
import { daylight, minuteOfDay, type HomeState } from '../home/state';

const H = 72;
const GROUND = 56; // top of the sidewalk
const FPS = 14;


function rng(seed: number) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

function mix(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const r = Math.round(((pa >> 16) & 255) * (1 - t) + ((pb >> 16) & 255) * t);
  const g = Math.round(((pa >> 8) & 255) * (1 - t) + ((pb >> 8) & 255) * t);
  const bl = Math.round((pa & 255) * (1 - t) + (pb & 255) * t);
  return `#${((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1)}`;
}

/** Darken a color toward night blue. */
function shade(c: string, light: number) {
  return mix('#141a3a', c, 0.35 + 0.65 * light);
}

interface Actor { x: number; visible: boolean; frame: number }
type WalkerPhase = 'idle' | 'arriving' | 'pickup' | 'walkingAway' | 'onWalk' | 'returning' | 'dropoff' | 'leaving';
interface Car { x: number; dir: 1 | -1; color: string; speed: number }

export function PixelStreet() {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = canvas.current!;
    const ctx = cv.getContext('2d')!;
    let W = 320;
    let scale = 3;
    const resize = () => {
      const w = wrap.current!.clientWidth;
      scale = w < 560 ? 2 : 3;
      W = Math.ceil(w / scale);
      cv.width = W;
      cv.height = H;
      cv.style.height = `${H * scale}px`;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap.current!);

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const r = rng(42);
    const stars = Array.from({ length: 60 }, () => ({ x: r(), y: r() * 34, p: r() * 6 }));
    const clouds = Array.from({ length: 4 }, (_, i) => ({ x: r() * 400, y: 6 + i * 7 + r() * 4, w: 14 + r() * 16, s: 0.05 + r() * 0.08 }));

    const walker = { x: 9999, frame: 0, phase: 'idle' as WalkerPhase, timer: 0, withDog: false };
    const van: Actor = { x: 9999, visible: false, frame: 0 };
    const cars: Car[] = [];
    const smoke: { x: number; y: number; life: number }[] = [];
    const notes: { x: number; y: number; life: number; c: string }[] = [];
    let nextCar = 120;
    let tick = 0;
    let raf = 0;
    let last = 0;
    let wasUnlocked = false;
    let k = 1; // frame-time factor so movement speed doesn't depend on frame rate

    const px = (x: number, y: number, w: number, h: number, c: string) => {
      ctx.fillStyle = c;
      ctx.fillRect(Math.round(x), Math.round(y), w, h);
    };

    const draw = (home: HomeState, now: number) => {
      const d = daylight(now);
      const mod = minuteOfDay(now);
      const hour = mod / 60;
      const golden = Math.max(0, 1 - Math.min(Math.abs(hour - 18.9), Math.abs(hour - 6.6)) / 1.2);
      const night = d < 0.3;

      // ---- sky: quantized bands for a retro look ----
      const top = mix('#0b1030', '#5aa9ef', d);
      const bottom = mix(mix('#24204f', '#bfe3ff', d), '#ff9a6b', golden * 0.8);
      const bands = 7;
      for (let i = 0; i < bands; i++) {
        px(0, (i * 46) / bands, W, Math.ceil(46 / bands) + 1, mix(top, bottom, i / (bands - 1)));
      }
      // stars
      if (d < 0.4) {
        for (const s of stars) {
          const tw = Math.sin(tick * 0.15 + s.p) > 0.2 ? 1 : 0.5;
          ctx.globalAlpha = (1 - d / 0.4) * tw;
          px(s.x * W, s.y, 1, 1, '#fff6d6');
        }
        ctx.globalAlpha = 1;
      }
      // sun / moon on an arc
      const dayT = (hour - 6.2) / (19.4 - 6.2);
      if (dayT > -0.05 && dayT < 1.05) {
        const sx = W * 0.08 + dayT * W * 0.84;
        const sy = 36 - Math.sin(Math.PI * Math.min(1, Math.max(0, dayT))) * 28;
        px(sx - 3, sy - 2, 6, 4, golden > 0.3 ? '#ffb070' : '#ffe08a');
        px(sx - 2, sy - 3, 4, 6, golden > 0.3 ? '#ffb070' : '#ffe08a');
      } else {
        const nT = ((hour + 24 - 19.4) % 24) / (24 - 19.4 + 6.2);
        const mx = W * 0.1 + nT * W * 0.8;
        const my = 30 - Math.sin(Math.PI * nT) * 22;
        px(mx - 2, my - 3, 5, 6, '#e8ecff');
        px(mx - 3, my - 2, 7, 4, '#e8ecff');
        px(mx, my - 2, 3, 3, mix('#0b1030', '#e8ecff', 0.35));
      }
      // clouds
      for (const c of clouds) {
        c.x = (c.x + c.s) % (W + 60);
        const cc = mix(mix('#2a2d55', '#ffffff', d), '#ffc2a0', golden * 0.5);
        px(c.x - 30, c.y, c.w, 3, cc);
        px(c.x - 30 + 3, c.y - 2, c.w - 8, 2, cc);
      }

      // ---- far hills + neighbor silhouettes ----
      const hill = shade('#6b8f7a', d);
      for (let x = 0; x < W; x++) {
        const hgt = 6 + Math.round(3 * Math.sin(x * 0.05) + 2 * Math.sin(x * 0.13 + 1));
        px(x, 46 - hgt, 1, hgt + 2, hill);
      }
      const far = shade('#7b6f9a', d * 0.8);
      for (let x = 170; x < W; x += 58) {
        px(x, 34, 22, 14, far);
        for (let i = 0; i < 6; i++) px(x + 11 - i * 2, 28 + i, 4 + i * 4 - (i ? 2 : 0), 1, far);
        const lit = night && (x / 58) % 2 < 1;
        px(x + 5, 38, 4, 4, lit ? '#ffd38a' : shade('#9fb4d8', d));
        px(x + 13, 38, 4, 4, night ? shade('#33395e', 0) : shade('#9fb4d8', d));
      }

      // ---- lawn, sidewalk, road ----
      px(0, 48, W, GROUND - 48, shade('#5fae5a', d));
      for (let x = 0; x < W; x += 3) px(x, 48 + ((x * 7) % 3), 1, 1, shade('#4f9a4c', d));
      px(0, GROUND, W, 4, shade('#c9c2b8', d));
      for (let x = 0; x < W; x += 12) px(x, GROUND, 1, 4, shade('#aaa397', d));
      px(0, GROUND + 4, W, H - GROUND - 4, shade('#3d3f4f', d));
      for (let x = (tick * 0) % 16; x < W; x += 16) px(x, 66, 8, 1, shade('#e9d27a', d));

      // ---- streetlights ----
      for (let x = 150; x < W; x += 100) {
        px(x, 30, 2, GROUND - 30, shade('#4a4d5e', d));
        px(x - 2, 29, 7, 2, shade('#4a4d5e', d));
        px(x + 3, 31, 3, 2, night ? '#ffe7a0' : shade('#b8b8c0', d));
        if (night) {
          ctx.globalAlpha = 0.16;
          ctx.fillStyle = '#ffe7a0';
          ctx.beginPath();
          ctx.moveTo(x + 4, 33);
          ctx.lineTo(x - 8, GROUND + 4);
          ctx.lineTo(x + 16, GROUND + 4);
          ctx.fill();
          ctx.globalAlpha = 1;
        }
      }

      // ---- trees ----
      const tree = (tx: number, s: number) => {
        px(tx + 4 * s, 40, 2 * s, GROUND - 40, shade('#7a5233', d));
        const leaf = shade('#3f8a4f', d);
        const leaf2 = shade('#57a35f', d);
        px(tx, 30, 10 * s, 8, leaf);
        px(tx + 1, 26, 8 * s, 6, leaf2);
        px(tx + 3, 23, 4 * s, 4, leaf);
      };
      tree(6, 1);
      tree(132, 1);

      // ---- the house ----
      const X = 28;
      const wall = shade('#efe3d3', d);
      const trim = shade('#fbf7f1', d);
      const roof = shade('#b0573f', d);
      // chimney
      px(X + 50, 14, 6, 12, shade('#9c5a44', d));
      // roof (triangle rows)
      for (let i = 0; i < 16; i++) px(X - 3 + i * 2, 29 - i, 70 - i * 4, 1, i % 4 === 0 ? shade('#9a4835', d) : roof);
      px(X, 29, 64, GROUND - 29, wall);
      px(X, GROUND - 2, 64, 2, shade('#d6c6b2', d));
      // garage
      px(X + 64, 34, 30, GROUND - 34, shade('#e6d6c3', d));
      px(X + 62, 32, 34, 3, roof);
      const g = home['garage.door'];
      const gOpen = g?.kind === 'garage' && g.open;
      px(X + 68, 38, 22, GROUND - 38, shade('#2a2433', d));
      if (!gOpen) {
        for (let y = 38; y < GROUND; y += 3) px(X + 68, y, 22, 2, shade('#d8cfc2', d));
      } else {
        for (let y = 38; y < 42; y += 3) px(X + 68, y, 22, 2, shade('#d8cfc2', d));
        px(X + 74, 48, 6, 6, shade('#c49a6c', d)); // box inside
      }

      // living-room window
      const wx = X + 6;
      const wy = 35;
      const lights = ['living.ceiling', 'living.lamp', 'living.strip'].map((id) => home[id]).filter((s) => s?.kind === 'light' && s.on);
      const tv = home['living.tv'];
      const blinds = home['living.blinds'];
      let glass = night ? '#1d2448' : shade('#a9d2f0', d);
      if (lights.length) glass = mix(glass, '#ffd99a', 0.55 + lights.length * 0.12);
      px(wx - 1, wy - 1, 22, 14, trim);
      px(wx, wy, 20, 12, glass);
      if (tv?.kind === 'tv' && tv.on && Math.sin(tick * 0.9) > -0.4) px(wx + 2, wy + 6, 8, 5, mix(glass, '#7cc0ff', 0.5));
      const strip = home['living.strip'];
      if (strip?.kind === 'light' && strip.on) px(wx + 1, wy + 10, 18, 1, strip.color);
      if (blinds?.kind === 'blinds' && blinds.position < 100) {
        const hgt = Math.round(12 * (1 - blinds.position / 100));
        for (let y = 0; y < hgt; y += 2) px(wx, wy + y, 20, 1, shade('#e8d9bf', Math.max(d, lights.length ? 0.7 : 0)));
      }
      px(wx + 9, wy, 2, 12, trim);
      if (lights.length && night) {
        ctx.globalAlpha = 0.18;
        px(wx - 2, GROUND - 1, 24, 2, '#ffd99a');
        ctx.globalAlpha = 1;
      }

      // front door
      const door = home['entry.frontdoor'];
      const unlocked = door?.kind === 'lock' && !door.locked;
      const dx = X + 36;
      px(dx - 1, 39, 12, GROUND - 39, trim);
      if (unlocked) {
        px(dx, 40, 10, GROUND - 40, mix('#2a1d14', '#ffcf8a', lights.length ? 0.35 : 0.05));
        px(dx, 40, 3, GROUND - 40, shade('#3f6e8c', d));
      } else {
        px(dx, 40, 10, GROUND - 40, shade('#3f6e8c', d));
        px(dx + 2, 42, 6, 5, shade('#365f79', d));
        px(dx + 8, 48, 1, 2, '#d8b25a');
      }
      // porch light shows lock state
      const blink = Math.sin(tick * 0.6) > 0;
      px(dx + 12, 42, 2, 3, unlocked ? (blink ? '#ffb547' : '#7a5a2a') : '#59e07a');
      if (night) {
        ctx.globalAlpha = 0.2;
        px(dx + 9, 39, 8, 9, unlocked ? '#ffb547' : '#59e07a');
        ctx.globalAlpha = 1;
      }
      // path
      px(dx + 1, GROUND - 1, 8, 1, shade('#d8cfc2', d));

      // alarm + camera LEDs
      const alarm = home['home.alarm'];
      const armed = alarm?.kind === 'alarm' && alarm.mode !== 'off';
      px(X + 30, 33, 3, 3, shade('#f4f2ee', d));
      px(X + 31, 34, 1, 1, armed ? (Math.sin(tick * 0.4) > 0 ? '#ff4d4d' : '#7a2020') : '#7cb7ff');
      const cam = home['home.cameras'];
      const camOn = cam?.kind === 'camera' && cam.on;
      px(X + 58, 30, 4, 2, shade('#e9e9ee', d));
      px(X + 61, camOn ? 30 : 31, 2, 2, shade('#2b2b30', d));
      if (camOn && Math.sin(tick * 0.5) > -0.3) px(X + 58, 30, 1, 1, '#ff3b3b');

      // chimney smoke when heating
      const th = home['home.thermostat'];
      const heating = th?.kind === 'thermostat' && (th.mode === 'heat' || th.mode === 'auto' || th.mode === 'eco') && th.current < th.target - 0.4;
      if (heating && tick % 6 === 0) smoke.push({ x: X + 52, y: 13, life: 0 });
      for (const s of smoke) {
        s.life++;
        s.y -= 0.35;
        s.x += 0.15;
        const sz = 2 + Math.floor(s.life / 12);
        ctx.globalAlpha = Math.max(0, 0.6 - s.life / 60);
        px(s.x, s.y, sz, sz, shade('#d9d4e4', Math.max(d, 0.5)));
      }
      ctx.globalAlpha = 1;
      while (smoke.length && smoke[0].life > 36) smoke.shift();

      // music notes from the window
      const sp = home['living.speaker'];
      if (sp?.kind === 'speaker' && sp.on && tick % 10 === 0) {
        notes.push({ x: wx + 16, y: wy, life: 0, c: ['#7ce9ff', '#ff8ad8', '#ffe066'][Math.floor(tick / 10) % 3] });
      }
      for (const n of notes) {
        n.life++;
        n.y -= 0.4;
        n.x += Math.sin(n.life * 0.3) * 0.4;
        ctx.globalAlpha = Math.max(0, 1 - n.life / 30);
        px(n.x, n.y, 1, 3, n.c);
        px(n.x - 2, n.y + 2, 2, 2, n.c);
      }
      ctx.globalAlpha = 1;
      while (notes.length && notes[0].life > 30) notes.shift();

      // ---- delivery van: arrives while the garage is open ----
      const vanStop = X + 70;
      if (gOpen) {
        if (!van.visible) { van.visible = true; van.x = W + 10; }
        van.x = Math.max(vanStop, van.x - 1.6 * k);
      } else if (van.visible) {
        van.x -= 1.8 * k;
        if (van.x < -40) van.visible = false;
      }
      if (van.visible) drawVan(px, van.x, d, tick);

      // ---- passing cars ----
      if (!reduce && --nextCar <= 0) {
        const dir = (Math.random() < 0.5 ? 1 : -1) as 1 | -1;
        cars.push({ x: dir === 1 ? -30 : W + 10, dir, color: ['#e06b5a', '#5a8fe0', '#f2c14e', '#8fd18a', '#c48ae0'][Math.floor(Math.random() * 5)], speed: 1.2 + Math.random() });
        nextCar = 140 + Math.random() * 220;
      }
      for (const c of cars) {
        c.x += c.dir * c.speed * k;
        drawCar(px, c, d, night);
      }
      for (let i = cars.length - 1; i >= 0; i--) if (cars[i].x < -40 || cars[i].x > W + 40) cars.splice(i, 1);

      // ---- dog walker: one full visit per unlock ----
      // arrive -> take the dog -> walk down the street -> come back -> dog goes home -> leave
      const stop = dx + 13;
      const corner = stop + 120; // "around the corner"
      const step = 2.1 * k; // ~30 px/s
      if (unlocked && !wasUnlocked && walker.phase === 'idle') {
        walker.phase = useStore.getState().dogOut ? 'returning' : 'arriving';
        walker.withDog = useStore.getState().dogOut;
        walker.x = corner;
      }
      wasUnlocked = unlocked;
      let facingRight = false;
      let moving = true;
      switch (walker.phase) {
        case 'arriving':
        case 'returning':
          walker.x = Math.max(stop, walker.x - step);
          if (walker.x <= stop) {
            walker.phase = walker.phase === 'arriving' ? 'pickup' : 'dropoff';
            walker.timer = 700;
          }
          break;
        case 'pickup':
        case 'dropoff':
          moving = false;
          walker.timer -= 1000 / FPS * k;
          if (walker.timer <= 0) {
            const picking = walker.phase === 'pickup';
            walker.withDog = picking;
            useStore.getState().setDogOut(picking);
            walker.phase = picking ? 'walkingAway' : 'leaving';
          }
          break;
        case 'walkingAway':
        case 'leaving':
          facingRight = true;
          walker.x += step;
          if (walker.x >= corner) {
            if (walker.phase === 'walkingAway') { walker.phase = 'onWalk'; walker.timer = 4000; }
            else walker.phase = 'idle';
          }
          break;
        case 'onWalk':
          walker.timer -= 1000 / FPS * k;
          if (walker.timer <= 0) walker.phase = 'returning';
          break;
      }
      if (walker.phase !== 'idle' && walker.phase !== 'onWalk') {
        if (moving) walker.frame++;
        // fade in/out near the corner so they don't pop
        ctx.globalAlpha = Math.max(0, Math.min(1, (corner - walker.x) / 25));
        drawWalker(px, walker.x, walker.frame, d, tick, facingRight, walker.withDog);
        ctx.globalAlpha = 1;
      }
    };

    const loop = (t: number) => {
      raf = requestAnimationFrame(loop);
      if (t - last < 1000 / FPS) return;
      k = last ? Math.min(4, (t - last) / (1000 / FPS)) : 1;
      last = t;
      tick++;
      const s = useStore.getState();
      draw(s.home, s.now);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return (
    <div className="street" ref={wrap}>
      <canvas ref={canvas} className="street__canvas" role="img" aria-label="Pixel-art view of the street outside the house. It follows the simulated time and shows the front door, garage, lights and visitors." />
      <span className="street__tag">OUTSIDE · 42 MAPLE ST</span>
    </div>
  );
}

type Px = (x: number, y: number, w: number, h: number, c: string) => void;

function drawWalker(px: Px, x: number, frame: number, d: number, tick: number, facingRight: boolean, withDog: boolean) {
  const f = Math.floor(frame / 4) % 2;
  const y = GROUND + 2; // feet line
  const skin = shade('#e0a77c', d);
  // person
  px(x, y - 15, 4, 3, skin);
  px(x, y - 16, 4, 1, shade('#3b2a20', d));
  px(x - 1, y - 12, 6, 6, shade('#3fae8f', d));
  px(x + (facingRight ? 4 : -2), y - 11, 2, 4, skin);
  px(x, y - 6, 2, 6 - (f ? 1 : 0), shade('#2f3550', d));
  px(x + 2, y - 6, 2, 6 - (f ? 0 : 1), shade('#2f3550', d));
  if (!withDog) return;
  // leash + dog
  const dxo = facingRight ? 6 : -9;
  px(x + (facingRight ? 5 : -3), y - 8, 1, 1, shade('#c4573f', d));
  const dog = shade('#c08a4e', d);
  const wag = Math.sin(tick * 1.2) > 0 ? -1 : 0;
  px(x + dxo, y - 5, 7, 3, dog);
  px(x + dxo + (facingRight ? 6 : -2), y - 7, 3, 3, dog);
  px(x + dxo + (facingRight ? 8 : -2), y - 6, 1, 1, shade('#2b2b30', d));
  px(x + dxo + (facingRight ? -1 : 7), y - 6 + wag, 1, 2, dog);
  px(x + dxo + (f ? 1 : 0), y - 2, 1, 2, dog);
  px(x + dxo + 5 - (f ? 1 : 0), y - 2, 1, 2, dog);
}

function drawVan(px: Px, x: number, d: number, tick: number) {
  const y = GROUND + 3;
  px(x, y, 30, 9, shade('#f1f1f4', d));
  px(x, y + 4, 30, 2, shade('#ff8a3d', d));
  px(x + 1, y + 1, 6, 3, shade('#9fd3ff', d * 0.8 + 0.2));
  px(x + 26, y + 6, 3, 1, Math.sin(tick * 0.8) > 0 ? '#ffb547' : shade('#f1f1f4', d));
  px(x + 4, y + 8, 4, 3, '#1b1b20');
  px(x + 21, y + 8, 4, 3, '#1b1b20');
}

function drawCar(px: Px, c: Car, d: number, night: boolean) {
  const y = c.dir === 1 ? GROUND + 9 : GROUND + 5;
  px(c.x, y + 2, 20, 4, shade(c.color, d));
  px(c.x + 5, y, 10, 3, shade(c.color, d));
  px(c.x + 6, y + 1, 8, 1, shade('#bfe3ff', d * 0.8 + 0.2));
  px(c.x + 3, y + 5, 3, 2, '#1b1b20');
  px(c.x + 14, y + 5, 3, 2, '#1b1b20');
  if (night) px(c.dir === 1 ? c.x + 19 : c.x, y + 3, 1, 1, '#fff2b0');
}
