"use client";

import { useRef, useMemo, useEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface ParticlesProps {
  count?: number;
  mouse: React.MutableRefObject<{ x: number; y: number }>;
}

function Particles({ count = 2000, mouse }: ParticlesProps) {
  const mesh = useRef<THREE.Points>(null);
  const light = useRef<THREE.PointLight>(null);

  // Generate particle positions and colors
  const { positions, colors, sizes, originalPositions } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);

    // Teal color: #0d9488 -> RGB: 13, 148, 136
    // Coral color: #f97316 -> RGB: 249, 115, 22
    const teal = new THREE.Color(0x0d9488);
    const coral = new THREE.Color(0xf97316);
    const white = new THREE.Color(0xffffff);

    for (let i = 0; i < count; i++) {
      // Position - spread in a sphere-like formation
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const radius = 3 + Math.random() * 4;

      positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta) - 1;
      positions[i * 3 + 2] = radius * Math.cos(phi) - 2;

      // Color - mix between teal, coral, and white
      const colorMix = Math.random();
      let color: THREE.Color;
      if (colorMix < 0.5) {
        color = teal.clone().lerp(white, Math.random() * 0.5);
      } else if (colorMix < 0.8) {
        color = coral.clone().lerp(white, Math.random() * 0.5);
      } else {
        color = white.clone();
      }

      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;

      // Size - vary for depth effect
      sizes[i] = Math.random() * 3 + 0.5;
    }

    return {
      positions,
      colors,
      sizes,
      originalPositions: positions.slice(),
    };
  }, [count]);

  // Set up geometry attributes
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geo.setAttribute("size", new THREE.BufferAttribute(sizes, 1));
    return geo;
  }, [positions, colors, sizes]);

  useFrame((state) => {
    if (!mesh.current) return;

    const time = state.clock.getElapsedTime();
    const positionAttribute = mesh.current.geometry.attributes.position;

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;

      // Get original position
      const ox = originalPositions[i3];
      const oy = originalPositions[i3 + 1];
      const oz = originalPositions[i3 + 2];

      // Add flowing wave motion
      const waveX = Math.sin(time * 0.3 + oy * 0.5) * 0.3;
      const waveY = Math.cos(time * 0.2 + ox * 0.5) * 0.2;
      const waveZ = Math.sin(time * 0.4 + ox * 0.3) * 0.2;

      // Mouse influence - subtle attraction
      const mouseInfluenceX = (mouse.current.x * 2 - ox) * 0.02;
      const mouseInfluenceY = (-mouse.current.y * 2 - oy) * 0.02;

      positionAttribute.setXYZ(
        i,
        ox + waveX + mouseInfluenceX,
        oy + waveY + mouseInfluenceY,
        oz + waveZ
      );
    }

    positionAttribute.needsUpdate = true;

    // Rotate the entire particle system slowly
    mesh.current.rotation.y = time * 0.02;
    mesh.current.rotation.x = Math.sin(time * 0.1) * 0.1;

    // Move light with mouse
    if (light.current) {
      light.current.position.x = mouse.current.x * 3;
      light.current.position.y = -mouse.current.y * 3;
    }
  });

  return (
    <>
      <pointLight ref={light} distance={40} intensity={8} color="#0d9488" />
      <pointLight position={[5, 5, -5]} distance={30} intensity={4} color="#f97316" />
      <points ref={mesh} geometry={geometry}>
        <pointsMaterial
          size={0.08}
          vertexColors
          transparent
          opacity={0.8}
          sizeAttenuation
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </points>
    </>
  );
}

function FloatingOrbs({ mouse }: { mouse: React.MutableRefObject<{ x: number; y: number }> }) {
  const orb1 = useRef<THREE.Mesh>(null);
  const orb2 = useRef<THREE.Mesh>(null);
  const orb3 = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    const time = state.clock.getElapsedTime();

    if (orb1.current) {
      orb1.current.position.x = Math.sin(time * 0.5) * 2 + mouse.current.x * 0.5;
      orb1.current.position.y = Math.cos(time * 0.3) * 1.5 - mouse.current.y * 0.5;
      orb1.current.position.z = Math.sin(time * 0.4) * 1;
    }

    if (orb2.current) {
      orb2.current.position.x = Math.cos(time * 0.4) * 2.5 - mouse.current.x * 0.3;
      orb2.current.position.y = Math.sin(time * 0.5) * 1 + mouse.current.y * 0.3;
      orb2.current.position.z = Math.cos(time * 0.3) * 1.5;
    }

    if (orb3.current) {
      orb3.current.position.x = Math.sin(time * 0.3) * 1.5;
      orb3.current.position.y = Math.cos(time * 0.6) * 2 - 0.5;
      orb3.current.position.z = Math.sin(time * 0.5) * 2;
    }
  });

  return (
    <>
      {/* Teal orb */}
      <mesh ref={orb1} position={[2, 1, -2]}>
        <sphereGeometry args={[0.5, 32, 32]} />
        <meshStandardMaterial
          color="#0d9488"
          emissive="#0d9488"
          emissiveIntensity={0.5}
          transparent
          opacity={0.3}
        />
      </mesh>

      {/* Coral orb */}
      <mesh ref={orb2} position={[-2, 0, -1]}>
        <sphereGeometry args={[0.4, 32, 32]} />
        <meshStandardMaterial
          color="#f97316"
          emissive="#f97316"
          emissiveIntensity={0.5}
          transparent
          opacity={0.25}
        />
      </mesh>

      {/* White orb */}
      <mesh ref={orb3} position={[0, -1, -3]}>
        <sphereGeometry args={[0.3, 32, 32]} />
        <meshStandardMaterial
          color="#ffffff"
          emissive="#ffffff"
          emissiveIntensity={0.3}
          transparent
          opacity={0.2}
        />
      </mesh>
    </>
  );
}

export default function ParticleField() {
  const mouse = useRef({ x: 0, y: 0 });

  const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    mouse.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.current.y = ((event.clientY - rect.top) / rect.height) * 2 - 1;
  };

  return (
    <div
      className="absolute inset-0 -z-10"
      onMouseMove={handleMouseMove}
    >
      <Canvas
        camera={{ position: [0, 0, 6], fov: 60 }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: "transparent" }}
      >
        <ambientLight intensity={0.5} />
        <Particles count={1500} mouse={mouse} />
        <FloatingOrbs mouse={mouse} />
      </Canvas>
    </div>
  );
}
