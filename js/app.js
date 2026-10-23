import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { PLAN, WALL_H, SILL, WIN_TOP, DOOR_H, ROOMS, DOORS, CLADDING, LIGHTS, PROPOSAL } from './plan.js';
import { M, mesh, PHONE } from './materials.js';
import { CATALOG, build, loadModels, box, fluted, channels } from './furniture.js';

const $ = id => document.getElementById(id);
const SNAP = 0.05, KEY = 'wadi-houf-design-v2';

// ---------- renderer / scene ----------
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
// Phones get a lighter pipeline so iOS doesn't kill the tab for GPU memory.
renderer.setPixelRatio(Math.min(devicePixelRatio, PHONE ? 1.5 : 2));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 0.9;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
$('view').appendChild(renderer.domElement);
if (!PHONE) RectAreaLightUniformsLib.init();

const scene = new THREE.Scene();
const BG = new THREE.Color('#eeebe7');
scene.background = BG;
const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.05, 200);
const CENTER = new THREE.Vector3(10.1, 0, 2.9);

const pmrem = new THREE.PMREMGenerator(renderer);
let sky = null, envPMREM = null;
new HDRLoader().load('assets/hdri/interior.hdr', t => { envPMREM = scene.environment = pmrem.fromEquirectangular(t).texture; t.dispose(); });
new HDRLoader().load('assets/hdri/sky.hdr', t => { t.mapping = THREE.EquirectangularReflectionMapping; sky = t; applyBackground(); });
scene.environmentIntensity = 0.4;

scene.add(new THREE.HemisphereLight('#fff6ea', '#a89a88', 0.35));
const sun = new THREE.DirectionalLight('#fff4e6', 2.2);
sun.position.set(CENTER.x - 9, 12, CENTER.z - 7);
sun.target.position.copy(CENTER);
sun.castShadow = true;
sun.shadow.mapSize.setScalar(PHONE ? 2048 : 4096);
sun.shadow.bias = PHONE ? -0.001 : -0.0004; sun.shadow.normalBias = PHONE ? 0.05 : 0.02;
Object.assign(sun.shadow.camera, { left: -13, right: 13, top: 13, bottom: -13, near: 1, far: 40 });
scene.add(sun, sun.target);

const ground = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), new THREE.MeshStandardMaterial({ color: '#dedad4', roughness: 1 }));
ground.rotation.x = -Math.PI / 2; ground.position.y = -0.03; ground.receiveShadow = true;
scene.add(ground);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const gtao = new GTAOPass(scene, camera, innerWidth, innerHeight);
gtao.updateGtaoMaterial({ radius: 0.35, distanceFallOff: 1, thickness: 1 });
gtao.blendIntensity = 0.9;
if (!PHONE) composer.addPass(gtao);
composer.addPass(new OutputPass());

// ---------- architecture ----------
const arch = new THREE.Group(), ceiling = new THREE.Group();
scene.add(arch, ceiling);
const roomAt = (x, z) => ROOMS.find(r => r.rects.some(([a, b, c, d]) => x >= a && x <= c && z >= b && z <= d));
const span = ([x1, z1, x2, z2]) => {
  const alongX = x2 - x1 >= z2 - z1;
  return { alongX, a: alongX ? x1 : z1, b: alongX ? x2 : z2, t1: alongX ? z1 : x1, t2: alongX ? z2 : x2 };
};
// Box between plan rect and heights, in world coords.
const slab = ([x1, z1, x2, z2], y1, y2, mat) => box(x2 - x1, y2 - y1, z2 - z1, mat, (x1 + x2) / 2, y1, (z1 + z2) / 2);

