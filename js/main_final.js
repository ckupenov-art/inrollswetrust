// main_final.js — desktop + mobile with 3-state bottom sheet
// LANE = X | CHANNEL = Z | LAYER = Y

import * as THREE from "three";
import { OrbitControls } from "https://unpkg.com/three@0.165.0/examples/jsm/controls/OrbitControls.js";

// ---------------------------------------------------------
// DOM
// ---------------------------------------------------------

const container = document.getElementById("scene-container");
const countLabel = document.getElementById("count-label");

const rollsPerLaneEl    = document.getElementById("rollsPerLaneInput");
const rollsPerChannelEl = document.getElementById("rollsPerChannelInput");
const rollsPerLayerEl   = document.getElementById("rollsPerLayerInput");

const rollDiameterEl = document.getElementById("rollDiameterInput");
const coreDiameterEl = document.getElementById("coreDiameterInput");
const rollHeightEl   = document.getElementById("rollHeightInput");
const rollGapEl      = document.getElementById("rollGapInput");

const totalRollsEl = document.getElementById("total-rolls");

const generateBtn    = document.getElementById("generateBtn");
const resetCameraBtn = document.getElementById("resetCameraBtn");
const exportPngBtn   = document.getElementById("exportPngBtn");

const camDebugPanel = document.getElementById("camera-debug");
const camXEl  = document.getElementById("cam-x");
const camYEl  = document.getElementById("cam-y");
const camZEl  = document.getElementById("cam-z");
const camTxEl = document.getElementById("cam-tx");
const camTyEl = document.getElementById("cam-ty");
const camTzEl = document.getElementById("cam-tz");

const mobileToggleBtn = document.getElementById("mobile-toggle-btn");
const controlPanel = document.getElementById("control-panel");

// ---------------------------------------------------------
// Mobile bottom sheet logic (S2: collapsed / half / full)
// ---------------------------------------------------------

const isMobile = window.matchMedia("(max-width: 800px)").matches;

const SheetState = {
  COLLAPSED: "collapsed",
  HALF: "half",
  FULL: "full"
};

let sheetState = SheetState.HALF;
let sheetOffsets = { collapsed: 0, half: 0, full: 0 };
let currentOffsetPx = 0;

// compute real viewport height and offsets
function updateViewportHeight() {
  const vh = window.innerHeight;
  document.documentElement.style.setProperty("--vh", vh + "px");

  sheetOffsets.full = 0;
  sheetOffsets.half = vh * 0.45;          // ~45% visible sheet
  sheetOffsets.collapsed = vh - 56;       // show ~56px bar

  applySheetState(sheetState, false);
}

function applySheetState(state, animate = true) {
  sheetState = state;

  let offset;
  if (state === SheetState.FULL) offset = sheetOffsets.full;
  else if (state === SheetState.HALF) offset = sheetOffsets.half;
  else offset = sheetOffsets.collapsed;

  currentOffsetPx = offset;
  document.documentElement.style.setProperty(
    "--sheet-translateY",
    offset + "px"
  );

  if (!animate) {
    // Safari sometimes needs a reflow “kick”
    void document.body.offsetHeight;
  }

  // toggle button label
  if (mobileToggleBtn) {
    if (sheetState === SheetState.COLLAPSED) {
      mobileToggleBtn.textContent = "Pack Settings";
    } else if (sheetState === SheetState.HALF) {
      mobileToggleBtn.textContent = "Pack Settings ▲";
    } else {
      mobileToggleBtn.textContent = "Close ▲";
    }
  }
}

