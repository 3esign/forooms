"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { PointerLockControls as PLControls } from "three-stdlib";
import * as THREE from "three";

export type MovementMode = "fps" | "fly";

interface PlayerProps {
  onLock: () => void;
  onUnlock: () => void;
  onModeChange?: (mode: MovementMode) => void;
  onInteract?: (intersect: THREE.Intersection | null, button: number) => void;
  enabled?: boolean;
  getBlock?: (x: number, y: number, z: number) => number;
  onMove?: (x: number, y: number, z: number) => void;
  onSelectIndex?: (index: number) => void;
  teleportPos?: { x: number; y: number; z: number } | null;
}

const GROUND_Y = 2.0;       // eye-level height in voxel units (y=0 is ground plane, blocks are 1 unit)
const GRAVITY = -0.5;     // gravity pull per frame
const JUMP_FORCE = 0.55;   // initial upward velocity on jump - reduced for realistic feel
const MOVE_SPEED = 0.08;   // Slower, realistic walking speed
const SPRINT_MULT = 1.85;   // Running multiplier
const FLY_SPEED = 0.2;
const FLY_SPRINT = 2.2;
const INTERACT_DISTANCE = 30;

export function Player({ onLock, onUnlock, onModeChange, onInteract, enabled = true, getBlock, onMove, onSelectIndex, teleportPos }: PlayerProps) {
  const { camera, gl, scene } = useThree();
  const controlsRef = useRef<PLControls | null>(null);
  const enabledRef = useRef(enabled);
  const [mode, setMode] = useState<MovementMode>("fps");
  const velocityY = useRef(0);
  const isGrounded = useRef(true);

  const keys = useRef({
    w: false, a: false, s: false, d: false,
    arrowup: false, arrowdown: false, arrowleft: false, arrowright: false,
    shift: false, space: false, c: false,
  });

  const lastSentPos = useRef({ x: 0, y: 0, z: 0, t: 0 });
  const lastInteractTime = useRef(0);

  const checkCollision = useCallback((pos: THREE.Vector3): boolean => {
    if (!getBlock) return false;
    
    const minX = pos.x - 0.3;
    const maxX = pos.x + 0.3;
    const minZ = pos.z - 0.3;
    const maxZ = pos.z + 0.3;
    const minY = pos.y - 1.5; // feet level relative to eye-level
    const maxY = pos.y + 0.2; // head level
    
    const startX = Math.floor(minX);
    const endX = Math.ceil(maxX);
    const startY = Math.floor(minY);
    const endY = Math.ceil(maxY);
    const startZ = Math.floor(minZ);
    const endZ = Math.ceil(maxZ);
    
    for (let x = startX; x <= endX; x++) {
      for (let y = startY; y <= endY; y++) {
        for (let z = startZ; z <= endZ; z++) {
          const blockId = getBlock(x, y, z);
          if (blockId !== 0 && blockId !== 7) { // 0: Air, 7: Water
            const blockMinX = x - 0.5;
            const blockMaxX = x + 0.5;
            const blockMinY = y - 0.5;
            const blockMaxY = y + 0.5;
            const blockMinZ = z - 0.5;
            const blockMaxZ = z + 0.5;
            
            // Allow player to step up small elevations (like stepping onto sidewalk or road)
            const isStepUp = (minY >= blockMaxY - 0.35);
            if (isStepUp) continue;
            
            const overlapX = minX < blockMaxX && maxX > blockMinX;
            const overlapY = minY < blockMaxY && maxY > blockMinY;
            const overlapZ = minZ < blockMaxZ && maxZ > blockMinZ;
            
            if (overlapX && overlapY && overlapZ) {
              return true;
            }
          }
        }
      }
    }
    return false;
  }, [getBlock]);

  // Spawn position (center of selected region, eye level 2.0)
  useEffect(() => {
    camera.position.set(0, 2.0, 0);
    camera.lookAt(0, 2.0, -5);
  }, [camera]);

  // Teleport listener
  useEffect(() => {
    if (teleportPos) {
      // Set camera slightly above target coordinate (ground is at 0.5, eye height is 1.5 => target y should be 2.0)
      const targetY = teleportPos.y === 0 ? 1.98 : teleportPos.y + 1.5;
      camera.position.set(teleportPos.x, targetY, teleportPos.z);
      camera.lookAt(teleportPos.x, targetY, teleportPos.z - 5);
      velocityY.current = 0;
    }
  }, [teleportPos, camera]);

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
      if (key === "w" || key === "arrowup") { keys.current.w = true; keys.current.arrowup = true; }
      if (key === "a" || key === "arrowleft") { keys.current.a = true; keys.current.arrowleft = true; }
      if (key === "s" || key === "arrowdown") { keys.current.s = true; keys.current.arrowdown = true; }
      if (key === "d" || key === "arrowright") { keys.current.d = true; keys.current.arrowright = true; }
      if (key === " ") { keys.current.space = true; e.preventDefault(); }
      if (key === "arrowup" || key === "arrowdown" || key === "arrowleft" || key === "arrowright") e.preventDefault();
      if (key === "c") keys.current.c = true;
      if (key === "f") toggleMode();
      if (key === "1") onSelectIndex?.(0);
      if (key === "2") onSelectIndex?.(1);
      if (key === "3") onSelectIndex?.(2);
      if (key === "4") onSelectIndex?.(3);
      if (key === "5") onSelectIndex?.(4);
      if (key === "6") onSelectIndex?.(5);
      if (key === "shift") keys.current.shift = true;
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key === "w" || key === "arrowup") { keys.current.w = false; keys.current.arrowup = false; }
      if (key === "a" || key === "arrowleft") { keys.current.a = false; keys.current.arrowleft = false; }
      if (key === "s" || key === "arrowdown") { keys.current.s = false; keys.current.arrowdown = false; }
      if (key === "d" || key === "arrowright") { keys.current.d = false; keys.current.arrowright = false; }
      if (key === " ") keys.current.space = false;
      if (key === "c") keys.current.c = false;
      if (key === "shift") keys.current.shift = false;
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [toggleMode]);

  useEffect(() => {
    const handlePointerDown = (e: MouseEvent) => {
      const now = Date.now();
      if (now - lastInteractTime.current < 250) return; // Prevent double placements/deletions on single click (250ms throttle)

      const isLocked = !!document.pointerLockElement;
      
      // If unlocked, we only allow right-click (inspect/place note) to prevent left-click lock interference
      if (!isLocked && e.button !== 2) return;

      lastInteractTime.current = now;

      const mouse = isLocked 
        ? new THREE.Vector2(0, 0)
        : new THREE.Vector2(
            (e.clientX / window.innerWidth) * 2 - 1,
            -(e.clientY / window.innerHeight) * 2 + 1
          );

      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(scene.children, true);
      
      if (intersects.length > 0) {
        const hit = intersects[0];
        if (hit.distance <= INTERACT_DISTANCE) {
          onInteract?.(hit, e.button);
          return;
        }
      }
      onInteract?.(null, e.button);
    };
    
    // Prevent default right-click menu when clicking on the 3D canvas
    const handleContextMenu = (e: MouseEvent) => {
      if (e.target instanceof HTMLCanvasElement || document.pointerLockElement) {
        e.preventDefault();
      }
    };

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("contextmenu", handleContextMenu);
    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("contextmenu", handleContextMenu);
    };
  }, [camera, scene, onInteract]);

  const direction = useRef(new THREE.Vector3());
  const frontVector = useRef(new THREE.Vector3());
  const sideVector = useRef(new THREE.Vector3());

  useFrame(() => {
    if (!enabled) return;

    const k = keys.current;
    const sprint = k.shift;

    if (mode === "fps") {
      // ── FPS Ground Mode ──
      // Calculate direction from inputs
      frontVector.current.set(0, 0, Number(k.s || k.arrowdown) - Number(k.w || k.arrowup));
      sideVector.current.set(Number(k.a || k.arrowleft) - Number(k.d || k.arrowright), 0, 0);

      direction.current
        .subVectors(frontVector.current, sideVector.current)
        .normalize()
        .multiplyScalar(MOVE_SPEED * (sprint ? SPRINT_MULT : 1))
        .applyEuler(camera.rotation);

      direction.current.y = 0;

      // Horizontal movement with axis-by-axis collision check
      const prevX = camera.position.x;
      const prevZ = camera.position.z;

      camera.position.x += direction.current.x;
      if (getBlock && checkCollision(camera.position)) {
        camera.position.x = prevX;
      }

      camera.position.z += direction.current.z;
      if (getBlock && checkCollision(camera.position)) {
        camera.position.z = prevZ;
      }

      // Gravity + Jump
      if (k.space && isGrounded.current) {
        velocityY.current = JUMP_FORCE;
        isGrounded.current = false;
      }

      velocityY.current += GRAVITY * 0.1;
      const prevY = camera.position.y;
      camera.position.y += velocityY.current;

      if (getBlock && checkCollision(camera.position)) {
        camera.position.y = prevY;
        if (velocityY.current < 0) {
          isGrounded.current = true;
        }
        velocityY.current = 0;
      }

      // Ground plane collision fallback (sea level y=0.5 + eye height 1.5 = 2.0)
      const minEyeY = 2.0;
      if (camera.position.y <= minEyeY) {
        camera.position.y = minEyeY;
        velocityY.current = 0;
        isGrounded.current = true;
      }

    } else {
      // ── Fly Mode ──
      frontVector.current.set(0, 0, Number(k.s || k.arrowdown) - Number(k.w || k.arrowup));
      sideVector.current.set(Number(k.a || k.arrowleft) - Number(k.d || k.arrowright), 0, 0);

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

    // Report player position throttled
    const now = Date.now();
    const dx = camera.position.x - lastSentPos.current.x;
    const dy = camera.position.y - lastSentPos.current.y;
    const dz = camera.position.z - lastSentPos.current.z;
    const distSq = dx*dx + dy*dy + dz*dz;
    
    if (distSq > 0.0025 && now - lastSentPos.current.t > 100) {
      onMove?.(camera.position.x, camera.position.y, camera.position.z);
      lastSentPos.current = { x: camera.position.x, y: camera.position.y, z: camera.position.z, t: now };
    }
  });

  const onLockRef = useRef(onLock);
  const onUnlockRef = useRef(onUnlock);

  useEffect(() => {
    onLockRef.current = onLock;
    onUnlockRef.current = onUnlock;
  }, [onLock, onUnlock]);

  // Pointer lock programmatic manager
  useEffect(() => {
    const controls = new PLControls(camera, gl.domElement);
    controlsRef.current = controls;

    const handleLock = () => onLockRef.current();
    const handleUnlock = () => onUnlockRef.current();

    controls.addEventListener("lock", handleLock);
    controls.addEventListener("unlock", handleUnlock);

    const handleClick = () => {
      if (!controlsRef.current || !enabledRef.current) return;
      try {
        // Check if element is still in DOM before requesting lock
        if (gl.domElement && document.body.contains(gl.domElement)) {
          controlsRef.current.lock();
        }
      } catch (err) {
        console.warn("PointerLock error caught safely:", err);
      }
    };

    gl.domElement.addEventListener("click", handleClick);

    return () => {
      controls.removeEventListener("lock", handleLock);
      controls.removeEventListener("unlock", handleUnlock);
      gl.domElement.removeEventListener("click", handleClick);
      try {
        controls.disconnect();
      } catch (e) {}
      controls.dispose();
      controlsRef.current = null;
    };
  }, [camera, gl.domElement]);

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  return null;
}