function buildArchitecture(H) {
  arch.clear(); ceiling.clear();
  for (const r of PLAN.floor) arch.add(slab(r, -0.02, 0, M('travertine')));
  for (const room of ROOMS) if (room.floor !== 'travertine') for (const r of room.rects) arch.add(slab(r, 0, 0.003, M(room.floor)));

  for (const r of PLAN.walls) {
    arch.add(slab(r, 0, H, M('paint')));
    if (H > 0.1) arch.add(slab([r[0] - 0.012, r[1] - 0.012, r[2] + 0.012, r[3] + 0.012], 0, 0.1, M('skirting')));
  }

  for (const w of PLAN.windows) {
    const s = span(w);
    arch.add(slab(w, 0, Math.min(SILL, H), M('paint')));
    if (H > WIN_TOP) arch.add(slab(w, WIN_TOP, H, M('paint')));
    if (H <= SILL) continue;
    const top = Math.min(WIN_TOP, H), mid = (s.t1 + s.t2) / 2;
    const part = (a, b, t, y1, y2, mat) => arch.add(slab(s.alongX ? [a, mid - t, b, mid + t] : [mid - t, a, mid + t, b], y1, y2, mat));
    part(s.a, s.b, 0.005, SILL, top, M('glass'));
    part(s.a, s.a + 0.05, 0.03, SILL, top, M('blackmetal'));
    part(s.b - 0.05, s.b, 0.03, SILL, top, M('blackmetal'));
    part((s.a + s.b) / 2 - 0.025, (s.a + s.b) / 2 + 0.025, 0.03, SILL, top, M('blackmetal'));
    part(s.a, s.b, 0.03, SILL, SILL + 0.05, M('blackmetal'));
    if (H >= WIN_TOP) part(s.a, s.b, 0.03, WIN_TOP - 0.05, WIN_TOP, M('blackmetal'));
  }

  for (const d of DOORS) {
    const s = span(d.open), dh = Math.min(DOOR_H, H);
    if (H > DOOR_H) arch.add(slab(d.open, DOOR_H, H, M('paint')));
    const jamb = (a, b) => arch.add(slab(s.alongX ? [a, s.t1 - 0.015, b, s.t2 + 0.015] : [s.t1 - 0.015, a, s.t2 + 0.015, b], 0, dh, M('walnut')));
    jamb(s.a, s.a + 0.03); jamb(s.b - 0.03, s.b);
    if (H > DOOR_H) arch.add(slab(s.alongX ? [s.a, s.t1 - 0.015, s.b, s.t2 + 0.015] : [s.t1 - 0.015, s.a, s.t2 + 0.015, s.b], DOOR_H - 0.03, DOOR_H, M('walnut')));
    // Door leaf, open exactly as drawn, with brass levers on its free end.
    const l = span(d.leaf), lm = (l.t1 + l.t2) / 2;
    arch.add(slab(d.leaf, 0.01, dh - 0.01, d.main ? M('walnut_v', '#7a6656') : M('walnut_v')));
    const oc = s.alongX ? [(s.a + s.b) / 2, (s.t1 + s.t2) / 2] : [(s.t1 + s.t2) / 2, (s.a + s.b) / 2];
    const ends = [l.a, l.b].map(v => l.alongX ? [v, lm] : [lm, v]);
    const free = Math.hypot(ends[0][0] - oc[0], ends[0][1] - oc[1]) > Math.hypot(ends[1][0] - oc[0], ends[1][1] - oc[1]) ? 0 : 1;
    const along = free === 0 ? l.a + 0.09 : l.b - 0.09;
    if (H > 1.05) for (const side of [-1, 1]) {
      const off = side * ((l.t2 - l.t1) / 2 + 0.03);
      arch.add(l.alongX ? box(0.14, 0.02, 0.02, M('brass'), along + (free === 0 ? 0.05 : -0.05), 1.0, lm + off)
                        : box(0.02, 0.02, 0.14, M('brass'), lm + off, 1.0, along + (free === 0 ? 0.05 : -0.05)));
    }
  }

  for (const [x1, z1, x2, z2, y1, y2raw, finish] of CLADDING) {
    const y2 = Math.min(y2raw, H);
    if (y2 <= y1 + 0.02) continue;
    const s = span([x1, z1, x2, z2]), cx = (x1 + x2) / 2, cz = (z1 + z2) / 2, t = s.t2 - s.t1;
    const sign = s.alongX ? (roomAt(cx, s.t2 + 0.3) ? 1 : -1) : (roomAt(s.t2 + 0.3, cz) ? 1 : -1);
    const len = s.b - s.a;
    if (finish === 'calacatta') {
      // keep window openings clear
      const holes = PLAN.windows.map(span).filter(w => w.alongX === s.alongX && w.b > s.a && w.a < s.b && Math.abs((w.t1 + w.t2) / 2 - (s.t1 + s.t2) / 2) < 0.4);
      let cuts = [s.a, ...holes.flatMap(w => [Math.max(w.a, s.a), Math.min(w.b, s.b)]), s.b];
      for (let i = 0; i < cuts.length - 1; i++) {
        const a = cuts[i], b = cuts[i + 1], inHole = i % 2 === 1;
        const r = s.alongX ? [a, s.t1, b, s.t2] : [s.t1, a, s.t2, b];
        if (!inHole) arch.add(slab(r, y1, y2, M('calacatta')));
        else {
          if (Math.min(y2, SILL) > y1) arch.add(slab(r, y1, Math.min(y2, SILL), M('calacatta')));
          if (y2 > WIN_TOP) arch.add(slab(r, Math.max(y1, WIN_TOP), y2, M('calacatta')));
        }
      }
      continue;
    }
    const panel = finish === 'fluted' ? fluted(len, y2 - y1) : channels(len, y2 - y1, M('boucle', '#cbbfae'));
    const face = (s.t1 + s.t2) / 2 + sign * (finish === 'fluted' ? t / 2 - 0.017 : -t / 2);
    panel.position.set(s.alongX ? cx : face, y1, s.alongX ? face : cz);
    panel.rotation.y = s.alongX ? (sign > 0 ? 0 : Math.PI) : (sign > 0 ? Math.PI / 2 : -Math.PI / 2);
    arch.add(panel);
  }

  // Ceiling with recessed downlights (shown only when the camera is inside).
  for (const r of PLAN.floor) ceiling.add(slab(r, WALL_H, WALL_H + 0.05, M('ceiling')));
  for (const room of ROOMS) for (const [a, b, c, d] of room.rects) {
    const nx = Math.max(1, Math.round((c - a - 1) / 1.3)), nz = Math.max(1, Math.round((d - b - 1) / 1.3));
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
      const disc = mesh(new THREE.CircleGeometry(0.045, 24), M('glow'), { shadow: false });
      disc.rotation.x = Math.PI / 2;
      disc.position.set(a + 0.5 + (c - a - 1) * (nx === 1 ? 0.5 : i / (nx - 1)), WALL_H - 0.002, b + 0.5 + (d - b - 1) * (nz === 1 ? 0.5 : j / (nz - 1)));
      ceiling.add(disc);
    }
  }
}
for (const [x, z, w, d, intensity] of LIGHTS) {
  // Phones: plain point lights instead of area lights (those need half-float LUTs that break on iOS).
  const l = PHONE ? new THREE.PointLight('#ffe6cc', intensity * w * d * 0.35, 0, 2) : new THREE.RectAreaLight('#ffe6cc', intensity * 0.6, w, d);
  l.position.set(x, WALL_H - (PHONE ? 0.4 : 0.02), z); l.lookAt(x, 0, z);
  scene.add(l);
}