if (isMobile) {
  // initial state: collapsed if very short screens, else half
  sheetState = window.innerHeight < 700 ? SheetState.COLLAPSED : SheetState.HALF;
  updateViewportHeight();

  window.addEventListener("resize", () => updateViewportHeight());
  window.addEventListener("orientationchange", () => updateViewportHeight());

  // toggle button cycles between collapsed / half / full
  mobileToggleBtn?.addEventListener("click", () => {
    if (sheetState === SheetState.COLLAPSED) applySheetState(SheetState.HALF);
    else if (sheetState === SheetState.HALF) applySheetState(SheetState.FULL);
    else applySheetState(SheetState.HALF);
  });

  // drag to move sheet
  let dragStartY = null;
  let dragStartOffset = null;
  let dragging = false;

  function touchOnInteractive(el) {
    return !!el.closest("input, button, select, textarea");
  }

  controlPanel.addEventListener(
    "touchstart",
    (e) => {
      if (e.touches.length !== 1) return;
      if (touchOnInteractive(e.target)) return; // don't start drag on inputs
      dragging = true;
      dragStartY = e.touches[0].clientY;
      dragStartOffset = currentOffsetPx;
    },
    { passive: true }
  );

  controlPanel.addEventListener(
    "touchmove",
    (e) => {
      if (!dragging || e.touches.length !== 1) return;
      const dy = e.touches[0].clientY - dragStartY;
      let newOffset = dragStartOffset + dy;
      const min = sheetOffsets.full;
      const max = sheetOffsets.collapsed;
      if (newOffset < min) newOffset = min;
      if (newOffset > max) newOffset = max;
      currentOffsetPx = newOffset;
      document.documentElement.style.setProperty(
        "--sheet-translateY",
        newOffset + "px"
      );
    },
    { passive: true }
  );

  function snapSheet() {
    dragging = false;
    const dFull = Math.abs(currentOffsetPx - sheetOffsets.full);
    const dHalf = Math.abs(currentOffsetPx - sheetOffsets.half);
    const dCol  = Math.abs(currentOffsetPx - sheetOffsets.collapsed);

    let target = SheetState.HALF;
    let best = dHalf;
    if (dFull < best) { best = dFull; target = SheetState.FULL; }
    if (dCol  < best) { best = dCol;  target = SheetState.COLLAPSED; }

    applySheetState(target);
  }

  controlPanel.addEventListener("touchend", snapSheet);
  controlPanel.addEventListener("touchcancel", snapSheet);
} else {
  // desktop: ensure CSS variables are sensible
  document.documentElement.style.setProperty("--vh", window.innerHeight + "px");
  document.documentElement.style.setProperty("--sheet-translateY", "0px");
}

// ---------------------------------------------------------
// THREE Scene
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
  preserveDrawingBuffer: true
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.domElement.style.backgroundColor = "#e8e4da";
container.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

if (isMobile) {
  controls.rotateSpeed = 0.6;
  controls.zoomSpeed = 0.35;
  controls.panSpeed = 0.35;
}

// Optional: tap canvas to collapse sheet
if (isMobile) {
  renderer.domElement.addEventListener("pointerdown", () => {
    if (sheetState !== SheetState.COLLAPSED) applySheetState(SheetState.COLLAPSED);
  });
}

// ---------------------------------------------------------
// Lighting
// ---------------------------------------------------------

scene.add(new THREE.AmbientLight(0xffffff, 0.08));

const key = new THREE.DirectionalLight(0xffffff, 2.1);
key.position.set(90, 120, 70);
scene.add(key);

const fill = new THREE.DirectionalLight(0xffffff, 1.0);
fill.position.set(-120, 60, -50);
scene.add(fill);

const rim = new THREE.DirectionalLight(0xffffff, 0.9);
rim.position.set(0, 160, -120);
scene.add(rim);

// ---------------------------------------------------------
// Constants & pack group
// ---------------------------------------------------------

const MM  = 0.1;
const EPS = 0.01;

const packGroup = new THREE.Group();
scene.add(packGroup);

// ---------------------------------------------------------
// Helpers
// ---------------------------------------------------------

function getInt(el, fb) {
  const v = parseInt(el.value, 10);
  return Number.isFinite(v) && v > 0 ? v : fb;
}

