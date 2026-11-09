// State-driven devices in the living room. Every visual value is damped toward its
// target each frame so changes from the agent animate smoothly.
import { useFrame } from '@react-three/fiber';
import { RoundedBox, Html } from '@react-three/drei';
import { useMemo, useRef, useState, type ReactNode } from 'react';
import * as THREE from 'three';
import { useStore } from '../../store';
import { DEVICE_BY_ID } from '../../home/devices';
import { describeDevice, daylight, minuteOfDay } from '../../home/state';
import type { LightState, TvState, SpeakerState, BlindsState, VacuumState, ThermostatState, LockState, AlarmState, CameraState } from '../../home/state';
import { C, skyColor } from './materials';
import { WIN, H, DOOR } from './Room';

const damp = THREE.MathUtils.damp;

function useDevice<T>(id: string): T {
  return useStore((s) => s.home[id]) as T;
}

/** Hover/click/highlight wrapper that shows a floating label for a device. */
function Interactive({ id, anchor, children }: { id: string; anchor: [number, number, number]; children: ReactNode }) {
  const [hover, setHover] = useState(false);
  const highlight = useStore((s) => s.highlight === id);
  const state = useStore((s) => s.home[id]);
  const show = hover || highlight;
  return (
    <group
      onPointerOver={(e) => { e.stopPropagation(); setHover(true); document.body.style.cursor = 'pointer'; }}
      onPointerOut={() => { setHover(false); document.body.style.cursor = ''; }}
    >
      {children}
      {show && state && (
        <Html position={anchor} center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
          <div className={`scene-label ${highlight ? 'scene-label--active' : ''}`}>
            <strong>{DEVICE_BY_ID[id].label}</strong>
            <span>{describeDevice(state)}</span>
          </div>
        </Html>
      )}
    </group>
  );
}

// ---------------- lights ----------------

function CeilingPendant() {
  const s = useDevice<LightState>('living.ceiling');
  const light = useRef<THREE.PointLight>(null!);
  const bulb = useRef<THREE.MeshStandardMaterial>(null!);
  const color = useMemo(() => new THREE.Color(), []);
  useFrame((_, dt) => {
    const target = s.on ? (s.brightness / 100) * 14 : 0;
    light.current.intensity = damp(light.current.intensity, target, 6, dt);
    color.set(s.color);
    light.current.color.lerp(color, 1 - Math.exp(-6 * dt));
    bulb.current.emissive.copy(light.current.color);
    bulb.current.emissiveIntensity = (light.current.intensity / 14) * 4;
  });
  return (
    <Interactive id="living.ceiling" anchor={[-0.7, 2.95, 0.2]}>
      <group position={[-0.7, 0, 0.2]}>
        <mesh position={[0, (H + 2.75) / 2, 0]}>
          <cylinderGeometry args={[0.012, 0.012, H - 2.75, 6]} />
          <meshStandardMaterial color={C.dark} />
        </mesh>
        <mesh position={[0, 2.62, 0]} castShadow>
          <cylinderGeometry args={[0.1, 0.42, 0.3, 20, 1, true]} />
          <meshStandardMaterial color="#2f3b3a" side={THREE.DoubleSide} roughness={0.5} />
        </mesh>
        <mesh position={[0, 2.5, 0]}>
          <sphereGeometry args={[0.09, 16, 12]} />
          <meshStandardMaterial ref={bulb} color="#fff" emissive="#fff" toneMapped={false} />
        </mesh>
        <pointLight ref={light} position={[0, 2.35, 0]} intensity={0} decay={1.6} distance={0} castShadow shadow-mapSize={[512, 512]} shadow-bias={-0.002} />
      </group>
    </Interactive>
  );
}

