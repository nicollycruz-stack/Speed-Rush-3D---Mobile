import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";

// SPEED RUSH 3D — versão integrada.
// Controles: W/↑ acelera, S/↓ freia, A/← e D/→ desviam.

const $ = (id) => document.getElementById(id);
const canvas = $("game");
document.documentElement.style.width = "100%";
document.documentElement.style.height = "100%";
document.body.style.width = "100%";
document.body.style.height = "100%";
document.body.style.margin = "0";
document.body.style.overflow = "hidden";
canvas.style.touchAction = "none";
const overlay = $("overlay");
const gameOverScreen = $("gameOver");
const startButton = $("startButton");
const restartButton = $("restartButton");
const hud = $("hud");
const loadingLabel = $("loading");
const errorMessage = $("errorMessage");

const distanceEl = $("distance");
const speedEl = $("speed");
const scoreEl = $("score");
const finalStats = $("finalStats");
const menuMessage = $("menuMessage");

let running = false;
let distance = 0;
let score = 0;
let speed = 0;
let steering = 0;
let elapsed = 0;
const keys = Object.create(null);

// Usa a área de controles já existente no HTML, evitando IDs duplicados.
let mobileControls = $("mobileControls");
if (!mobileControls) {
  mobileControls = document.createElement("section");
  mobileControls.id = "mobileControls";
  $("game-wrap").appendChild(mobileControls);
}
mobileControls.className = "mobile-controls hidden";
mobileControls.setAttribute("aria-label", "Controles da corrida");
mobileControls.innerHTML = `
  <div class="mobile-steering">
    <button type="button" class="mobile-control direction" data-key="arrowleft" aria-label="Virar à esquerda">◀</button>
    <button type="button" class="mobile-control direction" data-key="arrowright" aria-label="Virar à direita">▶</button>
  </div>
  <div class="mobile-pedals">
    <button type="button" class="mobile-control accelerate" data-key="arrowup" aria-label="Acelerar">▲<span>ACELERAR</span></button>
    <button type="button" class="mobile-control brake" data-key="arrowdown" aria-label="Frear">▼<span>FREAR</span></button>
  </div>
`;

// Estilos responsivos dos botões móveis.
const mobileStyle = document.createElement("style");
mobileStyle.textContent = `
  #game-wrap { position: relative; overflow: hidden; }
  .mobile-controls {
    position: absolute; inset: auto 0 max(14px, env(safe-area-inset-bottom)) 0;
    z-index: 20; display: flex; justify-content: space-between; align-items: end;
    padding: 0 max(14px, env(safe-area-inset-right)) 0 max(14px, env(safe-area-inset-left));
    pointer-events: none; box-sizing: border-box; user-select: none;
    -webkit-user-select: none; touch-action: none;
  }
  .mobile-controls.hidden { display: none !important; }
  .mobile-steering, .mobile-pedals { display: flex; gap: 12px; align-items: end; pointer-events: auto; }
  .mobile-control {
    display: flex; flex-direction: column; justify-content: center; align-items: center;
    width: clamp(58px, 16vw, 78px); height: clamp(58px, 16vw, 78px);
    border: 2px solid rgba(255,255,255,.7); border-radius: 18px;
    color: #fff; background: rgba(8,17,29,.72); font: 800 26px/1 system-ui, sans-serif;
    box-shadow: 0 5px 18px rgba(0,0,0,.35); backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px); touch-action: none; padding: 6px;
  }
  .mobile-control span { font-size: 9px; letter-spacing: .7px; margin-top: 5px; }
  .mobile-control.accelerate { background: rgba(12,125,76,.82); border-color: #78ffc0; }
  .mobile-control.brake { background: rgba(158,38,48,.82); border-color: #ff9ca3; }
  .mobile-control.direction { background: rgba(16,48,75,.82); }
  .mobile-control:active, .mobile-control.pressed { transform: scale(.94); filter: brightness(1.3); }
  @media (hover: hover) and (pointer: fine) { .mobile-controls { display: none !important; } }
  @media (max-width: 700px) {
    #game-wrap, #game { width: 100%; height: 100%; }
    .mobile-controls { bottom: max(12px, env(safe-area-inset-bottom)); }
    .mobile-steering, .mobile-pedals { gap: 8px; }
    .mobile-control { border-radius: 15px; }
    #hud { gap: 5px; }
    .hud-card { padding: 7px 9px; }
  }
`;
document.head.appendChild(mobileStyle);

const mobileKeyButtons = mobileControls.querySelectorAll("[data-key]");
function releaseMobileKeys() {
  mobileKeyButtons.forEach((button) => {
    keys[button.dataset.key] = false;
    button.classList.remove("pressed");
  });
}
mobileKeyButtons.forEach((button) => {
  const key = button.dataset.key;
  const press = (event) => {
    event.preventDefault();
    if (!running) return;
    keys[key] = true;
    button.classList.add("pressed");
    if (button.setPointerCapture && event.pointerId !== undefined) {
      try { button.setPointerCapture(event.pointerId); } catch (_) {}
    }
  };
  const release = (event) => {
    if (event) event.preventDefault();
    keys[key] = false;
    button.classList.remove("pressed");
  };
  button.addEventListener("pointerdown", press, { passive: false });
  button.addEventListener("pointerup", release, { passive: false });
  button.addEventListener("pointercancel", release, { passive: false });
  button.addEventListener("lostpointercapture", release);
  button.addEventListener("contextmenu", (event) => event.preventDefault());
});
window.addEventListener("pointerup", () => {
  mobileKeyButtons.forEach((button) => {
    keys[button.dataset.key] = false;
    button.classList.remove("pressed");
  });
});
window.addEventListener("blur", releaseMobileKeys);


