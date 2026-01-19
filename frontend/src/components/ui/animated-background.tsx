"use client";

import { useRef, useMemo, Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Points, PointMaterial } from "@react-three/drei";
import * as THREE from "three";

// =============================================================================
// PARTICLE FIELD - Floating particles that respond to mouse
// =============================================================================

function ParticleField({ count = 3000 }: { count?: number }) {
  const ref = useRef<THREE.Points>(null);
  const mouseRef = useRef({ x: 0, y: 0 });

  // Generate random positions for particles
  const positions = useMemo(() => {
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      // Spread particles in a sphere-like distribution
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const radius = 2 + Math.random() * 3;

      positions[i3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      positions[i3 + 2] = radius * Math.cos(phi);
    }
    return positions;
  }, [count]);

  // Track mouse movement
  useMemo(() => {
    if (typeof window !== "undefined") {
      const handleMouseMove = (e: MouseEvent) => {
        mouseRef.current.x = (e.clientX / window.innerWidth) * 2 - 1;
        mouseRef.current.y = -(e.clientY / window.innerHeight) * 2 + 1;
      };
      window.addEventListener("mousemove", handleMouseMove);
      return () => window.removeEventListener("mousemove", handleMouseMove);
    }
  }, []);

  // Animate particles
  useFrame((state) => {
    if (!ref.current) return;

    const time = state.clock.getElapsedTime();

    // Gentle rotation
    ref.current.rotation.x = time * 0.02 + mouseRef.current.y * 0.1;
    ref.current.rotation.y = time * 0.03 + mouseRef.current.x * 0.1;

    // Subtle breathing effect
    const scale = 1 + Math.sin(time * 0.5) * 0.05;
    ref.current.scale.setScalar(scale);
  });

  return (
    <Points ref={ref} positions={positions} stride={3} frustumCulled={false}>
      <PointMaterial
        transparent
        color="#6366f1"
        size={0.015}
        sizeAttenuation={true}
        depthWrite={false}
        opacity={0.6}
        blending={THREE.AdditiveBlending}
      />
    </Points>
  );
}

// =============================================================================
// GRADIENT ORB - A glowing orb that floats
// =============================================================================

function GradientOrb({ position, color, size = 1 }: { position: [number, number, number]; color: string; size?: number }) {
  const ref = useRef<THREE.Mesh>(null);
  const initialPosition = useRef(position);

  useFrame((state) => {
    if (!ref.current) return;
    const time = state.clock.getElapsedTime();

    // Float animation
    ref.current.position.y = initialPosition.current[1] + Math.sin(time * 0.5) * 0.3;
    ref.current.position.x = initialPosition.current[0] + Math.sin(time * 0.3) * 0.2;
  });

  return (
    <mesh ref={ref} position={position}>
      <sphereGeometry args={[size, 32, 32]} />
      <meshBasicMaterial
        color={color}
        transparent
        opacity={0.15}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}

// =============================================================================
// AMBIENT PARTICLES - Additional floating particles for depth
// =============================================================================

function AmbientParticles({ count = 100 }: { count?: number }) {
  const ref = useRef<THREE.Points>(null);

  const positions = useMemo(() => {
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      positions[i3] = (Math.random() - 0.5) * 15;
      positions[i3 + 1] = (Math.random() - 0.5) * 10;
      positions[i3 + 2] = (Math.random() - 0.5) * 5 - 3;
    }
    return positions;
  }, [count]);

  useFrame((state) => {
    if (!ref.current) return;
    const time = state.clock.getElapsedTime();

    // Gentle floating motion
    ref.current.rotation.y = time * 0.01;
    ref.current.position.y = Math.sin(time * 0.3) * 0.2;
  });

  return (
    <Points ref={ref} positions={positions} stride={3} frustumCulled={false}>
      <PointMaterial
        transparent
        color="#22d3ee"
        size={0.02}
        sizeAttenuation={true}
        depthWrite={false}
        opacity={0.4}
        blending={THREE.AdditiveBlending}
      />
    </Points>
  );
}

// =============================================================================
// MAIN BACKGROUND SCENE
// =============================================================================