function getFloat(el, fb) {
  const v = parseFloat(el.value);
  return Number.isFinite(v) && v >= 0 ? v : fb;
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
// Paper bump texture
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
      const shade = 120 + Math.random() * 18 + (y / size) * 20;
      d[i] = d[i+1] = d[i+2] = shade;
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
// Roll builder
// ---------------------------------------------------------

function buildRoll(R_outer, R_coreOuter, L) {
  const group = new THREE.Group();

  const paperSideMat = new THREE.MeshStandardMaterial({
    color: 0xf7f7ff,
    roughness: 0.55,
    bumpMap: paperBumpTex,
    bumpScale: 0.03
  });

  const paperEndMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
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

  const coreThickness = 1.2 * MM;
  const R_coreInner = Math.max(0, R_coreOuter - coreThickness);
  const bevelDepth = 1.0 * MM;

  const sideGeom = new THREE.CylinderGeometry(
    R_outer, R_outer,
    L - bevelDepth * 2,
    64, 1, true
  );
  sideGeom.rotateZ(Math.PI / 2);
  group.add(new THREE.Mesh(sideGeom, paperSideMat));

  const bevelGeom = new THREE.CylinderGeometry(
    R_outer, R_outer,
    bevelDepth,
    48, 1, true
  );
  bevelGeom.rotateZ(Math.PI / 2);

  const bevelFront = new THREE.Mesh(bevelGeom, paperSideMat);
  bevelFront.position.x = L/2 - bevelDepth/2;
  group.add(bevelFront);

  const bevelBack = bevelFront.clone();
  bevelBack.position.x = -L/2 + bevelDepth/2;
  group.add(bevelBack);

  const endRingGeom = new THREE.RingGeometry(R_coreOuter, R_outer, 64);

  const endFront = new THREE.Mesh(endRingGeom, paperEndMat);
  endFront.position.x = L/2;
  endFront.rotation.y = Math.PI / 2;
  group.add(endFront);

  const endBack = endFront.clone();
  endBack.position.x = -L/2;
  endBack.rotation.y = -Math.PI / 2;
  group.add(endBack);

  const coreOuterGeom = new THREE.CylinderGeometry(
    R_coreOuter, R_coreOuter,
    L * 0.97,
    48, 1, true
  );
  coreOuterGeom.rotateZ(Math.PI / 2);
  group.add(new THREE.Mesh(coreOuterGeom, coreSideMat));

  const coreInnerGeom = new THREE.CylinderGeometry(
    R_coreInner, R_coreInner,
    L * 0.97,
    48, 1, true
  );
  coreInnerGeom.rotateZ(Math.PI / 2);
  group.add(new THREE.Mesh(coreInnerGeom, coreInnerMat));

  return group;
}

// ---------------------------------------------------------
// Pack generation
// ---------------------------------------------------------

function clearPack() {
  while (packGroup.children.length) {
    packGroup.remove(packGroup.children[0]);
  }
}

function generatePack() {
  const p = readParams();

  const R_outer = (p.rollDiameterMm / 2) * MM;
  const R_core  = (p.coreDiameterMm / 2) * MM;
  const L       = p.rollHeightMm * MM;

  const D = p.rollDiameterMm * MM;
  const G = p.rollGapMm * MM;

  const spacingX = L + G + EPS; // lane (X)
  const spacingY = D + EPS;     // layer (Y)
  const spacingZ = D + EPS;     // channel (Z)

  const offsetX = -((p.rollsPerLane    - 1) * spacingX) / 2;
  const offsetY = -((p.rollsPerLayer   - 1) * spacingY) / 2;
  const offsetZ = -((p.rollsPerChannel - 1) * spacingZ) / 2;

  clearPack();

  for (let layer = 0; layer < p.rollsPerLayer; layer++) {
    for (let lane = 0; lane < p.rollsPerLane; lane++) {
      for (let channel = 0; channel < p.rollsPerChannel; channel++) {
        const roll = buildRoll(R_outer, R_core, L);
        roll.position.set(
          offsetX + lane    * spacingX,
          offsetY + layer   * spacingY,
          offsetZ + channel * spacingZ
        );
        packGroup.add(roll);
      }
    }
  }

  const total = p.rollsPerLane * p.rollsPerChannel * p.rollsPerLayer;
  totalRollsEl.textContent = total;
  countLabel.textContent   = `${total} rolls`;
}

// ---------------------------------------------------------
// Camera
// ---------------------------------------------------------

function setDefaultCamera() {
  camera.position.set(115, 46, -81);
  controls.target.set(0, 0, 0);
  controls.update();
}

// ---------------------------------------------------------
// Export PNG — filename toilet_pack_Channel_Lane_Layer.png
// ---------------------------------------------------------

function exportPNG() {
  const prevDisplay = camDebugPanel.style.display;
  camDebugPanel.style.display = "none";

  renderer.render(scene, camera);
  const url = renderer.domElement.toDataURL("image/png");

  const p = readParams();
  const filename = `toilet_pack_${p.rollsPerChannel}_${p.rollsPerLane}_${p.rollsPerLayer}.png`;

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  camDebugPanel.style.display = prevDisplay;
}

// ---------------------------------------------------------
// Camera debug
// ---------------------------------------------------------

function updateCameraDebug() {
  if (!camDebugPanel || isMobile) return;
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
resetCameraBtn.onclick = setDefaultCamera;
exportPngBtn.onclick   = exportPNG;

generatePack();
setDefaultCamera();

// handle resize
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  if (isMobile) updateViewportHeight();
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
