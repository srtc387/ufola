// FIX: Implemented a performant ParticleSystem component using InstancedMesh for visual effects.

import React, { useRef, useMemo, forwardRef, useImperativeHandle } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const PARTICLE_COUNT = 100;

interface Particle {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  life: number;
  initialLife: number;
  color: THREE.Color;
}

export interface ParticleSystemRef {
  trigger: (position: THREE.Vector3, color: THREE.Color, count: number) => void;
}

const ParticleSystem = forwardRef<ParticleSystemRef, {}>((props, ref) => {
  const meshRef = useRef<THREE.InstancedMesh>(null!);
  
  const particles = useMemo<Particle[]>(() => {
    const temp: Particle[] = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      temp.push({
        position: new THREE.Vector3(0, -100, 0), // Start off-screen
        velocity: new THREE.Vector3(),
        life: 0,
        initialLife: 1,
        color: new THREE.Color(),
      });
    }
    return temp;
  }, []);

  useImperativeHandle(ref, () => ({
    trigger: (position, color, count) => {
      let triggeredCount = 0;
      for (let i = 0; i < PARTICLE_COUNT && triggeredCount < count; i++) {
        const p = particles[i];
        if (p.life <= 0) {
          p.position.copy(position);
          p.velocity.set(
            (Math.random() - 0.5) * 5,
            (Math.random() - 0.5) * 5,
            (Math.random() - 0.5) * 5
          );
          p.life = Math.random() * 0.5 + 0.5; // 0.5 to 1 second life
          p.initialLife = p.life;
          p.color.copy(color);
          triggeredCount++;
        }
      }
    },
  }));

  useFrame((state, delta) => {
    if (!meshRef.current) return;
    
    const dummy = new THREE.Object3D();
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const p = particles[i];
      if (p.life > 0) {
        p.life -= delta;
        p.velocity.y -= 2 * delta; // a bit of gravity
        p.position.addScaledVector(p.velocity, delta);

        const scale = Math.max(0, p.life / p.initialLife);
        dummy.scale.set(scale, scale, scale);
        dummy.position.copy(p.position);
        dummy.updateMatrix();
        meshRef.current.setMatrixAt(i, dummy.matrix);
        meshRef.current.setColorAt(i, p.color);
      } else {
        // Hide particle by moving it off-screen
        dummy.position.set(0, -100, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        meshRef.current.setMatrixAt(i, dummy.matrix);
      }
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) {
      meshRef.current.instanceColor.needsUpdate = true;
    }
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, PARTICLE_COUNT]}>
      <boxGeometry args={[0.1, 0.1, 0.1]} />
      <meshStandardMaterial vertexColors />
    </instancedMesh>
  );
});

export default ParticleSystem;
