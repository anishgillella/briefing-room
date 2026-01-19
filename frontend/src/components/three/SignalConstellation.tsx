"use client";

import { useRef, useMemo, useCallback, useEffect, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

// =============================================================================
// CONSTELLATION NODE
// =============================================================================

interface Node {
  position: THREE.Vector3;
  originalPosition: THREE.Vector3;
  velocity: THREE.Vector3;
  brightness: number;
  targetBrightness: number;
}

// =============================================================================
// CONSTELLATION LINES - Lines connecting nearby nodes
// =============================================================================

function ConstellationLines({
  nodes,
  maxDistance = 2.5,
}: {
  nodes: Node[];
  maxDistance?: number;
}) {
  const linesRef = useRef<THREE.LineSegments>(null);

  const geometry = useMemo(() => {
    const positions: number[] = [];
    const colors: number[] = [];

    // Pre-allocate max possible connections
    const maxConnections = nodes.length * 6;
    for (let i = 0; i < maxConnections * 6; i++) {
      positions.push(0);
      colors.push(0);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3)
    );
    geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    geo.setDrawRange(0, 0);

    return geo;
  }, [nodes.length]);

  useFrame(() => {
    if (!linesRef.current) return;

    const positionAttr = linesRef.current.geometry.attributes
      .position as THREE.BufferAttribute;
    const colorAttr = linesRef.current.geometry.attributes
      .color as THREE.BufferAttribute;

    let lineIndex = 0;
    const primaryColor = new THREE.Color("#4F7CFF");
    const secondaryColor = new THREE.Color("#38BDF8");

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dist = nodes[i].position.distanceTo(nodes[j].position);

        if (dist < maxDistance && lineIndex < nodes.length * 3) {
          const opacity = 1 - dist / maxDistance;
          const avgBrightness = (nodes[i].brightness + nodes[j].brightness) / 2;
          const finalOpacity = opacity * 0.4 * (0.5 + avgBrightness * 0.5);

          const color = primaryColor.clone().lerp(secondaryColor, avgBrightness);

          positionAttr.setXYZ(
            lineIndex * 2,
            nodes[i].position.x,
            nodes[i].position.y,
            nodes[i].position.z
          );
          positionAttr.setXYZ(
            lineIndex * 2 + 1,
            nodes[j].position.x,
            nodes[j].position.y,
            nodes[j].position.z
          );

          colorAttr.setXYZ(
            lineIndex * 2,
            color.r * finalOpacity,
            color.g * finalOpacity,
            color.b * finalOpacity
          );
          colorAttr.setXYZ(
            lineIndex * 2 + 1,
            color.r * finalOpacity,
            color.g * finalOpacity,
            color.b * finalOpacity
          );

          lineIndex++;
        }
      }
    }

    positionAttr.needsUpdate = true;
    colorAttr.needsUpdate = true;
    linesRef.current.geometry.setDrawRange(0, lineIndex * 2);
  });

  return (
    <lineSegments ref={linesRef} geometry={geometry}>
      <lineBasicMaterial
        vertexColors
        transparent
        opacity={1}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </lineSegments>
  );
}

// =============================================================================
// CONSTELLATION POINTS - The actual nodes/particles
// =============================================================================

