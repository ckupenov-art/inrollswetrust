// main.js – perfect roll geometry (P1) + adjustable gap + camera debug + smooth rendering

import * as THREE from "three";
import { OrbitControls } from "https://unpkg.com/three@0.165.0/examples/jsm/controls/OrbitControls.js";
import * as BufferGeometryUtils from "https://unpkg.com/three@0.165.0/examples/jsm/utils/BufferGeometryUtils.js";

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
//---------------------------------------

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
scene.add(new THREE.AmbientLight(0xffffff, 0.8));

const dirLight = new THREE.DirectionalLight(0xffffff, 1.1);
dirLight.position.set(10, 20, 12);
dirLight.castShadow = true;
scene.add(dirLight);

const packGroup = new THREE.Group();
scene.add(packGroup);

// --------------------------------------
// Helpers
//---------------------------------------

const MM  = 0.1;   // 10 mm = 1 unit
const EPS = 0.01;  // small offset

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
// PERFECT ROLL GEOMETRY (P1)
//---------------------------------------

let outerShellGeom = null;
let innerWallGeom  = null;
let coreTubeGeom   = null;

const paperMaterial = new THREE.MeshStandardMaterial({
  color: 0xffffff,
  roughness: 0.45,
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

  if (outerShellGeom) outerShellGeom.dispose();
  if (innerWallGeom)  innerWallGeom.dispose();
  if (coreTubeGeom)   coreTubeGeom.dispose();

  const R_outer = (p.rollDiameterMm / 2) * MM;
  const R_coreOuter = (p.coreDiameterMm / 2) * MM;
  const length = p.rollHeightMm * MM;

  // Cardboard tube thickness
  const tubeThickness = Math.min(R_coreOuter * 0.25, 0.8 * MM);
  const R_coreInner = Math.max(R_coreOuter - tubeThickness, R_coreOuter * 0.6);

  // Outer paper shell
  outerShellGeom = new THREE.CylinderGeometry(
    R_outer, R_outer, length, 64, 1, true
  );
  outerShellGeom.rotateZ(Math.PI / 2);

  // Inner paper hole
  innerWallGeom = new THREE.CylinderGeometry(
    R_coreOuter, R_coreOuter, length, 64, 1, true
  );
  innerWallGeom.scale(1, 1, -1);
  innerWallGeom.rotateZ(Math.PI / 2);

  // Cardboard tube geometry
  const coreOuter = new THREE.CylinderGeometry(
    R_coreOuter, R_coreOuter, length, 48, 1, true
  );
  const coreInner = new THREE.CylinderGeometry(
    R_coreInner, R_coreInner, length, 48, 1, true
  );
  coreInner.scale(1, 1, -1);

  coreOuter.rotateZ(Math.PI / 2);
  coreInner.rotateZ(Math.PI / 2);

  coreTubeGeom = BufferGeometryUtils.mergeGeometries([coreOuter, coreInner]);
}

// --------------------------------------
// Pack generation
//---------------------------------------

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
  const baseY   = -((p.layers - 1) * spacingY) / 2;

  clearPack();

  for (let y = 0; y < p.layers; y++) {
    for (let z = 0; z < p.rowsPerLayer; z++) {
      for (let x = 0; x < p.rollsPerRow; x++) {

        const px = offsetX + x * spacingX;
        const py = baseY   + y * spacingY;
        const pz = offsetZ + z * spacingZ;

        packGroup.add(new THREE.Mesh(outerShellGeom, paperMaterial).setPosition(px, py, pz));
        packGroup.add(new THREE.Mesh(innerWallGeom, paperMaterial).setPosition(px, py, pz));
        packGroup.add(new THREE.Mesh(coreTubeGeom, coreMaterial).setPosition(px, py, pz));
      }
    }
  }

  const total = p.rollsPerRow * p.rowsPerLayer * p.layers;
  totalRollsEl.textContent = total;
  countLabel.textContent = `${total} rolls`;
}

// --------------------------------------
// Camera defaults
//---------------------------------------

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
//---------------------------------------

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
// Camera debug display
//---------------------------------------

function updateCameraDebug() {
  camXEl.textContent = camera.position.x.toFixed(2);
  camYEl.textContent = camera.position.y.toFixed(2);
  camZEl.textContent = camera.position.z.toFixed(2);

  camTxEl.textContent = controls.target.x.toFixed(2);
  camTyEl.textContent = controls.target.y.toFixed(2);
  camTzEl.textContent = controls.target.z.toFixed(2);
}

// --------------------------------------
// Init
//---------------------------------------

generateBtn.onclick = generatePack;
resetCameraBtn.onclick = resetCamera;
exportPngBtn.onclick = exportPNG;

generatePack();
setDefaultCamera();

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// --------------------------------------
// Render loop
//---------------------------------------

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  updateCameraDebug();
  renderer.render(scene, camera);
}

animate();
