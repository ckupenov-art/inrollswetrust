// FINAL FINAL main.js – clean rolls, visible core, no artifacts

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
scene.background = null;

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

// Lighting
scene.add(new THREE.AmbientLight(0xffffff, 0.9));

const dirLight = new THREE.DirectionalLight(0xffffff, 1.1);
dirLight.position.set(12, 22, 14);
dirLight.castShadow = true;
scene.add(dirLight);

const packGroup = new THREE.Group();
scene.add(packGroup);

// --------------------------------------
// Helpers
// --------------------------------------

const MM  = 0.1;
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
// Simple paper bump texture
// --------------------------------------

function createPaperBumpTexture() {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");

  const img = ctx.createImageData(size, size);
  const d = img.data;

  for (let i = 0; i < d.length; i += 4) {
    const val = 210 + Math.random() * 20;
    d[i] = d[i+1] = d[i+2] = val;
    d[i+3] = 255;
  }

  ctx.putImageData(img, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 1);
  return tex;
}

const paperBumpTexture = createPaperBumpTexture();

// --------------------------------------
// Materials
// --------------------------------------

const paperMaterial = new THREE.MeshStandardMaterial({
  color: 0xffffff,
  roughness: 0.45,
  bumpMap: paperBumpTexture,
  bumpScale: 0.015
});

const coreMaterial = new THREE.MeshStandardMaterial({
  color: 0x9a7b5f,
  roughness: 0.75
});

const seamMaterial = new THREE.MeshStandardMaterial({
  color: 0xd6d6d6,
  roughness: 0.6
});

// --------------------------------------
// Geometries
// --------------------------------------

let paperGeom = null;
let coreGeom  = null;
let seamGeom  = null;
let paperRingGeom = null;
let coreRingGeom  = null;

function updateGeometries(p) {
  if (paperGeom) paperGeom.dispose();
  if (coreGeom)  coreGeom.dispose();
  if (seamGeom)  seamGeom.dispose();
  if (paperRingGeom) paperRingGeom.dispose();
  if (coreRingGeom)  coreRingGeom.dispose();

  const R_outer = (p.rollDiameterMm / 2) * MM;
  const R_core  = (p.coreDiameterMm / 2) * MM;
  const L       = p.rollHeightMm * MM;

  // Outer paper cylinder
  paperGeom = new THREE.CylinderGeometry(R_outer, R_outer, L, 64, 1, false);
  paperGeom.rotateZ(Math.PI / 2);

  // Core cylinder (shorter)
  const coreLength = L * 0.85;
  coreGeom = new THREE.CylinderGeometry(R_core, R_core, coreLength, 48, 1, false);
  coreGeom.rotateZ(Math.PI / 2);

  // Seam ring
  const seamThickness = 0.4 * MM;
  seamGeom = new THREE.CylinderGeometry(
    R_outer * 1.002,
    R_outer * 1.002,
    seamThickness,
    64,
    1,
    false
  );
  seamGeom.rotateZ(Math.PI / 2);

  // NEW: WHITE PAPER RING (outer)
  paperRingGeom = new THREE.RingGeometry(R_core, R_outer, 64);
  paperRingGeom.rotateZ(Math.PI / 2);

  // NEW: BROWN CORE RING (inner) — *ring, NOT circle*
  coreRingGeom = new THREE.RingGeometry(0, R_core, 48);
  coreRingGeom.rotateZ(Math.PI / 2);
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

        // PAPER
        const paper = new THREE.Mesh(paperGeom, paperMaterial);
        paper.position.set(px, py, pz);

        // CORE
        const core = new THREE.Mesh(coreGeom, coreMaterial);
        core.position.set(px, py, pz);

        // SEAMS
        const seamOffset = (L / 2) - (1.2 * MM);
        const seamFront = new THREE.Mesh(seamGeom, seamMaterial);
        const seamBack  = new THREE.Mesh(seamGeom, seamMaterial);
        seamFront.position.set(px + seamOffset, py, pz);
        seamBack.position.set(px - seamOffset, py, pz);

        // PAPER RINGS
        const ringFront = new THREE.Mesh(paperRingGeom, paperMaterial);
        ringFront.position.set(px + L/2 + 0.0001, py, pz);

        const ringBack = new THREE.Mesh(paperRingGeom, paperMaterial);
        ringBack.position.set(px - L/2 - 0.0001, py, pz);

        // CORE RINGS (brown)
        const coreFront = new THREE.Mesh(coreRingGeom, coreMaterial);
        coreFront.position.set(px + L/2 + 0.0002, py, pz);

        const coreBack = new THREE.Mesh(coreRingGeom, coreMaterial);
        coreBack.position.set(px - L/2 - 0.0002, py, pz);

        packGroup.add(
          paper,
          core,
          seamFront,
          seamBack,
          ringFront,
          ringBack,
          coreFront,
          coreBack
        );
      }
    }
  }

  const total = p.rollsPerRow * p.rowsPerLayer * p.layers;
  totalRollsEl.textContent = total;
  countLabel.textContent   = `${total} rolls`;
}

// --------------------------------------
// Camera defaults
// --------------------------------------

function setDefaultCamera() {
  camera.position.set(115.72, 46.43, -81.27);
  controls.target.set(1.40, -7.93, 7.26);
  controls.update();
}
