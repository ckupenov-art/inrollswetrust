// main.js – clean white rolls, hollow core, beige bg, bevel + micro shading

import * as THREE from "three";
import { OrbitControls } from "https://unpkg.com/three@0.165.0/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "https://unpkg.com/three@0.165.0/examples/jsm/environments/RoomEnvironment.js";

// ------------------------------------------------
// DOM
// ------------------------------------------------
const container       = document.getElementById("scene-container");
const countLabel      = document.getElementById("count-label");

const rollsPerRowEl   = document.getElementById("rollsPerRowInput");
const rowsPerLayerEl  = document.getElementById("rowsPerLayerInput");
const layersEl        = document.getElementById("layersInput");
const rollDiameterEl  = document.getElementById("rollDiameterInput");
const coreDiameterEl  = document.getElementById("coreDiameterInput");
const rollHeightEl    = document.getElementById("rollHeightInput");
const rollGapEl       = document.getElementById("rollGapInput");
const totalRollsEl    = document.getElementById("total-rolls");

const generateBtn     = document.getElementById("generateBtn");
const resetCameraBtn  = document.getElementById("resetCameraBtn");
const exportPngBtn    = document.getElementById("exportPngBtn");

const camXEl  = document.getElementById("cam-x");
const camYEl  = document.getElementById("cam-y");
const camZEl  = document.getElementById("cam-z");
const camTxEl = document.getElementById("cam-tx");
const camTyEl = document.getElementById("cam-ty");
const camTzEl = document.getElementById("cam-tz");
const camDebugPanel = document.getElementById("camera-debug");

// ------------------------------------------------
// Scene + Renderer
// ------------------------------------------------
const scene = new THREE.Scene();
scene.background = null;

const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.1,
  5000
);

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  alpha: true,
  preserveDrawingBuffer: true
});

renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000000, 0);

// Beige UI background (PNG stays transparent)
renderer.domElement.style.backgroundColor = "#e8e4da";

container.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// ------------------------------------------------
// Lighting – product style
// ------------------------------------------------
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.02).texture;

scene.add(new THREE.AmbientLight(0xffffff, 0.22));

const keyLight = new THREE.DirectionalLight(0xffffff, 1.35);
keyLight.position.set(40, 60, 40);
scene.add(keyLight);

const fillLight = new THREE.DirectionalLight(0xffffff, 0.18);
fillLight.position.set(-40, 20, -40);
scene.add(fillLight);

scene.add(new THREE.HemisphereLight(0xffffff, 0xdddddd, 0.18));

// ------------------------------------------------
const packGroup = new THREE.Group();
scene.add(packGroup);

const MM  = 0.1; // 10 mm per unit
const EPS = 0.01;

function getInt(el, fallback) {
  const v = parseInt(el.value, 10);
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

function getFloat(el, fallback) {
  const v = parseFloat(el.value);
  return Number.isFinite(v) && v >= 0 ? v : fallback;
}

function readParams() {
  return {
    rollsPerRow:  getInt(rollsPerRowEl, 4),
    rowsPerLayer: getInt(rowsPerLayerEl, 3),
    layers:       getInt(layersEl, 2),

    rollDiameterMm: getFloat(rollDiameterEl, 120),
    coreDiameterMm: getFloat(coreDiameterEl, 45),
    rollHeightMm:   getFloat(rollHeightEl, 100),

    rollGapMm: (getFloat(rollGapEl, 7) || 7)
  };
}

// ------------------------------------------------
// Micro bump texture for paper (no visible pattern)
// ------------------------------------------------
function createPaperBumpTexture() {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");

  const img = ctx.createImageData(size, size);
  const d = img.data;
  const cx = size / 2;
  const cy = size / 2;
  const maxR = size / 2;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const r = Math.sqrt(dx*dx + dy*dy) / maxR; // 0 center → 1 edge
      const shade = 128 + (r * 30); // edges slightly higher
      const i = (y * size + x) * 4;
      d[i] = d[i+1] = d[i+2] = shade;
      d[i+3] = 255;
    }
  }

  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

const paperBumpTex = createPaperBumpTexture();

