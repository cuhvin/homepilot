// Static architecture + furniture of the living-room diorama (procedural low-poly).
import { RoundedBox } from '@react-three/drei';
import { useMemo } from 'react';
import { C, plankTexture, artTexture } from './materials';

export const H = 3.4; // wall height
export const WIN = { x0: -2.0, x1: 0.4, y0: 1.1, y1: 2.7 }; // window opening in back wall

function Box({ args, position, color, rough = 0.85, cast = true, receive = true }: {
  args: [number, number, number]; position: [number, number, number]; color: string; rough?: number; cast?: boolean; receive?: boolean;
}) {
  return (
    <mesh position={position} castShadow={cast} receiveShadow={receive}>
      <boxGeometry args={args} />
      <meshStandardMaterial color={color} roughness={rough} />
    </mesh>
  );
}

function Walls() {
  const t = 0.2;
  const zb = -3.5 - t / 2;
  const winW = WIN.x1 - WIN.x0;
  const winCx = (WIN.x0 + WIN.x1) / 2;
  return (
    <group>
      {/* back wall, built around the window opening */}
      <Box args={[WIN.x0 + 4.7, H, t]} position={[(-4.7 + WIN.x0) / 2, H / 2, zb]} color={C.wallBack} />
      <Box args={[4.5 - WIN.x1, H, t]} position={[(WIN.x1 + 4.5) / 2, H / 2, zb]} color={C.wallBack} />
      <Box args={[winW, WIN.y0, t]} position={[winCx, WIN.y0 / 2, zb]} color={C.wallBack} />
      <Box args={[winW, H - WIN.y1, t]} position={[winCx, (H + WIN.y1) / 2, zb]} color={C.wallBack} />
      {/* left wall */}
      <Box args={[t, H, 7.4]} position={[-4.6, H / 2, -0.1]} color={C.wallLeft} />
      {/* wall caps (cut-away look) */}
      <Box args={[9.4, 0.06, t + 0.04]} position={[-0.1, H + 0.03, zb]} color={C.trim} />
      <Box args={[t + 0.04, 0.06, 7.4]} position={[-4.6, H + 0.03, -0.1]} color={C.trim} />
      {/* baseboards */}
      <Box args={[9, 0.14, 0.04]} position={[0, 0.07, -3.48]} color={C.trim} cast={false} />
      <Box args={[0.04, 0.14, 7]} position={[-4.48, 0.07, 0]} color={C.trim} cast={false} />
      {/* window frame + sill + mullions */}
      <Box args={[winW + 0.16, 0.08, 0.3]} position={[winCx, WIN.y0 - 0.02, -3.5]} color={C.trim} />
      <Box args={[winW + 0.16, 0.08, 0.26]} position={[winCx, WIN.y1 + 0.04, -3.55]} color={C.trim} />
      <Box args={[0.08, WIN.y1 - WIN.y0, 0.26]} position={[WIN.x0 - 0.04, (WIN.y0 + WIN.y1) / 2, -3.55]} color={C.trim} />
      <Box args={[0.08, WIN.y1 - WIN.y0, 0.26]} position={[WIN.x1 + 0.04, (WIN.y0 + WIN.y1) / 2, -3.55]} color={C.trim} />
      <Box args={[0.05, WIN.y1 - WIN.y0, 0.06]} position={[winCx, (WIN.y0 + WIN.y1) / 2, -3.62]} color={C.trim} cast={false} />
      <Box args={[winW, 0.05, 0.06]} position={[winCx, (WIN.y0 + WIN.y1) / 2, -3.62]} color={C.trim} cast={false} />
    </group>
  );
}

function Floor() {
  const tex = useMemo(() => plankTexture(), []);
  return (
    <group>
      {/* diorama slab */}
      <mesh position={[-0.1, -0.2, -0.1]} receiveShadow>
        <boxGeometry args={[9.4, 0.4, 7.4]} />
        <meshStandardMaterial color={C.base} roughness={0.9} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0]} receiveShadow>
        <planeGeometry args={[9, 7]} />
        <meshStandardMaterial map={tex} roughness={0.75} />
      </mesh>
    </group>
  );
}

