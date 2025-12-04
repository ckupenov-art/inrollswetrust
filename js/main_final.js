// main_final.js — Stable Desktop + Mobile Hybrid
// LANE = X | CHANNEL = Z | LAYER = Y

import * as THREE from "three";
import { OrbitControls } from "https://unpkg.com/three@0.165.0/examples/jsm/controls/OrbitControls.js";

// ---------------------------------------------------------
// DOM Elements
// ---------------------------------------------------------

const container = document.getElementById("scene-container");
const countLabel = document.getElementById("count-label");

const rollsPerLaneEl      = document.getElementById("rollsPerLaneInput");
const rollsPerChannelEl   = document.getElementById("rollsPerChannelInput");
const rollsPerLayerEl     = document.getElementById("rollsPerLayerInput");

const rollDiameterEl = document.getElementById("rollDiameterInput");
const coreDiameterEl = document.getElementById("coreDiameterInput");
const rollHeightEl   = document.getElementById("rollHeightInput");
const rollGapEl      = document.getElementById("rollGapInput");

const totalRollsEl = document.getElementById("total-rolls");

const generateBtn    = document.getElementById("generateBtn");
const resetCameraBtn = document.getElementById("resetCameraBtn");
const exportPngBtn   = document.getElementById("exportPngBtn");

const camXEl = document.getElementById("cam-x");
const camYEl = document.getElementById("cam-y");
const camZEl = document.getElementById("cam-z");
const camTxEl = document.getElementById("cam-tx");
const camTyEl = document.getElementById("cam-ty");
const camTzEl = document.getElementById("cam-tz");
const camDebugPanel = document.getElementById("camera-debug");

const mobileToggleBtn = document.getElementById("mobile-toggle-btn");

// ---------------------------------------------------------
// Mobile detection + toggle
// ---------------------------------------------------------

const isMobile = window.innerWidth < 800;

// Hybrid mode: if screen < 700px → collapse drawer initially
if (isMobile && window.innerHeight < 700) {
  document.body.classList.add("mobile-collapsed");
}

if (mobileToggleBtn) {
  mobileToggleBtn.addEventListener("click", () =>
    document.body.classList.toggle("mobile-collapsed")
  );
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
  3000
);

const renderer = new THREE.WebGLRenderer({
  antialias: true, alpha: true, preserveDrawingBuffer: true
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.domElement.style.backgroundColor = "#e8e4da";

container.appendChild(renderer.domElement);

// Orbit controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

if (isMobile) {
  controls.rotateSpeed = 0.7;
  controls.zoomSpeed = 0.4;
  controls.panSpeed = 0.4;
}

// ---------------------------------------------------------
// Lighting
// ---------------------------------------------------------

scene.add(new THREE.AmbientLight(0xffffff, 0.08));

const key = new THREE.DirectionalLight(0xffffff, 2);
key.position.set(90, 120, 70);
scene.add(key);

const fill = new THREE.DirectionalLight(0xffffff, 1.1);
fill.position.set(-120, 60, -50);
scene.add(fill);

const rim = new THREE.DirectionalLight(0xffffff, 1.0);
rim.position.set(0, 160, -120);
scene.add(rim);

// ---------------------------------------------------------
const MM = 0.1;
const EPS = 0.01;

const packGroup = new THREE.Group();
scene.add(packGroup);

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
    rollsPerLane:    getInt(rollsPerLaneEl, 4),
    rollsPerChannel: getInt(rollsPerChannelEl, 3),
    rollsPerLayer:   getInt(rollsPerLayerEl, 2),

    rollDiameterMm: getFloat(rollDiameterEl, 120),
    coreDiameterMm: getFloat(coreDiameterEl, 45),
    rollHeightMm:   getFloat(rollHeightEl, 100),
    rollGapMm:      getFloat(rollGapEl, 7)
  };
}

// ---------------------------------------------------------
function createPaperBumpTexture() {
  const size = 64;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d");

  const img = ctx.createImageData(size, size);
  const d = img.data;
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const shade = 120 + Math.random() * 15 + (y / size) * 20;
      d[i] = d[i+1] = d[i+2] = shade;
      d[i+3] = 255;
    }

  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

const paperBumpTex = createPaperBumpTexture();

