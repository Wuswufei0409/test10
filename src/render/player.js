// First-person player: pointer-lock mouse look, WASD + space movement,
// gravity and robust AABB collision. Root-cause fix: spawns on clear open
// ground (never on/in a tree canopy), treats leaves as passable, and resolves
// the player AABB per-axis with binary-search contact so it can never become
// embedded in solid blocks (which caused inverted/clipped near-view faces).
import * as THREE from "three";
import { BLOCK } from "../world/worldgen.js";

const GRAVITY = -26;
const SPEED = 7;
const JUMP = 8.6;
const BODY_R = 0.3;
const BODY_H = 1.78;
const EYE_H = 1.62; // first-person eye height above feet

// leaves are passable so the player falls through canopies to the ground
const NON_SOLID = new Set([BLOCK.AIR, BLOCK.WATER, BLOCK.OAK_LEAVES]);

export class Player {
  constructor(camera, world, domElement) {
    this.camera = camera;
    this.world = world;
    this.dom = domElement;
    this.pos = new THREE.Vector3(8, 30, 8);
    this.vel = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0;
    this.onGround = false;
    this.keys = new Set();
    this.locked = false;

    this.onKeyDown = (e) => this.keys.add(e.code);
    this.onKeyUp = (e) => this.keys.delete(e.code);
    this.onMouseMove = (e) => {
      if (!this.locked) return;
      this.yaw -= e.movementX * 0.0022;
      this.pitch -= e.movementY * 0.0022;
      this.pitch = Math.max(-1.55, Math.min(1.55, this.pitch));
    };
    this.onLockChange = () => { this.locked = document.pointerLockElement === this.dom; };
    this.onLockClick = () => {
      if (!this.locked) this.dom.requestPointerLock && this.dom.requestPointerLock();
    };

    if (typeof document !== "undefined") {
      document.addEventListener("keydown", this.onKeyDown);
      document.addEventListener("keyup", this.onKeyUp);
      document.addEventListener("mousemove", this.onMouseMove);
      document.addEventListener("pointerlockchange", this.onLockChange);
      document.addEventListener("click", this.onLockClick);
    }

    this.spawn();
  }

  isSolid(x, y, z) {
    const b = this.world.getBlock(x, y, z);
    return !NON_SOLID.has(b);
  }

  boxMinMax() {
    const p = this.pos;
    return {
      x0: Math.floor(p.x - BODY_R), x1: Math.floor(p.x + BODY_R),
      y0: Math.floor(p.y), y1: Math.floor(p.y + BODY_H),
      z0: Math.floor(p.z - BODY_R), z1: Math.floor(p.z + BODY_R),
    };
  }

  overlapsSolid() {
    const m = this.boxMinMax();
    for (let x = m.x0; x <= m.x1; x++)
      for (let y = m.y0; y <= m.y1; y++)
        for (let z = m.z0; z <= m.z1; z++)
          if (this.isSolid(x, y, z)) return true;
    return false;
  }

  flatSurfaceAt(x, z) {
    const col = this.world.getColumn(x, z);
    for (let y = 90; y >= 0; y--) {
      const b = col[y];
      if (b !== BLOCK.AIR && b !== BLOCK.WATER && b !== BLOCK.OAK_LEAVES) return y;
    }
    return -1;
  }