function Rug() {
  return (
    <group position={[-0.9, 0, 0.2]}>
      <mesh position={[0, 0.012, 0]} receiveShadow>
        <boxGeometry args={[3.5, 0.02, 2.7]} />
        <meshStandardMaterial color={C.rugBorder} roughness={1} />
      </mesh>
      <mesh position={[0, 0.02, 0]} receiveShadow>
        <boxGeometry args={[3.2, 0.02, 2.4]} />
        <meshStandardMaterial color={C.rug} roughness={1} />
      </mesh>
      {[-0.8, 0, 0.8].map((z) => (
        <mesh key={z} position={[0, 0.031, z]} receiveShadow>
          <boxGeometry args={[3.0, 0.004, 0.08]} />
          <meshStandardMaterial color={C.rugBorder} roughness={1} />
        </mesh>
      ))}
    </group>
  );
}

function Sofa() {
  return (
    <group position={[1.6, 0, 0.2]}>
      <RoundedBox args={[1.0, 0.36, 2.6]} radius={0.06} position={[0, 0.26, 0]} castShadow receiveShadow>
        <meshStandardMaterial color={C.sofaDark} roughness={0.95} />
      </RoundedBox>
      {[-0.6, 0.6].map((z) => (
        <RoundedBox key={z} args={[0.86, 0.17, 1.16]} radius={0.07} position={[-0.08, 0.52, z]} castShadow receiveShadow>
          <meshStandardMaterial color={C.cushion} roughness={0.95} />
        </RoundedBox>
      ))}
      <RoundedBox args={[0.3, 0.78, 2.6]} radius={0.1} position={[0.37, 0.75, 0]} castShadow receiveShadow>
        <meshStandardMaterial color={C.sofa} roughness={0.95} />
      </RoundedBox>
      {[-1.3, 1.3].map((z) => (
        <RoundedBox key={z} args={[1.0, 0.62, 0.26]} radius={0.1} position={[0, 0.46, z]} castShadow receiveShadow>
          <meshStandardMaterial color={C.sofa} roughness={0.95} />
        </RoundedBox>
      ))}
      <RoundedBox args={[0.16, 0.42, 0.42]} radius={0.08} position={[0.16, 0.8, -0.82]} rotation={[0.25, 0, 0.15]} castShadow>
        <meshStandardMaterial color={C.pillowA} roughness={1} />
      </RoundedBox>
      <RoundedBox args={[0.16, 0.4, 0.4]} radius={0.08} position={[0.16, 0.8, 0.85]} rotation={[-0.2, 0, 0.12]} castShadow>
        <meshStandardMaterial color={C.pillowB} roughness={1} />
      </RoundedBox>
      {/* throw blanket on the arm */}
      <RoundedBox args={[0.9, 0.06, 0.34]} radius={0.03} position={[-0.02, 0.79, 1.3]} castShadow>
        <meshStandardMaterial color="#c9d6b8" roughness={1} />
      </RoundedBox>
      {[[-0.42, -1.2], [-0.42, 1.2], [0.42, -1.2], [0.42, 1.2]].map(([x, z]) => (
        <mesh key={`${x}${z}`} position={[x, 0.04, z]}>
          <cylinderGeometry args={[0.035, 0.03, 0.08, 8]} />
          <meshStandardMaterial color={C.wood} />
        </mesh>
      ))}
    </group>
  );
}

function CoffeeTable() {
  return (
    <group position={[-0.7, 0, 0.2]}>
      <RoundedBox args={[0.85, 0.07, 1.35]} radius={0.03} position={[0, 0.42, 0]} castShadow receiveShadow>
        <meshStandardMaterial color={C.woodLight} roughness={0.6} />
      </RoundedBox>
      <RoundedBox args={[0.72, 0.04, 1.2]} radius={0.02} position={[0, 0.14, 0]} castShadow receiveShadow>
        <meshStandardMaterial color={C.wood} roughness={0.7} />
      </RoundedBox>
      {[[-0.36, -0.6], [-0.36, 0.6], [0.36, -0.6], [0.36, 0.6]].map(([x, z]) => (
        <mesh key={`${x}${z}`} position={[x, 0.2, z]} castShadow>
          <cylinderGeometry args={[0.03, 0.025, 0.4, 8]} />
          <meshStandardMaterial color={C.wood} />
        </mesh>
      ))}
      {/* props */}
      <mesh position={[0.1, 0.5, -0.35]} castShadow>
        <cylinderGeometry args={[0.055, 0.05, 0.1, 14]} />
        <meshStandardMaterial color="#e7e1d6" roughness={0.4} />
      </mesh>
      <mesh position={[-0.12, 0.48, 0.25]} rotation={[0, 0.3, 0]} castShadow>
        <boxGeometry args={[0.3, 0.05, 0.22]} />
        <meshStandardMaterial color="#3f6e8c" />
      </mesh>
      <mesh position={[-0.1, 0.525, 0.27]} rotation={[0, 0.1, 0]} castShadow>
        <boxGeometry args={[0.27, 0.04, 0.2]} />
        <meshStandardMaterial color="#c9a13d" />
      </mesh>
      <mesh position={[0.12, 0.5, 0.35]} castShadow>
        <cylinderGeometry args={[0.07, 0.06, 0.1, 10]} />
        <meshStandardMaterial color={C.pot} />
      </mesh>
      <mesh position={[0.12, 0.6, 0.35]} castShadow>
        <icosahedronGeometry args={[0.1, 0]} />
        <meshStandardMaterial color={C.plant} flatShading />
      </mesh>
    </group>
  );
}

