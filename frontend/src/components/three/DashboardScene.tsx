"use client";

import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float } from "@react-three/drei";
import * as THREE from "three";

// Floating geometric shapes
function FloatingGeometry({ position, color, speed = 1 }: { position: [number, number, number]; color: string; speed?: number }) {
  const mesh = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (mesh.current) {
      mesh.current.rotation.x = state.clock.elapsedTime * 0.2 * speed;
      mesh.current.rotation.y = state.clock.elapsedTime * 0.3 * speed;
    }
  });

  return (
    <Float speed={2} rotationIntensity={0.5} floatIntensity={1}>
      <mesh ref={mesh} position={position}>
        <icosahedronGeometry args={[0.3, 0]} />
        <meshStandardMaterial
          color={color}
          transparent
          opacity={0.6}
          roughness={0.2}
          metalness={0.8}
        />
      </mesh>
    </Float>
  );
}

// Animated ring
function AnimatedRing({ position, color }: { position: [number, number, number]; color: string }) {
  const mesh = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (mesh.current) {
      mesh.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.5) * 0.3;
      mesh.current.rotation.y = state.clock.elapsedTime * 0.2;
    }
  });

  return (
    <mesh ref={mesh} position={position}>
      <torusGeometry args={[0.5, 0.05, 16, 50]} />
      <meshStandardMaterial
        color={color}
        transparent
        opacity={0.4}
        roughness={0.3}
        metalness={0.7}
      />
    </mesh>
  );
}

// Flowing particles background
function FlowingParticles({ count = 200 }: { count?: number }) {
  const points = useRef<THREE.Points>(null);

  const geometry = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    const indigoColor = new THREE.Color("#6366f1");
    const roseColor = new THREE.Color("#f43f5e");

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      // Spread across the viewport
      positions[i3] = (Math.random() - 0.5) * 20;
      positions[i3 + 1] = (Math.random() - 0.5) * 15;
      positions[i3 + 2] = (Math.random() - 0.5) * 10 - 5;

      // Random color between teal and orange
      const color = Math.random() > 0.7 ? roseColor : indigoColor;
      colors[i3] = color.r;
      colors[i3 + 1] = color.g;
      colors[i3 + 2] = color.b;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return geo;
  }, [count]);

  useFrame((state) => {
    if (points.current) {
      points.current.rotation.y = state.clock.elapsedTime * 0.02;
      points.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.1) * 0.1;
    }
  });

  return (
    <points ref={points} geometry={geometry}>
      <pointsMaterial
        size={0.03}
        vertexColors
        transparent
        opacity={0.6}
        sizeAttenuation
      />
    </points>
  );
}

// Glowing orb
function GlowOrb({ position, color, size = 1 }: { position: [number, number, number]; color: string; size?: number }) {
  const mesh = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (mesh.current) {
      const scale = 1 + Math.sin(state.clock.elapsedTime * 2) * 0.1;
      mesh.current.scale.setScalar(scale * size);
    }
  });

  return (
    <mesh ref={mesh} position={position}>
      <sphereGeometry args={[0.5, 32, 32]} />
      <meshStandardMaterial
        color={color}
        transparent
        opacity={0.15}
        roughness={1}
        metalness={0}
        emissive={color}
        emissiveIntensity={0.3}
      />
    </mesh>
  );
}

// Main scene
function Scene() {
  return (
    <>
      <ambientLight intensity={0.4} />
      <pointLight position={[10, 10, 10]} intensity={0.5} color="#6366f1" />
      <pointLight position={[-10, -10, -10]} intensity={0.3} color="#f43f5e" />

      {/* Floating particles */}
      <FlowingParticles count={150} />

      {/* Geometric shapes */}
      <FloatingGeometry position={[-4, 2, -3]} color="#6366f1" speed={0.8} />
      <FloatingGeometry position={[4, -1, -4]} color="#f43f5e" speed={1.2} />
      <FloatingGeometry position={[2, 3, -5]} color="#818cf8" speed={0.6} />

      {/* Rings */}
      <AnimatedRing position={[-3, -2, -4]} color="#6366f1" />
      <AnimatedRing position={[3, 2, -6]} color="#f43f5e" />

      {/* Glow orbs */}
      <GlowOrb position={[-5, 0, -8]} color="#6366f1" size={2} />
      <GlowOrb position={[5, 1, -10]} color="#f43f5e" size={1.5} />
      <GlowOrb position={[0, -3, -6]} color="#818cf8" size={1.8} />
    </>
  );
}

// Exported component
export default function DashboardScene() {
  return (
    <div className="fixed inset-0 -z-10 pointer-events-none">
      {/* Base gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-indigo-50/30" />

      {/* 3D Canvas */}
      <Canvas
        camera={{ position: [0, 0, 8], fov: 50 }}
        dpr={[1, 2]}
        style={{ background: "transparent" }}
      >
        <Scene />
      </Canvas>

      {/* Overlay gradient for readability */}
      <div
        className="absolute inset-0"
        style={{
          background: "radial-gradient(ellipse at center, transparent 0%, rgba(248, 250, 252, 0.7) 100%)"
        }}
      />
    </div>
  );
}