// ---------- furniture state ----------
const furn = new THREE.Group(); scene.add(furn);
const outline = new THREE.BoxHelper(undefined, '#ff7a00'); outline.visible = false; scene.add(outline);
const fromRow = ([type, x, z, rot, w, d, h, y]) => {
  const c = CATALOG[type];
  return { type, x, z, rot, w: w ?? c.w, d: d ?? c.d, h: h ?? c.h, y: y ?? c.y ?? (c.hang ? WALL_H - (h ?? c.h) : 0), color: c.color ?? null };
};
const proposal = () => PROPOSAL.map(fromRow);
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; } };
const save = () => localStorage.setItem(KEY, JSON.stringify(items));
let items = load() ?? proposal(), selected = null, wallMode = 1;

function place(obj) {
  const it = obj.userData.item;
  obj.position.set(it.x, it.y || 0, it.z);
  obj.rotation.y = THREE.MathUtils.degToRad(it.rot);
  const c = CATALOG[it.type];
  obj.visible = wallMode === 0 || !(c.curtain || c.wall);
}
function rebuildItem(it) {
  const old = furn.children.find(o => o.userData.item === it);
  if (old) furn.remove(old);
  const obj = build(it); obj.userData.item = it; place(obj); furn.add(obj);
  return obj;
}
const rebuildAll = () => { furn.clear(); items.forEach(rebuildItem); select(null); };