function FloorLamp() {
  const s = useDevice<LightState>('living.lamp');
  const light = useRef<THREE.PointLight>(null!);
  const shade = useRef<THREE.MeshStandardMaterial>(null!);
  const color = useMemo(() => new THREE.Color(), []);
  useFrame((_, dt) => {
    const target = s.on ? (s.brightness / 100) * 9 : 0;
    light.current.intensity = damp(light.current.intensity, target, 6, dt);
    color.set(s.color);
    light.current.color.lerp(color, 1 - Math.exp(-6 * dt));
    shade.current.emissive.copy(light.current.color);
    shade.current.emissiveIntensity = (light.current.intensity / 9) * 1.6;
  });
  return (
    <Interactive id="living.lamp" anchor={[2.45, 2.15, -1.6]}>
      <group position={[2.45, 0, -1.6]}>
        <mesh position={[0, 0.025, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.2, 0.22, 0.05, 20]} />
          <meshStandardMaterial color={C.dark} roughness={0.4} metalness={0.3} />
        </mesh>
        <mesh position={[0, 0.8, 0]} castShadow>
          <cylinderGeometry args={[0.02, 0.02, 1.5, 8]} />
          <meshStandardMaterial color={C.dark} metalness={0.4} roughness={0.4} />
        </mesh>
        <mesh position={[0, 1.68, 0]}>
          <cylinderGeometry args={[0.2, 0.3, 0.36, 24, 1, true]} />
          <meshStandardMaterial ref={shade} color={C.shade} side={THREE.DoubleSide} roughness={0.9} toneMapped={false} />
        </mesh>
        <pointLight ref={light} position={[0, 1.55, 0]} intensity={0} decay={1.6} distance={0} castShadow shadow-mapSize={[512, 512]} shadow-bias={-0.002} />
      </group>
    </Interactive>
  );
}

