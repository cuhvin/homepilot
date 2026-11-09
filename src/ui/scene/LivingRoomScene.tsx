import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, OrthographicCamera } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Room } from './Room';
import { Devices } from './Devices';
import { useStore } from '../../store';
import { daylight, minuteOfDay } from '../../home/state';
import { skyColor } from './materials';
import type { BlindsState } from '../../home/state';

function CameraRig() {
  const { camera, size } = useThree();
  useEffect(() => {
    const cam = camera as THREE.OrthographicCamera;
    cam.zoom = Math.min(size.width / 12.2, size.height / 9.6);
    cam.updateProjectionMatrix();
  }, [camera, size]);
  return null;
}

/** Sun, sky fill and moon light driven by the simulated clock and the blinds. */
function Environment() {
  const now = useStore((s) => s.now);
  const blinds = useStore((s) => s.home['living.blinds']) as BlindsState;
  const sun = useRef<THREE.DirectionalLight>(null!);
  const hemi = useRef<THREE.HemisphereLight>(null!);
  const fill = useRef<THREE.DirectionalLight>(null!);
  const target = useMemo(() => {
    const o = new THREE.Object3D();
    o.position.set(-0.5, 0, 1.5);
    return o;
  }, []);
  useFrame((_, dt) => {
    const d = daylight(now);
    const open = blinds.position / 100;
    const sky = skyColor(d, minuteOfDay(now));
    sun.current.intensity = THREE.MathUtils.damp(sun.current.intensity, d * 3.2, 3, dt);
    sun.current.color.set('#fff1d6').lerp(new THREE.Color('#ff9a5a'), 1 - Math.min(1, d * 1.4));
    hemi.current.intensity = THREE.MathUtils.damp(hemi.current.intensity, 0.18 + d * (0.35 + 0.55 * open), 3, dt);
    hemi.current.color.copy(sky).lerp(new THREE.Color('#ffffff'), 0.5);
    fill.current.intensity = 0.25 + (1 - d) * 0.15;
    fill.current.color.set(d > 0.3 ? '#fff6ea' : '#8fa3ff');
  });
  return (
    <>
      <primitive object={target} />
      <hemisphereLight ref={hemi} groundColor="#6b4a35" intensity={0.5} />
      <directionalLight
        ref={sun}
        position={[-0.2, 5.5, -9]}
        target={target}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-7}
        shadow-camera-right={7}
        shadow-camera-top={7}
        shadow-camera-bottom={-7}
        shadow-camera-near={1}
        shadow-camera-far={25}
        shadow-bias={-0.0008}
        shadow-normalBias={0.02}
      />
      <directionalLight ref={fill} position={[8, 6, 9]} intensity={0.3} />
    </>
  );
}

function hasWebGL(): boolean {
  try {
    const c = document.createElement('canvas');
    return Boolean(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

export default function LivingRoomScene() {
  const [ok] = useState(hasWebGL);
  const now = useStore((s) => s.now);
  const sky = skyColor(daylight(now), minuteOfDay(now));
  const bg = `radial-gradient(ellipse at 50% 40%, #${sky.clone().lerp(new THREE.Color('#ffffff'), 0.25).getHexString()} 0%, #${sky.clone().multiplyScalar(0.55).getHexString()} 75%)`;

  if (!ok) {
    return (
      <div className="scene scene--fallback" style={{ background: bg }}>
        <p>Your browser can't show the 3D room (WebGL is unavailable). Everything else still works; device states are listed in the panel.</p>
      </div>
    );
  }
  return (
    <div className="scene" style={{ background: bg }}>
      <Canvas shadows={{ type: THREE.PCFShadowMap }} dpr={[1, 1.75]} gl={{ antialias: false, alpha: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}>
        <OrthographicCamera makeDefault position={[10, 8.5, 10]} near={-50} far={100} />
        <CameraRig />
        <OrbitControls
          target={[-0.4, 1.0, -0.2]}
          enablePan={false}
          enableZoom={false}
          minAzimuthAngle={Math.PI * 0.08}
          maxAzimuthAngle={Math.PI * 0.42}
          minPolarAngle={Math.PI * 0.2}
          maxPolarAngle={Math.PI * 0.4}
          rotateSpeed={0.5}
          enableDamping
        />
        <Environment />
        <Room />
        <Devices />
        <EffectComposer multisampling={4}>
          <Bloom mipmapBlur luminanceThreshold={1} luminanceSmoothing={0.2} intensity={0.9} radius={0.7} />
          <Vignette offset={0.3} darkness={0.45} />
        </EffectComposer>
      </Canvas>
    </div>
  );
}
