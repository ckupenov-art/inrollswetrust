// js/main.js
// Touching spacing in all directions + camera debug panel + PNG export

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

// Camera debug elements
const camXEl  = document.getElementById('cam-x');
const camYEl  = document.getElementById('cam-y');
const camZEl  = document.getElementById('cam-z');
const camTxEl = document.getElementById('cam-tx');
const camTyEl = document.getElementById('cam-ty');
const camTzEl = document.getElementById('cam-tz');
const camDebugPanel = document.getElementById('camera-debug');

// -----------------------------------------------------------------------------
// 1. Basic Three.js setup
// -----------------------------------------------------------------------------

const scene = new THREE.Scene();
scene.background = null; // transparent scene

const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.1,
  5000
);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
// Transparent clear color so PNG has transparency
renderer.setClearColor(0x000000, 0);
renderer.shadowMap.enabled = true;
container.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.enablePan = true;

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
// 2. Helpers – reading inputs and spacing
// -----------------------------------------------------------------------------

const MM_TO_UNITS = 0.1;      // 10 mm = 1 scene unit
const EPSILON     = 0.01;     // small extra to avoid z-fighting (~0.1 mm)

// input readers
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
// 3. Roll geometries & materials (recreated if dimensions change)
// -----------------------------------------------------------------------------

let outerGeometry = null;
let coreGeometry  = null;

const outerMaterial = new THREE.MeshStandardMaterial({
  color: 0xffffff,
  roughness: 0.5,
  metalness: 0.0,
});
const coreMaterial = new THREE.MeshStandardMaterial({
  color: 0x9a7b5f,
  roughness: 0.7,
  metalness: 0.0,
});

function updateGeometries(params) {
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
// 4. Pack generation – touching spacing in X/Y/Z
// -----------------------------------------------------------------------------

function clearPack() {
  while (packGroup.children.length > 0) {
    const obj = packGroup.children[0];
    packGroup.remove(obj);
  }
}

function generatePack() {
  const params = readParams();
  updateGeometries(params);

  const { rollsPerRow, rowsPerLayer, layers } = params;

  const rollRadius = (params.rollDiameterMm / 2) * MM_TO_UNITS;
  const rollHeight = params.rollHeightMm * MM_TO_UNITS;

  // TOUCHING SPACING:
  // center-to-center spacing = size + tiny epsilon
  const spacingX = params.rollDiameterMm * MM_TO_UNITS + EPSILON;
  const spacingZ = params.rollDiameterMm * MM_TO_UNITS + EPSILON;
  const spacingY = rollHeight + EPSILON;

  // Total pack size (approx) for camera framing
  const packWidth  = (rollsPerRow  - 1) * spacingX + 2 * rollRadius;
  const packDepth  = (rowsPerLayer - 1) * spacingZ + 2 * rollRadius;
  const packHeight = (layers       - 1) * spacingY + rollHeight;

  // Center pack around (0,0,0)
  const offsetX = -((rollsPerRow  - 1) * spacingX) / 2;
  const offsetZ = -((rowsPerLayer - 1) * spacingZ) / 2;
  const baseY   = -((layers - 1) * spacingY) / 2;

  clearPack();

  for (let layer = 0; layer < layers; layer++) {
    for (let row = 0; row < rowsPerLayer; row++) {
      for (let col = 0; col < rollsPerRow; col++) {
        const x = offsetX + col * spacingX;
        const z = offsetZ + row * spacingZ;
        const y = baseY + layer * spacingY;

        // Outer roll – sideways (axis along X)
        const roll = new THREE.Mesh(outerGeometry, outerMaterial);
        roll.castShadow = true;
        roll.receiveShadow = true;
        roll.position.set(x, y, z);
        roll.rotation.z = Math.PI / 2;

        // Core – same orientation & position
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

  const total = rollsPerRow * rowsPerLayer * layers;
  if (totalRollsEl) totalRollsEl.textContent = total.toString();
  if (countLabel)   countLabel.textContent   = `${total} rolls`;

  frameCameraOnPack(packWidth, packHeight, packDepth);
}

// -----------------------------------------------------------------------------
// 5. Camera framing & reset
// -----------------------------------------------------------------------------

function frameCameraOnPack(width, height, depth) {
  const maxDim   = Math.max(width, height, depth);
  const distance = maxDim * 2.2; // tweak multiplier if needed

  camera.position.set(distance, distance * 0.75, distance);
  controls.target.set(0, 0, 0);
  controls.update();
}

function resetCamera() {
  const params = readParams();
  const rollRadius = (params.rollDiameterMm / 2) * MM_TO_UNITS;
  const rollHeight = params.rollHeightMm * MM_TO_UNITS;

  const spacingX = params.rollDiameterMm * MM_TO_UNITS + EPSILON;
  const spacingZ = params.rollDiameterMm * MM_TO_UNITS + EPSILON;
  const spacingY = rollHeight + EPSILON;

  const packWidth  = (params.rollsPerRow  - 1) * spacingX + 2 * rollRadius;
  const packDepth  = (params.rowsPerLayer - 1) * spacingZ + 2 * rollRadius;
  const packHeight = (params.layers       - 1) * spacingY + rollHeight;

  frameCameraOnPack(packWidth, packHeight, packDepth);
}

// -----------------------------------------------------------------------------
// 6. PNG export (transparent, hides camera debug panel)
// -----------------------------------------------------------------------------

function exportPNG() {
  // Hide debug panel for export (E1)
  let prevDisplay = '';
  if (camDebugPanel) {
    prevDisplay = camDebugPanel.style.display || '';
    camDebugPanel.style.display = 'none';
  }

  // Render a fresh frame
  renderer.render(scene, camera);

  const dataURL = renderer.domElement.toDataURL('image/png');
  const link = document.createElement('a');
  link.href = dataURL;
  link.download = 'toilet-pack.png';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Restore debug panel
  if (camDebugPanel) {
    camDebugPanel.style.display = prevDisplay;
  }
}

// -----------------------------------------------------------------------------
// 7. Camera debug panel update (C1/D2)
// -----------------------------------------------------------------------------

function updateCameraDebug() {
  if (!camXEl || !camYEl || !camZEl || !camTxEl || !camTyEl || !camTzEl) return;

  const pos = camera.position;
  const tgt = controls.target;

  camXEl.textContent  = pos.x.toFixed(2);
  camYEl.textContent  = pos.y.toFixed(2);
  camZEl.textContent  = pos.z.toFixed(2);
  camTxEl.textContent = tgt.x.toFixed(2);
  camTyEl.textContent = tgt.y.toFixed(2);
  camTzEl.textContent = tgt.z.toFixed(2);
}

// -----------------------------------------------------------------------------
// 8. Event wiring & initial generation
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

// Initial pack + camera
generatePack();

// Resize handler
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
  updateCameraDebug();
  renderer.render(scene, camera);
}
animate();
