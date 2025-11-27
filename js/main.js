// js/main.js
// Step 2: Toilet pack generator with UI, sideways rolls, no ground, tight spacing

import * as THREE from 'three';
import { OrbitControls } from 'https://unpkg.com/three@0.165.0/examples/jsm/controls/OrbitControls.js';

// DOM references
const container       = document.getElementById('scene-container');
const countLabel      = document.getElementById('count-label');
const rollsPerRowEl   = document.getElementById('rollsPerRowInput');
const rowsPerLayerEl  = document.getElementById('rowsPerLayerInput');
const layersEl        = document.getElementById('layersInput');
const rollDiameterEl  = document.getElementById('rollDiameterInput');
const coreDiameterEl  = document.getElementById('coreDiameterInput');
const rollHeightEl    = document.getElementById('rollHeightInput');
const totalRollsEl    = document.getElementById('total-rolls');
const generateBtn     = document.getElementById('generateBtn');
const resetCameraBtn  = document.getElementById('resetCameraBtn');
const exportPngBtn    = document.getElementById('exportPngBtn');

// -----------------------------------------------------------------------------
// 1. Basic Three.js setup
// -----------------------------------------------------------------------------

const scene = new THREE.Scene();
// Transparent background in renderer; page background comes from CSS
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
// Transparent clear color for PNG export
renderer.setClearColor(0x000000, 0);
renderer.shadowMap.enabled = true;
container.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.enablePan = true; // P1: unrestricted pan

// Lights
const ambientLight = new THREE.AmbientLight(0xffffff, 0.75);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 1.1);
dirLight.position.set(10, 20, 12);
dirLight.castShadow = true;
dirLight.shadow.mapSize.set(1024, 1024);
scene.add(dirLight);

// Group to hold the entire pack
const packGroup = new THREE.Group();
scene.add(packGroup);

// -----------------------------------------------------------------------------
// 2. Helpers – reading inputs and computing spacing
// -----------------------------------------------------------------------------

const MM_TO_UNITS = 0.1; // 10 mm = 1 Three.js unit