const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9aafbf);
scene.fog = new THREE.FogExp2(0x9aafbf, 0.0105);

const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 500);
camera.position.set(0, 5.7, 15.2);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
renderer.useLegacyLights = false;

scene.add(new THREE.HemisphereLight(0xdceeff, 0x354553, 2.0));
const sun = new THREE.DirectionalLight(0xfff3e4, 2.5);
sun.position.set(-9, 18, 9);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.left = -15; sun.shadow.camera.right = 15;
sun.shadow.camera.top = 24; sun.shadow.camera.bottom = -24;
scene.add(sun);
const blueFill = new THREE.DirectionalLight(0x75b9ed, 1.0);
blueFill.position.set(8, 8, -15);
scene.add(blueFill);

function mat(color, roughness = 0.7, metalness = 0) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

const road = new THREE.Mesh(new THREE.PlaneGeometry(13, 500), mat(0x252d35, 0.94));
road.rotation.x = -Math.PI / 2;
road.position.set(0, -0.08, -205);
road.receiveShadow = true;
scene.add(road);

const snowMat = mat(0xdce6eb, 0.98);
for (const x of [-8, 8]) {
  const snowBank = new THREE.Mesh(new THREE.BoxGeometry(3, 0.13, 500), snowMat);
  snowBank.position.set(x, -0.02, -205);
  snowBank.receiveShadow = true;
  scene.add(snowBank);
}

// Linha tracejada da pista.
const laneMarks = [];
const lineMat = mat(0xd5e0e6, 0.8);
for (let z = 18; z > -480; z -= 12) {
  for (const x of [-2.15, 2.15]) {
    const mark = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.025, 4.3), lineMat);
    mark.position.set(x, 0.005, z);
    scene.add(mark);
    laneMarks.push(mark);
  }
}

// Barreiras da ponte com postes.
const movingRoadside = [];
for (let z = 18; z > -480; z -= 5) {
  for (const x of [-6.25, 6.25]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.72, 4.7), mat(0xbccbd5, 0.6, 0.15));
    rail.position.set(x, 0.42, z);
    rail.castShadow = true;
    scene.add(rail);
    movingRoadside.push(rail);

    const post = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.95, 0.2), mat(0x3c4b56, 0.7, 0.2));
    post.position.set(x, 0.47, z - 2.25);
    scene.add(post);
    movingRoadside.push(post);
  }
}

// Montanhas ao longe.

 // Montanhas distantes, menores e fora da pista.
 for (let i = 0; i < 42; i++) {
   const height = 5 + Math.random() * 8;
   const width = 3 + Math.random() * 5;

   const mountain = new THREE.Mesh(
     new THREE.ConeGeometry(width, height, 7),
     mat(i % 2 ? 0x667987 : 0x8496a3, 1)
   );

   const side = i % 2 ? 1 : -1;

   mountain.position.set(
     side * (23 + Math.random() * 20),
     height / 2 - 1,
     -50 - Math.random() * 350
   );

   mountain.rotation.y = Math.random() * Math.PI;
   scene.add(mountain);
 }


// Neve em partículas.
const snowCount = 1200;
const snowPositions = new Float32Array(snowCount * 3);
for (let i = 0; i < snowCount; i++) {
  snowPositions[i * 3] = (Math.random() - 0.5) * 60;
  snowPositions[i * 3 + 1] = Math.random() * 24;
  snowPositions[i * 3 + 2] = -Math.random() * 300 + 25;
}
const snowGeometry = new THREE.BufferGeometry();
snowGeometry.setAttribute("position", new THREE.BufferAttribute(snowPositions, 3));
const snow = new THREE.Points(snowGeometry, new THREE.PointsMaterial({
  color: 0xffffff, size: 0.11, transparent: true, opacity: 0.82, depthWrite: false
}));
scene.add(snow);

// Cidade procedural: prédios, calçadas, pedestres, bicicletas e cones.
const environmentObjects = [];
// Fachadas procedurais com textura de pedra e janelas iluminadas.
// Esta adaptação mantém o renderer WebGL do jogo, sem importar cenas WebGPU incompatíveis.
function makeFacadeTexture(baseHex, seed) {
  const canvasTexture = document.createElement("canvas");
  canvasTexture.width = 512;
  canvasTexture.height = 512;
  const ctx = canvasTexture.getContext("2d");
  const base = new THREE.Color(baseHex);
  ctx.fillStyle = `rgb(${Math.round(base.r * 255)},${Math.round(base.g * 255)},${Math.round(base.b * 255)})`;
  ctx.fillRect(0, 0, 512, 512);
  for (let y = 0; y < 512; y += 32) {
    ctx.fillStyle = "rgba(7,13,20,0.24)"; ctx.fillRect(0, y, 512, 3);
    ctx.fillStyle = "rgba(210,224,234,0.09)"; ctx.fillRect(0, y + 4, 512, 2);
  }
  let n = seed + 17;
  const rand = () => { n = (n * 1664525 + 1013904223) >>> 0; return n / 4294967296; };
  for (let y = 18; y < 500; y += 42) {
    for (let x = 18; x < 500; x += 42) {
      ctx.fillStyle = rand() > 0.55 ? "rgba(255,205,126,0.9)" : "rgba(8,18,28,0.92)";
      ctx.fillRect(x, y, 22, 27);
      ctx.strokeStyle = "rgba(195,208,218,0.42)"; ctx.lineWidth = 2;
      ctx.strokeRect(x - 2, y - 2, 26, 31);
      ctx.fillStyle = "rgba(180,200,210,0.3)"; ctx.fillRect(x + 10, y, 2, 27);
    }
  }
  const texture = new THREE.CanvasTexture(canvasTexture);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  return texture;
}
const cityPalette = [0x3a4b5b, 0x596b7b, 0x293b4a, 0x78818a, 0x354858];
const cityMaterials = cityPalette.map((color, index) => new THREE.MeshStandardMaterial({
  color: 0xffffff, map: makeFacadeTexture(color, index + 1), roughness: 0.88, metalness: 0.08
}));
const windowMat = new THREE.MeshStandardMaterial({
  color: 0xffdca0, emissive: 0xffb94a, emissiveIntensity: 0.22, roughness: 0.55
});