// ---------------------------------------------------------
function buildRoll(R_outer, R_coreOuter, L) {
  const g = new THREE.Group();

  const paperSide = new THREE.MeshStandardMaterial({
    color: 0xf4f3ff,
    roughness: 0.55,
    bumpMap: paperBumpTex,
    bumpScale: 0.03
  });

  const paperEnd = new THREE.MeshStandardMaterial({
    color: 0xf7f5ff,
    roughness: 0.65,
    bumpMap: paperBumpTex,
    bumpScale: 0.04,
    side: THREE.DoubleSide
  });

  const coreSide = new THREE.MeshStandardMaterial({
    color: 0xb8925d, roughness: 0.75
  });
  const coreInner = new THREE.MeshStandardMaterial({
    color: 0x7a7a7a, roughness: 0.85, side: THREE.BackSide
  });

  const coreThickness = 1.2 * MM;
  const R_inner = Math.max(0, R_coreOuter - coreThickness);
  const bevelDepth = 1.0 * MM;

  const sideGeom = new THREE.CylinderGeometry(
    R_outer, R_outer, L - bevelDepth * 2, 64, 1, true
  );
  sideGeom.rotateZ(Math.PI / 2);
  g.add(new THREE.Mesh(sideGeom, paperSide));

  const bevelGeom = new THREE.CylinderGeometry(
    R_outer, R_outer, bevelDepth, 48, 1, true
  );
  bevelGeom.rotateZ(Math.PI / 2);

  const bf = new THREE.Mesh(bevelGeom, paperSide);
  bf.position.x = L/2 - bevelDepth/2;
  g.add(bf);

  const bb = bf.clone();
  bb.position.x = -L/2 + bevelDepth/2;
  g.add(bb);

  const endRing = new THREE.RingGeometry(R_coreOuter, R_outer, 64);
  const ef = new THREE.Mesh(endRing, paperEnd);
  ef.position.x = L/2;
  ef.rotation.y = Math.PI/2;
  g.add(ef);

  const eb = ef.clone();
  eb.position.x = -L/2;
  eb.rotation.y = -Math.PI/2;
  g.add(eb);

  const coreOuterGeom = new THREE.CylinderGeometry(
    R_coreOuter, R_coreOuter, L * 0.97, 48, 1, true
  );
  coreOuterGeom.rotateZ(Math.PI / 2);
  g.add(new THREE.Mesh(coreOuterGeom, coreSide));

  const coreInnerGeom = new THREE.CylinderGeometry(
    R_inner, R_inner, L * 0.97, 48, 1, true
  );
  coreInnerGeom.rotateZ(Math.PI / 2);
  g.add(new THREE.Mesh(coreInnerGeom, coreInner));

  return g;
}

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

  const offX = -((p.rollsPerLane - 1) * spacingX) / 2;
  const offY = -((p.rollsPerLayer - 1) * spacingY) / 2;
  const offZ = -((p.rollsPerChannel - 1) * spacingZ) / 2;

  clearPack();

  for (let y = 0; y < p.rollsPerLayer; y++)
    for (let x = 0; x < p.rollsPerLane; x++)
      for (let z = 0; z < p.rollsPerChannel; z++) {

        const roll = buildRoll(R_outer, R_core, L);
        roll.position.set(
          offX + x * spacingX,
          offY + y * spacingY,
          offZ + z * spacingZ
        );
        packGroup.add(roll);
      }

  const total = p.rollsPerLane * p.rollsPerChannel * p.rollsPerLayer;
  totalRollsEl.textContent = total;
  countLabel.textContent = total + " rolls";
}

// ---------------------------------------------------------
function setDefaultCamera() {
  camera.position.set(110, 50, -85);
  controls.target.set(0, 0, 0);
  controls.update();
}

// ---------------------------------------------------------
function exportPNG() {
  const prev = camDebugPanel.style.display;
  camDebugPanel.style.display = "none";

  renderer.render(scene, camera);
  const dataURL = renderer.domElement.toDataURL("image/png");

  const p = readParams();
  const filename = `toilet_pack_${p.rollsPerChannel}_${p.rollsPerLane}_${p.rollsPerLayer}.png`;

  const a = document.createElement("a");
  a.href = dataURL;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  camDebugPanel.style.display = prev;
}

// ---------------------------------------------------------
function updateCameraDebug() {
  if (isMobile) return;
  camXEl.textContent = camera.position.x.toFixed(2);
  camYEl.textContent = camera.position.y.toFixed(2);
  camZEl.textContent = camera.position.z.toFixed(2);
  camTxEl.textContent = controls.target.x.toFixed(2);
  camTyEl.textContent = controls.target.y.toFixed(2);
  camTzEl.textContent = controls.target.z.toFixed(2);
}

// ---------------------------------------------------------
generateBtn.onclick = generatePack;
resetCameraBtn.onclick = setDefaultCamera;
exportPngBtn.onclick  = exportPNG;

generatePack();
setDefaultCamera();

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------------------------------------------------------
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  updateCameraDebug();
  renderer.render(scene, camera);
}
animate();
