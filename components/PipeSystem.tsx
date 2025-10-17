import React, { forwardRef, useMemo, useRef, useImperativeHandle, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import { GameState } from '../types';
import { getLevelConfig, LevelConfig } from '../levelConfig';

// Constants
const PIPE_RADIUS = 1.2;
const PIPE_HEIGHT = 20;
const NUM_PIPE_SEGMENTS = 5; // Number of pipe pairs to pool
const LEVEL_RECYCLE_Z = 15; // Z-coordinate past which pipes are recycled
const COINLESS_GAP_REDUCTION = 0.5; // How much smaller the gap is for pipes without coins

// Create Star Geometry
const starShape = new THREE.Shape();
const outerRadius = 0.6;
const innerRadius = 0.3;
const points = 5;
starShape.moveTo(0, outerRadius);
for (let i = 0; i < points * 2; i++) {
    const radius = i % 2 === 0 ? outerRadius : innerRadius;
    const angle = (i * Math.PI) / points;
    starShape.lineTo(Math.sin(angle) * radius, Math.cos(angle) * radius);
}
const extrudeSettings = { steps: 1, depth: 0.15, bevelEnabled: false };
const STAR_GEOMETRY = new THREE.ExtrudeGeometry(starShape, extrudeSettings);
STAR_GEOMETRY.center();

const TRAP_GEOMETRY = new THREE.SphereGeometry(0.5, 8, 6);

// Reusable Materials
const COIN_MATERIAL = new THREE.MeshStandardMaterial({ color: 'gold', emissive: 'yellow', emissiveIntensity: 0.5 });
const TRAP_MATERIAL = new THREE.MeshStandardMaterial({ color: 'red', emissive: 'darkred', emissiveIntensity: 0.5 });
const PIPE_GEOMETRY = new THREE.CylinderGeometry(PIPE_RADIUS, PIPE_RADIUS, PIPE_HEIGHT, 32);
const PIPE_CAP_GEOMETRY = new THREE.CylinderGeometry(PIPE_RADIUS * 1.1, PIPE_RADIUS * 1.1, 0.2, 32);

export interface CoinObject {
  mesh: THREE.Mesh;
  isTrap: boolean;
}

export interface PipeSegment {
  pipes: THREE.Group[];
  coins: CoinObject[];
  passed: boolean;
  positionZ: number;
}

interface PipeSystemProps {
  level: number;
  gameState: GameState;
}

type PipeSystemRef = {
  movePipes: (delta: number, onPipePass: () => void) => void;
  segments: PipeSegment[];
  reset: (level: number) => void;
};

const PipeSystem = forwardRef<PipeSystemRef, PipeSystemProps>(({ level, gameState }, ref) => {
  const groupRef = useRef<THREE.Group>(null!);
  const segments = useRef<PipeSegment[]>([]);
  const pipeMaterial = useRef(new THREE.MeshStandardMaterial({ color: '#4CAF50', metalness: 0.6, roughness: 0.4 }));
  const pipeGenerationCounter = useRef(0);

  const createPipe = () => {
    const pipe = new THREE.Mesh(PIPE_GEOMETRY, pipeMaterial.current);
    const cap = new THREE.Mesh(PIPE_CAP_GEOMETRY, pipeMaterial.current);
    cap.position.y = PIPE_HEIGHT / 2;
    const pipeGroup = new THREE.Group();
    pipeGroup.add(pipe, cap);
    pipeGroup.castShadow = true;
    pipeGroup.receiveShadow = true;
    return pipeGroup;
  };

  const createCoinObject = (): CoinObject => {
    const mesh = new THREE.Mesh(STAR_GEOMETRY, COIN_MATERIAL);
    mesh.castShadow = true;
    return { mesh, isTrap: false };
  };

  const resetPipeSegment = useCallback((segment: PipeSegment, zPosition: number, config: LevelConfig, pipeIndex: number) => {
    segment.positionZ = zPosition;
    segment.passed = false;
    
    // If this pipe is beyond the defined number for the level, hide it.
    if (config.pipeCount > 0 && pipeIndex >= config.pipeCount) {
        segment.pipes.forEach(p => p.visible = false);
        segment.coins.forEach(c => c.mesh.visible = false);
        segment.passed = true; // Prevent scoring for invisible pipes
        return;
    }
    
    // Ensure recycled pipes are visible
    segment.pipes.forEach(p => p.visible = true);
    
    const gapCenter = Math.random() * 8 - 4; // -4 to +4
    
    segment.pipes.forEach(p => p.position.z = zPosition);

    let coinCount = 0;
    const willHaveCoins = Math.random() < config.coinChance;

    // Determine gap height based on whether there will be coins
    const currentGapHeight = willHaveCoins ? config.gapHeight : config.gapHeight - COINLESS_GAP_REDUCTION;

    // Set pipe positions using the new dynamic gap height
    segment.pipes[0].position.y = gapCenter + currentGapHeight / 2 + PIPE_HEIGHT / 2;
    segment.pipes[1].position.y = gapCenter - currentGapHeight / 2 - PIPE_HEIGHT / 2;

    if (willHaveCoins) {
      // Determine if this segment should have a coin tower based on level progress.
      const progress = config.pipeCount > 0 ? Math.max(0, pipeIndex) / config.pipeCount : 0;
      const TOWER_START_PROGRESS = 0.2; // Towers start appearing after 20% of the level.
      const MAX_TOWER_CHANCE = 0.5; // Max chance for a tower is 50% at the end of the level.
      let towerChance = 0;
      if (progress > TOWER_START_PROGRESS) {
          const normalizedProgress = (progress - TOWER_START_PROGRESS) / (1.0 - TOWER_START_PROGRESS);
          towerChance = Math.min(1.0, normalizedProgress) * MAX_TOWER_CHANCE;
      }
      
      const hasTower = Math.random() < towerChance;
      coinCount = hasTower ? 3 : 1;
    }
    
    for(let i=0; i<3; i++) {
        const coinObj = segment.coins[i];
        if (i < coinCount) {
            let isTrap = Math.random() < config.trapChance;
            if (coinCount === 1) isTrap = false; // Single coins are never traps
            
            const positionIndex = (coinCount === 1) ? 1 : i; // Center single coin
            if (isTrap && positionIndex === 1) isTrap = false; // Middle of tower is never a trap

            coinObj.isTrap = isTrap;
            coinObj.mesh.geometry = isTrap ? TRAP_GEOMETRY : STAR_GEOMETRY;
            coinObj.mesh.material = isTrap ? TRAP_MATERIAL : COIN_MATERIAL;
            coinObj.mesh.position.set(0, gapCenter + (positionIndex - 1) * 1.8, zPosition);
            coinObj.mesh.visible = true;
        } else {
            coinObj.mesh.visible = false;
        }
    }
  }, []);

  const initializeAndReset = useCallback((levelToInit: number) => {
    const config = getLevelConfig(levelToInit);
    pipeMaterial.current.color.set(config.color);

    if (segments.current.length === 0) {
      for (let i = 0; i < NUM_PIPE_SEGMENTS; i++) {
        const segment: PipeSegment = {
          pipes: [createPipe(), createPipe()],
          coins: [createCoinObject(), createCoinObject(), createCoinObject()],
          passed: false,
          positionZ: 0,
        };
        segment.pipes[1].rotation.x = Math.PI;
        groupRef.current.add(...segment.pipes, ...segment.coins.map(c => c.mesh));
        segments.current.push(segment);
      }
    }

    segments.current.forEach((segment, i) => {
      resetPipeSegment(segment, -i * config.pipeSpacing - 15, config, i);
    });
    pipeGenerationCounter.current = NUM_PIPE_SEGMENTS;

  }, [resetPipeSegment]);


  useEffect(() => {
    if (gameState === 'ready' || gameState === 'start') {
        initializeAndReset(level);
    }
  }, [level, gameState, initializeAndReset]);

  const movePipes = (delta: number, onPipePass: () => void) => {
    const config = getLevelConfig(level);
    const moveZ = config.gameSpeed * delta;
    const totalCycleDistance = NUM_PIPE_SEGMENTS * config.pipeSpacing;

    for (const segment of segments.current) {
        segment.positionZ += moveZ;

        if (segment.positionZ > LEVEL_RECYCLE_Z) {
            resetPipeSegment(segment, segment.positionZ - totalCycleDistance, config, pipeGenerationCounter.current);
            pipeGenerationCounter.current++;
        } else {
            segment.pipes.forEach(p => p.position.z = segment.positionZ);
            segment.coins.forEach(c => c.mesh.position.z = segment.positionZ);
        }
        
        // Animate coins
        segment.coins.forEach(coinObj => {
            if (coinObj.mesh.visible && !coinObj.isTrap) {
                coinObj.mesh.rotation.y += delta * 2;
            }
        });
        
        if (!segment.passed && segment.positionZ > 0) {
            segment.passed = true;
            onPipePass();
        }
    }
  };

  useImperativeHandle(ref, () => ({
    movePipes,
    segments: segments.current,
    reset: initializeAndReset,
  }));

  return <group ref={groupRef} />;
});

export default PipeSystem;