// ------------------------------------------------
// Roll Builder – bevel + micro shading + hollow core
// ------------------------------------------------
function buildRoll(R_outer, R_coreOuter, L) {
  const group = new THREE.Group();

  // Materials
  const paperSideMat = new THREE.MeshStandardMaterial({
    color: 0xeeeeee,
    roughness: 0.75,
    metalness: 0.0,
    bumpMap: paperBumpTex,
    bumpScale: 0.015,
    emissive: new THREE.Color(0x000000),
    emissiveIntensity: -0.05
  });

  const paperEndMat = new THREE.MeshStandardMaterial({
    color: 0xf4f4f4,
    roughness: 0.9,
    metalness: 0.0,
    side: THREE.DoubleSide,
    bumpMap: paperBumpTex,
    bumpScale: 0.02,
    emissiveIntensity: -0.08
  });

  const coreSideMat = new THREE.MeshStandardMaterial({
    color: 0xdfd2b8,
    roughness: 0.85,
    metalness: 0.0
  });

  const holeMat = new THREE.MeshStandardMaterial({
    color: 0xd0d0d0,
    roughness: 0.9,
    metalness: 0.0,
    side: THREE.DoubleSide
  });

  const coreEndMat = coreSideMat;

  // Dimensions
  const coreThickness = 1.2 * MM;
  const R_coreInner = Math.max(0, R_coreOuter - coreThickness);
  const bevelDepth = 0.4 * MM;

  // ---------------------------
  // Paper SIDE (slightly shorter)
  // ---------------------------
  const sideGeom = new THREE.CylinderGeometry(
    R_outer, R_outer, L - bevelDepth * 2,
    64, 1, true
  );
  sideGeom.rotateZ(Math.PI / 2);
  const sideMesh = new THREE.Mesh(sideGeom, paperSideMat);
  group.add(sideMesh);

  // ---------------------------
  // Bevel rings at ends (thin paper wrap)
  // ---------------------------
  const bevelGeom = new THREE.CylinderGeometry(
    R_outer, R_outer, bevelDepth,
    48, 1, true
  );
  bevelGeom.rotateZ(Math.PI / 2);

  const bevelFront = new THREE.Mesh(bevelGeom, paperSideMat);
  bevelFront.position.x = L/2 - bevelDepth/2;
  group.add(bevelFront);

  const bevelBack = bevelFront.clone();
  bevelBack.position.x = -L/2 + bevelDepth/2;
  group.add(bevelBack);

  // ---------------------------
  // Paper END rings
  // ---------------------------
  const endRingGeom = new THREE.RingGeometry(
    R_coreOuter, R_outer, 64
  );

  const endFront = new THREE.Mesh(endRingGeom, paperEndMat);
  endFront.rotation.y = Math.PI / 2;
  endFront.position.x = L / 2;
  group.add(endFront);

  const endBack = endFront.clone();
  endBack.rotation.y = -Math.PI / 2;
  endBack.position.x = -L / 2;
  group.add(endBack);

  // ---------------------------
  // Core outer wall
  // ---------------------------
  const coreOuterGeom = new THREE.CylinderGeometry(
    R_coreOuter, R_coreOuter, L * 0.98,
    48, 1, true
  );
  coreOuterGeom.rotateZ(Math.PI / 2);
  group.add(new THREE.Mesh(coreOuterGeom, coreSideMat));

  // ---------------------------
  // Core inner wall (hollow)
  // ---------------------------
  const coreInnerGeom = new THREE.CylinderGeometry(
    R_coreInner, R_coreInner, L * 0.98,
    48, 1, true
  );
  coreInnerGeom.rotateZ(Math.PI / 2);
  coreInnerGeom.scale(-1, 1, 1); // flip normals inward
  group.add(new THREE.Mesh(coreInnerGeom, holeMat));

  // ---------------------------
  // Core end rings (open center)
  // ---------------------------
  const coreEndRingGeom = new THREE.RingGeometry(
    R_coreInner, R_coreOuter, 48
  );

  const coreFront = new THREE.Mesh(coreEndRingGeom, coreEndMat);
  coreFront.rotation.y = Math.PI / 2;
  coreFront.position.x = L / 2;
  group.add(coreFront);

  const coreBack = coreFront.clone();
  coreBack.rotation.y = -Math.PI / 2;
  coreBack.position.x = -L / 2;
  group.add(coreBack);

  return group;
}

// ------------------------------------------------
// Pack generation
// ------------------------------------------------
function clearPack() {
  while (packGroup.children.length) packGroup.remove(packGroup.children[0]);
}

function generatePack() {
  const p = readParams();

  const R_outer = (p.rollDiameterMm / 2) * MM;
  const R_core  = (p.coreDiameterMm / 2) * MM;
  const L       = p.rollHeightMm * MM;

  const D = p.rollDiameterMm * MM;
  const G = p.rollGapMm * MM;

  const spacingX = L + G + EPS;
  const spacingY = D + EPS;
  const spacingZ = D + EPS;

  const offsetX = -((p.rollsPerRow  - 1) * spacingX) / 2;
  const offsetZ = -((p.rowsPerLayer - 1) * spacingZ) / 2;
  const baseY   = -((p.layers       - 1) * spacingY) / 2;

  clearPack();

  for (let layer = 0; layer < p.layers; layer++) {
    for (let row = 0; row < p.rowsPerLayer; row++) {
      for (let col = 0; col < p.rollsPerRow; col++) {

        const x = offsetX + col * spacingX;
        const y = baseY   + layer * spacingY;
        const z = offsetZ + row * spacingZ;

        const roll = buildRoll(R_outer, R_core, L);
        roll.position.set(x, y, z);
        packGroup.add(roll);
      }
    }
  }

  const total = p.rollsPerRow * p.rowsPerLayer * p.layers;
  totalRollsEl.textContent = total;
  countLabel.textContent = `${total} rolls`;
}

// ------------------------------------------------
// Camera + Export
// ------------------------------------------------
function setDefaultCamera() {
  camera.position.set(115.72, 46.43, -81.27);
  controls.target.set(1.40, -7.93, 7.26);
  controls.update();
}

function resetCamera() {
  setDefaultCamera();
}

function exportPNG() {
  const prev = camDebugPanel.style.display;
  camDebugPanel.style.display = "none";

  renderer.render(scene, camera);
  const url = renderer.domElement.toDataURL("image/png");

  const a = document.createElement("a");
  a.href = url;
  a.download = "toilet-pack.png";
  a.click();

  camDebugPanel.style.display = prev;
}

function updateCameraDebug() {
  camXEl.textContent  = camera.position.x.toFixed(2);
  camYEl.textContent  = camera.position.y.toFixed(2);
  camZEl.textContent  = camera.position.z.toFixed(2);

  camTxEl.textContent = controls.target.x.toFixed(2);
  camTyEl.textContent = controls.target.y.toFixed(2);
  camTzEl.textContent = controls.target.z.toFixed(2);
}

// ------------------------------------------------
// Init Loop
// ------------------------------------------------
generateBtn.onclick    = generatePack;
resetCameraBtn.onclick = resetCamera;
exportPngBtn.onclick   = exportPNG;

generatePack();
setDefaultCamera();

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  updateCameraDebug();
  renderer.render(scene, camera);
}

animate();