let glowTex: THREE.CanvasTexture | null = null;
function glowTexture() {
  if (glowTex) return glowTex;
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const g = cv.getContext('2d')!;
  const grad = g.createRadialGradient(64, 64, 4, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.4, 'rgba(255,255,255,0.45)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  glowTex = new THREE.CanvasTexture(cv);
  return glowTex;
}

function LedStrip() {
  const s = useDevice<LightState>('living.strip');
  const glow = useRef<THREE.MeshBasicMaterial>(null!);
  const strip = useRef<THREE.MeshBasicMaterial>(null!);
  const light = useRef<THREE.PointLight>(null!);
  const level = useRef(0);
  const color = useMemo(() => new THREE.Color(), []);
  const tex = useMemo(() => glowTexture(), []);
  useFrame((_, dt) => {
    level.current = damp(level.current, s.on ? s.brightness / 100 : 0, 5, dt);
    color.set(s.color);
    glow.current.color.lerp(color, 1 - Math.exp(-6 * dt));
    glow.current.opacity = level.current * 0.85;
    strip.current.color.copy(glow.current.color).multiplyScalar(0.2 + level.current * 2.5);
    light.current.color.copy(glow.current.color);
    light.current.intensity = level.current * 5;
  });
  return (
    <Interactive id="living.strip" anchor={[-4.3, 2.6, 1.1]}>
      <group>
        <mesh position={[-4.475, 1.65, 0]} rotation={[0, Math.PI / 2, 0]}>
          <planeGeometry args={[3.4, 2.2]} />
          <meshBasicMaterial ref={glow} map={tex} transparent opacity={0} depthWrite={false} toneMapped={false} blending={THREE.AdditiveBlending} />
        </mesh>
        <mesh position={[-4.42, 1.65, 0]}>
          <boxGeometry args={[0.02, 0.9, 1.7]} />
          <meshBasicMaterial ref={strip} toneMapped={false} />
        </mesh>
        <pointLight ref={light} position={[-4.15, 1.65, 0]} intensity={0} decay={1.8} distance={0} />
      </group>
    </Interactive>
  );
}

// ---------------- TV ----------------

const TV_PALETTES: Record<string, string[]> = {
  movies: ['#1b2a4a', '#f08a4b', '#2a9d8f', '#e9c46a'],
  news: ['#123a7a', '#d62839', '#f1f1f1', '#2f6fd6'],
  sports: ['#2f8f3f', '#e8f5e9', '#1e5e2a', '#ffd166'],
  gaming: ['#2a0d4a', '#ff4fd8', '#4de4ff', '#a46bff'],
  music: ['#ff6b6b', '#ffd93d', '#6bcB77', '#4d96ff'],
};

function drawScreen(g: CanvasRenderingContext2D, input: string, t: number) {
  const w = g.canvas.width;
  const h = g.canvas.height;
  const pal = TV_PALETTES[input] ?? TV_PALETTES.movies;
  const grad = g.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, pal[0]);
  grad.addColorStop(1, pal[2]);
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);
  if (input === 'news') {
    g.fillStyle = pal[1]; g.fillRect(0, h * 0.78, w, h * 0.12);
    g.fillStyle = pal[2]; g.fillRect(((t * 60) % (w + 120)) - 120, h * 0.81, 110, h * 0.05);
    g.fillStyle = 'rgba(255,255,255,0.85)'; g.beginPath(); g.arc(w * 0.3, h * 0.42, 26, 0, Math.PI * 2); g.fill();
    g.fillRect(w * 0.3 - 34, h * 0.5, 68, 60);
  } else if (input === 'sports') {
    g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 3;
    g.strokeRect(10, 10, w - 20, h - 20); g.beginPath(); g.moveTo(w / 2, 10); g.lineTo(w / 2, h - 10); g.stroke();
    g.fillStyle = pal[3]; g.beginPath(); g.arc(w / 2 + Math.sin(t * 1.3) * w * 0.35, h / 2 + Math.cos(t * 1.7) * h * 0.3, 7, 0, Math.PI * 2); g.fill();
  } else if (input === 'music') {
    for (let i = 0; i < 16; i++) {
      const v = (Math.sin(t * 6 + i * 0.9) * 0.5 + 0.5) * (Math.sin(t * 2.3 + i) * 0.3 + 0.7);
      g.fillStyle = pal[i % 4]; g.fillRect(8 + i * ((w - 16) / 16), h - 10 - v * h * 0.7, (w - 16) / 16 - 3, v * h * 0.7);
    }
  } else {
    // movies / gaming: drifting soft shapes
    for (let i = 0; i < 4; i++) {
      g.fillStyle = pal[(i % 3) + 1] + 'aa';
      g.beginPath();
      g.arc(w * (0.2 + 0.6 * (0.5 + 0.5 * Math.sin(t * 0.4 + i * 1.7))), h * (0.3 + 0.4 * (0.5 + 0.5 * Math.cos(t * 0.33 + i))), 30 + i * 12, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = 'rgba(0,0,0,0.85)'; g.fillRect(0, 0, w, h * 0.1); g.fillRect(0, h * 0.9, w, h * 0.1);
  }
}

function Tv() {
  const s = useDevice<TvState>('living.tv');
  const { tex, ctx } = useMemo(() => {
    const cv = document.createElement('canvas');
    cv.width = 256;
    cv.height = 144;
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    return { tex: t, ctx: cv.getContext('2d')! };
  }, []);
  const mat = useRef<THREE.MeshBasicMaterial>(null!);
  const light = useRef<THREE.PointLight>(null!);
  const power = useRef(0);
  const lastDraw = useRef(0);
  const avg = useMemo(() => new THREE.Color(), []);
  useFrame(({ clock }, dt) => {
    power.current = damp(power.current, s.on ? 1 : 0, 7, dt);
    const t = clock.elapsedTime;
    if (s.on && t - lastDraw.current > 1 / 20) {
      drawScreen(ctx, s.input, t);
      tex.needsUpdate = true;
      lastDraw.current = t;
    }
    mat.current.color.setScalar(0.04 + power.current * 1.25);
    const pal = TV_PALETTES[s.input] ?? TV_PALETTES.movies;
    avg.set(pal[1]).lerp(new THREE.Color(pal[0]), 0.5);
    light.current.color.copy(avg);
    light.current.intensity = power.current * (2.6 + Math.sin(t * 7) * 0.25 + Math.sin(t * 2.3) * 0.3);
  });
  return (
    <Interactive id="living.tv" anchor={[-4.2, 2.45, -0.5]}>
      <group>
        <RoundedBox args={[0.07, 1.06, 1.86]} radius={0.02} position={[-4.39, 1.65, 0]} castShadow>
          <meshStandardMaterial color="#141418" roughness={0.35} metalness={0.2} />
        </RoundedBox>
        <mesh position={[-4.35, 1.65, 0]} rotation={[0, Math.PI / 2, 0]}>
          <planeGeometry args={[1.76, 0.97]} />
          <meshBasicMaterial ref={mat} map={tex} toneMapped={false} />
        </mesh>
        <pointLight ref={light} position={[-3.6, 1.6, 0]} intensity={0} decay={1.8} distance={0} />
      </group>
    </Interactive>
  );
}

// ---------------- speaker ----------------

function Speaker() {
  const s = useDevice<SpeakerState>('living.speaker');
  const woofer = useRef<THREE.Group>(null!);
  const led = useRef<THREE.MeshBasicMaterial>(null!);
  const notes = useRef<THREE.Group>(null!);
  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime;
    const beat = s.on ? Math.max(0, Math.sin(t * 7.5)) ** 4 * (s.volume / 100) : 0;
    woofer.current.scale.x = damp(woofer.current.scale.x, 1 + beat * 1.8, 20, dt);
    led.current.color.set(s.on ? '#4de4ff' : '#222').multiplyScalar(s.on ? 1.5 + beat * 2 : 1);
    notes.current.visible = s.on;
    notes.current.children.forEach((n, i) => {
      const p = (t * 0.35 + i / 3) % 1;
      n.position.set(0.25 + p * 0.25, 1.35 + p * 0.9, Math.sin(t * 2 + i * 2) * 0.15);
      n.scale.setScalar(Math.sin(p * Math.PI) * 0.9);
    });
  });
  return (
    <Interactive id="living.speaker" anchor={[-4.05, 1.75, 1.85]}>
      <group position={[-4.12, 0, 1.85]}>
        <RoundedBox args={[0.36, 1.2, 0.36]} radius={0.04} position={[0, 0.62, 0]} castShadow receiveShadow>
          <meshStandardMaterial color="#26262c" roughness={0.6} />
        </RoundedBox>
        <group ref={woofer} position={[0.18, 0.42, 0]}>
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.13, 0.13, 0.03, 20]} />
            <meshStandardMaterial color="#45454d" roughness={0.4} />
          </mesh>
        </group>
        <mesh position={[0.185, 0.88, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.07, 0.07, 0.02, 16]} />
          <meshStandardMaterial color="#45454d" roughness={0.4} />
        </mesh>
        <mesh position={[0.185, 1.12, 0]}>
          <sphereGeometry args={[0.018, 8, 8]} />
          <meshBasicMaterial ref={led} toneMapped={false} />
        </mesh>
        <group ref={notes}>
          {[0, 1, 2].map((i) => (
            <mesh key={i}>
              <sphereGeometry args={[0.05, 8, 8]} />
              <meshBasicMaterial color={['#4de4ff', '#ff7ad9', '#ffd93d'][i]} toneMapped={false} />
            </mesh>
          ))}
        </group>
      </group>
    </Interactive>
  );
}