function addBuilding(x, z, width, height, depth, material) 
  const group = new THREE.Group();
  const building = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
  building.position.y = height / 2;
  building.castShadow = true;
  building.receiveShadow = true;
  group.add(building);
  
  // Detalhes extras na fachada dos prédios.
### PARTE 2 DE 3

```javascript
  const facadeDetail = new THREE.Group();

  // Faixas verticais para dar profundidade à fachada.
  const stripeMaterial = new THREE.MeshStandardMaterial({
    color: 0x303946,
    roughness: 0.82,
    metalness: 0.12
  });

  const stripeCount = Math.max(2, Math.floor(width / 1.8));

  for (let i = 0; i <= stripeCount; i++) {
    const xPos = -width / 2 + (width * i / stripeCount);

    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(0.07, height, 0.08),
      stripeMaterial
    );

    stripe.position.set(xPos, height / 2, depth / 2 + 0.045);
    facadeDetail.add(stripe);
  }

  // Pequenas faixas horizontais entre os andares.
  const floorMaterial = new THREE.MeshStandardMaterial({
    color: 0x89939e,
    roughness: 0.9,
    metalness: 0.05
  });

  const floorCount = Math.floor(height / 2.8);

  for (let i = 1; i < floorCount; i++) {
    const floorLine = new THREE.Mesh(
      new THREE.BoxGeometry(width, 0.055, 0.09),
      floorMaterial
    );

    floorLine.position.set(0, i * 2.8, depth / 2 + 0.05);
    facadeDetail.add(floorLine);
  }

  group.add(facadeDetail);

  // Janelas na fachada voltada para a rua (mais próximas da câmera), em fileiras.
  const rows = Math.min(10, Math.max(3, Math.floor(height / 2.15)));
  const roadSide = x < 0 ? 1 : -1;
  for (let row = 1; row < rows; row++) {
    for (let col = 0; col < 3; col++) {
      const win = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.62, 0.48), windowMat);
      win.position.set(roadSide * (width / 2 + 0.028), row * height / rows, (col - 1) * depth * 0.27);
      group.add(win);
    }
    // Frisos de pedra que dão relevo à fachada.
    if (row % 2 === 0) {
      const ledge = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.075, depth * 0.92), mat(0x89949c, 0.78, 0.12));
      ledge.position.set(roadSide * (width / 2 + 0.035), row * height / rows + 0.36, 0);
      group.add(ledge);
    }
  }
  // Pináculos e telhado escalonado inspirados na cidade gótica do exemplo.
  const roof = new THREE.Mesh(new THREE.BoxGeometry(width * 0.88, 0.42, depth * 0.88), mat(0x263642, 0.72, 0.18));
  roof.position.y = height + 0.18;
  group.add(roof);
  if (height > 17) {
    const spire = new THREE.Mesh(new THREE.ConeGeometry(Math.min(width * 0.2, 0.8), Math.min(height * 0.22, 5.5), 5), material);
    spire.position.set(0, height + 2.8, 0);
    group.add(spire);
  }
  group.position.set(x, 0, z);
  scene.add(group);
  environmentObjects.push(group);
}
for (let z = 18; z > -430; z -= 17) {
  const h1 = 9 + Math.random() * 24;
  const h2 = 8 + Math.random() * 28;
  addBuilding(-12.5 - Math.random() * 4, z, 5 + Math.random() * 4, h1, 7 + Math.random() * 3, cityMaterials[Math.floor(Math.random()*cityMaterials.length)]);
  addBuilding(12.5 + Math.random() * 4, z - 8, 5 + Math.random() * 4, h2, 7 + Math.random() * 3, cityMaterials[Math.floor(Math.random()*cityMaterials.length)]);
}

// Calçadas e postes de luz.
for (const side of [-1, 1]) {
  const sidewalk = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.16, 500), mat(0x69747b, 0.95));
  sidewalk.position.set(side * 7.45, 0.01, -205);
  sidewalk.receiveShadow = true;
  scene.add(sidewalk);
  for (let z = 14; z > -470; z -= 28) {
    const pole = new THREE.Group();
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 4.4, 8), mat(0x29333b, 0.6, 0.4));
    post.position.y = 2.2;
    pole.add(post);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.08, 0.08), mat(0x29333b, 0.6, 0.4));
    arm.position.set(-side * 0.35, 4.25, 0);
    pole.add(arm);
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.12, 0.24), new THREE.MeshStandardMaterial({color:0xffedb0, emissive:0xffd16a, emissiveIntensity:0.4}));
    lamp.position.set(-side * 0.7, 4.2, 0);
    pole.add(lamp);
    pole.position.set(side * 7.95, 0, z);
    scene.add(pole);
    environmentObjects.push(pole);
  }
}

// Pedestres estilizados nas calçadas.
function addPedestrian(x, z, shirtColor) {
  const g = new THREE.Group();
  const skin = mat(0xd7a47e, 0.8);
  const shirt = mat(shirtColor, 0.85);
  const pants = mat(0x202a36, 0.9);
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.55, 4, 8), shirt);
  torso.position.y = 1.08; g.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 10), skin);
  head.position.y = 1.62; g.add(head);
  for (const lx of [-0.12, 0.12]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.09, 0.52, 8), pants);
    leg.position.set(lx, 0.42, 0); g.add(leg);
  }
  g.position.set(x, 0, z);
  scene.add(g); environmentObjects.push(g);
}
for (let i = 0; i < 18; i++) {
  const side = i % 2 ? 1 : -1;
  addPedestrian(side * (7.0 + Math.random() * 0.8), 12 - i * 24, [0x2c8ca4,0xb44d4d,0xd6a23c,0x647ec4][i%4]);
}

// Bicicletas simples em silhueta, nas calçadas.
function addBicycle(x, z) {
  const g = new THREE.Group();
  const frameMat = mat(0xe64d55, 0.45, 0.25);
  for (const wx of [-0.52, 0.52]) {
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.035, 8, 18), mat(0x171b20, 0.8));
    wheel.position.set(wx, 0.34, 0); g.add(wheel);
  }
  const bar1 = new THREE.Mesh(new THREE.CylinderGeometry(0.025,0.025,0.75,6), frameMat);
  bar1.rotation.z = Math.PI/3; bar1.position.set(-0.18,0.48,0); g.add(bar1);
  const bar2 = new THREE.Mesh(new THREE.CylinderGeometry(0.025,0.025,0.75,6), frameMat);
  bar2.rotation.z = -Math.PI/3; bar2.position.set(0.18,0.48,0); g.add(bar2);
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.24,0.06,0.1), mat(0x171b20));
  seat.position.set(-0.18,0.78,0); g.add(seat);
  g.position.set(x,0,z); scene.add(g); environmentObjects.push(g);
}
addBicycle(-7.05, -30);
addBicycle(7.05, -155);
addBicycle(-7.05, -285);

// Cones laranja com faixas claras refletivas.
const cones = [];
function addCone(x, z) {
  const g = new THREE.Group();
  const orange = mat(0xff681e, 0.4, 0.05);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.28,0.32,0.08,16), mat(0x22282d));
  base.position.y = 0.04; g.add(base);
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.22,0.72,16), orange);
  cone.position.y = 0.43; cone.castShadow = true; g.add(cone);
  const reflective = new THREE.MeshStandardMaterial({color:0xffffff, emissive:0xcbd7df, emissiveIntensity:1.8, roughness:0.18, metalness:0.22});
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.145,0.18,0.105,20), reflective);
  band.position.y = 0.43; g.add(band);
  const band2 = new THREE.Mesh(new THREE.CylinderGeometry(0.095,0.125,0.075,20), reflective);
  band2.position.y = 0.59; g.add(band2);
  g.position.set(x,0,z); scene.add(g); cones.push(g); environmentObjects.push(g);
}
for (let i=0;i<12;i++) addCone(i%2 ? 5.45 : -5.45, -20-i*31);

// Lista de veículos que podem colidir com o jogador.
// Declarada antes da viatura porque ela também é adicionada ao tráfego.
const traffic = [];

// Viatura policial com giroflex; ela entra no tráfego como obstáculo.
// Cria uma viatura policial detalhada em 3D.
function createPoliceCar(x, z) {
  const g = new THREE.Group();

  const whitePaint = new THREE.MeshPhysicalMaterial({
    color: 0xf0f2f4,
    roughness: 0.25,
    metalness: 0.25,
    clearcoat: 0.8
  });

  const blackPaint = mat(0x111820, 0.3, 0.4);
  const bluePaint = mat(0x12345a, 0.32, 0.3);

  const glass = new THREE.MeshPhysicalMaterial({
    color: 0x172b3b,
    roughness: 0.12,
    metalness: 0.2,
    clearcoat: 1
  });

  const chrome = mat(0xb9c4cc, 0.22, 0.85);
  const tireMat = mat(0x090d11, 0.85);
  const rimMat = mat(0xaebbc4, 0.25, 0.8);

  function part(geometry, material, x, y, z) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    g.add(mesh);
    return mesh;
  }

  // Carroceria principal.
  part(
    new THREE.BoxGeometry(1.96, 0.55, 3.72),
    whitePaint, 0, 0.66, 0
  );

  // Capô e porta-malas.
  part(
    new THREE.BoxGeometry(1.82, 0.16, 1.05),
    whitePaint, 0, 0.92, -1.2
  );

  part(
    new THREE.BoxGeometry(1.78, 0.16, 0.78),
    whitePaint, 0, 0.9, 1.42
  );

  // Cabine e vidros.
  part(
    new THREE.BoxGeometry(1.48, 0.53, 1.62),
    glass, 0, 1.08, 0.02
  );

  part(
    new THREE.BoxGeometry(1.3, 0.35, 0.06),
    glass, 0, 1.13, -0.8
  );

  part(
    new THREE.BoxGeometry(1.28, 0.32, 0.06),
    glass, 0, 1.12, 0.83
  );

  // Faixa azul lateral.
  part(
    new THREE.BoxGeometry(1.99, 0.16, 2.05),
    bluePaint, 0, 0.73, 0.05
  );

  // Detalhes laterais.
  for (const side of [-1, 1]) {
    // Molduras das portas.
    part(
      new THREE.BoxGeometry(0.035, 0.3, 0.72),
      blackPaint, side * 0.99, 0.76, -0.18
    );

    part(
      new THREE.BoxGeometry(0.035, 0.3, 0.72),
      blackPaint, side * 0.99, 0.76, 0.62
    );

    // Retrovisores.
    part(
      new THREE.BoxGeometry(0.2, 0.12, 0.22),
      blackPaint, side * 0.91, 1.0, -0.55
    );

    // Maçanetas.
    part(
      new THREE.BoxGeometry(0.035, 0.045, 0.18),
      chrome, side * 1.005, 0.87, 0.18
    );
  }

  // Para-choques.
  part(
    new THREE.BoxGeometry(1.94, 0.18, 0.18),
    blackPaint, 0, 0.43, -1.9
  );

  part(
    new THREE.BoxGeometry(1.94, 0.16, 0.18),
    blackPaint, 0, 0.43, 1.9
  );

  // Grade dianteira.
  part(
    new THREE.BoxGeometry(0.72, 0.18, 0.04),
    blackPaint, 0, 0.61, -1.94
  );

  // Faróis.
  const headlightMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xcceaff,
    emissiveIntensity: 2
  });

  for (const side of [-1, 1]) {
    part(
      new THREE.BoxGeometry(0.38, 0.15, 0.06),
      headlightMat, side * 0.65, 0.76, -1.91
    );

    part(
      new THREE.BoxGeometry(0.34, 0.12, 0.06),
      new THREE.MeshStandardMaterial({
        color: 0xff1527,
        emissive: 0xff0011,
        emissiveIntensity: 1.2
      }),
      side * 0.65, 0.75, 1.91
    );
  }

  // Giroflex.
  part(
    new THREE.BoxGeometry(0.85, 0.1, 0.22),
    blackPaint, 0, 1.39, 0.05
  );

  const red = part(
    new THREE.BoxGeometry(0.34, 0.13, 0.2),
    new THREE.MeshStandardMaterial({
      color: 0xff1535,
      emissive: 0xff001e,
      emissiveIntensity: 3
    }),
    -0.22, 1.49, 0.05
  );

  const blue = part(
    new THREE.BoxGeometry(0.34, 0.13, 0.2),
    new THREE.MeshStandardMaterial({
      color: 0x167bff,
      emissive: 0x004cff,
      emissiveIntensity: 0.3
    }),
    0.22, 1.49, 0.05
  );

  // Rodas com pneus e aros.
  for (const wx of [-0.98, 0.98]) {
    for (const wz of [-1.22, 1.22]) {
      const wheel = part(
        new THREE.CylinderGeometry(0.32, 0.32, 0.2, 24),
        tireMat, wx, 0.36, wz
      );

      wheel.rotation.z = Math.PI / 2;

      const rim = part(
        new THREE.CylinderGeometry(0.2, 0.2, 0.215, 16),
        rimMat, wx * 1.01, 0.36, wz
      );

      rim.rotation.z = Math.PI / 2;
    }
  }

  g.position.set(x, 0, z);
  scene.add(g);

  return {
    group: g,
    redLight: red,
    blueLight: blue
  };
}
// A viatura começa atrás do jogador e o persegue durante toda a fuga.
// Viatura policial posicionada atrás do jogador.
const police = createPoliceCar(2.5, 9.6);
police.group.scale.setScalar(1.08);
police.group.visible = true;
police.group.position.y = 0;

// Seletor de clima e horário.
const weatherSelect = $("weatherSelect");
function setWeather(mode) {
  const presets = {
    sunset: {sky:0xc17b63, fog:0xc17b63, fogDensity:0.008, hemi:0xffd9bf, sun:0xffa56d, exposure:1.15, particles:0.05},
    day:    {sky:0x8bbbd8, fog:0x8bbbd8, fogDensity:0.0045, hemi:0xe2f4ff, sun:0xfff1d2, exposure:1.25, particles:0},
    night:  {sky:0x07111f, fog:0x07111f, fogDensity:0.008, hemi:0x7895bd, sun:0x7699d8, exposure:0.72, particles:0},
    rain:   {sky:0x4b5c69, fog:0x4b5c69, fogDensity:0.012, hemi:0xb5c7d4, sun:0x9eb4c9, exposure:0.85, particles:0.95},
    snow:   {sky:0x9aafbf, fog:0x9aafbf, fogDensity:0.0105, hemi:0xdceeff, sun:0xfff3e4, exposure:1.1, particles:0.82}
  };
  const p = presets[mode] || presets.sunset;
  scene.background.setHex(p.sky);
  scene.fog.color.setHex(p.fog);
  scene.fog.density = p.fogDensity;
  scene.children.forEach(obj => {
    if (obj.isHemisphereLight) obj.color.setHex(p.hemi);
    if (obj.isDirectionalLight && obj !== blueFill) obj.color.setHex(p.sun);
  });
  renderer.toneMappingExposure = p.exposure;
  snow.material.color.setHex(mode === "rain" ? 0x9cc7e8 : 0xffffff);
  snow.material.size = mode === "rain" ? 0.065 : 0.11;
  snow.material.opacity = p.particles;
  snow.visible = p.particles > 0;
  if (mode === "night") {
    windowMat.emissiveIntensity = 1.6;
    windowMat.color.setHex(0xffd27a);
  } else {
    windowMat.emissiveIntensity = mode === "day" ? 0.05 : 0.35;
  }
}
if (weatherSelect) {
  weatherSelect.addEventListener("change", () => setWeather(weatherSelect.value));
  setWeather(weatherSelect.value);
}


// Jogador: o grupo fica como referência estável para colisões e controles.
const player = new THREE.Group();
player.position.set(0, 0, 4);
scene.add(player);
let playerVisual = new THREE.Group();
player.add(playerVisual);

function createFallbackCar(parent) {
  const bodyMat = mat(0xc92532, 0.25, 0.55);
  const glassMat = new THREE.MeshPhysicalMaterial({ color: 0x132532, roughness: 0.14, metalness: 0.2, clearcoat: 1 });
  const tireMat = mat(0x090d11, 0.85);
  const rimMat = mat(0xa4b1bb, 0.28, 0.8);
  const headlightMat = new THREE.MeshStandardMaterial({ color: 0xeaf7ff, emissive: 0x9bdcff, emissiveIntensity: 1.8 });

  function addBox(w, h, d, material, x, y, z) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  addBox(2.05, 0.53, 4.15, bodyMat, 0, 0.68, 0);
  addBox(1.9, 0.22, 1.2, bodyMat, 0, 0.87, -1.35);
  addBox(1.5, 0.62, 1.65, glassMat, 0, 1.12, 0.05);
  addBox(1.22, 0.12, 0.9, bodyMat, 0, 1.46, 0.05);
  addBox(1.5, 0.12, 0.16, mat(0x171b20), 0, 0.55, -2.12);
  addBox(1.5, 0.12, 0.16, mat(0x9e202b), 0, 0.6, 2.12);
  for (const x of [-0.68, 0.68]) {
    addBox(0.45, 0.1, 0.06, headlightMat, x, 0.79, -2.12);
    addBox(0.35, 0.1, 0.06, mat(0xff2538), x, 0.76, 2.12);
  }
  for (const x of [-1, 1]) {
    for (const z of [-1.35, 1.3]) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.24, 24), tireMat);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(x, 0.42, z);
      wheel.castShadow = true;
      parent.add(wheel);
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.255, 16), rimMat);
      rim.rotation.z = Math.PI / 2;
      rim.position.set(x * 1.01, 0.42, z);
      parent.add(rim);
    }
  }
  addBox(1.3, 0.07, 0.2, bodyMat, 0, 1.12, 1.95);
}
createFallbackCar(playerVisual);

// Ferrari 458 Italia do exemplo oficial do Three.js.
// O modelo pode usar Draco; o decoder abaixo permite carregar esse tipo de GLB.
// O arquivo é servido pelo Three.js oficial, então é necessária conexão com a internet.
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath("https://unpkg.com/three@0.160.0/examples/jsm/libs/draco/gltf/");
const gltfLoader = new GLTFLoader();
gltfLoader.setDRACOLoader(dracoLoader);
gltfLoader.setCrossOrigin("anonymous");
const ferrariUrl = "https://threejs.org/examples/models/gltf/ferrari.glb";

gltfLoader.load(
  ferrariUrl,
  (gltf) => {
    const carModel = gltf.scene;
    const initialBox = new THREE.Box3().setFromObject(carModel);
    const initialSize = initialBox.getSize(new THREE.Vector3());
    const maxDimension = Math.max(initialSize.x, initialSize.y, initialSize.z);
    if (maxDimension > 0) carModel.scale.setScalar(4.25 / maxDimension);
   carModel.rotation.y = 0;
    let box = new THREE.Box3().setFromObject(carModel);
    const center = box.getCenter(new THREE.Vector3());
    carModel.position.x -= center.x;
    carModel.position.z -= center.z;
    box = new THREE.Box3().setFromObject(carModel);
    carModel.position.y -= box.min.y;
    carModel.traverse((obj) => {
      if (obj.isMesh) { obj.castShadow = true; obj.receiveShadow = true; }
    });
    player.remove(playerVisual);
    playerVisual = carModel;
    player.add(playerVisual);
    loadingLabel.textContent = "FERRARI 458 CARREGADA";
    loadingLabel.classList.remove("hidden");
    window.setTimeout(() => loadingLabel.classList.add("hidden"), 1200);
    console.info("Ferrari 458 Italia carregada do exemplo oficial do Three.js.");
  },
  undefined,
  (error) => {
    console.error("Falha ao carregar Ferrari 458 Italia. Confira a internet e o Console.", error);
    loadingLabel.textContent = "FERRARI NÃO CARREGOU — CARRO RESERVA ATIVO";
    loadingLabel.classList.remove("hidden");
    window.setTimeout(() => loadingLabel.classList.add("hidden"), 3500);
  }
);

// Tráfego civil.
const trafficColors = [0x6e8799, 0x283a4b, 0xd0d5d8, 0x8d3037, 0x30363d];

function createTrafficCar(x, z, color) {
  const group = new THREE.Group();
  const paint = mat(color, 0.32, 0.35);
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.62, 3.35), paint);
  body.position.y = 0.58;
  body.castShadow = true;
  group.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.52, 1.3), mat(0x172a38, 0.2, 0.15));
  cabin.position.set(0, 1.02, 0.08);
  group.add(cabin);
  for (const wx of [-0.92, 0.92]) {
    for (const wz of [-1.03, 1.03]) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.31, 0.2, 14), mat(0x090d11, 0.85));
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(wx, 0.34, wz);
      group.add(wheel);
    }
  }
  group.position.set(x, 0, z);
  scene.add(group);
  traffic.push(group);
}
for (let i = 0; i < 9; i++) {
  createTrafficCar([-4.2, 0, 4.2][i % 3], -35 - i * 34, trafficColors[i % trafficColors.length]);
}

function showError(message) {
  errorMessage.textContent = message;
  errorMessage.classList.remove("hidden");
}


// Atualiza os números exibidos na tela durante a corrida.
function updateHUD() {
  if (distanceEl) {
    distanceEl.textContent = `${Math.floor(distance)} m`;
  }

  if (speedEl) {
    speedEl.textContent = `${Math.round(speed * 3.6)} km/h`;
  }

  if (scoreEl) {
    scoreEl.textContent = Math.floor(score);
  }
}

function startGame() {
  // Reinicia o estado da corrida.
  running = true;
  distance = 0;
  score = 0;
  speed = 0;
  steering = 0;
  elapsed = 0;
  player.position.set(0, 0, 4);
  player.rotation.set(0, 0, 0);

  traffic.forEach((car, index) => {
    car.position.x = [-4.2, 0, 4.2][index % 3];
    car.position.z = -35 - index * 34;
  });
  police.group.position.set(2.5, 0, player.position.z + 5.6);
  police.group.rotation.set(0, 0, 0);

  overlay.classList.add("hidden");
  gameOverScreen.classList.add("hidden");
  hud.classList.remove("hidden");
  mobileControls.classList.remove("hidden");
  errorMessage.classList.add("hidden");
  updateHUD();
}

// Finaliza a corrida e mostra o motivo.
function finishGame(reason = "caught") {
  if (!running) return;

  running = false;
  releaseMobileKeys();
  mobileControls.classList.add("hidden");
  hud.classList.add("hidden");

  const title = gameOverScreen.querySelector("h2");

  if (title) {
    if (reason === "crash") {
      title.innerHTML = 'VOCÊ <br><span>BATEU!</span>';
    } else {
      title.innerHTML = 'VOCÊ FOI<br><span>ALCANÇADO</span>';
    }
  }

  finalStats.textContent =
    `Distância: ${Math.floor(distance)} m · Pontos: ${score}`;

  gameOverScreen.classList.remove("hidden");
}
  // Eventos dos botões — os IDs correspondem ao index.html.
startButton.addEventListener("click", startGame);
restartButton.addEventListener("click", startGame);

window.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();

  if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(key)) {
    event.preventDefault();
  }

  keys[key] = true;
});

window.addEventListener("keyup", (event) => {
  keys[event.key.toLowerCase()] = false;
});

window.addEventListener("blur", () => {
  for (const key of Object.keys(keys)) {
    keys[key] = false;
  }
});

// Renderiza mesmo antes de iniciar, para o cenário aparecer atrás do menu.
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  const dt = Math.min(clock.getDelta(), 0.04);
  elapsed += dt;

  if (running) {
    const accelerating = keys.w || keys.arrowup;
    const braking = keys.s || keys.arrowdown;

    // Velocidade maior para uma fuga mais rápida.
    const targetSpeed = accelerating ? 78 : braking ? 10 : 36;

    speed = THREE.MathUtils.damp(
      speed,
      targetSpeed,
      accelerating ? 2.35 : 2.0,
      dt
    );

    const left = keys.a || keys.arrowleft;
    const right = keys.d || keys.arrowright;

    if (left) steering -= dt * 6.2;
    if (right) steering += dt * 6.2;

    steering = THREE.MathUtils.clamp(steering, -4.65, 4.65);

    player.position.x = THREE.MathUtils.damp(
      player.position.x,
      steering,
      5,
      dt
    );

    player.rotation.z = THREE.MathUtils.damp(
      player.rotation.z,
      (left ? 0.075 : 0) - (right ? 0.075 : 0),
      5,
      dt
    );

    const movement = speed * dt * 0.82;

    distance += movement * 2.5;
    score = Math.floor(distance / 2);

    // Linhas da pista.
    for (const mark of laneMarks) {
      mark.position.z += movement;

      if (mark.position.z > 14) {
        mark.position.z -= 500;
      }
    }

    // Barreiras laterais.
    for (const piece of movingRoadside) {
      piece.position.z += movement;

      if (piece.position.z > 14) {
        piece.position.z -= 500;
      }
    }

    // Cenário, prédios, postes, pedestres, bicicletas e cones.
    for (const obj of environmentObjects) {
      obj.position.z += movement * 0.78;

      if (obj.position.z > 24) {
        obj.position.z -= 470;
      }
    }

    // Movimento do trânsito e colisão com o carro do jogador.
    for (const car of traffic) {
      car.position.z += movement * (0.8 + speed / 55);

      if (car.position.z > 13) {
        car.position.z = -260 - Math.random() * 100;
        car.position.x = [-4.2, 0, 4.2][
          Math.floor(Math.random() * 3)
        ];
      }

      if (
        Math.abs(car.position.z - player.position.z) < 2.15 &&
        Math.abs(car.position.x - player.position.x) < 1.55
      ) {
        finishGame("crash");
        break;
      }
    }

    // Perseguição policial com desvio de trânsito.
    const policeGroup = police.group;

    const desiredX = THREE.MathUtils.clamp(
      player.position.x + 6.5,
      -4.5,
      4.5
    );

    // Distância de segurança em relação aos outros carros.
    function policePositionBlocked(x, z) {
      return traffic.some((car) => {
        const dx = Math.abs(car.position.x - x);
        const dz = Math.abs(car.position.z - z);

        return dx < 2.15 && dz < 4.2;
      });
    }

    // Procura uma faixa livre para a viatura.
    const lanes = [-4.2, 0, 4.2, desiredX].sort(
      (a, b) => Math.abs(a - desiredX) - Math.abs(b - desiredX)
    );

    let targetX = policeGroup.position.x;
    let laneFound = false;

    for (const lane of lanes) {
      if (!policePositionBlocked(lane, policeGroup.position.z)) {
        targetX = lane;
        laneFound = true;
        break;
      }
    }

    // Tenta desviar lateralmente dos carros.
    if (laneFound) {
      const nextX = THREE.MathUtils.damp(
        policeGroup.position.x,
        targetX,
        3.2,
        dt
      );

      let pathBlocked = false;

      for (const car of traffic) {
        const dz = Math.abs(
          car.position.z - policeGroup.position.z
        );

        const minX = Math.min(
          policeGroup.position.x,
          nextX
        );

        const maxX = Math.max(
          policeGroup.position.x,
          nextX
        );

        if (
          dz < 3.6 &&
          car.position.x + 2.15 > minX &&
          car.position.x - 2.15 < maxX
        ) {
          pathBlocked = true;
          break;
        }
      }

      if (!pathBlocked) {
        policeGroup.position.x = nextX;
      } else {
        // Se a faixa atual estiver bloqueada, procura uma alternativa.
        for (const lane of lanes) {
          if (
            Math.abs(lane - policeGroup.position.x) > 0.5 &&
            !policePositionBlocked(
              lane,
              policeGroup.position.z
            )
          ) {
            policeGroup.position.x = THREE.MathUtils.damp(
              policeGroup.position.x,
              lane,
              4.0,
              dt
            );

            break;
          }
        }
      }
    }

    // Mantém a viatura dentro dos limites da pista.
    policeGroup.position.x = THREE.MathUtils.clamp(
      policeGroup.position.x,
      -4.7,
      4.7
    );

    // Verifica se há um carro imediatamente à frente da viatura.
    let blockedAhead = false;

    for (const car of traffic) {
      const dx = Math.abs(
        car.position.x - policeGroup.position.x
      );

      const dz = car.position.z - policeGroup.position.z;

      if (dx < 2.15 && dz > -3.8 && dz < 4.2) {
        blockedAhead = true;
        break;
      }
    }

    // A viatura reduz a aproximação quando há obstáculos.
    const catchSpeed =
      speed < 15 ? 2.8 :
      speed < 25 ? 1.8 :
      speed < 38 ? 0.8 :
      0.15;

    // Perseguição: a polícia acompanha o jogador.
    const policeTargetZ = player.position.z + 6.5;

    const policeFollowSpeed = blockedAhead ? 0.7 : 1.2;

    policeGroup.position.z = THREE.MathUtils.damp(
      policeGroup.position.z,
      policeTargetZ,
      policeFollowSpeed,
      dt
    );

    // Impede que a viatura ultrapasse o jogador.
    policeGroup.position.z = Math.max(
      player.position.z + 5.5,
      policeGroup.position.z
    );

    // Verifica se a polícia alcançou o jogador.
    const distanceToPlayer = Math.abs(
      policeGroup.position.z - player.position.z
    );

    const lateralDistance = Math.abs(
      policeGroup.position.x - player.position.x
    );

    if (
      distanceToPlayer < 2.5 &&
      lateralDistance < 1.8
    ) {
      finishGame();
    }

    // Giroflex alternando vermelho e azul.
    const sirenPulse = Math.sin(elapsed * 13) > 0;

    police.redLight.material.emissiveIntensity =
      sirenPulse ? 3.6 : 0.25;

    police.blueLight.material.emissiveIntensity =
      sirenPulse ? 0.25 : 3.6;

    // Atualização das partículas de chuva ou neve.
    const positions = snow.geometry.attributes.position;

    for (let i = 0; i < snowCount; i++) {
      positions.array[i * 3 + 1] -=
        dt * (
          weatherSelect && weatherSelect.value === "rain"
            ? 10.5
            : 2.1
        );

      positions.array[i * 3 + 2] += movement * 0.75;

      if (positions.array[i * 3 + 1] < 0) {
        positions.array[i * 3 + 1] = 24;
      }

      if (positions.array[i * 3 + 2] > 25) {
        positions.array[i * 3 + 2] = -275;
      }
    }

    positions.needsUpdate = true;

    updateHUD();
  }

  // Câmera acompanha o carro suavemente.
  camera.position.x = THREE.MathUtils.damp(
    camera.position.x,
    player.position.x * 0.45,
    2.2,
    dt
  );

  camera.position.y = THREE.MathUtils.damp(
    camera.position.y,
    5.7,
    2,
    dt
  );

  camera.lookAt(
    player.position.x * 0.22,
    0.9,
    -6.5
  );

  renderer.render(scene, camera);
}

// Redimensionamento para celular, tablet e computador.
window.addEventListener("resize", () => {
  const width = window.innerWidth;
  const height = window.innerHeight;

  camera.aspect = width / height;
  camera.updateProjectionMatrix();

  renderer.setSize(width, height);
  renderer.setPixelRatio(
    Math.min(devicePixelRatio || 1, 1.8)
  );
});

// Erros fatais são exibidos na própria página.
window.addEventListener("error", (event) => {
  if (event.message) {
    showError(`Erro no jogo: ${event.message}`);
  }
});

window.addEventListener("unhandledrejection", (event) => {
  const reason = event.reason;

  if (reason) {
    showError(
      `Falha ao carregar um recurso: ${reason.message || reason}`
    );
  }
});

// INICIA A ANIMAÇÃO DO JOGO.
animate(); 