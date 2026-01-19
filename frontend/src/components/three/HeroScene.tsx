"use client";

import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, MeshDistortMaterial, MeshWobbleMaterial, Sphere, Torus, Box } from "@react-three/drei";
import * as THREE from "three";

// Floating teal sphere with distortion
function TealSphere() {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.x = state.clock.elapsedTime * 0.2;
      meshRef.current.rotation.y = state.clock.elapsedTime * 0.3;
    }
  });

  return (
    <Float speed={2} rotationIntensity={0.5} floatIntensity={1}>
      <mesh ref={meshRef} position={[-3, 1, -2]} scale={1.5}>
        <sphereGeometry args={[1, 64, 64]} />
        <MeshDistortMaterial
          color="#0d9488"
          attach="material"
          distort={0.4}
          speed={2}
          roughness={0.2}
          metalness={0.8}
        />
      </mesh>
    </Float>
  );
}

// Floating orange torus
function OrangeTorus() {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.x = state.clock.elapsedTime * 0.3;
      meshRef.current.rotation.z = state.clock.elapsedTime * 0.2;
    }
  });

  return (
    <Float speed={1.5} rotationIntensity={0.8} floatIntensity={0.8}>
      <mesh ref={meshRef} position={[3, -1, -3]} scale={1}>
        <torusGeometry args={[1, 0.4, 32, 64]} />
        <MeshWobbleMaterial
          color="#f97316"
          attach="material"
          factor={0.3}
          speed={2}
          roughness={0.3}
          metalness={0.7}
        />
      </mesh>
    </Float>
  );
}

// Floating glass cube
function GlassCube() {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.x = state.clock.elapsedTime * 0.15;
      meshRef.current.rotation.y = state.clock.elapsedTime * 0.25;
    }
  });

  return (
    <Float speed={1.8} rotationIntensity={0.6} floatIntensity={1.2}>
      <mesh ref={meshRef} position={[0, 2, -4]} scale={0.8}>
        <boxGeometry args={[1.5, 1.5, 1.5]} />
        <meshPhysicalMaterial
          color="#ffffff"
          transmission={0.9}
          thickness={0.5}
          roughness={0.1}
          metalness={0}
          ior={1.5}
        />
      </mesh>
    </Float>
  );
}

// Particle ring
function ParticleRing() {
  const points = useRef<THREE.Points>(null);
  const particleCount = 200;

  const geometry = useMemo(() => {
    const pos = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      const angle = (i / particleCount) * Math.PI * 2;
      const radius = 4 + Math.random() * 0.5;
      pos[i * 3] = Math.cos(angle) * radius;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 0.5;
      pos[i * 3 + 2] = Math.sin(angle) * radius - 5;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    return geo;
  }, []);

  useFrame((state) => {
    if (points.current) {
      points.current.rotation.y = state.clock.elapsedTime * 0.1;
      points.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.2) * 0.1;
    }
  });

  return (
    <points ref={points} geometry={geometry}>
      <pointsMaterial
        size={0.05}
        color="#0d9488"
        transparent
        opacity={0.6}
        sizeAttenuation
      />
    </points>
  );
}

// Flowing particles
function FlowingParticles({ mouse }: { mouse: React.MutableRefObject<{ x: number; y: number }> }) {
  const points = useRef<THREE.Points>(null);
  const particleCount = 1000;

  const { positions, colors, originalPositions } = useMemo(() => {
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);

    const teal = new THREE.Color(0x0d9488);
    const orange = new THREE.Color(0xf97316);
    const white = new THREE.Color(0xffffff);

    for (let i = 0; i < particleCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const radius = 2 + Math.random() * 5;

      positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = radius * Math.cos(phi) - 3;

      const colorMix = Math.random();
      let color: THREE.Color;
      if (colorMix < 0.4) {
        color = teal.clone().lerp(white, Math.random() * 0.3);
      } else if (colorMix < 0.7) {
        color = orange.clone().lerp(white, Math.random() * 0.3);
      } else {
        color = white.clone();
      }

      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }

    return {
      positions,
      colors,
      originalPositions: positions.slice(),
    };
  }, []);

  useFrame((state) => {
    if (!points.current) return;

    const time = state.clock.elapsedTime;
    const positionAttribute = points.current.geometry.attributes.position;

    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;
      const ox = originalPositions[i3];
      const oy = originalPositions[i3 + 1];
      const oz = originalPositions[i3 + 2];

      const waveX = Math.sin(time * 0.5 + oy * 0.5) * 0.3;
      const waveY = Math.cos(time * 0.3 + ox * 0.5) * 0.2;
      const waveZ = Math.sin(time * 0.4 + ox * 0.3) * 0.2;

      const mouseInfluenceX = mouse.current.x * 0.5;
      const mouseInfluenceY = -mouse.current.y * 0.5;

      positionAttribute.setXYZ(
        i,
        ox + waveX + mouseInfluenceX * 0.3,
        oy + waveY + mouseInfluenceY * 0.3,
        oz + waveZ
      );
    }

    positionAttribute.needsUpdate = true;
    points.current.rotation.y = time * 0.02;
  });

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return geo;
  }, [positions, colors]);

  return (
    <points ref={points} geometry={geometry}>
      <pointsMaterial
        size={0.06}
        vertexColors
        transparent
        opacity={0.7}
        sizeAttenuation
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
}

// DNA Helix
function DNAHelix() {
  const group = useRef<THREE.Group>(null);
  const sphereCount = 30;

  useFrame((state) => {
    if (group.current) {
      group.current.rotation.y = state.clock.elapsedTime * 0.2;
    }
  });

  const spheres = useMemo(() => {
    const items = [];
    for (let i = 0; i < sphereCount; i++) {
      const t = (i / sphereCount) * Math.PI * 4;
      const y = (i / sphereCount) * 6 - 3;

      // First strand
      items.push({
        position: [Math.cos(t) * 1.2, y, Math.sin(t) * 1.2 - 6] as [number, number, number],
        color: "#0d9488",
        scale: 0.08,
      });

      // Second strand
      items.push({
        position: [Math.cos(t + Math.PI) * 1.2, y, Math.sin(t + Math.PI) * 1.2 - 6] as [number, number, number],
        color: "#f97316",
        scale: 0.08,
      });
    }
    return items;
  }, []);

  return (
    <group ref={group} position={[4, 0, 0]}>
      {spheres.map((sphere, i) => (
        <mesh key={i} position={sphere.position} scale={sphere.scale}>
          <sphereGeometry args={[1, 16, 16]} />
          <meshStandardMaterial color={sphere.color} emissive={sphere.color} emissiveIntensity={0.3} />
        </mesh>
      ))}
    </group>
  );
}

export default function HeroScene() {
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
        camera={{ position: [0, 0, 8], fov: 50 }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: "transparent" }}
      >
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 5]} intensity={1} />
        <pointLight position={[-10, -10, -5]} intensity={0.5} color="#0d9488" />
        <pointLight position={[10, 10, 5]} intensity={0.5} color="#f97316" />

        <TealSphere />
        <OrangeTorus />
        <GlassCube />
        <ParticleRing />
        <FlowingParticles mouse={mouse} />
        <DNAHelix />
      </Canvas>
    </div>
  );
}
