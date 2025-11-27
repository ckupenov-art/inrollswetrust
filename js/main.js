// main.js – correct spacing + adjustable gap + real hollow core + camera debug

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

// Lighting
scene.add(new THREE.AmbientLight(0xffffff, 0.75));

const dirLight = new THREE.DirectionalLight(0xffffff, 1.1);
dirLight.position.set(10, 20, 12);
dirLight.castShadow = true;
scene.add(dirLight);

const packGroup = new THREE.Group();
scene.add(packGroup);

// --------------------------------------
// Helpers
// --------------------------------------

const MM  = 0.1;   // 10 mm = 1 unit
const EPS = 0.01;  // small safety gap

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

    rollGapMm:      getFloat(rollGapEl, 1.0)   // visual gap along roll length
  };
}

// --------------------------------------
// Geometries (hollow roll + hollow core tube)
// --------------------------------------

let paperGeometry = null;
let coreGeometry  = null;

const paperMaterial = new THREE.MeshStandardMaterial({
  color: 0xffffff,
  roughness: 0.5,
  metalness: 0.0,
  side: THREE.DoubleSide
});

const coreMaterial = new THREE.MeshStandardMaterial({
  color: 0x9a7b5f, // cardboard
  roughness: 0.8,
  metalness: 0.0,
  side: THREE.DoubleSide
});

function updateGeometries(p) {
  if (paperGeometry) paperGeometry.dispose();
  if (coreGeometry)  coreGeometry.dispose();

  const outerR = (p.rollDiameterMm / 2) * MM;
  const coreOuterR = (p.coreDiameterMm / 2) * MM;
  const rollLength = p.rollHeightMm * MM;

  // thickness of cardboard tube walls
  const coreWallThickness = Math.min(coreOuterR * 0.25, 0.8 * MM); // up to ~8 mm
  const coreInnerR = Math.max(coreOuterR - coreWallThickness, coreOuterR * 0.6);

  // PAPER: hollow cylinder from coreOuterR to outerR
  const paperShape = new THREE.Shape();
  paperShape.absarc(0, 0, outerR, 0, Math.PI * 2, false);
  const paperHole = new THREE.Path();
  paperHole.absarc(0, 0, coreOuterR, 0, Math.PI * 2, true);
  paperShape.holes.push(paperHole);

  // CORE: thin hollow cardboard tube from coreInnerR to coreOuterR
  const coreShape = new THREE.Shape();
  coreShape.absarc(0, 0, coreOuterR, 0, Math.PI * 2, false);
  const coreHole = new THREE.Path();
  coreHole.absarc(0, 0, coreInnerR, 0, Math.PI * 2, true);
  coreShape.holes.push(coreHole);

  const extrudeSettings = {
    depth: rollLength,
    bevelEnabled: false,
    steps: 1,
    curveSegments: 32
  };

  const paperExtruded = new THREE.ExtrudeGeometry(paperShape, extrudeSettings);
  const coreExtruded  = new THREE.ExtrudeGeometry(coreShape, extrudeSettings);

  // Extrude is along +Z; rotate so length is along X (sideways roll)
  paperExtruded.rotateY(Math.PI / 2);
  coreExtruded.rotateY(Math.PI / 2);

  paperGeometry = paperExtruded;
  coreGeometry  = coreExtruded;
}

// --------------------------------------
// Pack generation
// --------------------------------------

function clearPack() {
  while (packGroup.children.length) {
    packGroup.remove(packGroup.children[0]);
  }
}

function generatePack() {
  const p = readParams();
  updateGeometries(p);

  const L = p.rollHeightMm * MM;   // roll length (along X)
  const D = p.rollDiameterMm * MM; // roll diameter (Y,Z)
  const G = p.rollGapMm * MM;      // visual gap along length

  const spacingX = L + G + EPS;
  const spacingY = D + EPS;
  const spacingZ = D + EPS;

  const packWidth  = (p.rollsPerRow  - 1) * spacingX + L;
  const packDepth  = (p.rowsPerLayer - 1) * spacingZ + D;
  const packHeight = (p.layers       - 1) * spacingY + D;

  const offsetX = -((p.rollsPerRow  - 1) * spacingX) / 2;
  const offsetZ = -((p.rowsPerLayer - 1) * spacingZ) / 2;
  const baseY   = -((p.layers - 1) * spacingY) / 2;

  clearPack();

  for (let y = 0; y < p.layers; y++) {
    for (let z = 0; z < p.rowsPerLayer; z++) {
      for (let x = 0; x < p.rollsPerRow; x++) {

        const px = offsetX + x * spacingX;
        const py = baseY   + y * spacingY;
        const pz = offsetZ + z * spacingZ;

        // Paper volume
        const paperMesh = new THREE.Mesh(paperGeometry, paperMaterial);
        paperMesh.castShadow = true;
        paperMesh.receiveShadow = true;
        paperMesh.position.set(px, py, pz);

        // Cardboard tube
        const coreMesh = new THREE.Mesh(coreGeometry, coreMaterial);
        coreMesh.castShadow = false;
        coreMesh.receiveShadow = false;
        coreMesh.position.set(px, py, pz);

        packGroup.add(paperMesh, coreMesh);
      }
    }
  }

  const total = p.rollsPerRow * p.rowsPerLayer * p.layers;
  totalRollsEl.textContent = total;
  countLabel.textContent   = `${total} rolls`;

  // We no longer auto-frame; default/reset uses your fixed camera
}

// --------------------------------------
// Camera setup & reset (your chosen values)
// --------------------------------------

function setDefaultCamera() {
  // Your chosen camera coordinates:
  camera.position.set(115.72, 46.43, -81.27);
  controls.target.set(1.40, -7.93, 7.26);
  controls.update();
}

// Reset uses your default
function resetCamera() {
  setDefaultCamera();
}

// --------------------------------------
// PNG Export (hide debug panel for clean image)
// --------------------------------------

function exportPNG() {
  const prev = camDebugPanel.style.display || "";
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
// Camera debug panel update
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
// Events & init
// --------------------------------------

generateBtn.onclick    = () => generatePack();
resetCameraBtn.onclick = () => resetCamera();
exportPngBtn.onclick   = () => exportPNG();

// initial
generatePack();
setDefaultCamera();

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// --------------------------------------
// Render loop
// --------------------------------------

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  updateCameraDebug();
  renderer.render(scene, camera);
}

animate();