function Bookshelf() {
  const books = useMemo(() => {
    const colors = ['#c4573f', '#e0a84a', '#3f6e8c', '#6a8f5a', '#8c5a8f', '#d9c7a7', '#2f4858', '#b5654a'];
    let seed = 11;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const out: { x: number; y: number; w: number; h: number; c: string; tilt: number }[] = [];
    [0.12, 0.62, 1.12, 1.62].forEach((y, row) => {
      let x = -0.62;
      while (x < 0.55) {
        const w = 0.06 + rnd() * 0.06;
        const h = 0.28 + rnd() * 0.14;
        if (row === 1 && x > 0.1 && x < 0.4) { x += 0.32; continue; } // gap for a vase
        out.push({ x: x + w / 2, y, w, h, c: colors[Math.floor(rnd() * colors.length)], tilt: rnd() < 0.08 ? 0.25 : 0 });
        x += w + 0.01;
      }
    });
    return out;
  }, []);
  return (
    <group position={[2.8, 0, -3.25]}>
      {[-0.72, 0.72].map((x) => <Box key={x} args={[0.05, 2.1, 0.4]} position={[x, 1.05, 0]} color={C.wood} />)}
      {[0.06, 0.56, 1.06, 1.56, 2.08].map((y) => <Box key={y} args={[1.49, 0.04, 0.4]} position={[0, y, 0]} color={C.wood} />)}
      <Box args={[1.49, 2.1, 0.02]} position={[0, 1.05, -0.19]} color="#7a4f33" cast={false} />
      {books.map((b, i) => (
        <mesh key={i} position={[b.x, b.y + b.h / 2 - 0.04, 0.02]} rotation={[0, 0, b.tilt]} castShadow>
          <boxGeometry args={[b.w, b.h, 0.28]} />
          <meshStandardMaterial color={b.c} roughness={0.8} />
        </mesh>
      ))}
      <mesh position={[0.28, 0.76, 0]} castShadow>
        <cylinderGeometry args={[0.06, 0.1, 0.32, 12]} />
        <meshStandardMaterial color="#5aa3a0" roughness={0.3} />
      </mesh>
    </group>
  );
}

function Plant({ position, scale = 1 }: { position: [number, number, number]; scale?: number }) {
  const leaves = useMemo(() => {
    const out: { p: [number, number, number]; s: number; r: number }[] = [];
    let seed = 5;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      out.push({ p: [Math.cos(a) * 0.22 * rnd(), 0.75 + rnd() * 0.65, Math.sin(a) * 0.22 * rnd()], s: 0.2 + rnd() * 0.14, r: rnd() * 3 });
    }
    return out;
  }, []);
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 0.25, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.28, 0.22, 0.5, 14]} />
        <meshStandardMaterial color={C.pot} roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.5, 0]}>
        <cylinderGeometry args={[0.26, 0.26, 0.02, 14]} />
        <meshStandardMaterial color="#5a4030" />
      </mesh>
      <mesh position={[0, 0.65, 0]}>
        <cylinderGeometry args={[0.02, 0.03, 0.4, 6]} />
        <meshStandardMaterial color="#5c4a2e" />
      </mesh>
      {leaves.map((l, i) => (
        <mesh key={i} position={l.p} rotation={[l.r, l.r * 2, 0]} scale={[l.s, l.s * 1.4, l.s]} castShadow>
          <icosahedronGeometry args={[1, 0]} />
          <meshStandardMaterial color={i % 2 ? C.plant : C.plantDark} flatShading roughness={0.8} />
        </mesh>
      ))}
    </group>
  );
}

