// ===============================
// main_final.js — FINAL VERSION
// White/Purple Paper + Brown Core + Lit Cavity
// ===============================

import * as THREE from "three";
import { OrbitControls } from "https://unpkg.com/three@0.165.0/examples/jsm/controls/OrbitControls.js";

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
// Scene + Renderer
// ------------------------------------------------
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
  preserveDrawingBuffer: true
});

renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;
renderer.toneMappingExposure = 1.0;

renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000000, 0);
renderer.domElement.style.backgroundColor = "#faf6eb";
container.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// ------------------------------------------------
// Studio Lighting — Strong Enough for White Paper
// ------------------------------------------------
scene.add(new THREE.AmbientLight(0xffffff, 0.05));

const key = new THREE.DirectionalLight(0xffffff, 2.2);
key.position.set(90, 120, 70);
scene.add(key);

const fill = new THREE.DirectionalLight(0xffffff, 1.1);
fill.position.set(-120, 60, -50);
scene.add(fill);

const rim = new THREE.DirectionalLight(0xffffff, 0.9);
rim.position.set(0, 160, -120);
scene.add(rim);

// ------------------------------------------------
// Constants
// ------------------------------------------------
const MM  = 0.1;
const EPS = 0.01;

const packGroup = new THREE.Group();
scene.add(packGroup);

// ------------------------------------------------
// Helpers
// ------------------------------------------------
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

    rollGapMm: getFloat(rollGapEl, 7)
  };
}