function ConstellationPoints({
  nodes,
  onPulse,
}: {
  nodes: Node[];
  onPulse?: () => void;
}) {
  const pointsRef = useRef<THREE.Points>(null);
  const pulseTimeRef = useRef(0);
  const pulseCenterRef = useRef(new THREE.Vector3(0, 0, 0));

  const geometry = useMemo(() => {
    const positions = new Float32Array(nodes.length * 3);
    const colors = new Float32Array(nodes.length * 3);
    const sizes = new Float32Array(nodes.length);

    nodes.forEach((node, i) => {
      positions[i * 3] = node.position.x;
      positions[i * 3 + 1] = node.position.y;
      positions[i * 3 + 2] = node.position.z;

      colors[i * 3] = 0.31; // R for #4F7CFF
      colors[i * 3 + 1] = 0.49; // G
      colors[i * 3 + 2] = 1.0; // B

      sizes[i] = 0.08;
    });

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    geo.setAttribute("size", new THREE.Float32BufferAttribute(sizes, 1));

    return geo;
  }, [nodes]);

  // Trigger pulse periodically
  useEffect(() => {
    const interval = setInterval(() => {
      pulseTimeRef.current = 0;
      pulseCenterRef.current.set(
        (Math.random() - 0.5) * 4,
        (Math.random() - 0.5) * 3,
        -2
      );
      onPulse?.();
    }, 5000);

    return () => clearInterval(interval);
  }, [onPulse]);

  useFrame((state, delta) => {
    if (!pointsRef.current) return;

    const time = state.clock.elapsedTime;
    pulseTimeRef.current += delta;

    const positionAttr = pointsRef.current.geometry.attributes
      .position as THREE.BufferAttribute;
    const colorAttr = pointsRef.current.geometry.attributes
      .color as THREE.BufferAttribute;
    const sizeAttr = pointsRef.current.geometry.attributes
      .size as THREE.BufferAttribute;

    const primaryColor = new THREE.Color("#4F7CFF");
    const brightColor = new THREE.Color("#38BDF8");
    const pulseRadius = pulseTimeRef.current * 3;

    nodes.forEach((node, i) => {
      // Gentle floating motion
      const floatX = Math.sin(time * 0.3 + i * 0.5) * 0.1;
      const floatY = Math.cos(time * 0.2 + i * 0.7) * 0.1;

      node.position.x = node.originalPosition.x + floatX;
      node.position.y = node.originalPosition.y + floatY;

      // Calculate distance from pulse center
      const distFromPulse = node.position.distanceTo(pulseCenterRef.current);
      const pulseEffect =
        Math.abs(distFromPulse - pulseRadius) < 1.0
          ? Math.exp(-Math.pow(distFromPulse - pulseRadius, 2) * 2)
          : 0;

      // Update brightness
      node.targetBrightness = pulseEffect;
      node.brightness += (node.targetBrightness - node.brightness) * 0.1;

      // Update position
      positionAttr.setXYZ(i, node.position.x, node.position.y, node.position.z);

      // Update color based on brightness
      const color = primaryColor.clone().lerp(brightColor, node.brightness);
      colorAttr.setXYZ(i, color.r, color.g, color.b);

      // Update size
      sizeAttr.setX(i, 0.08 + node.brightness * 0.08);
    });

    positionAttr.needsUpdate = true;
    colorAttr.needsUpdate = true;
    sizeAttr.needsUpdate = true;
  });

  return (
    <points ref={pointsRef} geometry={geometry}>
      <pointsMaterial
        vertexColors
        size={0.1}
        sizeAttenuation
        transparent
        opacity={0.9}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
}

// =============================================================================
// CAMERA CONTROLLER - Subtle parallax based on mouse
// =============================================================================

function CameraController({ mouse }: { mouse: React.MutableRefObject<{ x: number; y: number }> }) {
  const { camera } = useThree();

  useFrame(() => {
    // Subtle camera movement based on mouse position
    camera.position.x = mouse.current.x * 0.5;
    camera.position.y = mouse.current.y * 0.3;
    camera.lookAt(0, 0, -3);
  });

  return null;
}

// =============================================================================
// MAIN CONSTELLATION SCENE
// =============================================================================

function ConstellationScene({
  nodeCount = 50,
  mouse,
  onInputFocus,
}: {
  nodeCount?: number;
  mouse: React.MutableRefObject<{ x: number; y: number }>;
  onInputFocus?: boolean;
}) {
  const nodes = useMemo(() => {
    const nodeArray: Node[] = [];

    for (let i = 0; i < nodeCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const radius = 2 + Math.random() * 4;

      const x = radius * Math.sin(phi) * Math.cos(theta);
      const y = radius * Math.sin(phi) * Math.sin(theta) * 0.6; // Flatten vertically
      const z = radius * Math.cos(phi) - 4;

      nodeArray.push({
        position: new THREE.Vector3(x, y, z),
        originalPosition: new THREE.Vector3(x, y, z),
        velocity: new THREE.Vector3(0, 0, 0),
        brightness: 0,
        targetBrightness: 0,
      });
    }

    return nodeArray;
  }, [nodeCount]);

  // Brighten nodes when input is focused
  useEffect(() => {
    if (onInputFocus) {
      // Brighten a cluster of nodes
      const centerIndex = Math.floor(Math.random() * nodes.length);
      const center = nodes[centerIndex].position;

      nodes.forEach((node) => {
        const dist = node.position.distanceTo(center);
        if (dist < 2) {
          node.targetBrightness = 1 - dist / 2;
        }
      });
    }
  }, [onInputFocus, nodes]);

  return (
    <>
      <CameraController mouse={mouse} />
      <ambientLight intensity={0.2} />
      <ConstellationPoints nodes={nodes} />
      <ConstellationLines nodes={nodes} maxDistance={2.0} />
    </>
  );
}

// =============================================================================
// SIGNAL CONSTELLATION COMPONENT (Exported)
// =============================================================================

interface SignalConstellationProps {
  className?: string;
  nodeCount?: number;
  onInputFocus?: boolean;
}

export default function SignalConstellation({
  className = "",
  nodeCount = 50,
  onInputFocus = false,
}: SignalConstellationProps) {
  const mouse = useRef({ x: 0, y: 0 });
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    // Check for reduced motion preference
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mediaQuery.matches);

    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    mouse.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  }, []);

  // Reduce node count on mobile
  const actualNodeCount = typeof window !== "undefined" && window.innerWidth < 768 ? Math.min(nodeCount, 24) : nodeCount;

  if (reducedMotion) {
    // Static fallback for reduced motion
    return (
      <div className={`absolute inset-0 ${className}`}>
        <div
          className="absolute inset-0"
          style={{
            background: `
              radial-gradient(ellipse 60% 40% at 30% 40%, rgba(79, 124, 255, 0.15), transparent),
              radial-gradient(ellipse 50% 30% at 70% 60%, rgba(56, 189, 248, 0.1), transparent)
            `,
          }}
        />
      </div>
    );
  }

  return (
    <div
      className={`absolute inset-0 ${className}`}
      onMouseMove={handleMouseMove}
    >
      <Canvas
        camera={{ position: [0, 0, 5], fov: 60 }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: "transparent" }}
        dpr={[1, 1.5]}
      >
        <ConstellationScene
          nodeCount={actualNodeCount}
          mouse={mouse}
          onInputFocus={onInputFocus}
        />
      </Canvas>
    </div>
  );
}