function WallArt() {
  const tex = useMemo(() => artTexture(), []);
  return (
    <group position={[-3.3, 2.05, -3.47]}>
      <Box args={[1.0, 0.78, 0.05]} position={[0, 0, 0]} color={C.dark} />
      <mesh position={[0, 0, 0.03]}>
        <planeGeometry args={[0.88, 0.66]} />
        <meshStandardMaterial map={tex} roughness={0.9} />
      </mesh>
    </group>
  );
}

function TvConsole() {
  return (
    <group position={[-4.17, 0, 0]}>
      <RoundedBox args={[0.5, 0.42, 2.6]} radius={0.03} position={[0, 0.25, 0]} castShadow receiveShadow>
        <meshStandardMaterial color={C.woodLight} roughness={0.6} />
      </RoundedBox>
      {[-0.65, 0.65].map((z) => (
        <mesh key={z} position={[0.252, 0.25, z]}>
          <boxGeometry args={[0.01, 0.3, 1.15]} />
          <meshStandardMaterial color={C.wood} />
        </mesh>
      ))}
      {[[-0.18, -1.2], [-0.18, 1.2], [0.18, -1.2], [0.18, 1.2]].map(([x, z]) => (
        <mesh key={`${x}${z}`} position={[x, 0.02, z]}>
          <cylinderGeometry args={[0.025, 0.02, 0.06, 8]} />
          <meshStandardMaterial color={C.dark} />
        </mesh>
      ))}
      {/* little decor: candle + console box */}
      <mesh position={[0, 0.52, -1.05]} castShadow>
        <cylinderGeometry args={[0.05, 0.05, 0.12, 12]} />
        <meshStandardMaterial color="#f1e6d2" />
      </mesh>
      <mesh position={[0, 0.5, 0.95]} castShadow>
        <boxGeometry args={[0.28, 0.08, 0.36]} />
        <meshStandardMaterial color="#e9e9ee" roughness={0.4} />
      </mesh>
    </group>
  );
}

function Armchair() {
  return (
    <group position={[-1.9, 0, 2.55]} rotation={[0, Math.PI * 0.82, 0]}>
      <RoundedBox args={[0.95, 0.34, 0.85]} radius={0.06} position={[0, 0.26, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#c97b5a" roughness={0.95} />
      </RoundedBox>
      <RoundedBox args={[0.75, 0.15, 0.7]} radius={0.06} position={[0, 0.5, 0.04]} castShadow receiveShadow>
        <meshStandardMaterial color="#d98e6c" roughness={0.95} />
      </RoundedBox>
      <RoundedBox args={[0.95, 0.65, 0.2]} radius={0.08} position={[0, 0.68, -0.34]} castShadow receiveShadow>
        <meshStandardMaterial color="#c97b5a" roughness={0.95} />
      </RoundedBox>
      {[-0.42, 0.42].map((x) => (
        <RoundedBox key={x} args={[0.16, 0.5, 0.85]} radius={0.07} position={[x, 0.45, 0]} castShadow receiveShadow>
          <meshStandardMaterial color="#b96d4e" roughness={0.95} />
        </RoundedBox>
      ))}
      {[[-0.38, -0.32], [-0.38, 0.32], [0.38, -0.32], [0.38, 0.32]].map(([x, z]) => (
        <mesh key={`${x}${z}`} position={[x, 0.045, z]}>
          <cylinderGeometry args={[0.03, 0.025, 0.09, 8]} />
          <meshStandardMaterial color={C.wood} />
        </mesh>
      ))}
    </group>
  );
}

function DogBed() {
  return (
    <group position={[3.4, 0, 2.2]}>
      <mesh position={[0, 0.1, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
        <torusGeometry args={[0.42, 0.13, 10, 24]} />
        <meshStandardMaterial color="#8a6f9e" roughness={1} />
      </mesh>
      <mesh position={[0, 0.06, 0]} receiveShadow>
        <cylinderGeometry args={[0.42, 0.42, 0.08, 24]} />
        <meshStandardMaterial color="#cbb8d9" roughness={1} />
      </mesh>
      <mesh position={[0.75, 0.07, -0.3]} castShadow>
        <icosahedronGeometry args={[0.07, 1]} />
        <meshStandardMaterial color="#e9d84a" roughness={0.6} />
      </mesh>
    </group>
  );
}

export function Room() {
  return (
    <group>
      <Floor />
      <Walls />
      <Rug />
      <Sofa />
      <CoffeeTable />
      <Bookshelf />
      <TvConsole />
      <WallArt />
      <Plant position={[-3.95, 0, 2.95]} />
      <Plant position={[3.95, 0, -2.95]} scale={0.75} />
      <Armchair />
      <DogBed />
    </group>
  );
}