function Scene() {
  return (
    <>
      {/* Ambient lighting */}
      <ambientLight intensity={0.5} />

      {/* Particle field */}
      <ParticleField count={2000} />

      {/* Glowing orbs */}
      <GradientOrb position={[-3, 1, -3]} color="#6366f1" size={1.5} />
      <GradientOrb position={[3, -1, -4]} color="#06b6d4" size={1.2} />
      <GradientOrb position={[0, 2, -5]} color="#8b5cf6" size={1} />

      {/* Ambient particles for depth */}
      <AmbientParticles count={150} />
    </>
  );
}

// =============================================================================
// ANIMATED BACKGROUND COMPONENT
// =============================================================================

interface AnimatedBackgroundProps {
  className?: string;
  intensity?: "low" | "medium" | "high";
}

export function AnimatedBackground({ className = "", intensity = "medium" }: AnimatedBackgroundProps) {
  const particleCount = {
    low: 1000,
    medium: 2000,
    high: 3000,
  }[intensity];

  return (
    <div className={`fixed inset-0 -z-10 ${className}`}>
      <Suspense fallback={<div className="w-full h-full bg-[#09090b]" />}>
        <Canvas
          camera={{ position: [0, 0, 5], fov: 60 }}
          dpr={[1, 2]}
          style={{ background: "transparent" }}
        >
          <Scene />
        </Canvas>
      </Suspense>

      {/* Gradient overlay for depth */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `
            radial-gradient(ellipse 80% 50% at 50% -20%, rgba(99, 102, 241, 0.15), transparent),
            radial-gradient(ellipse 60% 40% at 100% 50%, rgba(6, 182, 212, 0.08), transparent),
            radial-gradient(ellipse 60% 40% at 0% 50%, rgba(139, 92, 246, 0.08), transparent)
          `,
        }}
      />

      {/* Vignette effect */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse at center, transparent 0%, #09090b 100%)",
        }}
      />
    </div>
  );
}

// =============================================================================
// SIMPLE GRADIENT BACKGROUND (Fallback / Light version)
// =============================================================================

export function GradientBackground({ className = "" }: { className?: string }) {
  return (
    <div className={`fixed inset-0 -z-10 ${className}`}>
      <div
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse 80% 50% at 50% -20%, rgba(99, 102, 241, 0.15), transparent),
            radial-gradient(ellipse 60% 40% at 100% 50%, rgba(6, 182, 212, 0.08), transparent),
            radial-gradient(ellipse 60% 40% at 0% 50%, rgba(139, 92, 246, 0.08), transparent),
            #09090b
          `,
        }}
      />

      {/* Animated gradient orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/20 rounded-full blur-[100px] animate-float" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-cyan-500/15 rounded-full blur-[80px] animate-float delay-500" />
      <div className="absolute top-1/2 right-1/3 w-64 h-64 bg-purple-500/10 rounded-full blur-[60px] animate-float delay-300" />
    </div>
  );
}

// =============================================================================
// MESH GRADIENT (CSS-only version)
// =============================================================================

export function MeshGradient({ className = "" }: { className?: string }) {
  return (
    <div className={`fixed inset-0 -z-10 overflow-hidden ${className}`}>
      {/* Base gradient */}
      <div className="absolute inset-0 bg-[#09090b]" />

      {/* Mesh gradient blobs */}
      <div
        className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full opacity-30"
        style={{
          background: "radial-gradient(circle, #6366f1 0%, transparent 70%)",
          filter: "blur(60px)",
          animation: "float 8s ease-in-out infinite",
        }}
      />
      <div
        className="absolute -bottom-40 -right-40 w-[400px] h-[400px] rounded-full opacity-25"
        style={{
          background: "radial-gradient(circle, #06b6d4 0%, transparent 70%)",
          filter: "blur(50px)",
          animation: "float 10s ease-in-out infinite reverse",
        }}
      />
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-20"
        style={{
          background: "radial-gradient(circle, #8b5cf6 0%, transparent 70%)",
          filter: "blur(80px)",
          animation: "float 12s ease-in-out infinite",
        }}
      />

      {/* Noise texture */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />
    </div>
  );
}

export default AnimatedBackground;
