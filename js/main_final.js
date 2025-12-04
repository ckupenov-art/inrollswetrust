// main_final.js — Desktop + Mobile Hybrid UI (M3)
// LANE = X  |  CHANNEL = Z  |  LAYER = Y

import * as THREE from "three";
import { OrbitControls } from "https://unpkg.com/three@0.165.0/examples/jsm/controls/OrbitControls.js";

// ---------------------------------------------------------
// DOM Elements
// ---------------------------------------------------------

const container = document.getElementById("scene-container");
const countLabel = document.getElementById("count-label");

const rollsPerLaneEl      = document.getElementById("rollsPerLaneInput");     // X
const rollsPerChannelEl   = document.getElementById("rollsPerChannelInput");  // Z
const rollsPerLayerEl     = document.getElementById("rollsPerLayerInput");    // Y

const rollDiameterEl = document.getElementById("rollDiameterInput");
const coreDiameterEl = document.getElementById("coreDiameterInput");
const rollHeightEl   = document.getElementById("rollHeightInput");
const rollGapEl      = document.getElementById("rollGapInput");

const totalRollsEl = document.getElementById("total-rolls");

const generateBtn    = document.getElementById("generateBtn");
const resetCameraBtn = document.getElementById("resetCameraBtn");
const exportPngBtn   = document.getElementById("exportPngBtn");

const camXEl  = document.getElementById("cam-x");
const camYEl  = document.getElementById("cam-y");
const camZEl  = document.getElementById("cam-z");
const camTxEl = document.getElementById("cam-tx");
const camTyEl = document.getElementById("cam-ty");
const camTzEl = document.getElementById("cam-tz");
const camDebugPanel = document.getElementById("camera-debug");

const mobileToggleBtn = document.getElementById("mobile-toggle-btn");

// ---------------------------------------------------------
// Mobile detection
// ---------------------------------------------------------

const isMobile = window.innerWidth < 800;

if (isMobile) {
  // M3 — hybrid: collapsed if viewport < 700px
  if (window.innerHeight < 700) {
    document.body.classList.add("mobile-collapsed");
  }
}

// Toggle mobile drawer
if (mobileToggleBtn) {
  mobileToggleBtn.addEventListener("click", () => {
    document.body.classList.toggle("mobile-collapsed");
  });
}

// ---------------------------------------------------------
// Scene + Renderer
// ---------------------------------------------------------

const scene = new THREE.Scene();
scene.background = null;

const camera = new THREE.PerspectiveCamera(
  35,
  window.innerWidth / window.innerHeight,
  0.1,
  5000
);

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  alpha: true,
  preserveDrawingBuffer: true  // IMPORTANT for PNG export
});

renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.domElement.style.backgroundColor = "#e8e4da";
container.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// Mobile-friendly control tuning
if (isMobile) {
  controls.rotateSpeed = 0.6;
  controls.zoomSpeed = 0.4;
  controls.panSpeed = 0.4;
}

// ---------------------------------------------------------
// Lighting
// ---------------------------------------------------------

scene.add(new THREE.AmbientLight(0xffffff, 0.06));

const key = new THREE.DirectionalLight(0xffffff, 2);
key.position.set(90, 120, 70);
scene.add(key);

const fill = new THREE.DirectionalLight(0xffffff, 1.0);
fill.position.set(-120, 60, -50);
scene.add(fill);

const rim = new THREE.DirectionalLight(0xffffff, 0.85);
rim.position.set(0, 160, -120);
scene.add(rim);

// ---------------------------------------------------------
// Constants
// ---------------------------------------------------------

const MM = 0.1;
const EPS = 0.01;

const packGroup = new THREE.Group();
scene.add(packGroup);

// ---------------------------------------------------------
// Helpers
// ---------------------------------------------------------

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
    rollsPerLane:    getInt(rollsPerLaneEl, 4),     // X
    rollsPerChannel: getInt(rollsPerChannelEl, 3),  // Z
    rollsPerLayer:   getInt(rollsPerLayerEl, 2),    // Y

    rollDiameterMm: getFloat(rollDiameterEl, 120),
    coreDiameterMm: getFloat(coreDiameterEl, 45),
    rollHeightMm:   getFloat(rollHeightEl, 100),

    rollGapMm: getFloat(rollGapEl, 7)
  };
}

// ---------------------------------------------------------
// Texture
// ---------------------------------------------------------

function createPaperBumpTexture() {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");

  const img = ctx.createImageData(size, size);
  const d = img.data;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const base = 125 + Math.random() * 20;
      const gradient = (y / size) * 20;
      d[i] = d[i+1] = d[i+2] = base + gradient;
      d[i+3] = 255;
    }
  }

  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

const paperBumpTex = createPaperBumpTexture();

// ---------------------------------------------------------
// Roll Builder
// ---------------------------------------------------------