// ------------------------------------------------
// Paper Bump Texture
// ------------------------------------------------
function createPaperBumpTexture() {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");

  const img = ctx.createImageData(size, size);
  const d = img.data;

  for (let i = 0; i < size * size; i++) {
    const shade = 215 + Math.random() * 25;
    const idx = i * 4;
    d[idx] = d[idx+1] = d[idx+2] = shade;
    d[idx+3] = 255;
  }

  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

const paperBumpTex = createPaperBumpTexture();

// ------------------------------------------------
// Roll Builder
// ------------------------------------------------
function buildRoll(R_outer, R_coreOuter, L) {
  const group = new THREE.Group();

  // PAPER SIDE (White + Light Purple Tint)
  const paperSideMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0.96, 0.94, 1.0),
    roughness: 0.55,
    metalness: 0.0,
    bumpMap: paperBumpTex,
    bumpScale: 0.03,
    emissive: new THREE.Color(0.06, 0.06, 0.08),
    emissiveIntensity: 0.45
  });

  // PAPER ENDS (Slightly Brighter)
  const paperEndMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0.97, 0.95, 1.0),
    roughness: 0.65,
    metalness: 0.0,
    bumpMap: paperBumpTex,
    bumpScale: 0.04,
    side: THREE.DoubleSide,
    emissive: new THREE.Color(0.06, 0.06, 0.09),
    emissiveIntensity: 0.45
  });

  // CORE OUTER (Brown Cardboard)
  const coreSideMat = new THREE.MeshStandardMaterial({
    color: 0xb8925d,
    roughness: 0.78,
    metalness: 0.0
  });

  // CORE INNER (Lit Cavity Fix — NO MORE BLACK HOLE)
  const coreInnerMat = new THREE.MeshStandardMaterial({
    color: 0x7a7a7a,            // medium warm gray
    roughness: 0.85,
    metalness: 0.0,
    side: THREE.BackSide,       // correct orientation

    // key fix: simulates bounced light inside tube
    emissive: new THREE.Color(0.28, 0.22, 0.15),
    emissiveIntensity: 0.55
  });

  const coreEndMat = coreSideMat;

  const coreThickness = 1.2 * MM;
  const R_coreInner = Math.max(0, R_coreOuter - coreThickness);
  const bevelDepth = 0.9 * MM;

  // SIDE PAPER CYLINDER
  const sideGeom = new THREE.CylinderGeometry(
    R_outer, R_outer,
    L - bevelDepth * 2,
    64, 1, true
  );
  sideGeom.rotateZ(Math.PI / 2);
  group.add(new THREE.Mesh(sideGeom, paperSideMat));

  // BEVELS
  const bevelGeom = new THREE.CylinderGeometry(
    R_outer, R_outer,
    bevelDepth,
    48, 1, true
  );
  bevelGeom.rotateZ(Math.PI / 2);

  const bevelFront = new THREE.Mesh(bevelGeom, paperSideMat);
  bevelFront.position.x = L / 2 - bevelDepth / 2;
  group.add(bevelFront);

  const bevelBack = bevelFront.clone();
  bevelBack.position.x = -L / 2 + bevelDepth / 2;
  group.add(bevelBack);

  // PAPER ENDS
  const endRingGeom = new THREE.RingGeometry(R_coreOuter, R_outer, 64);

  const endFront = new THREE.Mesh(endRingGeom, paperEndMat);
  endFront.position.x = L / 2;
  endFront.rotation.y = Math.PI / 2;
  group.add(endFront);

  const endBack = endFront.clone();
  endBack.position.x = -L / 2;
  endBack.rotation.y = -Math.PI / 2;
  group.add(endBack);

  // CORE OUTER RING
  const coreOuterGeom = new THREE.CylinderGeometry(
    R_coreOuter, R_coreOuter,
    L * 0.97,
    48, 1, true
  );
  coreOuterGeom.rotateZ(Math.PI / 2);
  group.add(new THREE.Mesh(coreOuterGeom, coreSideMat));

  // CORE INNER WALL (BackSide + emissive)
  const coreInnerGeom = new THREE.CylinderGeometry(
    R_coreInner, R_coreInner,
    L * 0.97,
    48, 1, true
  );
  coreInnerGeom.rotateZ(Math.PI / 2);
  group.add(new THREE.Mesh(coreInnerGeom, coreInnerMat));

  // CORE END RINGS
  const coreEndRingGeom = new THREE.RingGeometry(R_coreInner, R_coreOuter, 48);

  const coreFront = new THREE.Mesh(coreEndRingGeom, coreEndMat);
  coreFront.position.x = L / 2;
  coreFront.rotation.y = Math.PI / 2;
  group.add(coreFront);

  const coreBack = coreFront.clone();
  coreBack.position.x = -L / 2;
  coreBack.rotation.y = -Math.PI / 2;
  group.add(coreBack);

  return group;
}

// ------------------------------------------------
// Pack Generation
// ------------------------------------------------
function clearPack() {
  while (packGroup.children.length)
    packGroup.remove(packGroup.children[0]);
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
  countLabel.textContent   = `${total} rolls`;
}

// ------------------------------------------------
// Camera
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
  const prevDebug = camDebugPanel.style.display;
  camDebugPanel.style.display = "none";

  const scale = 3;
  const w = container.clientWidth * scale;
  const h = container.clientHeight * scale;

  const prevSize = renderer.getSize(new THREE.Vector2());
  const prevPixelRatio = renderer.getPixelRatio();

  renderer.setSize(w, h);
  renderer.setPixelRatio(1);
  renderer.render(scene, camera);

  const url = renderer.domElement.toDataURL("image/png");

  const a = document.createElement("a");
  a.href = url;
  a.download = "toilet-pack.png";
  a.click();

  renderer.setSize(prevSize.x, prevSize.y);
  renderer.setPixelRatio(prevPixelRatio);
  camDebugPanel.style.display = prevDebug;
}

// ------------------------------------------------
// Camera Debug
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
generateBtn.onclick    = generatePack;
resetCameraBtn.onclick = resetCamera;
exportPngBtn.onclick   = exportPNG;

generatePack();
setDefaultCamera();

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ------------------------------------------------
// Animation Loop
// ------------------------------------------------
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  updateCameraDebug();
  renderer.render(scene, camera);
}
animate();
