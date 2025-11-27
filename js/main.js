// js/main.js
// Step 1: Hard-coded 3D toilet paper pack (no UI inputs yet)

import * as THREE from 'three';
import { OrbitControls } from 'https://unpkg.com/three@0.165.0/examples/jsm/controls/OrbitControls.js';

// DOM references
const container   = document.getElementById('scene-container');
const countLabel  = document.getElementById('count-label');
const regenButton = document.getElementById('regenerate-btn');

// -----------------------------------------------------------------------------
// 1. Basic Three.js setup
// -----------------------------------------------------------------------------

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x020617);

const camera = new THREE.PerspectiveCamera(
  50,
  window.innerWidth / window.innerHeight,
  0.1,
  2000
);
camera.position.set(10, 10, 14);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
container.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;

// Lights
const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
dirLight.position.set(10, 20, 10);
dirLight.castShadow = true;
dirLight.shadow.mapSize.set(1024, 1024);
scene.add(dirLight);

// Simple ground plane (just a shadow catcher)
const groundGeo = new THREE.PlaneGeometry(200, 200);
const groundMat = new THREE.MeshStandardMaterial({
  color: 0x020617,
  roughness: 0.95,
  metalness: 0.05
});
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x = -Math.PI / 2;
ground.position.y = 0;
ground.receiveShadow = true;
scene.add(ground);

// Group to hold the entire pack
const packGroup = new THREE.Group();
scene.add(packGroup);

// -----------------------------------------------------------------------------
// 2. Hard-coded pack parameters (for now)
// -----------------------------------------------------------------------------

// Units: mm from your idea, but scaled to Three.js units.
// We'll use: 10 mm = 1 unit (scale = 0.1)
const MM_TO_UNITS = 0.1;

// Layout (you can change these to test):
const rollsPerRow  = 4; // X direction
const rowsPerLayer = 3; // Z direction
const layers       = 2; // Y direction

// Roll dimensions in mm:
const rollDiameterMm   = 120; // full diameter
const coreDiameterMm   = 45;  // inner core diameter
const rollHeightMm     = 100; // roll height

// Derived dimensions in scene units:
const rollRadius   = (rollDiameterMm / 2) * MM_TO_UNITS;
const coreRadius   = (coreDiameterMm / 2) * MM_TO_UNITS;
const rollHeight   = rollHeightMm * MM_TO_UNITS;

// Spacing between rolls (a little gap so they don't intersect visually)
const spacingFactorXY = 1.05;
const spacingX = rollDiameterMm * MM_TO_UNITS * spacingFactorXY;
const spacingZ = rollDiameterMm * MM_TO_UNITS * spacingFactorXY;
const spacingY = rollHeight     * spacingFactorXY;

// -----------------------------------------------------------------------------
// 3. Roll geometries & materials
// -----------------------------------------------------------------------------

// Outer roll (paper) – white
const outerGeometry = new THREE.CylinderGeometry(
  rollRadius,
  rollRadius,
  rollHeight,
  32
);
const outerMaterial = new THREE.MeshStandardMaterial({
  color: 0xffffff,
  roughness: 0.5,
  metalness: 0.0
});

// Core – light cardboard-ish
const coreGeometry = new THREE.CylinderGeometry(
  coreRadius,
  coreRadius,
  rollHeight * 1.02, // slightly taller so it shows a bit
  24
);
const coreMaterial = new THREE.MeshStandardMaterial({
  color: 0x9a7b5f,
  roughness: 0.7,
  metalness: 0.0
});

// -----------------------------------------------------------------------------
// 4. Pack generation
// -----------------------------------------------------------------------------

function clearPack() {
  while (packGroup.children.length > 0) {
    const obj = packGroup.children[0];
    packGroup.remove(obj);
    // Geometries & materials are shared, so we don't dispose here.
  }
}

function generatePack() {
  clearPack();

  // Compute total size of pack for centering & camera framing
  const packWidth  = (rollsPerRow  - 1) * spacingX;
  const packDepth  = (rowsPerLayer - 1) * spacingZ;
  const packHeight = (layers       - 1) * spacingY + rollHeight;

  const offsetX = -packWidth  / 2;
  const offsetZ = -packDepth  / 2;
  const baseY   = rollHeight / 2; // bottom layer sitting on ground (y=0)

  for (let layer = 0; layer < layers; layer++) {
    for (let row = 0; row < rowsPerLayer; row++) {
      for (let col = 0; col < rollsPerRow; col++) {
        const x = offsetX + col * spacingX;
        const z = offsetZ + row * spacingZ;
        const y = baseY + layer * spacingY;

        // Outer roll
        const roll = new THREE.Mesh(outerGeometry, outerMaterial);
        roll.castShadow = true;
        roll.receiveShadow = true;
        roll.position.set(x, y, z);
        roll.rotation.x = Math.PI / 2; // lie on side if you want, or 0 for upright
        // For toilet packs, usually upright, so comment the line above if needed.

        // Core
        const core = new THREE.Mesh(coreGeometry, coreMaterial);
        core.castShadow = false;
        core.receiveShadow = false;
        core.position.set(x, y, z);
        core.rotation.x = roll.rotation.x;

        packGroup.add(roll);
        packGroup.add(core);
      }
    }
  }

  // Update total roll count in header
  const totalRolls = rollsPerRow * rowsPerLayer * layers;
  if (countLabel) {
    countLabel.textContent = `${totalRolls} rolls`;
  }

  // Reframe camera around this pack
  frameCameraOnPack(packWidth, packHeight, packDepth);
}

// -----------------------------------------------------------------------------
// 5. Camera framing
// -----------------------------------------------------------------------------

function frameCameraOnPack(width, height, depth) {
  const maxDim = Math.max(width, height, depth);
  const radius = maxDim * 0.6;

  const distance = radius * 3.0;

  // Nice 3/4 angle
  camera.position.set(distance, distance * 0.8, distance);
  controls.target.set(0, rollHeight, 0);
  controls.update();
}

// -----------------------------------------------------------------------------
// 6. Event wiring & animation loop
// -----------------------------------------------------------------------------

// Regenerate button – for now just rebuild the same pack
if (regenButton) {
  regenButton.addEventListener('click', () => {
    generatePack();
  });
}

// Initial generation
generatePack();

// Resize
window.addEventListener('resize', () => {
  const width = window.innerWidth;
  const height = window.innerHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
});

// Animation loop (no auto-rotation; user controls camera)
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

animate();
