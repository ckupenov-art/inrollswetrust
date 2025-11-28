// main.js – decorative printed rolls + studio lighting + transparent PNG

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
// Scene / Renderer
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

renderer.domElement.style.backgroundColor = "#b8beca";
container.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// ------------------------------------------------
// Lighting – PRODUCT RENDER STYLE
// ------------------------------------------------
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.01).texture;

scene.add(new THREE.AmbientLight(0xffffff, 0.33));

const keyLight = new THREE.DirectionalLight(0xffffff, 1.25);
keyLight.position.set(40, 60, 40);
scene.add(keyLight);

const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
fillLight.position.set(-40, 20, -40);
scene.add(fillLight);

const hemi = new THREE.HemisphereLight(0xffffff, 0xdddddd, 0.25);
scene.add(hemi);

// ------------------------------------------------
const packGroup = new THREE.Group();
scene.add(packGroup);

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

    rollGapMm: getFloat(rollGapEl, 7) // default spacing
  };
}

// ------------------------------------------------
// Load seamless print texture
// ------------------------------------------------
const textureLoader = new THREE.TextureLoader();
const paperPrintTex = textureLoader.load("./assets/pattern.png");
paperPrintTex.wrapS = paperPrintTex.wrapT = THREE.RepeatWrapping;
paperPrintTex.repeat.set(2, 1);

// ------------------------------------------------
// Roll Builder
// ------------------------------------------------
function buildRoll(R_outer, R_coreOuter, L) {
  const group = new THREE.Group();

  const paperSideMat = new THREE.MeshStandardMaterial({
    color: 0xf2f2f2,
    roughness: 0.7,
    metalness: 0.0,
    map: paperPrintTex
  });

  const paperEndMat = new THREE.MeshStandardMaterial({
    color: 0xf7f7f7,
    roughness: 0.9,
    metalness: 0.0,
    side: THREE.DoubleSide
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

  const bevel = 0.4 * MM;
  const coreThick = 1.2 * MM;
  const R_coreInner = Math.max(0, R_coreOuter - coreThick);

  // SIDE (with texture)
  const sideGeom = new THREE.CylinderGeometry(
    R_outer, R_outer, L,
    64, 1, true
  );
  sideGeom.rotateZ(Math.PI / 2);
  sideGeom.attributes.uv2 = sideGeom.attributes.uv;

  const sideMesh = new THREE.Mesh(sideGeom, paperSideMat);
  group.add(sideMesh);

  // END RINGS
  const paperEndRingGeom = new THREE.RingGeometry(
    R_coreOuter, R_outer, 64
  );
  paperEndRingGeom.attributes.uv2 = paperEndRingGeom.attributes.uv;

  const endFront = new THREE.Mesh(paperEndRingGeom, paperEndMat);
  endFront.rotation.y = Math.PI / 2;
  endFront.position.x = L / 2;
  group.add(endFront);

  const endBack = endFront.clone();
  endBack.rotation.y = -Math.PI / 2;
  endBack.position.x = -L / 2;
  group.add(endBack);

  // CORE OUTER
  const coreSideGeom = new THREE.CylinderGeometry(
    R_coreOuter, R_coreOuter, L * 0.98,
    48, 1, true
  );
  coreSideGeom.rotateZ(Math.PI / 2);
  coreSideGeom.attributes.uv2 = coreSideGeom.attributes.uv;
  group.add(new THREE.Mesh(coreSideGeom, coreSideMat));

  // CORE INNER
  const coreInnerGeom = new THREE.CylinderGeometry(
    R_coreInner, R_coreInner, L * 0.98,
    48, 1, true
  );
  coreInnerGeom.rotateZ(Math.PI / 2);
  coreInnerGeom.scale(-1, 1, 1);
  coreInnerGeom.attributes.uv2 = coreInnerGeom.attributes.uv;
  group.add(new THREE.Mesh(coreInnerGeom, holeMat));

  // CORE END RINGS
  const coreEndGeom = new THREE.RingGeometry(
    R_coreInner, R_coreOuter, 48
  );
  coreEndGeom.attributes.uv2 = coreEndGeom.attributes.uv;

  const coreEndFront = new THREE.Mesh(coreEndGeom, coreEndMat);
  coreEndFront.rotation.y = Math.PI / 2;
  coreEndFront.position.x = L / 2;
  group.add(coreEndFront);

  const coreEndBack = coreEndFront.clone();
  coreEndBack.rotation.y = -Math.PI / 2;
  coreEndBack.position.x = -L / 2;
  group.add(coreEndBack);

  // HOLE DISCS
  const holeDiscGeom = new THREE.CircleGeometry(R_coreInner, 32);
  holeDiscGeom.attributes.uv2 = holeDiscGeom.attributes.uv;

  const holeFront = new THREE.Mesh(holeDiscGeom, holeMat);
  holeFront.rotation.y = Math.PI / 2;
  holeFront.position.x = L / 2 + 0.0001;
  group.add(holeFront);

  const holeBack = holeFront.clone();
  holeBack.rotation.y = -Math.PI / 2;
  holeBack.position.x = -L / 2 - 0.0001;
  group.add(holeBack);

  return group;
}

// ------------------------------------------------
// Pack Layout
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
// Camera Controls
// ------------------------------------------------
function setDefaultCamera() {
  camera.position.set(115.72, 46.43, -81.27);
  controls.target.set(1.40, -7.93, 7.26);
  controls.update();
}

function resetCamera() {
  setDefaultCamera();
}

// ------------------------------------------------
// Export PNG
// ------------------------------------------------
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

// ------------------------------------------------
// Debug Panel
// ------------------------------------------------
function updateCameraDebug() {
  camXEl.textContent  = camera.position.x.toFixed(2);
  camYEl.textContent  = camera.position.y.toFixed(2);
  camZEl.textContent  = camera.position.z.toFixed(2);

  camTxEl.textContent = controls.target.x.toFixed(2);
  camTyEl.textContent = controls.target.y.toFixed(2);
  camTzEl.textContent = controls.target.z.toFixed(2);
}

// ------------------------------------------------
// Init
// ------------------------------------------------
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
