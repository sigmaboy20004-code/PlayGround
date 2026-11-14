import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.164.1/build/three.module.js';

const $ = (id) => document.getElementById(id);
const ui = {
  title: $('title-screen'), hud: $('hud'), objective: $('objective'), objectiveText: $('objective-text'),
  prompt: $('prompt'), promptText: $('prompt-text'), dialogue: $('dialogue'), speaker: $('speaker'),
  dialogueText: $('dialogue-text'), continue: $('continue-btn'), controls: $('controls'), caption: $('intro-caption'),
  ending: $('ending'), loading: $('loading'), sound: $('sound-btn'), action: $('action-btn'),
};
const canvas = $('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.14;
renderer.shadowMap.enabled = false; // Keep the procedural scene responsive on mobile and software-rendered devices.
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x090d1c);
scene.fog = new THREE.FogExp2(0x090d1c, 0.018);
const camera = new THREE.PerspectiveCamera(54, window.innerWidth / window.innerHeight, 0.1, 140);
const clock = new THREE.Clock();
const world = new THREE.Group(); scene.add(world);
const hemi = new THREE.HemisphereLight(0x96a6cf, 0x231b25, 1.65); scene.add(hemi);
const moon = new THREE.DirectionalLight(0xc3d3f2, 2.1); moon.position.set(-7, 14, 8); moon.castShadow = true;
moon.shadow.mapSize.set(1024, 1024); moon.shadow.camera.left = -22; moon.shadow.camera.right = 22; moon.shadow.camera.top = 22; moon.shadow.camera.bottom = -22; scene.add(moon);
const fill = new THREE.PointLight(0x4863ad, 24, 45); fill.position.set(1, 8, 3); scene.add(fill);
const mat = (color, roughness = .78, metalness = 0, emissive = 0x000000, intensity = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness, emissive, emissiveIntensity: intensity });
const M = {
  floor: mat(0x292a34), wall: mat(0x343440), trim: mat(0x7f6c59), burgundy: mat(0x672e36), velvet: mat(0x35222a), gold: mat(0xc39c5c, .4, .45),
  black: mat(0x11131b, .34, .55), blue: mat(0x202c48), red: mat(0x713a43), skin: mat(0xd0a47d), hair: mat(0x29232a), white: mat(0xd9d3c8),
  neonBlue: mat(0x253d79, .35, .1, 0x2849cc, 2), neonPink: mat(0x8e3158, .35, .05, 0xb51b65, 2), neonGold: mat(0x9b7138, .4, .1, 0xc07b23, 1.5),
};
let state = 'title', stage = 'city', player, parents = [], car, rain, rainPositions, rainVelocities;
let move = { up: false, down: false, left: false, right: false }, keys = {};
let worldTime = 0, introTime = 0, camAngle = 0, camTargetAngle = 0, nearTarget = null, dialogueAfter = null;
let soundOn = true, audioContext = null, ambientNodes = null;
let stageGoal = new THREE.Vector3(0, 0, 0);

