import React, { useRef, Suspense, useEffect, useCallback } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { PerspectiveCamera, Stars } from '@react-three/drei';
import * as THREE from 'three';
import UFO from './UFO';
import PipeSystem, { PipeSegment } from './PipeSystem';
import ParticleSystem, { ParticleSystemRef } from './ParticleSystem';
import { GameState, Recording } from '../types';

const UFO_JUMP_VELOCITY = 6;
const GRAVITY = -15;
const UFO_RADIUS = 0.8;
const COIN_RADIUS = 0.5;

type GameMode = 'start' | 'single' | 'challenge';

interface SceneProps {
  gameMode: GameMode;
  level: number;
  onFlap: () => void;
  lastRecording: Recording | null;
  // Player 1
  p1GameState: GameState;
  onPipePass1: () => void;
  onCoinCollect1: () => void;
  onTrapHit1: () => void;
  onCrash1: () => void;
  p1FlapRef: React.MutableRefObject<() => void>;
  // Player 2
  p2GameState: GameState;
  onPipePass2: () => void;
  onCoinCollect2: () => void;
  onTrapHit2: () => void;
  onCrash2: () => void;
  p2FlapRef: React.MutableRefObject<() => void>;
}

const Scene: React.FC<SceneProps> = (props) => {
  const { gameMode, level, onFlap, lastRecording } = props;

  const ufo1Ref = useRef<THREE.Group>(null!);
  const ufo2Ref = useRef<THREE.Group>(null!);
  const pipeSystemRef = useRef<{ reset: (level: number) => void; movePipes: (delta: number, onPipePass: () => void) => void; segments: PipeSegment[] }>(null!);
  const particleSystemRef = useRef<ParticleSystemRef>(null!);
  const starsRef = useRef<THREE.Group>(null!);
  const camera2Ref = useRef<THREE.PerspectiveCamera>(null!);
  
  const ufo1Velocity = useRef(0);
  const ufo1Position = useRef(new THREE.Vector3(0, 2, 0));
  const ufo2Velocity = useRef(0);
  const ufo2Position = useRef(new THREE.Vector3(0, 2, 0));
  
  const playbackState = useRef({
    time: 0, nextFlapIndex: 0, velocity: 0, position: new THREE.Vector3(0, 2, 0),
  }).current;

  const resetPlayer = (positionRef: React.MutableRefObject<THREE.Vector3>, velocityRef: React.MutableRefObject<number>, ufoRef: React.RefObject<THREE.Group>) => {
    positionRef.current.set(0, 2, 0);
    velocityRef.current = 0;
    if (ufoRef.current) {
      ufoRef.current.position.copy(positionRef.current);
      ufoRef.current.rotation.set(0, 0, 0);
    }
  };

  const isPlaybackMode = (gameMode === 'start') && lastRecording;
  
  useEffect(() => {
    if (isPlaybackMode) {
      pipeSystemRef.current?.reset(lastRecording.level);
      playbackState.time = 0;
      playbackState.nextFlapIndex = 0;
      playbackState.velocity = 0;
      playbackState.position.set(0, 2, 0);
      if (ufo1Ref.current) ufo1Ref.current.position.copy(playbackState.position);
    } else if (props.p1GameState === 'ready' || gameMode === 'start') {
      resetPlayer(ufo1Position, ufo1Velocity, ufo1Ref);
    }
    if (props.p2GameState === 'ready') {
      resetPlayer(ufo2Position, ufo2Velocity, ufo2Ref);
    }
  }, [props.p1GameState, props.p2GameState, gameMode, isPlaybackMode, lastRecording]);


  const createFlap = useCallback((velocityRef: React.MutableRefObject<number>) => () => {
      velocityRef.current = UFO_JUMP_VELOCITY;
      onFlap();
  }, [onFlap]);

  useEffect(() => { props.p1FlapRef.current = createFlap(ufo1Velocity); }, [props.p1FlapRef, createFlap]);
  useEffect(() => { props.p2FlapRef.current = createFlap(ufo2Velocity); }, [props.p2FlapRef, createFlap]);

  const updateUFO = (delta: number, ufoRef: React.RefObject<THREE.Group>, posRef: React.MutableRefObject<THREE.Vector3>, velRef: React.MutableRefObject<number>, onCrash: () => void) => {
      if (!ufoRef.current) return;
      velRef.current += GRAVITY * delta;
      posRef.current.y += velRef.current * delta;

      if (posRef.current.y > 8) {
          posRef.current.y = 8;
          velRef.current = 0;
      }
      if (posRef.current.y < -8) {
        onCrash();
        return;
      }
      ufoRef.current.position.y = posRef.current.y;
      ufoRef.current.rotation.x = Math.max(-Math.PI / 4, Math.min(Math.PI / 4, velRef.current * 0.1));
  };
  
  const checkCollisions = (posRef: React.MutableRefObject<THREE.Vector3>, ufoRef: React.RefObject<THREE.Group>, onCrash: () => void, onCoinCollect: () => void, onTrapHit: () => void) => {
    if (!ufoRef.current || !pipeSystemRef.current) return;
    const ufoBox = new THREE.Box3().setFromObject(ufoRef.current);
    
    for (const segment of pipeSystemRef.current.segments) {
        for (const pipe of segment.pipes) {
            const pipeBox = new THREE.Box3().setFromObject(pipe, true);
            if (ufoBox.intersectsBox(pipeBox)) {
                onCrash();
                return;
            }
        }
        for (const coinObj of segment.coins) {
            if (coinObj.mesh.visible) {
                const coinPosition = new THREE.Vector3();
                coinObj.mesh.getWorldPosition(coinPosition);
                if (posRef.current.distanceTo(coinPosition) < UFO_RADIUS + COIN_RADIUS) {
                    coinObj.mesh.visible = false;
                    if (coinObj.isTrap) {
                        onTrapHit();
                        particleSystemRef.current?.trigger(coinPosition, new THREE.Color('red'), 30);
                    } else {
                        onCoinCollect();
                        particleSystemRef.current?.trigger(coinPosition, new THREE.Color('gold'), 30);
                    }
                }
            }
        }
    }
  };

  // Physics Loop
  useFrame((state, delta) => {
    const { clock } = state;
    if (isPlaybackMode && lastRecording) {
        playbackState.time += delta * 1000;
        if (playbackState.nextFlapIndex < lastRecording.flaps.length && playbackState.time >= lastRecording.flaps[playbackState.nextFlapIndex].time) {
            playbackState.velocity = UFO_JUMP_VELOCITY;
            onFlap();
            playbackState.nextFlapIndex++;
        }
        playbackState.velocity += GRAVITY * delta;
        playbackState.position.y += playbackState.velocity * delta;
        if (playbackState.position.y < -8 || playbackState.position.y > 8) {
            pipeSystemRef.current?.reset(lastRecording.level);
            playbackState.time = 0;
            playbackState.nextFlapIndex = 0;
            playbackState.velocity = 0;
            playbackState.position.set(0, 2, 0);
        }
        ufo1Ref.current.position.y = playbackState.position.y;
        ufo1Ref.current.rotation.x = Math.max(-Math.PI / 4, Math.min(Math.PI / 4, playbackState.velocity * 0.1));
        pipeSystemRef.current?.movePipes(delta, () => {});
    }

    if (gameMode === 'start') {
        if (ufo1Ref.current) {
            ufo1Ref.current.position.y = 2 + Math.sin(clock.getElapsedTime() * 0.7) * 0.4;
            ufo1Ref.current.rotation.y = Math.sin(clock.getElapsedTime() * 0.3) * 0.4;
        }
        if (starsRef.current) {
            starsRef.current.rotation.y += delta * 0.01;
            starsRef.current.rotation.x += delta * 0.005;
        }
        return;
    }

    if (props.p1GameState === 'levelComplete') {
        if (ufo1Ref.current) {
            ufo1Ref.current.position.z -= delta * 15;
            ufo1Ref.current.position.y += delta * 2;
            ufo1Ref.current.rotation.x = -Math.PI / 8;
        }
        return;
    }

    if (props.p1GameState === 'playing') {
      const handleCrash1 = () => {
        if (gameMode === 'single') {
          particleSystemRef.current?.trigger(ufo1Position.current, new THREE.Color('orange'), 50);
        }
        props.onCrash1();
      };
      updateUFO(delta, ufo1Ref, ufo1Position, ufo1Velocity, handleCrash1);
      checkCollisions(ufo1Position, ufo1Ref, handleCrash1, props.onCoinCollect1, props.onTrapHit1);
      pipeSystemRef.current?.movePipes(delta, props.onPipePass1);
    }
    
    if (gameMode === 'challenge' && props.p2GameState === 'playing') {
        updateUFO(delta, ufo2Ref, ufo2Position, ufo2Velocity, props.onCrash2);
        checkCollisions(ufo2Position, ufo2Ref, props.onCrash2, props.onCoinCollect2, props.onTrapHit2);
        // Pipes are moved by Player 1's update loop
    }
  });

  // Render Loop
  useFrame(({ gl, scene, camera }) => {
    if (gameMode === 'challenge') {
      gl.autoClear = false;
      gl.clear();
      const { width, height } = gl.domElement;
      const aspect = (width / 2) / height;

      // Player 1
      camera.aspect = aspect;
      camera.updateProjectionMatrix();
      gl.setViewport(0, 0, width / 2, height);
      gl.setScissor(0, 0, width / 2, height);
      gl.setScissorTest(true);
      if(ufo2Ref.current) ufo2Ref.current.visible = false;
      if(ufo1Ref.current) ufo1Ref.current.visible = true;
      gl.render(scene, camera);

      // Player 2
      if (camera2Ref.current) {
        camera2Ref.current.position.copy(camera.position);
        camera2Ref.current.quaternion.copy(camera.quaternion);
        camera2Ref.current.scale.x = -1; // Mirror view
        camera2Ref.current.aspect = aspect;
        camera2Ref.current.updateProjectionMatrix();
        gl.setViewport(width / 2, 0, width / 2, height);
        gl.setScissor(width / 2, 0, width / 2, height);
        if(ufo1Ref.current) ufo1Ref.current.visible = false;
        if(ufo2Ref.current) ufo2Ref.current.visible = true;
        gl.render(scene, camera2Ref.current);
      }
      if(ufo1Ref.current) ufo1Ref.current.visible = true;
    } else {
      // Single player or start mode
      const { width, height } = gl.domElement;
      
      // Reset camera aspect for full screen if it was changed
      if (camera.aspect !== width / height) {
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
      }
      
      if(ufo2Ref.current) ufo2Ref.current.visible = false;
      if(ufo1Ref.current) ufo1Ref.current.visible = true;

      gl.autoClear = true;
      gl.setScissorTest(false);
      gl.setViewport(0, 0, width, height);
      gl.render(scene, camera);
    }
  }, 1);

  return (
    <Suspense fallback={null}>
      <fog attach="fog" args={['#050510', 15, 35]} />
      <ambientLight intensity={0.3} />
      <pointLight position={[10, 10, 10]} intensity={1.2} />
      <directionalLight 
        position={[-10, 15, 5]} 
        intensity={1.5} 
        castShadow 
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />

      <PerspectiveCamera makeDefault position={[4.23, 2, 9.06]} fov={75} />
      <PerspectiveCamera ref={camera2Ref} fov={75} />

      <group ref={starsRef}>
        <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
      </group>

      <UFO ref={ufo1Ref} gameState={props.p1GameState} />
      {gameMode === 'challenge' && <UFO ref={ufo2Ref} gameState={props.p2GameState} />}

      <PipeSystem ref={pipeSystemRef} level={level} gameState={props.p1GameState} />
      <ParticleSystem ref={particleSystemRef} />
    </Suspense>
  );
};

export default Scene;