// ---------------- window + blinds + sky ----------------

function WindowAndBlinds() {
  const blinds = useDevice<BlindsState>('living.blinds');
  const now = useStore((s) => s.now);
  const shade = useRef<THREE.Group>(null!);
  const glass = useRef<THREE.MeshBasicMaterial>(null!);
  const closed = useRef(1 - blinds.position / 100);
  const w = WIN.x1 - WIN.x0 + 0.1;
  const hgt = WIN.y1 - WIN.y0;
  useFrame((_, dt) => {
    closed.current = damp(closed.current, 1 - blinds.position / 100, 3, dt);
    const c = Math.max(0.001, closed.current);
    shade.current.scale.y = c;
    glass.current.color.copy(skyColor(daylight(now), minuteOfDay(now)));
  });
  return (
    <Interactive id="living.blinds" anchor={[(WIN.x0 + WIN.x1) / 2, WIN.y1 + 0.35, -3.3]}>
      <group>
        <mesh position={[(WIN.x0 + WIN.x1) / 2, (WIN.y0 + WIN.y1) / 2, -3.66]}>
          <planeGeometry args={[w, hgt]} />
          <meshBasicMaterial ref={glass} toneMapped={false} />
        </mesh>
        {/* roller housing */}
        <mesh position={[(WIN.x0 + WIN.x1) / 2, WIN.y1 + 0.03, -3.4]} castShadow>
          <boxGeometry args={[w + 0.1, 0.1, 0.1]} />
          <meshStandardMaterial color={C.trim} />
        </mesh>
        {/* fabric scales down from the top */}
        <group ref={shade} position={[(WIN.x0 + WIN.x1) / 2, WIN.y1, -3.42]}>
          <mesh position={[0, -hgt / 2, 0]} castShadow>
            <boxGeometry args={[w, hgt, 0.02]} />
            <meshStandardMaterial color="#e8d9bf" roughness={1} />
          </mesh>
          <mesh position={[0, -hgt, 0]}>
            <boxGeometry args={[w + 0.02, 0.04, 0.04]} />
            <meshStandardMaterial color={C.wood} />
          </mesh>
        </group>
      </group>
    </Interactive>
  );
}

