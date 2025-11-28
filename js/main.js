// main.js – clean subtle technical style (no "eyes"), transparent PNG

import * as THREE from "three";
import { OrbitControls } from "https://unpkg.com/three@0.165.0/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "https://unpkg.com/three@0.165.0/examples/jsm/environments/RoomEnvironment.js";

// -----------------------------
// DOM elements
// -----------------------------
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

// Camera debug UI
const camXEl  = document.getElementById("cam-x");
const camYEl  = document.getElementById("cam-y");
const camZEl  = document.getElementById("cam-z");
const camTxEl = document.getElementById("cam-tx");
const camTyEl = document.getElementById("cam-ty");
const camTzEl = document.getElementById("cam-tz");
const camDebugPanel = document.getElementById("camera-debug");

// -----------------------------
// Scene / Renderer
// -----------------------------
const scene = new THREE.Scene();
scene.background = null; // keep renders transparent

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

// WebGL background is transparent; this is just the canvas CSS color
renderer.setClearColor(0x000000, 0);
container.appendChild(renderer.domElement);
renderer.domElement.style.backgroundColor = "#e7e9ee"; // lighter UI background

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.enablePan = true;

// -----------------------------
// HDRI-style studio environment
// -----------------------------
const pmrem = new THREE.PMREMGenerator(renderer);
const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
scene.environment = envRT.texture;

// -----------------------------
// Soft lighting (no "eye" artifacts)
// -----------------------------
scene.add(new THREE.AmbientLight(0xffffff, 0.65)); // global fill

const keyLight = new THREE.DirectionalLight(0xffffff, 0.35);
keyLight.position.set(6, 10, 14);
keyLight.castShadow = true;
keyLight.shadow.radius = 8;
keyLight.shadow.mapSize.set(1024, 1024);
scene.add(keyLight);

// Fake AO / skylight
const hemiLight = new THREE.HemisphereLight(0xffffff, 0xdddddd, 0.22);
scene.add(hemiLight);

// -----------------------------
const packGroup = new THREE.Group();
scene.add(packGroup);

// -----------------------------
// Helpers
// -----------------------------
const MM  = 0.1;   // 10 mm = 1 world unit
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

    rollGapMm:      getFloat(rollGapEl, 1.0)
  };
}

// --------------------------------------------------
// Paper side texture (very subtle noise)
// --------------------------------------------------
function createPaperSideTexture() {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");

  const img = ctx.createImageData(size, size);
  const d = img.data;

  for (let i = 0; i < d.length; i += 4) {
    const val = 244 + Math.random() * 8;
    d[i] = d[i + 1] = d[i + 2] = val;
    d[i + 3] = 255;
  }

  ctx.putImageData(img, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 1);
  return tex;
}
const paperSideTexture = createPaperSideTexture();

// --------------------------------------------------
// Seam micro-emboss bump texture
// --------------------------------------------------
function createSeamBumpTexture() {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");

  const img = ctx.createImageData(size, size);
  const d = img.data;

  for (let i = 0; i < d.length; i += 4) {
    const val = 120 + Math.random() * 20; // subtle grain
    d[i] = d[i + 1] = d[i + 2] = val;
    d[i + 3] = 255;
  }

  ctx.putImageData(img, 0, 0);
  return new THREE.CanvasTexture(canvas);
}
const seamBumpTexture = createSeamBumpTexture();

// --------------------------------------------------
// Roll end texture – soft, beveled feel, internal spiral
// --------------------------------------------------
let endTexture = null;

function createRollEndTexture(R_outer, R_core) {
  if (endTexture) endTexture.dispose();

  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");

  const cx = size / 2;
  const cy = size / 2;

  const outerPix = size * 0.45;
  const corePix  = outerPix * (R_core / R_outer);
  const holePix  = corePix * 0.55;

  // Base paper disc
  ctx.fillStyle = "#f5f5f5";
  ctx.beginPath();
  ctx.arc(cx, cy, outerPix, 0, Math.PI * 2);
  ctx.fill();

  // Soft bevel-like gradient toward edge
  let grd = ctx.createRadialGradient(
    cx, cy, outerPix * 0.2,
    cx, cy, outerPix
  );
  grd.addColorStop(0.0, "rgba(0,0,0,0.00)");
  grd.addColorStop(1.0, "rgba(0,0,0,0.05)");
  ctx.fillStyle = grd;
  ctx.beginPath();
  ctx.arc(cx, cy, outerPix, 0, Math.PI * 2);
  ctx.fill();

  // Compression ring
  ctx.strokeStyle = "rgba(200,200,200,0.28)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, (outerPix + corePix) * 0.52, 0, Math.PI * 2);
  ctx.stroke();

  // Core cardboard
  ctx.fillStyle = "#e8dbc9";
  ctx.beginPath();
  ctx.arc(cx, cy, corePix, 0, Math.PI * 2);
  ctx.fill();

  // Slight darkening inside core
  grd = ctx.createRadialGradient(cx, cy, holePix, cx, cy, corePix);
  grd.addColorStop(0, "rgba(0,0,0,0.035)");
  grd.addColorStop(1, "rgba(0,0,0,0.0)");
  ctx.fillStyle = grd;
  ctx.beginPath();
  ctx.arc(cx, cy, corePix, 0, Math.PI * 2);
  ctx.fill();

  // Very subtle internal paper spiral
  ctx.strokeStyle = "rgba(0,0,0,0.04)";
  ctx.lineWidth = 0.6;
  for (let r = corePix * 1.05; r < outerPix * 0.98; r += 1.4) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Hole
  ctx.fillStyle = "#d6d6d6";
  ctx.beginPath();
  ctx.arc(cx, cy, holePix, 0, Math.PI * 2);
  ctx.fill();

  // IMPORTANT: no outer stroke -> no black circle

  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  endTexture = tex;
  return tex;
}