  spawn() {
    // Prefer a FLAT, OPEN, dry landing spot with clear sky above — not at the
    // base of a cliff/mountain and not in/under a tree canopy. Search outward.
    const R = 14;
    const walk = new Set([BLOCK.GRASS, BLOCK.DIRT, BLOCK.SAND, BLOCK.STONE, BLOCK.SANDSTONE, BLOCK.SNOW]);
    let best = null;
    for (let dx = -R; dx <= R; dx++) {
      for (let dz = -R; dz <= R; dz++) {
        const x = 8 + dx, z = 8 + dz;
        const surf = this.flatSurfaceAt(x, z);
        if (surf < 0) continue;
        const g = this.world.getBlock(x, surf, z);
        if (!walk.has(g)) continue;
        if (this.world.getBlock(x, surf + 1, z) === BLOCK.WATER) continue; // submerged
        // clear (non-solid) air above
        let clear = true;
        for (let k = surf + 1; k <= surf + 6; k++) {
          const bb = this.world.getBlock(x, k, z);
          if (bb !== BLOCK.AIR && bb !== BLOCK.OAK_LEAVES) { clear = false; break; }
        }
        if (!clear) continue;
        // flatness: all surface heights within a 5x5 area within +/-2
        let flat = true;
        for (let ax = -2; ax <= 2 && flat; ax++) {
          for (let az = -2; az <= 2; az++) {
            const s = this.flatSurfaceAt(x + ax, z + az);
            if (s < 0 || Math.abs(s - surf) > 2) { flat = false; break; }
          }
        }
        if (!flat) continue;
        // prefer low, gentle plains (not high mountains, not oceanbed)
        const score = 200 - Math.abs(surf - 26) - (surf > 70 ? 500 : 0);
        if (!best || score > best.score) best = { x, z, surf, score };
      }
    }
    if (best) {
      this.pos.set(best.x + 0.5, best.surf + 1.01, best.z + 0.5);
      this.vel.set(0, 0, 0);
      this.onGround = true;
      return;
    }
    // fallback: stand on the highest solid at the origin column
    for (let y = 68; y > 1; y--) {
      if (this.isSolid(8, y, 8)) { this.pos.set(8.5, y + 1, 8.5); break; }
    }
  }

  moveAxis(axis, delta) {
    if (axis === "y") {
      if (delta === 0) return;
      const prev = this.pos.y;
      this.pos.y += delta;
      if (this.overlapsSolid()) {
        let lo = prev, hi = this.pos.y;
        for (let i = 0; i < 10; i++) {
          const mid = (lo + hi) / 2;
          this.pos.y = mid;
          if (this.overlapsSolid()) hi = mid; else lo = mid;
        }
        this.pos.y = lo;
        if (delta < 0) { this.onGround = true; this.vel.y = 0; }
        else this.vel.y = 0;
      }
      return;
    }
    // horizontal move with auto step-up (<=1 block), so 1-block steps don't trap the player
    const prevX = this.pos.x, prevZ = this.pos.z, prevY = this.pos.y;
    for (let step = 0; step < 2; step++) {
      this.pos.x = prevX; this.pos.z = prevZ; this.pos.y = prevY;
      if (step === 1) this.pos.y += 1.05; // try stepping up
      if (axis === "x") this.pos.x += delta; else this.pos.z += delta;
      if (!this.overlapsSolid()) { this.vel[axis] = 0; return; }
    }
    // fully blocked: binary-search back to first non-overlapping position at original height
    this.pos.x = prevX; this.pos.z = prevZ; this.pos.y = prevY;
    this.pos[axis] += delta;
    let lo = prevX !== this.pos.x ? prevX : prevZ;
    let hi = this.pos[axis];
    this.pos[axis] = lo;
    for (let i = 0; i < 10; i++) {
      const mid = (lo + hi) / 2;
      this.pos[axis] = mid;
      if (this.overlapsSolid()) hi = mid; else lo = mid;
    }
    this.pos[axis] = lo;
    this.vel[axis] = 0;
  }

  update(dt) {
    // look
    this.camera.rotation.order = "YXZ";
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;

    // wish movement
    const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const wish = new THREE.Vector3();
    if (this.keys.has("KeyW")) wish.add(forward);
    if (this.keys.has("KeyS")) wish.sub(forward);
    if (this.keys.has("KeyD")) wish.add(right);
    if (this.keys.has("KeyA")) wish.sub(right);
    if (wish.lengthSq() > 0) wish.normalize().multiplyScalar(SPEED);

    this.vel.x = wish.x;
    this.vel.z = wish.z;
    if (this.keys.has("Space") && this.onGround) this.vel.y = JUMP;
    this.vel.y += GRAVITY * dt;

    this.onGround = false;
    this.moveAxis("x", this.vel.x * dt);
    this.moveAxis("z", this.vel.z * dt);
    this.moveAxis("y", this.vel.y * dt);

    // first-person camera at EYE height above the feet (never embedded in ground)
    this.camera.position.set(this.pos.x, this.pos.y + EYE_H, this.pos.z);
  }

  playerChunk() {
    const CHUNK = 16;
    return { x: Math.floor(this.pos.x / CHUNK), z: Math.floor(this.pos.z / CHUNK) };
  }
}