function getInt(el, fallback) {
  const v = parseInt(el.value, 10);
  return Number.isFinite(v) && v > 0 ? v : fallback;
}
function getFloat(el, fallback) {
  const v = parseFloat(el.value);
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

function readParams() {
  const rollsPerRow  = getInt(rollsPerRowEl, 4);
  const rowsPerLayer = getInt(rowsPerLayerEl, 3);
  const layers       = getInt(layersEl, 2);

  const rollDiameterMm = getFloat(rollDiameterEl, 120);
  const coreDiameterMm = getFloat(coreDiameterEl, 45);
  const rollHeightMm   = getFloat(rollHeightEl, 100);

  return {
    rollsPerRow,
    rowsPerLayer,
    layers,
    rollDiameterMm,
    coreDiameterMm,
    rollHeightMm,
  };
}

// -----------------------------------------------------------------------------
// 3. Roll geometries & materials (created per-update when dims change)
// -----------------------------------------------------------------------------

let outerGeometry = null;
let coreGeometry  = null;

const outerMaterial = new THREE.MeshStandardMaterial({
  color: 0xffffff,
  roughness: 0.5,
  metalness: 0.0,
});
const coreMaterial = new THREE.MeshStandardMaterial({
  color: 0x9a7b5f, // cardboard-ish
  roughness: 0.7,
  metalness: 0.0,
});

function updateGeometries(params) {
  // Dispose old geometries, if any
  if (outerGeometry) outerGeometry.dispose();
  if (coreGeometry)  coreGeometry.dispose();

  const rollRadius = (params.rollDiameterMm / 2) * MM_TO_UNITS;
  const coreRadius = (params.coreDiameterMm / 2) * MM_TO_UNITS;
  const rollHeight = params.rollHeightMm * MM_TO_UNITS;

  outerGeometry = new THREE.CylinderGeometry(
    rollRadius,
    rollRadius,
    rollHeight,
    32
  );
  coreGeometry = new THREE.CylinderGeometry(
    coreRadius,
    coreRadius,
    rollHeight * 1.02,
    24
  );
}

// -----------------------------------------------------------------------------
// 4. Pack generation
// -----------------------------------------------------------------------------

function clearPack() {
  while (packGroup.children.length > 0) {
    const obj = packGroup.children[0];
    packGroup.remove(obj);
    // Geometry/materials are shared, don't dispose here.
  }
}

function generatePack() {
  const params = readParams();
  updateGeometries(params);

  const rollsPerRow  = params.rollsPerRow;
  const rowsPerLayer = params.rowsPerLayer;
  const layers       = params.layers;

  const rollRadius   = (params.rollDiameterMm / 2) * MM_TO_UNITS;
  const rollHeight   = params.rollHeightMm * MM_TO_UNITS;

  // Tight spacing – as requested
  const spacingFactorXY = 1.01; // X/Z
  const spacingFactorY  = 1.02; // Y

  const spacingX = (params.rollDiameterMm * MM_TO_UNITS) * spacingFactorXY;
  const spacingZ = (params.rollDiameterMm * MM_TO_UNITS) * spacingFactorXY;
  const spacingY = rollHeight * spacingFactorY;

  // Compute total size of pack
  const packWidth  = (rollsPerRow  - 1) * spacingX + rollRadius * 2;
  const packDepth  = (rowsPerLayer - 1) * spacingZ + rollRadius * 2;
  const packHeight = (layers       - 1) * spacingY + rollHeight;

  // Center pack around (0,0,0)
  const offsetX = -((rollsPerRow  - 1) * spacingX) / 2;
  const offsetZ = -((rowsPerLayer - 1) * spacingZ) / 2;
  const baseY   = -packHeight / 2 + rollHeight / 2;

  clearPack();

  for (let layer = 0; layer < layers; layer++) {
    for (let row = 0; row < rowsPerLayer; row++) {
      for (let col = 0; col < rollsPerRow; col++) {
        const x = offsetX + col * spacingX;
        const z = offsetZ + row * spacingZ;
        const y = baseY + layer * spacingY;

        // Outer roll – sideways (R2)
        const roll = new THREE.Mesh(outerGeometry, outerMaterial);
        roll.castShadow = true;
        roll.receiveShadow = true;
        roll.position.set(x, y, z);
        // Cylinder axis is Y by default; rotate so axis points along X (sideways)
        roll.rotation.z = Math.PI / 2;

        // Core
        const core = new THREE.Mesh(coreGeometry, coreMaterial);
        core.castShadow = false;
        core.receiveShadow = false;
        core.position.set(x, y, z);
        core.rotation.z = roll.rotation.z;

        packGroup.add(roll);
        packGroup.add(core);
      }
    }
  }

  // Update total roll count in UI & header
  const total = rollsPerRow * rowsPerLayer * layers;
  if (totalRollsEl) totalRollsEl.textContent = total.toString();
  if (countLabel)   countLabel.textContent   = `${total} rolls`;

  frameCameraOnPack(packWidth, packHeight, packDepth);
}

// -----------------------------------------------------------------------------
// 5. Camera framing & reset
// -----------------------------------------------------------------------------

function frameCameraOnPack(width, height, depth) {
  const maxDim  = Math.max(width, height, depth);
  const radius  = maxDim * 0.6;
  const distance = radius * 2.6;

  camera.position.set(distance, distance * 0.8, distance);
  controls.target.set(0, 0, 0);
  controls.update();
}

function resetCamera() {
  // Reframe using current pack bounds; approximate from last params
  const params = readParams();
  const rollRadius   = (params.rollDiameterMm / 2) * MM_TO_UNITS;
  const rollHeight   = params.rollHeightMm * MM_TO_UNITS;
  const spacingFactorXY = 1.01;
  const spacingFactorY  = 1.02;
  const spacingX = (params.rollDiameterMm * MM_TO_UNITS) * spacingFactorXY;
  const spacingZ = (params.rollDiameterMm * MM_TO_UNITS) * spacingFactorXY;
  const spacingY = rollHeight * spacingFactorY;
  const packWidth  = (params.rollsPerRow  - 1) * spacingX + rollRadius * 2;
  const packDepth  = (params.rowsPerLayer - 1) * spacingZ + rollRadius * 2;
  const packHeight = (params.layers       - 1) * spacingY + rollHeight;
  frameCameraOnPack(packWidth, packHeight, packDepth);
}

// -----------------------------------------------------------------------------
// 6. PNG export (transparent background)
// -----------------------------------------------------------------------------

function exportPNG() {
  // Ensure one fresh render before capturing
  renderer.render(scene, camera);
  const dataURL = renderer.domElement.toDataURL('image/png');

  const link = document.createElement('a');
  link.href = dataURL;
  link.download = 'toilet-pack.png';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// -----------------------------------------------------------------------------
// 7. Event wiring & initial generation
// -----------------------------------------------------------------------------

if (generateBtn) {
  generateBtn.addEventListener('click', () => {
    generatePack();
  });
}

if (resetCameraBtn) {
  resetCameraBtn.addEventListener('click', () => {
    resetCamera();
  });
}

if (exportPngBtn) {
  exportPngBtn.addEventListener('click', () => {
    exportPNG();
  });
}

// Generate initial pack and frame camera
generatePack();

// Resize
window.addEventListener('resize', () => {
  const width  = window.innerWidth;
  const height = window.innerHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
});

// Animation loop
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
animate();
