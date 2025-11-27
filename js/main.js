// main.js – sketchy toilet roll pack (non-eye style)

import * as THREE from "three";
import { OrbitControls } from "https://unpkg.com/three@0.165.0/examples/jsm/controls/OrbitControls.js";

// DOM elements
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

// --------------------------------------
// Scene Setup
// --------------------------------------

const scene = new THREE.Scene();
scene.background = null; // transparent

const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.1,
  5000
);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000000, 0);
renderer.shadowMap.enabled = true;
container.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.enablePan = true;

// Lighting – soft and simple
scene.add(new THREE.AmbientLight(0xffffff, 0.9));

const dirLight = new THREE.DirectionalLight(0xffffff, 0.9);
dirLight.position.set(20, 30, 20);
dirLight.castShadow = true;
scene.add(dirLight);

const packGroup = new THREE.Group();
scene.add(packGroup);

// --------------------------------------
// Helpers
// --------------------------------------

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

// --------------------------------------
// Simple paper side texture (very subtle noise)
// --------------------------------------

function createPaperSideBumpTexture() {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");

  const img = ctx.createImageData(size, size);
  const d = img.data;

  for (let i = 0; i < d.length; i += 4) {
    const val = 225 + Math.random() * 10;
    d[i] = d[i + 1] = d[i + 2] = val;
    d[i + 3] = 255;
  }

  ctx.putImageData(img, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 1);
  return tex;
}

const paperSideTexture = createPaperSideBumpTexture();

// --------------------------------------
// Sketch-style end texture (non-eye)
// --------------------------------------

let endTexture = null;

function createRollEndTexture(outerRadius, coreRadius) {
  if (endTexture) endTexture.dispose();

  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");

  const cx = size / 2;
  const cy = size / 2;

  // Map radii to pixel space
  const outerPix = size * 0.45;
  const corePix  = outerPix * (coreRadius / outerRadius);
  const holePix  = corePix * 0.55; // still a visible hole

  // Background (paper) – light gray, no harsh outline
  ctx.fillStyle = "#f4f4f4";
  ctx.beginPath();
  ctx.arc(cx, cy, outerPix, 0, Math.PI * 2);
  ctx.fill();

  // VERY subtle paper rings (light gray lines)
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(210,210,210,0.7)";
  const ringCount = 4;
  for (let i = 1; i <= ringCount; i++) {
    const r = holePix + (outerPix - holePix) * (i / (ringCount + 1));
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Cardboard ring – soft beige, not too saturated
  ctx.fillStyle = "#caa882";
  ctx.beginPath();
  ctx.arc(cx, cy, corePix, 0, Math.PI * 2);
  ctx.fill();

  // Inner core hole – LIGHT gray (to avoid 'pupil' look)
  ctx.fillStyle = "#c8c8c8"; // your choice (style 1)
  ctx.beginPath();
  ctx.arc(cx, cy, holePix, 0, Math.PI * 2);
  ctx.fill();

  // Thin soft outline around outer paper – light gray, not black
  ctx.strokeStyle = "rgba(170,170,170,0.9)";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(cx, cy, outerPix, 0, Math.PI * 2);
  ctx.stroke();

  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  endTexture = tex;
  return tex;
}

// --------------------------------------
// Geometries & materials
// --------------------------------------

let paperSideGeom = null;
let seamGeom      = null;
let endGeom       = null;

const paperSideMaterial = new THREE.MeshStandardMaterial({
  color: 0xf7f7f7,
  roughness: 0.55,
  metalness: 0.0,
  map: paperSideTexture
});

const seamMaterial = new THREE.MeshStandardMaterial({
  color: 0xdedede,
  roughness: 0.7,
  metalness: 0.0
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

  // Side cylinder – open-ended, sideways along X
  paperSideGeom = new THREE.CylinderGeometry(R_outer, R_outer, L, 48, 1, true);
  paperSideGeom.rotateZ(Math.PI / 2);

  // Seam ring – thin band around the roll
  const seamThickness = 0.4 * MM;
  seamGeom = new THREE.CylinderGeometry(
    R_outer * 1.01,
    R_outer * 1.01,
    seamThickness,
    32,
    1,
    true
  );
  seamGeom.rotateZ(Math.PI / 2);

  // End disc – flat circle facing X axis
  endGeom = new THREE.CircleGeometry(R_outer, 64);
  endGeom.rotateY(Math.PI / 2); // normal along +X

  // Update end texture based on current radii
  const endTex = createRollEndTexture(R_outer, R_core);
  endMaterial.map = endTex;
  endMaterial.needsUpdate = true;
}

// --------------------------------------
// Pack generation
// --------------------------------------

function clearPack() {
  while (packGroup.children.length) packGroup.remove(packGroup.children[0]);
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

        // SIDE (paper)
        const side = new THREE.Mesh(paperSideGeom, paperSideMaterial);
        side.castShadow = true;
        side.receiveShadow = true;
        side.position.set(px, py, pz);

        // SEAMS
        const seamOffset = (L / 2) - (1.0 * MM);
        const seamFront = new THREE.Mesh(seamGeom, seamMaterial);
        const seamBack  = new THREE.Mesh(seamGeom, seamMaterial);
        seamFront.position.set(px + seamOffset, py, pz);
        seamBack.position.set(px - seamOffset, py, pz);

        // END DISCS (non-eye style)
        const endFront = new THREE.Mesh(endGeom, endMaterial);
        endFront.position.set(px + L / 2 + 0.0001, py, pz);

        const endBack = new THREE.Mesh(endGeom, endMaterial);
        endBack.position.set(px - L / 2 - 0.0001, py, pz);
        endBack.rotation.y += Math.PI;

        packGroup.add(side, seamFront, seamBack, endFront, endBack);
      }
    }
  }

  const total = p.rollsPerRow * p.rowsPerLayer * p.layers;
  totalRollsEl.textContent = total;
  countLabel.textContent   = `${total} rolls`;
}

// --------------------------------------
// Camera
// --------------------------------------

function setDefaultCamera() {
  camera.position.set(115.72, 46.43, -81.27);
  controls.target.set(1.40, -7.93, 7.26);
  controls.update();
}

function resetCamera() {
  setDefaultCamera();
}

// --------------------------------------
// PNG Export
// --------------------------------------

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

// --------------------------------------
// Camera debug
// --------------------------------------

function updateCameraDebug() {
  camXEl.textContent  = camera.position.x.toFixed(2);
  camYEl.textContent  = camera.position.y.toFixed(2);
  camZEl.textContent  = camera.position.z.toFixed(2);

  camTxEl.textContent = controls.target.x.toFixed(2);
  camTyEl.textContent = controls.target.y.toFixed(2);
  camTzEl.textContent = controls.target.z.toFixed(2);
}

// --------------------------------------
// Init
// --------------------------------------

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
