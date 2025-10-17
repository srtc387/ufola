
import React, { forwardRef, useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group, Mesh } from 'three';
import { GameState } from '../types';

interface UFOProps {
  gameState: GameState;
}

const UFO = forwardRef<Group, UFOProps>(({ gameState }, ref) => {
  const bodyRef = useRef<Group>(null!);
  const landingAnimProgress = useRef(-1); // -1 means not animating

  // Subtle hover animation
  useFrame(({ clock }) => {
    if (bodyRef.current && (gameState === 'playing' || gameState === 'ready' || gameState === 'start')) {
        bodyRef.current.position.y = Math.sin(clock.getElapsedTime() * 4) * 0.1;
    }
  });

  // Landing animation logic
  useFrame((_, delta) => {
    if (gameState === 'gameOver' && landingAnimProgress.current === -1) {
        // Start animation on game over
        landingAnimProgress.current = 0;
    }

    if (landingAnimProgress.current >= 0 && landingAnimProgress.current <= 1) {
        // Slower, more pronounced animation
        landingAnimProgress.current += delta * 2.5; // Animation speed adjusted

        // Squash and stretch effect using a sine wave, with more intensity
        const squash = 1 + Math.sin(landingAnimProgress.current * Math.PI) * 0.4;
        bodyRef.current.scale.y = 1 / squash;
        bodyRef.current.scale.x = squash;
        bodyRef.current.scale.z = squash;

        if (landingAnimProgress.current > 1) {
            landingAnimProgress.current = -2; // Animation finished
            // Reset scale
            bodyRef.current.scale.set(1, 1, 1);
        }
    }
  });

  // Reset animation state when restarting
  useEffect(() => {
    if (gameState === 'ready') {
        landingAnimProgress.current = -1;
        if(bodyRef.current) {
            bodyRef.current.scale.set(1, 1, 1);
        }
    }
  }, [gameState]);


  return (
    <group ref={ref}>
        <group ref={bodyRef}>
            {/* Main Saucer Body */}
            <mesh position={[0, 0, 0]} castShadow>
                <cylinderGeometry args={[1, 1, 0.4, 32]} />
                <meshStandardMaterial color="#c0c0c0" metalness={0.8} roughness={0.2} />
            </mesh>
            {/* Cockpit Dome */}
            <mesh position={[0, 0.2, 0]} castShadow>
                <sphereGeometry args={[0.6, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
                <meshStandardMaterial color="#87CEEB" transparent opacity={0.6} emissive="#00FFFF" emissiveIntensity={1.0} />
            </mesh>
            {/* Underside Light */}
            <mesh position={[0, -0.2, 0]}>
                <cylinderGeometry args={[0.3, 0.5, 0.2, 32]} />
                <meshStandardMaterial color="#FFFF00" emissive="#FFFF00" emissiveIntensity={1.5} />
            </mesh>
        </group>
    </group>
  );
});

export default UFO;