// ---------------- thermostat ----------------

const MODE_COLORS: Record<string, string> = { heat: '#ff8a3d', cool: '#4d9bff', auto: '#2fd6c4', eco: '#59e07a', off: '#777' };

function Thermostat() {
  const s = useDevice<ThermostatState>('home.thermostat');
  const ring = useRef<THREE.MeshBasicMaterial>(null!);
  useFrame(({ clock }) => {
    const working = s.mode !== 'off' && Math.abs(s.current - s.target) > 0.6;
    const pulse = working ? 1.4 + Math.sin(clock.elapsedTime * 3) * 0.6 : 1;
    ring.current.color.set(MODE_COLORS[s.mode] ?? '#777').multiplyScalar(pulse);
  });
  return (
    <Interactive id="home.thermostat" anchor={[1.0, 2.0, -3.3]}>
      <group position={[1.0, 1.5, -3.47]}>
        <RoundedBox args={[0.32, 0.32, 0.05]} radius={0.04} castShadow>
          <meshStandardMaterial color="#f7f7f5" roughness={0.3} />
        </RoundedBox>
        <mesh position={[0, 0, 0.03]}>
          <ringGeometry args={[0.1, 0.125, 32]} />
          <meshBasicMaterial ref={ring} toneMapped={false} />
        </mesh>
        <Html transform position={[0, 0, 0.031]} scale={0.1} style={{ pointerEvents: 'none' }}>
          <div className="thermo-face">{Math.round(s.target)}°</div>
        </Html>
      </group>
    </Interactive>
  );
}

// ---------------- robot vacuum ----------------

const DOCK = new THREE.Vector3(0.95, 0, -3.15);
const DOCK_POS: [number, number, number] = [0.95, 0, -3.15]; // stable ref so re-renders don't reset the puck