// ---------- UI ----------
const fields = { w: $('f-w'), d: $('f-d'), h: $('f-h'), y: $('f-y'), rot: $('f-r'), color: $('f-c') };
const cats = {};
for (const [k, c] of Object.entries(CATALOG)) (cats[c.cat] ??= []).push([k, c.label]);
for (const [cat, list] of Object.entries(cats)) {
  const og = document.createElement('optgroup'); og.label = cat;
  list.forEach(([k, label]) => og.append(new Option(label, k)));
  $('add-type').append(og);
}
ROOMS.forEach((r, i) => $('room-go').add(new Option(r.name, i)));

function select(obj) {
  selected = obj; outline.visible = !!obj;
  $('sel').hidden = !obj; $('sel-none').hidden = !!obj;
  if (!obj) return;
  outline.setFromObject(obj);
  const it = obj.userData.item, c = CATALOG[it.type];
  $('sel-name').textContent = c.label;
  $('sel-spec').textContent = c.spec;
  $('color-row').hidden = !c.tint;
  for (const [k, el] of Object.entries(fields)) el.value = k === 'color' ? (it.color || '#ffffff') : +(+it[k] || 0).toFixed(2);
}
for (const [k, el] of Object.entries(fields)) el.addEventListener('input', () => {
  if (!selected) return;
  const it = selected.userData.item;
  if (k === 'color') it.color = el.value;
  else { const v = parseFloat(el.value); if (!Number.isFinite(v) || (['w', 'd', 'h'].includes(k) && v <= 0)) return; it[k] = v; }
  select(rebuildItem(it)); save();
});
const rotate = deg => { if (!selected) return; const it = selected.userData.item; it.rot = ((it.rot + deg) % 360 + 360) % 360; place(selected); select(selected); save(); };
$('rot-l').onclick = () => rotate(90);
$('rot-r').onclick = () => rotate(-90);
$('del').onclick = () => { if (!selected) return; items.splice(items.indexOf(selected.userData.item), 1); furn.remove(selected); select(null); save(); };
$('dup').onclick = () => { if (!selected) return; const s = selected.userData.item, it = { ...s, x: s.x + 0.3, z: s.z + 0.3 }; items.push(it); select(rebuildItem(it)); save(); };
$('add-btn').onclick = () => {
  const t = orbit.target, it = fromRow([$('add-type').value, +t.x.toFixed(2), +t.z.toFixed(2), 0]);
  items.push(it); select(rebuildItem(it)); save();
};
$('reset').onclick = () => { if (confirm('Discard all your changes and go back to the proposed design?')) { items = proposal(); rebuildAll(); save(); } };
$('export').onclick = () => download(URL.createObjectURL(new Blob([JSON.stringify(items, null, 1)], { type: 'application/json' })), 'apartment-design.json');
$('import').onclick = () => $('import-file').click();
$('import-file').onchange = async e => {
  const f = e.target.files[0]; if (!f) return;
  try {
    const data = JSON.parse(await f.text());
    const ok = Array.isArray(data) && data.every(it => CATALOG[it?.type] && ['x', 'z', 'rot', 'w', 'd', 'h', 'y'].every(k => Number.isFinite(it[k])) && (it.color === null || /^#[0-9a-f]{6}$/i.test(it.color)));
    if (!ok) throw new Error('bad file');
    items = data; rebuildAll(); save();
  } catch { alert('That file is not a valid design export from this planner.'); }
  e.target.value = '';
};
function download(href, name) { const a = document.createElement('a'); a.href = href; a.download = name; a.click(); }
$('shot').onclick = () => { if (!photo) composer.render(); download(renderer.domElement.toDataURL('image/png'), 'apartment.png'); };
$('v-walls').onclick = () => setWalls((wallMode + 1) % 3);
function setWalls(m) {
  wallMode = m;
  $('v-walls').textContent = 'Walls: ' + ['full', 'cut', 'off'][m];
  buildArchitecture([WALL_H, 1.15, 0.1][m]);
  furn.children.forEach(place);
  applyBackground();
}

// Specs sheet: finishes per room + every piece with its size, grouped by room.
const FINISH_SPEC = {
  Reception: 'Floor: existing glossy marble-look porcelain, 60×60 (kept) · Walls: warm greige matte (≈ #E6DDD1) · TV wall: full-height fluted walnut · Ceiling: gypsum, recessed 2700 K downlights · Curtains: ceiling track, sheer + linen',
  Dining: 'Floor: existing glossy marble-look porcelain (kept) · Pendants ×2 over table at 75 cm above top · Walls: warm greige',
  'Main bathroom': 'Floor + walls: Calacatta large-format (marble or porcelain), full height · Brushed-brass fittings · Walk-in glass shower with linear drain',
  Kitchen: 'Floor: travertine · Base units: handleless greige lacquer · Tall units: walnut · Worktop + splash: Calacatta 2 cm · Brass mixer',
  Bedroom: 'Floor: oak herringbone parquet · Bed wall: fluted walnut · Wardrobe: walnut to ceiling · Curtains: sheer + linen',
  'Master bedroom': 'Floor: oak herringbone parquet · Headboard wall: built-out full-height fluted walnut (hides the column) · Wardrobe: walnut to ceiling',
  Corridor: 'Floor: travertine · Art lighting · Doors: flush walnut, 2.25 m, brass levers; entrance: armoured, dark walnut',
};
$('specs').onclick = () => {
  const groups = {};
  for (const it of items) (groups[roomAt(it.x, it.z)?.name ?? 'Other'] ??= []).push(it);
  const cm = v => Math.round(v * 100);
  $('specs-body').innerHTML = ROOMS.map(r => r.name).concat('Other').filter(n => groups[n] || FINISH_SPEC[n]).map(n => `
    <h3>${n}</h3>${FINISH_SPEC[n] ? `<p>${FINISH_SPEC[n]}</p>` : ''}
    <table>${Object.values((groups[n] || []).reduce((acc, it) => {
      const k = `${it.type}|${cm(it.w)}|${cm(it.d)}|${cm(it.h)}|${it.color}`;
      (acc[k] ??= { it, n: 0 }).n++;
      return acc;
    }, {})).map(({ it, n: q }) => `<tr><td>${CATALOG[it.type].label}${q > 1 ? ` ×${q}` : ''}</td><td>${cm(it.w)}×${cm(it.d)}×${cm(it.h)} cm</td><td>${CATALOG[it.type].spec}</td></tr>`).join('')}</table>`).join('');
  $('specs-modal').hidden = false;
};
$('specs-close').onclick = () => { $('specs-modal').hidden = true; };
$('specs-print').onclick = () => window.print();

// ---------- controls ----------
const orbit = new OrbitControls(camera, renderer.domElement);
orbit.enableDamping = true; orbit.maxPolarAngle = Math.PI / 2 - 0.02;
const walk = new PointerLockControls(camera, document.body);
// iPhone/iPad Safari has no Pointer Lock API (and no keyboard), so Walk mode is desktop-only.
const canLock = 'requestPointerLock' in document.body;
if (!canLock) $('v-walk').hidden = true;
let mode = 'orbit', locked = true;
const HELP = {
  orbit: 'Drag to rotate · Right-drag / two fingers to pan · Scroll / pinch to zoom',
  walk: 'Click the view to look around · WASD / arrows to walk · Esc to release the mouse',
  photo: 'Rendering a photo-real image… keep the camera still. Drag to change the angle (restarts).',
};
const helpText = () => mode === 'walk' ? HELP.walk : (locked ? '' : 'Drag furniture to move · R rotate · Del delete · ') + HELP.orbit;
function applyBackground() {
  scene.background = (wallMode === 0 || photo) && sky ? sky : BG;
  scene.environment = photo && sky ? sky : envPMREM; // the path tracer needs an equirect environment
  ceiling.visible = wallMode === 0 && camera.position.y < WALL_H;
}
function setMode(m) {
  mode = m;
  ['orbit', 'top', 'walk'].forEach(k => $('v-' + k).classList.toggle('on', k === m));
  $('help').textContent = helpText();
  orbit.enabled = m !== 'walk';
  if (m === 'walk') {
    setWalls(0);
    camera.position.set(4.6, 1.6, 3.7); camera.lookAt(2.0, 1.4, 1.2);
  } else {
    if (walk.isLocked) walk.unlock();
    orbit.target.copy(CENTER);
    const k = Math.max(1, 1.3 / camera.aspect); // pull back on narrow (phone) screens so the whole flat fits
    if (m === 'top') camera.position.set(CENTER.x, 24 * k, CENTER.z + 0.01);
    else camera.position.set(CENTER.x - 3 * k, 13 * k, CENTER.z + 12 * k);
  }
  applyBackground();
}
$('v-orbit').onclick = () => setMode('orbit');
$('v-top').onclick = () => setMode('top');
$('v-walk').onclick = () => setMode('walk');
$('room-go').onchange = e => {
  const r = ROOMS[e.target.value]; if (!r) return;
  const [a, b, c, d] = r.rects[0], cx = (a + c) / 2, cz = (b + d) / 2;
  setMode('orbit');
  if (wallMode === 0) setWalls(1);
  orbit.target.set(cx, 0.5, cz); camera.position.set(cx - 1.2, 5.5, cz + 4.5);
  e.target.value = '';
};

// Eye-level interior view from a room corner, walls on, for photos.
$('v-eye').onclick = () => {
  setMode('orbit'); setWalls(0);
  orbit.target.set(2.3, 1.0, 1.8); camera.position.set(4.7, 1.55, 4.0);
  applyBackground();
};

// Furniture is locked on every load so nothing moves by accident; unlocking needs a confirm.
$('lock').onclick = () => {
  if (locked && !confirm('Unlock furniture for editing? Pieces can then be moved, resized or deleted.')) return;
  locked = !locked;
  if (locked) select(null);
  $('lock').textContent = locked ? '🔒 Furniture locked' : '🔓 Editing — click to lock';
  $('lock').classList.toggle('on', !locked);
  $('edit-tools').hidden = locked;
  $('help').textContent = helpText();
};
$('menu-btn').onclick = () => {
  const open = $('panel').hidden;
  $('panel').hidden = !open;
  $('menu-btn').textContent = open ? '✕ Close' : '☰ Menu';
  $('menu-btn').setAttribute('aria-expanded', open);
};

// drag-to-move on the floor
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
let drag = null;
const pick = e => { ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera); };
const rootOf = o => { while (o && o.parent !== furn) o = o.parent; return o; };
renderer.domElement.addEventListener('pointerdown', e => {
  if (photo) return;
  if (mode === 'walk') { if (canLock) walk.lock(); return; }
  if (e.button !== 0 || locked) return;
  pick(e);
  const hit = ray.intersectObjects(furn.children.filter(o => o.visible), true)[0];
  const obj = hit && rootOf(hit.object);
  select(obj || null);
  if (!obj) return;
  const p = new THREE.Vector3(); ray.ray.intersectPlane(floorPlane, p);
  drag = { obj, dx: obj.position.x - p.x, dz: obj.position.z - p.z };
  orbit.enabled = false;
});
addEventListener('pointermove', e => {
  if (!drag) return;
  pick(e);
  const p = new THREE.Vector3(); if (!ray.ray.intersectPlane(floorPlane, p)) return;
  const it = drag.obj.userData.item, snap = v => +(Math.round(v / SNAP) * SNAP).toFixed(2);
  it.x = snap(p.x + drag.dx); it.z = snap(p.z + drag.dz);
  place(drag.obj); outline.setFromObject(drag.obj);
});
addEventListener('pointerup', () => { if (drag) { save(); drag = null; orbit.enabled = mode !== 'walk'; } });
const keys = {};
addEventListener('keydown', e => {
  if (['INPUT', 'SELECT'].includes(e.target.tagName)) return;
  keys[e.code] = true;
  if (mode !== 'walk' && !photo && !locked) {
    if (e.code === 'KeyR') rotate(e.shiftKey ? 15 : -90);
    if (e.code === 'Delete' || e.code === 'Backspace') $('del').click();
    if (e.code === 'Escape') select(null);
  }
});
addEventListener('keyup', e => { keys[e.code] = false; });

// ---------- photo-real path tracing ----------
let photo = null;
$('photo').onclick = async () => {
  if (photo) return stopPhoto();
  $('photo').disabled = true; $('photo').textContent = 'Preparing…';
  try {
    const { WebGLPathTracer } = await import('https://esm.sh/three-gpu-pathtracer@0.0.27?external=three');
    select(null); if (walk.isLocked) walk.unlock();
    const pt = new WebGLPathTracer(renderer);
    pt.tiles.set(2, 2); pt.filterGlossyFactor = 0.5; pt.renderDelay = 0; pt.fadeDuration = 0; pt.minSamples = 1;
    photo = pt; applyBackground();
    await new Promise(r => setTimeout(r, 50)); // let the button repaint before the BVH build blocks
    pt.setScene(scene, camera);
    $('photo').textContent = 'Stop photo';
    $('help').textContent = HELP.photo;
  } catch (err) {
    console.error(err); photo = null; applyBackground();
    alert('Photo render needs a desktop browser with WebGL2. Error: ' + err.message);
    $('photo').textContent = '📸 Photo render';
  }
  $('photo').disabled = false;
};
function stopPhoto() {
  photo.dispose?.(); photo = null;
  $('photo').textContent = '📸 Photo render'; $('samples').textContent = '';
  setMode(mode);
}
orbit.addEventListener('change', () => photo?.updateCamera());

// room labels
const tags = ROOMS.filter(r => !r.noLabel).map(r => {
  const el = document.createElement('div'); el.className = 'tag'; el.textContent = r.name; document.body.appendChild(el);
  const [a, b, c, d] = r.rects[0];
  return { el, p: new THREE.Vector3((a + c) / 2, 0.05, (b + d) / 2) };
});

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight);
  photo?.updateCamera();
});