function box(parent, size, position, material, options = {}) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.position.set(...position); mesh.castShadow = options.castShadow !== false; mesh.receiveShadow = options.receiveShadow !== false;
  if (options.rotation) mesh.rotation.set(...options.rotation);
  parent.add(mesh); return mesh;
}
function sphere(parent, radius, position, material, scale = [1, 1, 1]) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 12, 10), material);
  mesh.position.set(...position); mesh.scale.set(...scale); mesh.castShadow = true; parent.add(mesh); return mesh;
}
function cylinder(parent, r1, r2, height, position, material, segments = 10) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, height, segments), material);
  mesh.position.set(...position); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
}
function addText(parent, text, position, color = '#f6d28b', size = 0.34) {
  const c = document.createElement('canvas'), ctx = c.getContext('2d'); c.width = 512; c.height = 128;
  ctx.clearRect(0, 0, c.width, c.height); ctx.font = '700 58px Georgia'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.shadowColor = color; ctx.shadowBlur = 22; ctx.fillStyle = color; ctx.fillText(text, 256, 64);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sprite.position.set(...position); sprite.scale.set(size * 4, size, 1); parent.add(sprite); return sprite;
}
function clearWorld() {
  const sharedMaterials = new Set(Object.values(M));
  for (const child of [...world.children]) {
    child.traverse(object => {
      if (!object.isMesh && !object.isPoints && !object.isSprite) return;
      object.geometry?.dispose();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) {
        if (!material || sharedMaterials.has(material)) continue;
        for (const value of Object.values(material)) {
          if (value?.isTexture) value.dispose();
        }
        material.dispose();
      }
    });
    world.remove(child);
  }
  parents = []; player = null; car = null; rain = null;
}
function makeActor(kind, x, z) {
  const root = new THREE.Group(); root.position.set(x, 0, z); world.add(root);
  const isBruce = kind === 'bruce', isMartha = kind === 'martha';
  const coat = isBruce ? mat(0x253756) : isMartha ? mat(0x77525b) : mat(0x342d32);
  const head = sphere(root, isBruce ? .27 : .31, [0, 1.33, 0], M.skin, [0.83, 1, .83]);
  sphere(root, isBruce ? .28 : .32, [0, 1.55, .025], isMartha ? mat(0x49303a) : M.hair, [1, .56, .93]);
  box(root, [.55, .68, .34], [0, .79, 0], coat);
  box(root, [.22, .62, .23], [-.16, .33, .02], M.black); box(root, [.22, .62, .23], [.16, .33, .02], M.black);
  cylinder(root, .075, .09, .12, [-.23, .79, 0], M.skin); cylinder(root, .075, .09, .12, [.23, .79, 0], M.skin);
  if (isBruce) box(root, [.18, .16, .055], [0, .88, -.18], M.white, { castShadow: false });
  root.userData.kind = kind; root.userData.baseZ = z; root.userData.walkOffset = Math.random() * 5;
  root.userData.head = head;
  return root;
}
function makePlayer(x, z) { player = makeActor('bruce', x, z); player.userData.isPlayer = true; }
function makeParents(x, z, follow = false) {
  const dad = makeActor('thomas', x - .72, z);
  const mom = makeActor('martha', x + .72, z - .12);
  dad.userData.follow = follow; mom.userData.follow = follow; parents = [dad, mom];
}
function buildTheater() {
  clearWorld(); stage = 'theater'; scene.fog = new THREE.FogExp2(0x171421, .024); scene.background.set(0x171421);
  hemi.color.set(0xb7a6bb); hemi.groundColor.set(0x251a27); hemi.intensity = 1.2;
  moon.intensity = 1.0; fill.color.set(0xb74366); fill.position.set(0, 5, -8); fill.intensity = 18;
  box(world, [19, .5, 32], [0, -.3, 0], M.floor);
  box(world, [19, 8, .5], [0, 4, -15.7], M.wall); box(world, [.5, 8, 32], [-9.5, 4, 0], M.wall); box(world, [.5, 8, 32], [9.5, 4, 0], M.wall);
  box(world, [19, .5, 32], [0, 8, 0], mat(0x1c1c27));
  // gilt wall panels and low sconces
  for (const side of [-1, 1]) for (let z = -11; z <= 9; z += 5) {
    box(world, [.08, 3.8, 2.2], [side * 9.18, 3.2, z], M.trim);
    const lamp = box(world, [.13, .68, .33], [side * 9.04, 2.5, z], M.neonGold);
    const glow = new THREE.PointLight(0xe5a75f, 4, 5); glow.position.copy(lamp.position); world.add(glow);
  }
  // screen, velvet proscenium, flickering projected abstract image
  box(world, [10, 5.3, .65], [0, 4.2, -14.9], M.burgundy);
  box(world, [8.6, 4.1, .08], [0, 4.25, -14.48], mat(0x322c40, .9, 0, 0x252144, .38));
  box(world, [8.8, .14, .3], [0, 6.4, -14.35], M.gold);
  const seatCount = 5 * 7 * 7;
  const seatParts = [
    new THREE.InstancedMesh(new THREE.BoxGeometry(.3, .48, .3), M.velvet, seatCount),
    new THREE.InstancedMesh(new THREE.BoxGeometry(.31, .75, .25), M.burgundy, seatCount),
    new THREE.InstancedMesh(new THREE.BoxGeometry(.075, .36, .34), M.red, seatCount * 2),
  ];
  for (const part of seatParts) { part.castShadow = false; part.receiveShadow = false; world.add(part); }
  const seatTransform = new THREE.Object3D();
  let seatIndex = 0, armIndex = 0;
  for (let row = 0; row < 5; row++) for (let col = 0; col < 7; col++) {
    const x = -6.8 + col * 2.25, z = -10.3 + row * 4.05;
    for (let seat = 0; seat < 7; seat++) {
      const sx = x + seat * .34;
      seatTransform.position.set(sx, .42, z); seatTransform.updateMatrix(); seatParts[0].setMatrixAt(seatIndex, seatTransform.matrix);
      seatTransform.position.set(sx, .84, z - .13); seatTransform.updateMatrix(); seatParts[1].setMatrixAt(seatIndex, seatTransform.matrix);
      for (const side of [-1, 1]) {
        seatTransform.position.set(sx + side * .18, .57, z); seatTransform.updateMatrix(); seatParts[2].setMatrixAt(armIndex++, seatTransform.matrix);
      }
      seatIndex++;
    }
  }
  for (const part of seatParts) { part.instanceMatrix.needsUpdate = true; part.computeBoundingSphere(); }
  // center aisle and exit doors
  box(world, [2.4, .035, 27], [0, -.03, 0], mat(0x463c40));
  box(world, [4.1, 4.2, .28], [0, 2.1, 15.3], M.trim);
  box(world, [1.85, 3.5, .18], [-.95, 1.8, 15.05], M.burgundy);
  box(world, [1.85, 3.5, .18], [.95, 1.8, 15.05], M.burgundy);
  for (const x of [-.35, .35]) sphere(world, .075, [x, 1.75, 14.91], M.gold);
  addText(world, 'EXIT', [0, 4.3, 14.5], '#e8b967', .28);
  addText(world, 'WAYNE THEATRE', [0, 7.1, -14.1], '#edcf93', .24);
  makePlayer(0, -2.5); makeParents(0, -1.05, false);
  player.rotation.y = Math.PI;
  stageGoal.set(0, 0, 14.0);
  buildRain(120);
}
function buildCity() {
  clearWorld(); stage = 'city'; scene.fog = new THREE.FogExp2(0x090d1c, .017); scene.background.set(0x090d1c);
  hemi.color.set(0x9badd4); hemi.groundColor.set(0x20202a); hemi.intensity = 1.55;
  moon.intensity = 2.15; fill.color.set(0x405bc2); fill.position.set(-5, 8, 3); fill.intensity = 22;
  // Wet avenue, sidewalks, curb, lane paint
  box(world, [54, .38, 48], [0, -.36, 0], mat(0x171a25, .26, .45));
  box(world, [18, .12, 48], [0, -.12, 0], mat(0x20232e, .19, .48));
  box(world, [8, .14, 48], [-13, -.10, 0], mat(0x45424a, .34, .16)); box(world, [8, .14, 48], [13, -.10, 0], mat(0x45424a, .34, .16));
  box(world, [.34, .2, 48], [-9.15, -.02, 0], mat(0xaaa090)); box(world, [.34, .2, 48], [9.15, -.02, 0], mat(0xaaa090));
  for (let z = -20; z < 22; z += 6) box(world, [.14, .018, 2.3], [0, -.018, z], mat(0xc6b27d));
  // Dark skyline behind buildings
  for (let i = 0; i < 13; i++) {
    const x = (i - 6) * 5.2, h = 12 + ((i * 17) % 17), z = -23 - (i % 3) * 1.8;
    const tower = box(world, [4.5, h, 5], [x, h / 2 - .25, z], mat(i % 2 ? 0x171d31 : 0x202438));
    box(world, [4.62, .18, 5.1], [x, h - .25, z], mat(0x33394c));
    for (let y = 2; y < h - 1; y += 2.4) for (let j = -1; j <= 1; j++) {
      if ((i + Math.floor(y) + j) % 3) box(world, [.32, .62, .04], [x + j * 1.1, y, z + 2.52], new THREE.MeshStandardMaterial({ color: 0x52547c, emissive: 0x52547c, emissiveIntensity: .65 }));
    }
  }
  // Near street frontages; keep a broad walkway through center
  for (const side of [-1, 1]) {
    for (let j = 0; j < 5; j++) {
      const z = -17 + j * 8.3, w = 5.2, h = 8.5 + (j % 2) * 2.2, x = side * 12.2;
      box(world, [w, h, 7.8], [x, h / 2 - .16, z], mat(j % 2 ? 0x2a2a36 : 0x292b38));
      box(world, [w + .28, .34, 8], [x, h - .28, z], M.trim);
      box(world, [w + .05, 2.6, .18], [x, 2.25, z + 3.95], mat(0x121722));
      for (let wx = -1; wx <= 1; wx++) box(world, [.78, 1.3, .08], [x + wx * 1.35, 5.4, z + 3.95], new THREE.MeshStandardMaterial({ color: 0x38435b, emissive: 0x161b30, emissiveIntensity: .8 }));
      if (j === 2 || j === 0) {
        const signMat = j === 2 ? M.neonPink : M.neonBlue;
        box(world, [3.8, .78, .17], [x, 4.0, z + 4.12], signMat);
        addText(world, j === 2 ? (side === -1 ? 'MONARCH' : 'GOTHAM') : (side === -1 ? 'HOTEL' : 'DINER'), [x, 4.05, z + 4.0], j === 2 ? '#f078a1' : '#8db7ff', .18);
      }
      box(world, [.35, 1.3, .35], [side * 8.1, .65, z - 1.5], M.black);
      const lamp = new THREE.PointLight(j % 2 ? 0x4c75ef : 0xf0b766, 8, 9); lamp.position.set(side * 8, 3.6, z - 1.5); world.add(lamp);
    }
  }
  // Theater facade, glowing marquee at the far end of block
  box(world, [10, 7.8, 2.2], [-12, 3.8, 13], mat(0x302a31));
  box(world, [10.3, .4, 2.35], [-12, 7.6, 13], M.trim);
  box(world, [8.7, 1.55, .25], [-12, 6.3, 11.82], M.neonGold);
  addText(world, 'WAYNE THEATRE', [-12, 6.34, 11.64], '#ffdda1', .25);
  for (let x = -15; x <= -9; x += 2) box(world, [.18, 3.2, .26], [x, 2.0, 11.75], M.gold);
  // Street lights with glowing heads
  for (const side of [-1, 1]) for (let z = -17; z < 20; z += 10) {
    cylinder(world, .09, .13, 4.7, [side * 8.4, 2.35, z], M.black);
    box(world, [.75, .15, .3], [side * 8.1, 4.72, z], M.neonGold);
    const lamp = new THREE.PointLight(0xf0bf78, 9, 11); lamp.position.set(side * 8.1, 4.4, z); world.add(lamp);
  }
  makePlayer(0, 3); makeParents(-.95, 4.6, true);
  player.rotation.y = Math.PI; stageGoal.set(3.2, 0, -7.5);
  car = createCar(3.2, -7.5); buildRain(240);
}
function createCar(x, z) {
  const root = new THREE.Group(); root.position.set(x, 0, z); world.add(root);
  const body = mat(0x171a22, .26, .62), glass = mat(0x42516a, .18, .42);
  box(root, [2.5, .75, 4.3], [0, .72, 0], body);
  box(root, [2.05, .85, 2.1], [0, 1.42, -.14], body);
  box(root, [1.87, .62, .06], [0, 1.48, .95], glass);
  box(root, [1.87, .6, .06], [0, 1.48, -1.18], glass);
  box(root, [.08, .68, 1.82], [-1.02, 1.48, -.12], glass); box(root, [.08, .68, 1.82], [1.02, 1.48, -.12], glass);
  for (const side of [-1, 1]) for (const zz of [-1.42, 1.43]) {
    const wheel = cylinder(root, .48, .48, .22, [side * 1.2, .43, zz], mat(0x0b0c11, .38, .2), 14); wheel.rotation.z = Math.PI / 2;
    cylinder(root, .25, .25, .24, [side * 1.2, .43, zz], M.gold, 12).rotation.z = Math.PI / 2;
  }
  for (const side of [-1, 1]) {
    box(root, [.45, .22, .05], [side * .78, .84, -2.17], mat(0xc9484b, .4, 0, 0x9f151a, .8));
    box(root, [.42, .2, .05], [side * .78, .89, 2.17], mat(0xffdf9a, .4, 0, 0xf0bc62, .9));
  }
  return root;
}
function buildRain(count) {
  const positions = new Float32Array(count * 3), velocities = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - .5) * 38; positions[i * 3 + 1] = Math.random() * 17; positions[i * 3 + 2] = (Math.random() - .5) * 42;
    velocities[i] = 7 + Math.random() * 8;
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({ color: 0xa6c6ef, size: .035, transparent: true, opacity: .48, depthWrite: false });
  rain = new THREE.Points(geo, material); rainPositions = positions; rainVelocities = velocities; world.add(rain);
}