function Vacuum() {
  const s = useDevice<VacuumState>('living.vacuum');
  const puck = useRef<THREE.Group>(null!);
  const led = useRef<THREE.MeshBasicMaterial>(null!);
  const t0 = useRef(0);
  const target = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ clock }, dt) => {
    const p = puck.current.position;
    if (s.running) {
      t0.current += dt;
      const t = t0.current;
      target.set(-1.35 + 2.15 * Math.sin(0.42 * t), 0, 0.1 + 2.55 * Math.sin(0.29 * t + 1.1));
    } else {
      target.copy(DOCK);
    }
    const prev = p.clone();
    p.x = damp(p.x, target.x, 1.6, dt);
    p.z = damp(p.z, target.z, 1.6, dt);
    const v = p.clone().sub(prev);
    if (v.lengthSq() > 1e-7) puck.current.rotation.y = Math.atan2(v.x, v.z);
    led.current.color.set(s.running ? '#59e07a' : '#4d8dff').multiplyScalar(s.running ? 1.5 + Math.sin(clock.elapsedTime * 6) * 0.8 : 1.2);
  });
  return (
    <Interactive id="living.vacuum" anchor={[0.95, 0.6, -3.0]}>
      <group>
        <mesh position={[0.95, 0.12, -3.38]} castShadow>
          <boxGeometry args={[0.4, 0.24, 0.14]} />
          <meshStandardMaterial color="#e9e9ee" roughness={0.4} />
        </mesh>
        <group ref={puck} position={DOCK_POS}>
          <mesh position={[0, 0.05, 0]} castShadow>
            <cylinderGeometry args={[0.22, 0.22, 0.08, 24]} />
            <meshStandardMaterial color="#f2f2f4" roughness={0.35} />
          </mesh>
          <mesh position={[0, 0.095, 0]}>
            <cylinderGeometry args={[0.14, 0.14, 0.012, 24]} />
            <meshStandardMaterial color="#2b2b30" roughness={0.3} />
          </mesh>
          <mesh position={[0, 0.1, 0.17]}>
            <sphereGeometry args={[0.02, 8, 8]} />
            <meshBasicMaterial ref={led} toneMapped={false} />
          </mesh>
        </group>
      </group>
    </Interactive>
  );
}

// ---------------- front door + alarm keypad + camera ----------------

function FrontDoor() {
  const s = useDevice<LockState>('entry.frontdoor');
  const now = useStore((st) => st.now);
  const hinge = useRef<THREE.Group>(null!);
  const led = useRef<THREE.MeshBasicMaterial>(null!);
  const outside = useRef<THREE.MeshBasicMaterial>(null!);
  const w = DOOR.z1 - DOOR.z0 - 0.02;
  useFrame(({ clock }, dt) => {
    // unlocked = door swings open so the change is obvious in the demo
    hinge.current.rotation.y = damp(hinge.current.rotation.y, s.locked ? 0 : 1.15, 2.5, dt);
    const blink = s.locked ? 1 : 0.6 + 0.6 * Math.max(0, Math.sin(clock.elapsedTime * 5));
    led.current.color.set(s.locked ? '#59e07a' : '#ffb547').multiplyScalar(1.5 * blink);
    outside.current.color.copy(skyColor(daylight(now), minuteOfDay(now))).multiplyScalar(0.8);
  });
  return (
    <Interactive id="entry.frontdoor" anchor={[-4.3, DOOR.h + 0.45, (DOOR.z0 + DOOR.z1) / 2]}>
      <group>
        {/* the porch seen through the doorway */}
        <mesh position={[-4.72, DOOR.h / 2, (DOOR.z0 + DOOR.z1) / 2]} rotation={[0, Math.PI / 2, 0]}>
          <planeGeometry args={[DOOR.z1 - DOOR.z0, DOOR.h]} />
          <meshBasicMaterial ref={outside} toneMapped={false} />
        </mesh>
        <group ref={hinge} position={[-4.55, 0, DOOR.z0 + 0.01]}>
          <RoundedBox args={[0.06, DOOR.h - 0.02, w]} radius={0.015} position={[0, DOOR.h / 2, w / 2]} castShadow receiveShadow>
            <meshStandardMaterial color="#3f6e8c" roughness={0.6} />
          </RoundedBox>
          {[0.55, 1.45].map((y) => (
            <mesh key={y} position={[0.035, y, w / 2]}>
              <boxGeometry args={[0.01, 0.6, w - 0.3]} />
              <meshStandardMaterial color="#365f79" roughness={0.6} />
            </mesh>
          ))}
          {[-1, 1].map((side) => (
            <mesh key={side} position={[side * 0.06, 1.0, w - 0.12]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.025, 0.025, 0.06, 10]} />
              <meshStandardMaterial color="#d8b25a" metalness={0.8} roughness={0.3} />
            </mesh>
          ))}
        </group>
        {/* smart-lock status light on the frame */}
        <mesh position={[-4.46, 1.15, DOOR.z1 + 0.06]}>
          <boxGeometry args={[0.02, 0.12, 0.05]} />
          <meshBasicMaterial ref={led} toneMapped={false} />
        </mesh>
      </group>
    </Interactive>
  );
}

