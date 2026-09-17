// Builds Three.js BufferGeometry for a chunk's opaque and water blocks,
// culling faces that border a solid neighbour (including across chunk edges).
import * as THREE from "three";
import {
  CHUNK_SIZE, WORLD_HEIGHT,
} from "../config.js";
import { BLOCK } from "./worldgen.js";
import { TILE_BY_BLOCK, tileUV } from "../render/textures.js";

const SOLID = new Set([
  BLOCK.GRASS, BLOCK.DIRT, BLOCK.STONE, BLOCK.SAND, BLOCK.SANDSTONE,
  BLOCK.SNOW, BLOCK.OAK_LOG, BLOCK.OAK_LEAVES, BLOCK.BEDROCK, BLOCK.CACTUS,
]);

const NAME_TO_TILE = {
  [BLOCK.GRASS]: "grass",
  [BLOCK.DIRT]: "dirt",
  [BLOCK.STONE]: "stone",
  [BLOCK.SAND]: "sand",
  [BLOCK.SANDSTONE]: "sandstone",
  [BLOCK.SNOW]: "snow",
  [BLOCK.OAK_LOG]: "log",
  [BLOCK.OAK_LEAVES]: "leaves",
  [BLOCK.BEDROCK]: "bedrock",
  [BLOCK.CACTUS]: "cactus",
};

// Faces: [dir, normal, the 4 corners, tile hint]
// We build each face with CCW winding facing outward.
function faceFor(blockValue, axis, corner) {
  const name = NAME_TO_TILE[blockValue] || "stone";
  const tiles = TILE_BY_BLOCK[name] || TILE_BY_BLOCK.stone;
  let uvs;
  if (axis === "y" && corner >= 0) uvs = tiles.top; // top
  else if (axis === "y") uvs = tiles.bottom; // bottom
  else uvs = tiles.side;
  return uvs;
}

// Emit one cube face. Sorts the 4 corners into a proper CCW cyclic order around
// the face centroid (guarantees outward winding on every axis) so a
// front-face-culled material never drops or flips a side. out: geometry arrays.
function pushFace(out, cx, cy, cz, corners, normal, uvTile) {
  const c = corners.map((p) => [cx + p[0], cy + p[1], cz + p[2]]);
  // face-plane basis (u = an edge direction, v = normal x u)
  const u = [c[1][0] - c[0][0], c[1][1] - c[0][1], c[1][2] - c[0][2]];
  const v = [
    normal[1] * u[2] - normal[2] * u[1],
    normal[2] * u[0] - normal[0] * u[2],
    normal[0] * u[1] - normal[1] * u[0],
  ];
  const ox = (c[0][0] + c[1][0] + c[2][0] + c[3][0]) / 4;
  const oy = (c[0][1] + c[1][1] + c[2][1] + c[3][1]) / 4;
  const oz = (c[0][2] + c[1][2] + c[2][2] + c[3][2]) / 4;
  // cyclic order by angle around the centroid in the (u,v) plane
  const withA = c.map((p) => {
    const dx = p[0] - ox, dy = p[1] - oy, dz = p[2] - oz;
    return { a: Math.atan2(dx * v[0] + dy * v[1] + dz * v[2], dx * u[0] + dy * u[1] + dz * u[2]), p };
  });
  withA.sort((a, b) => a.a - b.a);
  const sorted = withA.map((w) => w.p);
  // orient CCW to match the outward normal
  const e1 = [sorted[1][0] - sorted[0][0], sorted[1][1] - sorted[0][1], sorted[1][2] - sorted[0][2]];
  const e2 = [sorted[2][0] - sorted[0][0], sorted[2][1] - sorted[0][1], sorted[2][2] - sorted[0][2]];
  const cr = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
  const order = cr[0] * normal[0] + cr[1] * normal[1] + cr[2] * normal[2] > 0
    ? sorted
    : [sorted[3], sorted[2], sorted[1], sorted[0]];

  const base = out.positions.length / 3;
  for (const p of order) {
    out.positions.push(p[0], p[1], p[2]);
    out.normals.push(normal[0], normal[1], normal[2]);
  }
  const { u0, v0, u1, v1 } = tileUV(uvTile);
  out.uvs.push(u0, v1, u1, v1, u0, v0, u1, v0);
  // two triangles, both CCW for a CCW quad
  out.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
}