function showDialogue(speaker, text, after) {
  ui.speaker.textContent = speaker.toUpperCase(); ui.dialogueText.textContent = text;
  ui.dialogue.classList.remove('hidden'); ui.prompt.classList.add('hidden'); dialogueAfter = after;
  state = 'dialogue';
}
function closeDialogue() {
  ui.dialogue.classList.add('hidden'); const after = dialogueAfter; dialogueAfter = null;
  if (after) after(); else state = 'play';
}
function setObjective(text) { ui.objectiveText.textContent = text; }
function startGame() {
  startAudio(); ui.title.classList.add('hidden'); ui.hud.classList.remove('hidden'); ui.caption.classList.remove('hidden');
  ui.controls.classList.add('hidden'); state = 'intro'; introTime = 0;
  camTargetAngle = 0; camAngle = 0;
}
function beginTheater() {
  buildTheater(); ui.caption.classList.add('hidden'); ui.controls.classList.remove('hidden');
  ui.objective.classList.remove('hidden'); setObjective('Listen to your father');
  showDialogue('Thomas Wayne', "Alright, Bruce. It's getting late. Let's get you home.", () => {
    state = 'play'; setObjective('Follow your parents to the lobby exit');
  });
}
function leaveTheater() {
  buildCity(); setObjective('Stay close to your parents');
  showDialogue('Thomas Wayne', "Stay close, Bruce. The car is just around the corner.", () => {
    state = 'play'; setObjective('Walk with your parents to the family car');
  });
}
function interact() {
  if (state === 'dialogue') { closeDialogue(); return; }
  if (state !== 'play') return;
  if (stage === 'theater' && player && player.position.z > 11.5) leaveTheater();
  else if (stage === 'city' && player && car && player.position.distanceTo(car.position) < 2.8) {
    state = 'ending'; ui.controls.classList.add('hidden'); ui.prompt.classList.add('hidden'); ui.ending.classList.remove('hidden'); ui.objective.classList.add('hidden');
  }
}
function showPrompt(text) { ui.promptText.textContent = text; ui.prompt.classList.remove('hidden'); }
function hidePrompt() { ui.prompt.classList.add('hidden'); }
function applyInput(dt) {
  if (!player || state !== 'play') return;
  const forward = (keys.KeyW || keys.ArrowUp || move.up ? 1 : 0) - (keys.KeyS || keys.ArrowDown || move.down ? 1 : 0);
  const sideways = (keys.KeyD || keys.ArrowRight || move.right ? 1 : 0) - (keys.KeyA || keys.ArrowLeft || move.left ? 1 : 0);
  // The theater lobby lies ahead at +Z; the avenue/car route runs toward -Z.
  const vector = new THREE.Vector3(sideways, 0, stage === 'theater' ? forward : -forward);
  if (vector.lengthSq()) {
    vector.normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), camAngle);
    const speed = 3.65 * dt;
    player.position.x = THREE.MathUtils.clamp(player.position.x + vector.x * speed, -7.3, 7.3);
    player.position.z = THREE.MathUtils.clamp(player.position.z + vector.z * speed, stage === 'theater' ? -13.6 : -12.5, stage === 'theater' ? 13 : 10.5);
    // Actor models face their local -Z axis.
    player.rotation.y = Math.atan2(-vector.x, -vector.z);
  }
  if (stage === 'theater' && parents.length) {
    // Thomas and Martha walk ahead toward the lobby, always keeping Bruce in sight.
    for (const [index, actor] of parents.entries()) {
      const target = new THREE.Vector3((index === 0 ? -.75 : .75), 0, 12.25 - index * .35);
      actor.position.lerp(target, Math.min(1, dt * .34));
      actor.rotation.y = Math.PI;
    }
  }
  if (stage === 'city' && parents.length) {
    // The family stays together on the sidewalk as Bruce heads for the car.
    for (const [index, actor] of parents.entries()) {
      const side = index === 0 ? -1.05 : -2.0;
      const target = new THREE.Vector3(player.position.x + side, 0, player.position.z + 1.15 + index * .45);
      actor.position.lerp(target, Math.min(1, dt * 2.4));
      actor.position.x = THREE.MathUtils.clamp(actor.position.x, -6.5, 6.5);
      actor.rotation.y = player.rotation.y;
    }
    if (player.position.distanceTo(car.position) < 2.8) showPrompt('GET IN THE CAR');
  }
  const threshold = stage === 'theater' ? player.position.z > 11.1 : player.position.distanceTo(car.position) < 2.8;
  if (threshold) showPrompt(stage === 'theater' ? 'HEAD TO THE LOBBY' : 'GET IN THE CAR'); else hidePrompt();
}
function updateRain(dt) {
  if (!rain) return;
  const p = rainPositions;
  for (let i = 0; i < p.length / 3; i++) {
    p[i * 3 + 1] -= rainVelocities[i] * dt;
    p[i * 3 + 2] += dt * 1.6;
    if (p[i * 3 + 1] < .1) { p[i * 3 + 1] = 15 + Math.random() * 5; p[i * 3] = (Math.random() - .5) * 38; p[i * 3 + 2] = (Math.random() - .5) * 42; }
    if (p[i * 3 + 2] > 22) p[i * 3 + 2] = -22;
  }
  rain.geometry.attributes.position.needsUpdate = true;
}
function updateCamera(dt) {
  if (state === 'intro') {
    const t = THREE.MathUtils.smoothstep(introTime / 4.8, 0, 1);
    const from = new THREE.Vector3(19, 14, 29), to = new THREE.Vector3(-3.5, 6.2, 17.8);
    camera.position.lerpVectors(from, to, t);
    camera.lookAt(new THREE.Vector3(-1, 3.1, -2).lerp(new THREE.Vector3(-4, 2.6, 12), t));
    return;
  }
  if (player && stage === 'theater' && state !== 'title') {
    const desired = new THREE.Vector3(player.position.x + Math.sin(camAngle) * 8.6, 4.7, player.position.z - Math.cos(camAngle) * 8.6);
    camera.position.lerp(desired, 1 - Math.exp(-dt * 3.4));
    camera.lookAt(player.position.x, 1.1, player.position.z + 1.7);
  } else if (player && stage === 'city' && state !== 'title') {
    const desired = new THREE.Vector3(player.position.x + Math.sin(camAngle) * 9.2, 5.2, player.position.z + Math.cos(camAngle) * 9.2);
    camera.position.lerp(desired, 1 - Math.exp(-dt * 2.7));
    camera.lookAt(player.position.x, 1.1, player.position.z - 1.5);
  }
}
function scheduleTick() {
  let fired = false;
  let fallback;
  const run = () => {
    if (fired) return;
    fired = true;
    clearTimeout(fallback);
    tick();
  };
  fallback = setTimeout(run, 50);
  requestAnimationFrame(run);
}
function tick() {
  scheduleTick();
  const dt = Math.min(clock.getDelta(), .05); worldTime += dt;
  if (state === 'intro') {
    introTime += dt;
    if (introTime >= 4.8) beginTheater();
  }
  applyInput(dt); updateRain(dt);
  if (player) player.position.y = Math.sin(worldTime * 7) * .025;
  for (const actor of parents) actor.position.y = Math.sin(worldTime * 5 + actor.userData.walkOffset) * .012;
  if (state === 'title') {
    camera.position.set(17, 12, 24); camera.lookAt(0, 4, -4);
  } else updateCamera(dt);
  renderer.render(scene, camera);
}
function startAudio() {
  if (!soundOn || audioContext) return;
  try {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const gain = audioContext.createGain(); gain.gain.value = .025; gain.connect(audioContext.destination);
    const osc1 = audioContext.createOscillator(), osc2 = audioContext.createOscillator();
    osc1.type = 'sine'; osc1.frequency.value = 54; osc2.type = 'triangle'; osc2.frequency.value = 81;
    const g1 = audioContext.createGain(), g2 = audioContext.createGain(); g1.gain.value = .65; g2.gain.value = .2;
    osc1.connect(g1).connect(gain); osc2.connect(g2).connect(gain); osc1.start(); osc2.start(); ambientNodes = gain;
  } catch { /* Audio is an enhancement; gameplay remains fully available. */ }
}
function toggleSound() {
  soundOn = !soundOn; ui.sound.innerHTML = soundOn ? '♫ <span>SOUND ON</span>' : '♫ <span>SOUND OFF</span>';
  if (ambientNodes && audioContext) ambientNodes.gain.setTargetAtTime(soundOn ? .025 : 0, audioContext.currentTime, .15);
  else if (soundOn) startAudio();
}

