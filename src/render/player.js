// First-person player: pointer-lock mouse look, WASD + space movement,
// gravity and simple AABB collision against solid blocks.
import * as THREE from "three";
import { BLOCK } from "../world/worldgen.js";

const GRAVITY = -26;
const SPEED = 7;
const JUMP = 8.6;
const EYE = 1.62;

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

    document.addEventListener("keydown", this.onKeyDown);
    document.addEventListener("keyup", this.onKeyUp);
    document.addEventListener("mousemove", this.onMouseMove);
    document.addEventListener("pointerlockchange", this.onLockChange);
    document.addEventListener("click", this.onLockClick);

    this.spawn();
  }

  spawn() {
    // find first air y at column, drop from top
    for (let y = 60; y > 1; y--) {
      if (this.isSolid(Math.floor(this.pos.x), y, Math.floor(this.pos.z))) {
        this.pos.y = y + 1 + 0.01;
        break;
      }
    }
  }

  isSolid(x, y, z) {
    const b = this.world.getBlock(x, y, z);
    return b !== BLOCK.AIR && b !== BLOCK.WATER;
  }

  collideAxis() {
    // oob / simple per-axis resolution
    const p = this.pos;
    const r = 0.3;
    const h = 1.78;
    const minX = Math.floor(p.x - r);
    const maxX = Math.floor(p.x + r);
    const minZ = Math.floor(p.z - r);
    const maxZ = Math.floor(p.z + r);
    const bottom = Math.floor(p.y);
    const top = Math.floor(p.y + h);
    for (let y = bottom; y <= top; y++) {
      for (let x = minX; x <= maxX; x++) {
        for (let z = minZ; z <= maxZ; z++) {
          if (this.isSolid(x, y, z)) {
            // push up
            if (p.y + h > y && p.y < y + 1) {
              if (this.vel.y <= 0) {
                p.y = y + 1;
                this.vel.y = 0;
                this.onGround = true;
              }
            }
          }
        }
      }
    }
  }

  update(dt) {
    // look
    this.camera.rotation.order = "YXZ";
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;

    // movement
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

    // gravity + jump
    if (this.keys.has("Space") && this.onGround) this.vel.y = JUMP;
    this.vel.y += GRAVITY * dt;
    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.z * dt;
    this.pos.y += this.vel.y * dt;

    this.onGround = false;
    this.collideAxis();

    this.camera.position.copy(this.pos);
  }

  playerChunk() {
    const CHUNK = 16;
    return { x: Math.floor(this.pos.x / CHUNK), z: Math.floor(this.pos.z / CHUNK) };
  }
}
