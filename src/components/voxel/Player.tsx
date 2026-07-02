"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { PointerLockControls } from "@react-three/drei";
import * as THREE from "three";

export type MovementMode = "fps" | "fly";

interface PlayerProps {
  onLock: () => void;
  onUnlock: () => void;
  onModeChange?: (mode: MovementMode) => void;
  enabled?: boolean;
}

const GROUND_Y = 4;       // eye-level height in voxel units (y=0 is ground plane, blocks are 2 units)
const GRAVITY = -0.5;     // gravity pull per frame
const JUMP_FORCE = 1.2;   // initial upward velocity on jump
const MOVE_SPEED = 0.3;
const SPRINT_MULT = 2.0;
const FLY_SPEED = 0.4;
const FLY_SPRINT = 2.5;

export function Player({ onLock, onUnlock, onModeChange, enabled = true }: PlayerProps) {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);
  const [mode, setMode] = useState<MovementMode>("fps");
  const velocityY = useRef(0);
  const isGrounded = useRef(true);

  const keys = useRef({
    w: false, a: false, s: false, d: false,
    shift: false, space: false, c: false,
  });

  // Spawn position
  useEffect(() => {
    camera.position.set(0, GROUND_Y, 60);
    camera.lookAt(0, GROUND_Y, 0);
  }, [camera]);

  // Toggle mode with F key
  const toggleMode = useCallback(() => {
    setMode(prev => {
      const next = prev === "fps" ? "fly" : "fps";
      onModeChange?.(next);
      return next;
    });
  }, [onModeChange]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key === "w") keys.current.w = true;
      if (key === "a") keys.current.a = true;
      if (key === "s") keys.current.s = true;
      if (key === "d") keys.current.d = true;
      if (key === " ") { keys.current.space = true; e.preventDefault(); }
      if (key === "c") keys.current.c = true;
      if (key === "f") toggleMode();
      if (e.shiftKey) keys.current.shift = true;
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key === "w") keys.current.w = false;
      if (key === "a") keys.current.a = false;
      if (key === "s") keys.current.s = false;
      if (key === "d") keys.current.d = false;
      if (key === " ") keys.current.space = false;
      if (key === "c") keys.current.c = false;
      keys.current.shift = e.shiftKey;
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [toggleMode]);

  const direction = useRef(new THREE.Vector3());
  const frontVector = useRef(new THREE.Vector3());
  const sideVector = useRef(new THREE.Vector3());

  useFrame(() => {
    if (!enabled) return;

    const k = keys.current;
    const sprint = k.shift;

    if (mode === "fps") {
      // ── FPS Ground Mode ──
      // Horizontal movement only (camera.rotation applied, but Y component zeroed)
      frontVector.current.set(0, 0, Number(k.s) - Number(k.w));
      sideVector.current.set(Number(k.a) - Number(k.d), 0, 0);

      direction.current
        .subVectors(frontVector.current, sideVector.current)
        .normalize()
        .multiplyScalar(MOVE_SPEED * (sprint ? SPRINT_MULT : 1))
        .applyEuler(camera.rotation);

      // Zero out vertical movement from looking up/down
      direction.current.y = 0;

      camera.position.x += direction.current.x;
      camera.position.z += direction.current.z;

      // Gravity + Jump
      if (k.space && isGrounded.current) {
        velocityY.current = JUMP_FORCE;
        isGrounded.current = false;
      }

      velocityY.current += GRAVITY * 0.1; // dampen gravity per frame
      camera.position.y += velocityY.current;

      // Ground collision
      if (camera.position.y <= GROUND_Y) {
        camera.position.y = GROUND_Y;
        velocityY.current = 0;
        isGrounded.current = true;
      }

    } else {
      // ── Fly Mode ──
      frontVector.current.set(0, 0, Number(k.s) - Number(k.w));
      sideVector.current.set(Number(k.a) - Number(k.d), 0, 0);

      direction.current
        .subVectors(frontVector.current, sideVector.current)
        .normalize()
        .multiplyScalar(FLY_SPEED * (sprint ? FLY_SPRINT : 1))
        .applyEuler(camera.rotation);

      camera.position.x += direction.current.x;
      camera.position.y += direction.current.y;
      camera.position.z += direction.current.z;

      // Vertical override
      if (k.space) camera.position.y += FLY_SPEED * (sprint ? FLY_SPRINT : 1);
      if (k.c) camera.position.y -= FLY_SPEED * (sprint ? FLY_SPRINT : 1);
    }
  });

  if (!enabled) return null;

  return <PointerLockControls ref={controlsRef} onLock={onLock} onUnlock={onUnlock} pointerSpeed={1.8} />;
}
