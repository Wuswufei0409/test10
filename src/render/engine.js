// Three.js scene: camera, sky gradient, fog, lights, chunk meshes.
import * as THREE from "three";
import { meshChunk } from "../world/mesher.js";
import { buildAtlas } from "./textures.js";
import { CHUNK_SIZE, RENDER_DISTANCE, WORLD_HEIGHT } from "../config.js";

// only near chunks render the transparent water mesh (outer water is fogged out)
const WATER_RING = 2;

export class Engine {
  constructor(container) {
    this.renderer = new THREE.WebGLRenderer({
      antialias: false, // software AA is costly; voxels don't need it
      powerPreference: "high-performance",
    });
    // cap pixel ratio to bound fill cost on hi-DPI displays (perf target ~30fps)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setClearColor(0x87ceeb, 1);
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0xaee3ff, 40, 95);

    // sky dome
    this.sky = new THREE.Mesh(
      new THREE.SphereGeometry(480, 16, 8),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        fog: false,
        vertexShader: `varying vec3 vWorld; void main(){ vec4 wp=modelMatrix*vec4(position,1.0); vWorld=wp.xyz; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
        fragmentShader: `
          varying vec3 vWorld;
          void main(){
            float h = normalize(vWorld).y;
            vec3 top = vec3(0.35,0.55,0.95);
            vec3 bottom = vec3(0.75,0.9,1.0);
            vec3 col = mix(bottom, top, clamp(h*1.2+0.2,0.0,1.0));
            gl_FragColor = vec4(col,1.0);
          }`,
      })
    );
    this.scene.add(this.sky);

    // lights
    const sun = new THREE.DirectionalLight(0xffffff, 1.0);
    sun.position.set(60, 90, 40);
    this.scene.add(sun);
    const hemi = new THREE.HemisphereLight(0xbfd8ff, 0x809060, 0.55);
    this.scene.add(hemi);
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.12));

    // camera
    this.camera = new THREE.PerspectiveCamera(
      70, container.clientWidth / container.clientHeight, 0.1, 600
    );

    // atlas texture
    this.texCanvas = buildAtlas("W1_ATLAS");
    this.tex = new THREE.CanvasTexture(this.texCanvas);
    this.tex.magFilter = THREE.NearestFilter;
    this.tex.minFilter = THREE.NearestFilter;
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.texMat = new THREE.MeshLambertMaterial({ map: this.tex });
    this.waterMat = new THREE.MeshLambertMaterial({
      map: this.tex,
      transparent: true,
      opacity: 0.85,   // natural semi-transparent water; the REAL fix is spawn/collision below
      depthWrite: true,
    });

    this.chunkGroup = new THREE.Group();
    this.scene.add(this.chunkGroup);
    this.chunkMeshes = new Map(); // key -> { opaque, water } meshes (per-chunk frustum culling)
  }

  updateChunks(world, playerChunkX, playerChunkZ) {
    // unload far chunks
    for (const [k, pair] of Array.from(this.chunkMeshes)) {
      const [cx, cz] = k.split(",").map(Number);
      if (Math.abs(cx - playerChunkX) > RENDER_DISTANCE + 1 || Math.abs(cz - playerChunkZ) > RENDER_DISTANCE + 1) {
        world.unloadChunk(cx, cz);
        this.chunkGroup.remove(pair.g);
        pair.g.traverse((o) => o.geometry && o.geometry.dispose());
        this.chunkMeshes.delete(k);
      }
    }
    // load + mesh nearby
    for (let cx = playerChunkX - RENDER_DISTANCE; cx <= playerChunkX + RENDER_DISTANCE; cx++) {
      for (let cz = playerChunkZ - RENDER_DISTANCE; cz <= playerChunkZ + RENDER_DISTANCE; cz++) {
        const k = cx + "," + cz;
        if (this.chunkMeshes.has(k)) continue;
        world.ensureChunk(cx, cz);
        const mesh = meshChunk(world, cx, cz);
        const g = new THREE.Group();
        if (mesh.opaque) g.add(new THREE.Mesh(mesh.opaque, this.texMat));
        g.position.set(0, 0, 0); // built in world coords
        this.chunkGroup.add(g);
        this.chunkMeshes.set(k, { g, opaque: mesh.opaque, water: mesh.water, waterAdded: false });
      }
    }
    // maintain the transparent-water ring: add water meshes for near chunks,
    // remove for far ones (fog hides outer water; saves software-render fill)
    for (const [k, pair] of this.chunkMeshes) {
      const [cx, cz] = k.split(",").map(Number);
      const dist = Math.max(Math.abs(cx - playerChunkX), Math.abs(cz - playerChunkZ));
      const near = dist <= WATER_RING;
      if (near && !pair.waterAdded && pair.water) { pair.g.add(new THREE.Mesh(pair.water, this.waterMat)); pair.waterAdded = true; }
      else if (!near && pair.waterAdded) { pair.g.remove(pair.g.children.find((c) => c.geometry === pair.water)); pair.waterAdded = false; }
    }
  }
    }
  }

  disposeGeom(g) {
    if (g) g.dispose();
  }

  resize(w, h) {
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}