// ---------- boot ----------
setWalls(1); setMode('orbit');
await loadModels(p => { $('loading-bar').style.width = Math.round(p * 100) + '%'; });
rebuildAll();
$('loading').hidden = true;

const timer = new THREE.Timer();
renderer.setAnimationLoop(() => {
  timer.update();
  const dt = Math.min(timer.getDelta(), 0.1);
  if (mode === 'walk' && walk.isLocked) {
    const sp = 1.8 * dt;
    if (keys.KeyW || keys.ArrowUp) walk.moveForward(sp);
    if (keys.KeyS || keys.ArrowDown) walk.moveForward(-sp);
    if (keys.KeyA || keys.ArrowLeft) walk.moveRight(-sp);
    if (keys.KeyD || keys.ArrowRight) walk.moveRight(sp);
  } else orbit.update();
  ceiling.visible = wallMode === 0 && camera.position.y < WALL_H;
  for (const t of tags) {
    const v = t.p.clone().project(camera);
    t.el.style.display = mode === 'walk' || photo || v.z > 1 || camera.position.y < WALL_H ? 'none' : '';
    t.el.style.left = (v.x + 1) / 2 * innerWidth + 'px';
    t.el.style.top = (1 - v.y) / 2 * innerHeight + 'px';
  }
  if (photo) { photo.renderSample(); $('samples').textContent = `${Math.floor(photo.samples)} samples`; }
  else composer.render();
});
window.__app = { scene, camera, orbit, items, setWalls, setMode };