// Mesh a chunk. `world` provides getColumn(wx,wz) -> column array (bottom->top).
export function meshChunk(world, chunkX, chunkZ) {
  const opaque = { positions: [], normals: [], uvs: [], indices: [] };
  const water = { positions: [], normals: [], uvs: [], indices: [] };
  const baseX = chunkX * CHUNK_SIZE;
  const baseZ = chunkZ * CHUNK_SIZE;

  const getBlock = (wx, wy, wz) => {
    if (wy < 0 || wy >= WORLD_HEIGHT) return BLOCK.AIR;
    const col = world.getColumn(wx, wz);
    if (!col) return BLOCK.AIR;
    return col[wy] === undefined ? BLOCK.AIR : col[wy];
  };

  // 6 faces: [offset, corners, normal]
  const FACES = [
    { off: [0, 0, 1], n: [0, 0, 1], c: [[0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]] }, // +z
    { off: [0, 0, -1], n: [0, 0, -1], c: [[1, 0, 0], [0, 0, 0], [1, 1, 0], [0, 1, 0]] }, // -z
    { off: [1, 0, 0], n: [1, 0, 0], c: [[1, 0, 0], [1, 0, 1], [1, 1, 0], [1, 1, 1]] }, // +x
    { off: [-1, 0, 0], n: [-1, 0, 0], c: [[0, 0, 1], [0, 0, 0], [0, 1, 1], [0, 1, 0]] }, // -x
    { off: [0, 1, 0], n: [0, 1, 0], c: [[0, 1, 1], [1, 1, 1], [0, 1, 0], [1, 1, 0]] }, // +y top
    { off: [0, -1, 0], n: [0, -1, 0], c: [[0, 0, 0], [1, 0, 0], [0, 0, 1], [1, 0, 1]] }, // -y bottom
  ];

  for (let lx = 0; lx < CHUNK_SIZE; lx++) {
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      const wx = baseX + lx;
      const wz = baseZ + lz;
      const col = world.getColumn(wx, wz);
      if (!col) continue;
      for (let y = 0; y < WORLD_HEIGHT; y++) {
        const b = col[y];
        if (b === BLOCK.AIR) continue;
        if (b === BLOCK.WATER) {
          // water: top face always, sides where neighbor is not water, bottom none
          for (let f = 0; f < 6; f++) {
            const face = FACES[f];
            const nx = wx + face.off[0];
            const ny = y + face.off[1];
            const nz = wz + face.off[2];
            const nb = getBlock(nx, ny, nz);
            if (nb !== BLOCK.WATER) {
              const uvTile = TILE_BY_BLOCK.water;
              faceForSolid(pushFace, water, wx, y, wz, face, uvTile);
              // slight lower top
              if (f === 4) bumpTop(water, -0.12);
            }
          }
          continue;
        }
        if (!SOLID.has(b)) continue;
        for (let f = 0; f < 6; f++) {
          const face = FACES[f];
          const nx = wx + face.off[0];
          const ny = y + face.off[1];
          const nz = wz + face.off[2];
          const nb = getBlock(nx, ny, nz);
          if (nb !== BLOCK.AIR && nb !== BLOCK.WATER) continue;
          let uvTile;
          if (face.n[1] === 1) uvTile = TILE_BY_BLOCK[NAME_TO_TILE[b]].top;
          else if (face.n[1] === -1) uvTile = TILE_BY_BLOCK[NAME_TO_TILE[b]].bottom;
          else uvTile = TILE_BY_BLOCK[NAME_TO_TILE[b]].side;
          pushFace(opaque, wx, y, wz, face.c, face.n, uvTile);
        }
      }
    }
  }

  return {
    opaque: makeGeometry(opaque),
    water: makeGeometry(water),
  };
}

// helper wrappers
function faceForSolid(push, out, x, y, z, face, uvTile) {
  push(out, x, y, z, face.c, face.n, uvTile);
}
function bumpTop(out, dy) {
  const base = out.positions.length / 3 - 4;
  for (let i = base; i < base + 4; i++) out.positions[i * 3 + 1] += dy;
}

function makeGeometry(buf) {
  if (buf.indices.length === 0) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(buf.positions, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(buf.normals, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(buf.uvs, 2));
  g.setIndex(buf.indices);
  g.computeBoundingSphere();
  return g;
}