// --------------------------------------------------
// Materials & geometries
// --------------------------------------------------
let paperSideGeom = null;
let seamGeom      = null;
let endGeom       = null;

const paperSideMaterial = new THREE.MeshStandardMaterial({
  color: 0xffffff,
  roughness: 0.78,
  metalness: 0.0,
  map: paperSideTexture,
  mapIntensity: 0.3,
  emissive: new THREE.Color(0xffffff), // SSS-like soft glow
  emissiveIntensity: 0.03
});

const seamMaterial = new THREE.MeshStandardMaterial({
  color: 0xf3f3f3,          // lighter, no harsh dark ring
  roughness: 0.92,
  metalness: 0.0,
  bumpMap: seamBumpTexture, // micro emboss
  bumpScale: 0.002
});

const endMaterial = new THREE.MeshBasicMaterial({
  map: null,
  transparent: false
});

function updateGeometries(p) {
  if (paperSideGeom) paperSideGeom.dispose();
  if (seamGeom)      seamGeom.dispose();
  if (endGeom)       endGeom.dispose();

  const R_outer = (p.rollDiameterMm / 2) * MM;
  const R_core  = (p.coreDiameterMm / 2) * MM;
  const L       = p.rollHeightMm * MM;

  // Side paper tube (open ends), oriented along X
  paperSideGeom = new THREE.CylinderGeometry(R_outer, R_outer, L, 48, 1, true);
  paperSideGeom.rotateZ(Math.PI / 2);

  // Seam ring – slightly oversized but very subtle
  const seamThickness = 0.4 * MM;
seamGeom = new THREE.CylinderGeometry(
  R_outer * 0.995,   // slightly inside so no black edge
  R_outer * 0.995,
  seamThickness,
  48,
  1,
  true
  );
  seamGeom.rotateZ(Math.PI / 2);

  // End disc (flat), oriented along X
  endGeom = new THREE.CircleGeometry(R_outer, 64);
  endGeom.rotateY(Math.PI / 2);

  const endTex = createRollEndTexture(R_outer, R_core);
  endMaterial.map = endTex;
  endMaterial.needsUpdate = true;
}

// --------------------------------------------------
// Pack generation
// --------------------------------------------------
function clearPack() {
  while (packGroup.children.length) {
    packGroup.remove(packGroup.children[0]);
  }
}

function generatePack() {
  const p = readParams();
  updateGeometries(p);

  const L = p.rollHeightMm * MM;
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

        const px = offsetX + col * spacingX;
        const py = baseY   + layer * spacingY;
        const pz = offsetZ + row * spacingZ;

        // Side tube
        const side = new THREE.Mesh(paperSideGeom, paperSideMaterial);
        side.position.set(px, py, pz);

        // Seams
        const seamOffset = (L / 2) - (1.0 * MM);
        const seamFront = new THREE.Mesh(seamGeom, seamMaterial);
        const seamBack  = new THREE.Mesh(seamGeom, seamMaterial);
        seamFront.position.set(px + seamOffset, py, pz);
        seamBack.position.set(px - seamOffset, py, pz);

        // Ends
        const endFront = new THREE.Mesh(endGeom, endMaterial);
        endFront.position.set(px + L / 2 + 0.0001, py, pz);

        const endBack = new THREE.Mesh(endGeom, endMaterial);
        endBack.position.set(px - L / 2 - 0.0001, py, pz);
        endBack.rotation.y = Math.PI;

        packGroup.add(side, seamFront, seamBack, endFront, endBack);
      }
    }
  }

  const total = p.rollsPerRow * p.rowsPerLayer * p.layers;
  totalRollsEl.textContent = total;
  countLabel.textContent   = `${total} rolls`;
}

// --------------------------------------------------
// Camera
// --------------------------------------------------
function setDefaultCamera() {
  camera.position.set(115.72, 46.43, -81.27);
  controls.target.set(1.40, -7.93, 7.26);
  controls.update();
}

function resetCamera() {
  setDefaultCamera();
}

// --------------------------------------------------
// PNG Export (transparent)
// --------------------------------------------------
function exportPNG() {
  const prevDisplay = camDebugPanel.style.display;
  camDebugPanel.style.display = "none";

  renderer.render(scene, camera);
  const url = renderer.domElement.toDataURL("image/png");

  const a = document.createElement("a");
  a.href = url;
  a.download = "toilet-pack.png";
  a.click();

  camDebugPanel.style.display = prevDisplay;
}

// --------------------------------------------------
// Camera debug
// --------------------------------------------------
function updateCameraDebug() {
  camXEl.textContent  = camera.position.x.toFixed(2);
  camYEl.textContent  = camera.position.y.toFixed(2);
  camZEl.textContent  = camera.position.z.toFixed(2);

  camTxEl.textContent = controls.target.x.toFixed(2);
  camTyEl.textContent = controls.target.y.toFixed(2);
  camTzEl.textContent = controls.target.z.toFixed(2);
}

// --------------------------------------------------
// Init & loop
// --------------------------------------------------
generateBtn.onclick    = () => generatePack();
resetCameraBtn.onclick = () => resetCamera();
exportPngBtn.onclick   = () => exportPNG();

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