$('start-btn').addEventListener('click', startGame);
ui.continue.addEventListener('click', closeDialogue);
ui.action.addEventListener('pointerdown', e => { e.preventDefault(); interact(); });
ui.sound.addEventListener('click', toggleSound);
$('replay-btn').addEventListener('click', () => {
  ui.ending.classList.add('hidden'); ui.objective.classList.add('hidden'); ui.hud.classList.add('hidden'); ui.title.classList.remove('hidden');
  buildCity(); state = 'title'; camera.position.set(17, 12, 24); camera.lookAt(0, 4, -4);
});
window.addEventListener('keydown', e => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  keys[e.code] = true;
  if ((e.code === 'KeyE' || e.code === 'Enter' || e.code === 'Space') && !e.repeat) interact();
});
window.addEventListener('keyup', e => { keys[e.code] = false; });
for (const button of document.querySelectorAll('.pad')) {
  const dir = button.dataset.dir;
  button.addEventListener('pointerdown', e => {
    e.preventDefault();
    try { button.setPointerCapture(e.pointerId); } catch { /* Synthetic pointers may not support capture. */ }
    move[dir] = true; button.classList.add('active');
  });
  const release = e => { e.preventDefault(); move[dir] = false; button.classList.remove('active'); };
  button.addEventListener('pointerup', release); button.addEventListener('pointercancel', release); button.addEventListener('lostpointercapture', release);
}
let dragging = false, previousX = 0;
canvas.addEventListener('pointerdown', e => { if (e.pointerType === 'mouse' || state === 'play') { dragging = true; previousX = e.clientX; canvas.setPointerCapture(e.pointerId); } });
canvas.addEventListener('pointermove', e => { if (!dragging || state !== 'play') return; camAngle = THREE.MathUtils.clamp(camAngle - (e.clientX - previousX) * .004, -1.05, 1.05); previousX = e.clientX; });
canvas.addEventListener('pointerup', () => { dragging = false; }); canvas.addEventListener('pointercancel', () => { dragging = false; });
window.addEventListener('resize', () => { camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25)); });

buildCity();
camera.position.set(17, 12, 24); camera.lookAt(0, 4, -4);
setTimeout(() => { ui.loading.style.opacity = '0'; setTimeout(() => ui.loading.remove(), 750); }, 400);
tick();