function buildRoll(R_outer, R_coreOuter, L) {
  const group = new THREE.Group();

  const paperSideMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0.96, 0.94, 1.0),
    roughness: 0.55,
    bumpMap: paperBumpTex,
    bumpScale: 0.03
  });

  const paperEndMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0.97, 0.95, 1.0),
    roughness: 0.65,
    bumpMap: paperBumpTex,
    bumpScale: 0.04,
    side: THREE.DoubleSide
  });

  const coreSideMat = new THREE.MeshStandardMaterial({
    color: 0xb8925d,
    roughness: 0.75
  });

  const coreInnerMat = new THREE.MeshStandardMaterial({
    color: 0x7a7a7a,
    roughness: 0.85,
    side: THREE.BackSide
  });

  const coreEndMat = coreSideMat;

  const coreThickness = 1.2 * MM;
  const R_coreInner = Math.max(0, R_coreOuter - coreThickness);
  const bevelDepth = 0.9 * MM;

  const sideGeom = new THREE.CylinderGeometry(
    R_outer, R_outer, L - bevelDepth * 2, 64, 1, true
  );
  sideGeom.rotateZ(Math.PI / 2);
  group.add(new THREE.Mesh(sideGeom, paperSideMat));

  const bevelGeom = new THREE.CylinderGeometry(
    R_outer, R_outer, bevelDepth, 48, 1, true
  );
  bevelGeom.rotateZ(Math.PI / 2);

  const bevelF = new THREE.Mesh(bevelGeom, paperSideMat);
  bevelF.position.x = L/2 - bevelDepth/2;
  group.add(bevelF);

  const bevelB = bevelF.clone();
  bevelB.position.x = -L/2 + bevelDepth/2;
  group.add(bevelB);

  const endRingGeom = new THREE.RingGeometry(R_coreOuter, R_outer, 64);

  const endF = new THREE.Mesh(endRingGeom, paperEndMat);
  endF.position.x = L/2;
  endF.rotation.y = Math.PI / 2;
  group.add(endF);

  const endB = endF.clone();
  endB.position.x = -L/2;
  endB.rotation.y = -Math.PI / 2;
  group.add(endB);

  const coreOuterGeom = new THREE.CylinderGeometry(
    R_coreOuter, R_coreOuter, L * 0.97, 48, 1, true
  );
  coreOuterGeom.rotateZ(Math.PI / 2);
  group.add(new THREE.Mesh(coreOuterGeom, coreSideMat));

  const coreInnerGeom = new THREE.CylinderGeometry(
    R_coreInner, R_coreInner, L * 0.97, 48, 1, true
  );
  coreInnerGeom.rotateZ(Math.PI / 2);
  group.add(new THREE.Mesh(coreInnerGeom, coreInnerMat));

  const coreEndRingGeom = new THREE.RingGeometry(R_coreInner, R_coreOuter, 48);

  const coreF = new THREE.Mesh(coreEndRingGeom, coreEndMat);
  coreF.position.x = L/2;
  coreF.rotation.y = Math.PI / 2;
  group.add(coreF);

  const coreB = coreF.clone();
  coreB.position.x = -L/2;
  coreB.rotation.y = -Math.PI / 2;
  group.add(coreB);

  return group;
}

// ---------------------------------------------------------
// Generate Pack
// ---------------------------------------------------------

function clearPack() {
  while (packGroup.children.length) packGroup.remove(packGroup.children[0]);
}

function generatePack() {
  const p = readParams();

  const R_outer = p.rollDiameterMm * 0.5 * MM;
  const R_core  = p.coreDiameterMm * 0.5 * MM;
  const L       = p.rollHeightMm * MM;

  const D = p.rollDiameterMm * MM;
  const G = p.rollGapMm * MM;

  const spacingX = L + G + EPS;
  const spacingY = D + EPS;
  const spacingZ = D + EPS;

  const offsetX = -((p.rollsPerLane - 1) * spacingX) / 2;
  const offsetY = -((p.rollsPerLayer - 1) * spacingY) / 2;
  const offsetZ = -((p.rollsPerChannel - 1) * spacingZ) / 2;

  clearPack();

  for (let y = 0; y < p.rollsPerLayer; y++) {
    for (let x = 0; x < p.rollsPerLane; x++) {
      for (let z = 0; z < p.rollsPerChannel; z++) {

        const roll = buildRoll(R_outer, R_core, L);
        roll.position.set(
          offsetX + x * spacingX,
          offsetY + y * spacingY,
          offsetZ + z * spacingZ
        );

        packGroup.add(roll);
      }
    }
  }

  const total = p.rollsPerLane * p.rollsPerChannel * p.rollsPerLayer;
  totalRollsEl.textContent = total;
  countLabel.textContent = `${total} rolls`;
}

// ---------------------------------------------------------
// Camera
// ---------------------------------------------------------

function setDefaultCamera() {
  camera.position.set(115, 46, -81);
  controls.target.set(1, -8, 7);
  controls.update();
}

function resetCamera() { setDefaultCamera(); }

// ---------------------------------------------------------
// PNG Export (Mobile-Safe)
// ---------------------------------------------------------

function exportPNG() {

  const prevDisplay = camDebugPanel.style.display;
  camDebugPanel.style.display = "none";

  renderer.render(scene, camera);
  const url = renderer.domElement.toDataURL("image/png");

  const p = readParams();
  const filename = `toilet_pack_${p.rollsPerChannel}_${p.rollsPerLane}_${p.rollsPerLayer}.png`;

  // iOS and Android require manual gesture click
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;

  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  camDebugPanel.style.display = prevDisplay;
}

// ---------------------------------------------------------
// Camera Debug
// ---------------------------------------------------------

function updateCameraDebug() {
  if (isMobile) return; // hidden anyway
  camXEl.textContent  = camera.position.x.toFixed(2);
  camYEl.textContent  = camera.position.y.toFixed(2);
  camZEl.textContent  = camera.position.z.toFixed(2);
  camTxEl.textContent = controls.target.x.toFixed(2);
  camTyEl.textContent = controls.target.y.toFixed(2);
  camTzEl.textContent = controls.target.z.toFixed(2);
}

// ---------------------------------------------------------
// Init
// ---------------------------------------------------------

generateBtn.onclick    = generatePack;
resetCameraBtn.onclick = resetCamera;
exportPngBtn.onclick   = exportPNG;

generatePack();
setDefaultCamera();

// Resize canvas
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------------------------------------------------------
// Loop
// ---------------------------------------------------------

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  updateCameraDebug();
  renderer.render(scene, camera);
}
animate();