const ALARM_COLORS = { off: '#7cb7ff', home: '#ffb547', away: '#ff5a5a' } as const;

function AlarmKeypad() {
  const s = useDevice<AlarmState>('home.alarm');
  const screen = useRef<THREE.MeshBasicMaterial>(null!);
  useFrame(({ clock }) => {
    const pulse = s.mode === 'off' ? 0.9 : 1.2 + Math.sin(clock.elapsedTime * 2.5) * 0.5;
    screen.current.color.set(ALARM_COLORS[s.mode]).multiplyScalar(pulse);
  });
  return (
    <Interactive id="home.alarm" anchor={[-4.3, 1.95, -1.45]}>
      <group position={[-4.47, 1.4, -1.45]}>
        <RoundedBox args={[0.05, 0.36, 0.26]} radius={0.02} castShadow>
          <meshStandardMaterial color="#f4f2ee" roughness={0.3} />
        </RoundedBox>
        <mesh position={[0.03, 0.08, 0]} rotation={[0, Math.PI / 2, 0]}>
          <planeGeometry args={[0.18, 0.09]} />
          <meshBasicMaterial ref={screen} toneMapped={false} />
        </mesh>
        {[-0.06, 0, 0.06].flatMap((z) => [-0.04, -0.1].map((y) => (
          <mesh key={`${z}${y}`} position={[0.03, y, z]}>
            <boxGeometry args={[0.01, 0.035, 0.035]} />
            <meshStandardMaterial color="#c9c4bb" />
          </mesh>
        )))}
      </group>
    </Interactive>
  );
}

function SecurityCamera() {
  const s = useDevice<CameraState>('home.cameras');
  const head = useRef<THREE.Group>(null!);
  const led = useRef<THREE.MeshBasicMaterial>(null!);
  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime;
    // recording: slow pan; off: "privacy mode", lens tilted to the floor
    head.current.rotation.y = damp(head.current.rotation.y, s.on ? -1.95 + Math.sin(t * 0.4) * 0.35 : -1.95, 3, dt);
    head.current.rotation.z = damp(head.current.rotation.z, s.on ? -0.45 : -1.35, 3, dt);
    const on = s.on && Math.sin(t * 4) > -0.2;
    led.current.color.set(on ? '#ff3b3b' : '#2a2a2a').multiplyScalar(on ? 2 : 1);
  });
  return (
    <Interactive id="home.cameras" anchor={[1.6, 3.45, -3.2]}>
      <group position={[1.6, 2.95, -3.32]}>
        <mesh position={[0, 0.08, -0.08]}>
          <boxGeometry args={[0.08, 0.08, 0.2]} />
          <meshStandardMaterial color="#e9e9ee" />
        </mesh>
        <group ref={head} rotation={[0, -1.95, -0.45]}>
          <RoundedBox args={[0.34, 0.15, 0.15]} radius={0.04} position={[0.14, 0, 0]} castShadow>
            <meshStandardMaterial color="#f4f4f6" roughness={0.3} />
          </RoundedBox>
          <mesh position={[0.32, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.05, 0.05, 0.03, 16]} />
            <meshStandardMaterial color="#1b1b20" roughness={0.2} metalness={0.4} />
          </mesh>
          <mesh position={[0.3, 0.06, 0.05]}>
            <sphereGeometry args={[0.016, 8, 8]} />
            <meshBasicMaterial ref={led} toneMapped={false} />
          </mesh>
        </group>
      </group>
    </Interactive>
  );
}

export function Devices() {
  return (
    <group>
      <CeilingPendant />
      <FloorLamp />
      <LedStrip />
      <Tv />
      <Speaker />
      <WindowAndBlinds />
      <Thermostat />
      <Vacuum />
      <FrontDoor />
      <AlarmKeypad />
      <SecurityCamera />
    </group>
  );
}
