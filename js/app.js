import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { PLAN, WALL_H, SILL, WIN_TOP, DOOR_H, ROOMS, DOORS, CLADDING, LIGHTS, PROPOSAL, PANORAMA, BALCONY } from './plan.js';
import { M, mesh, PHONE } from './materials.js';
import { CATALOG, build, loadModels, box, fluted, channels } from './furniture.js';

const $ = id => document.getElementById(id);

// Phones keep the old page cached (GitHub Pages sends max-age=600). If a newer deploy exists,
// reload once under a new URL, which skips the cached copy.
const BUILD = new URL(import.meta.url).searchParams.get('v');
fetch('version.txt', { cache: 'no-store' }).then(r => r.ok ? r.text() : '').then(v => {
  v = v.trim();
  if (BUILD && v && v !== BUILD && !sessionStorage.getItem('reloaded-' + v)) {
    sessionStorage.setItem('reloaded-' + v, '1');
    location.replace(location.pathname + '?v=' + encodeURIComponent(v));
  }
}).catch(() => {});
const SNAP = 0.05, KEY = 'wadi-houf-design-v4';

// ---------- renderer / scene ----------
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
// Phones get a lighter pipeline so iOS doesn't kill the tab for GPU memory.
renderer.setPixelRatio(Math.min(devicePixelRatio, PHONE ? 1.5 : 2));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping; // filmic, camera-like highlight roll-off
renderer.toneMappingExposure = 0.95;
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
let sky = null, envPMREM = null, view = null;
// Real elevated city view (Poly Haven, CC0) seen through the windows when walls are up; building in it turned away from the glass.
new THREE.TextureLoader().load('assets/hdri/view.jpg', t => { t.mapping = THREE.EquirectangularReflectionMapping; t.colorSpace = THREE.SRGBColorSpace; view = t; applyBackground(); });
scene.backgroundRotation.y = Math.PI * 0.6;
scene.backgroundIntensity = 1.7;
new HDRLoader().load('assets/hdri/interior.hdr', t => { envPMREM = scene.environment = pmrem.fromEquirectangular(t).texture; t.dispose(); });
new HDRLoader().load('assets/hdri/sky.hdr', t => { t.mapping = THREE.EquirectangularReflectionMapping; sky = t; applyBackground(); });
scene.environmentIntensity = 0.4;

scene.add(new THREE.HemisphereLight('#fff6ea', '#a89a88', 0.35));
const sun = new THREE.DirectionalLight('#fff4e6', 2.2);
sun.position.set(CENTER.x - 9, 12, CENTER.z - 7);
sun.target.position.copy(CENTER);
sun.castShadow = true;
sun.shadow.mapSize.setScalar(PHONE ? 2048 : 4096);
sun.shadow.radius = 4; sun.shadow.blurSamples = 12;
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
if (!PHONE) composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), 0.35, 0.6, 1.4));
composer.addPass(new OutputPass());

// ---------- architecture ----------
const arch = new THREE.Group(), ceiling = new THREE.Group();
const doorState = [], doors = [];
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

  const inPano = ([a, b, c, d]) => a >= PANORAMA[0] - 0.01 && c <= PANORAMA[2] + 0.01 && b >= PANORAMA[1] - 0.01 && d <= PANORAMA[3] + 0.01;
  for (const r of PLAN.walls) {
    if (inPano(r)) continue;
    arch.add(slab(r, 0, H, M('paint')));
    if (H > 0.1) arch.add(slab([r[0] - 0.012, r[1] - 0.012, r[2] + 0.012, r[3] + 0.012], 0, 0.1, M('skirting')));
  }

  // Rooms with their own skirting (bedrooms: dark wood-tile): strips on the wall face along each room edge,
  // wherever a wall sits just outside it (door openings stay clear); 1.6 cm proud to cover the generic skirting.
  const solid = PLAN.walls.concat(PLAN.windows);
  // Nearest wall surface facing the room along a short probe across the room edge (walls can be several stacked boxes).
  const faceAt = (x, z, nx, nz) => {
    const n = nx || nz, along = nz ? z : x, s1 = along - n * 0.04, s2 = along + n * 0.08, lo = Math.min(s1, s2), hi = Math.max(s1, s2);
    const hits = solid.filter(([a, b, c, d]) => nz ? x >= a && x <= c && b <= hi && d >= lo : z >= b && z <= d && a <= hi && c >= lo);
    if (!hits.length) return undefined;
    // nearest surface toward the room: smallest near-face when the wall lies on the + side, largest far-face on the - side
    return n > 0 ? Math.min(...hits.map(h => nz ? h[1] : h[0])) : Math.max(...hits.map(h => nz ? h[3] : h[2]));
  };
  if (H > 0.1) for (const room of ROOMS.filter(r => r.skirting)) for (const [x1, z1, x2, z2] of room.rects) {
    for (const [ax, az, bx, bz, nx, nz] of [[x1, z1, x2, z1, 0, -1], [x1, z2, x2, z2, 0, 1], [x1, z1, x1, z2, -1, 0], [x2, z1, x2, z2, 1, 0]]) {
      const len = Math.hypot(bx - ax, bz - az), steps = Math.max(1, Math.round(len / 0.05));
      let start = null, face = null;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps, px = ax + (bx - ax) * t, pz = az + (bz - az) * t;
        const f = i < steps ? faceAt(px, pz, nx, nz) : undefined;
        if (start !== null && f !== face) {
          const s0 = start * len, s1 = t * len, out = -(nx || nz); // room side direction along the normal axis
          const lo = Math.min(face, face + out * 0.016), hi = Math.max(face, face + out * 0.016);
          arch.add(slab(nz ? [ax + s0, lo, ax + s1, hi] : [lo, az + s0, hi, az + s1], 0, 0.101, M(room.skirting)));
          start = null;
        }
        if (f !== undefined && start === null) { start = t; face = f; }
      }
    }
  }

  for (const w of PLAN.windows) {
    if (inPano(w)) continue;
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

  // Panorama: floor-to-ceiling black-framed sliding glass (4 panels on two tracks) onto the balcony.
  {
    const [x1, z1, x2, z2] = PANORAMA, mx = (x1 + x2) / 2, top = Math.min(2.7, H), n = 4, pw = (z2 - z1) / n;
    arch.add(slab([x1, z1, x2, z2], -0.02, 0, M('travertine')));
    if (H > 2.7) arch.add(slab([x1, z1, x2, z2], 2.7, H, M('paint')));
    const part = (za, zb, x, t, y1, y2, mat) => arch.add(slab([x - t, za, x + t, zb], y1, y2, mat));
    for (let i = 0; i < n; i++) {
      const za = z1 + i * pw - (i ? 0.02 : 0), zb = z1 + (i + 1) * pw + (i < n - 1 ? 0.02 : 0), x = mx + (i % 2 ? 0.035 : -0.035);
      part(za, zb, x, 0.005, 0.02, top - 0.03, M('glass'));
      part(za, za + 0.04, x, 0.025, 0, top, M('blackmetal')); part(zb - 0.04, zb, x, 0.025, 0, top, M('blackmetal'));
      part(za, zb, x, 0.025, 0, 0.05, M('blackmetal')); if (H >= 2.7) part(za, zb, x, 0.025, top - 0.05, top, M('blackmetal'));
    }
    part(z1, z2, mx, 0.14, 0, 0.012, M('blackmetal'));
  }
  // Balcony: stone slab, fascia band and a black-framed glass railing on the open edges; canopy when walls are full.
  {
    const shape = new THREE.Shape(BALCONY.map(([x, z]) => new THREE.Vector2(x, z)));
    const slabGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.18, bevelEnabled: false });
    const bal = mesh(slabGeo, M('travertine')); bal.rotation.x = Math.PI / 2; bal.position.y = -0.02; arch.add(bal);
    if (H >= WALL_H) {
      const roof = mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.22, bevelEnabled: false }), M('paint'));
      roof.rotation.x = Math.PI / 2; roof.position.y = WALL_H + 0.22; arch.add(roof);
    }
    const [A, B, C] = BALCONY;
    for (const [p, q] of [[A, B], [B, C]]) {
      const len = Math.hypot(q[0] - p[0], q[1] - p[1]), g = new THREE.Group();
      g.position.set((p[0] + q[0]) / 2, 0, (p[1] + q[1]) / 2); g.rotation.y = -Math.atan2(q[1] - p[1], q[0] - p[0]);
      g.add(box(len, 0.2, 0.04, M('paint'), 0, -0.2, 0));                                  // fascia band on the slab edge
      g.add(box(len, 0.05, 0.06, M('blackmetal'), 0, 1.05, 0), box(len, 0.03, 0.04, M('blackmetal'), 0, 0.05, 0));
      g.add(box(len - 0.04, 0.95, 0.012, M('showerglass'), 0, 0.09, 0));
      const posts = Math.max(2, Math.round(len / 1.0) + 1);
      for (let i = 0; i < posts; i++) g.add(box(0.045, 1.08, 0.045, M('blackmetal'), -len / 2 + 0.02 + (len - 0.04) * i / (posts - 1), 0, 0));
      arch.add(g);
    }
  }

  DOORS.forEach((d, di) => {
    const s = span(d.open), dh = Math.min(DOOR_H, H);
    if (H > DOOR_H) arch.add(slab(d.open, DOOR_H, H, M('paint')));
    const jamb = (a, b) => arch.add(slab(s.alongX ? [a, s.t1 - 0.015, b, s.t2 + 0.015] : [s.t1 - 0.015, a, s.t2 + 0.015, b], 0, dh, M('walnut')));
    jamb(s.a, s.a + 0.03); jamb(s.b - 0.03, s.b);
    if (H > DOOR_H) arch.add(slab(s.alongX ? [s.a, s.t1 - 0.015, s.b, s.t2 + 0.015] : [s.t1 - 0.015, s.a, s.t2 + 0.015, s.b], DOOR_H - 0.03, DOOR_H, M('walnut')));
    // Door leaf on a hinge pivot: starts open the way the plan draws it, tap to close/open (see Inside mode).
    const l = span(d.leaf), lm = (l.t1 + l.t2) / 2, c = (s.t1 + s.t2) / 2;
    const near = Math.abs(lm - s.a) < Math.abs(lm - s.b) ? s.a : s.b, far = near === s.a ? s.b : s.a, dir = Math.sign(far - near);
    const L = Math.abs(far - near) - 0.07, farLeaf = Math.abs(l.a - c) > Math.abs(l.b - c) ? l.a : l.b, side = Math.sign(farLeaf - c);
    const P = (al, pe) => s.alongX ? [al, pe] : [pe, al];
    const angOf = ([vx, vz]) => -Math.atan2(vz, vx);
    const angOpen = angOf(P(0, side)), delta = Math.atan2(Math.sin(angOf(P(dir, 0)) - angOpen), Math.cos(angOf(P(dir, 0)) - angOpen));
    const [hx, hz] = P(near + dir * 0.035, c), t = 0.045, pivot = new THREE.Group();
    pivot.position.set(hx, 0, hz);
    pivot.add(box(L, dh - 0.02, t, d.main ? M('walnut_v', '#7a6656') : M('walnut_v'), L / 2, 0.01, 0));
    if (H > 1.05) for (const sd of [-1, 1]) pivot.add(box(0.14, 0.02, 0.02, M('brass'), L - 0.1, 1.0, sd * (t / 2 + 0.025)));
    const st = (doorState[di] ??= { open: true });
    pivot.rotation.y = st.open ? angOpen : angOpen + delta;
    pivot.traverse(o => { o.userData.door = di; });
    arch.add(pivot);
    doors[di] = { pivot, angOpen, angClosed: angOpen + delta, rect: d.open };
  });

  for (const [x1, z1, x2, z2, y1, y2raw, finish] of CLADDING) {
    const y2 = Math.min(y2raw, H);
    if (y2 <= y1 + 0.02) continue;
    const s = span([x1, z1, x2, z2]), cx = (x1 + x2) / 2, cz = (z1 + z2) / 2, t = s.t2 - s.t1;
    const sign = s.alongX ? (roomAt(cx, s.t2 + 0.3) ? 1 : -1) : (roomAt(s.t2 + 0.3, cz) ? 1 : -1);
    const len = s.b - s.a;
    if (finish === 'calacatta' || finish === 'stone_grey') {
      // keep window openings clear
      const holes = PLAN.windows.map(span).filter(w => w.alongX === s.alongX && w.b > s.a && w.a < s.b && Math.abs((w.t1 + w.t2) / 2 - (s.t1 + s.t2) / 2) < 0.4);
      let cuts = [s.a, ...holes.flatMap(w => [Math.max(w.a, s.a), Math.min(w.b, s.b)]), s.b];
      for (let i = 0; i < cuts.length - 1; i++) {
        const a = cuts[i], b = cuts[i + 1], inHole = i % 2 === 1;
        const r = s.alongX ? [a, s.t1, b, s.t2] : [s.t1, a, s.t2, b];
        if (!inHole) arch.add(slab(r, y1, y2, M(finish)));
        else {
          if (Math.min(y2, SILL) > y1) arch.add(slab(r, y1, Math.min(y2, SILL), M(finish)));
          if (y2 > WIN_TOP) arch.add(slab(r, Math.max(y1, WIN_TOP), y2, M(finish)));
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

  // Ceiling: gypsum drop band (cove) round the living rooms with hidden warm LED washing the raised centre,
  // spotlights set in the band; plain ceiling with a grid of downlights elsewhere.
  ceiling.add(slab([-0.023, 0, 20.3, 5.9], WALL_H, WALL_H + 0.05, M('ceiling'))); // one slab: per-room strips left hairline gaps
  const spot = (x, z, y) => { const d = mesh(new THREE.CircleGeometry(0.04, 24), M('glow'), { shadow: false }); d.rotation.x = Math.PI / 2; d.position.set(x, y, z); ceiling.add(d); };
  for (const room of ROOMS.filter(r => !r.outdoor)) for (const rect of room.rects) {
    const [a, b, c, d] = rect;
    if (room.cove && rect === room.rects[0]) {
      const B = 0.45, D = 0.14, y = WALL_H - D;
      ceiling.add(slab([a, b, c, b + B], y, WALL_H, M('ceiling')), slab([a, d - B, c, d], y, WALL_H, M('ceiling')),
                  slab([a, b + B, a + B, d - B], y, WALL_H, M('ceiling')), slab([c - B, b + B, c, d - B], y, WALL_H, M('ceiling')));
      for (const r of [[a + B, b + B, c - B, b + B + 0.02], [a + B, d - B - 0.02, c - B, d - B], [a + B, b + B, a + B + 0.02, d - B], [c - B - 0.02, b + B, c - B, d - B]])
        ceiling.add(slab(r, y + 0.02, y + 0.035, M('ledstrip')));                  // LED tucked behind the band lip
      for (const [x1, x2, zz] of [[a, c, b + B / 2], [a, c, d - B / 2]]) { const n = Math.max(2, Math.round((x2 - x1) / 1.2)); for (let i = 0; i < n; i++) spot(x1 + (x2 - x1) * (i + 0.5) / n, zz, y - 0.002); }
      continue;
    }
    const nx = Math.max(1, Math.round((c - a - 1) / 1.3)), nz = Math.max(1, Math.round((d - b - 1) / 1.3));
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++)
      spot(a + 0.5 + (c - a - 1) * (nx === 1 ? 0.5 : i / (nx - 1)), b + 0.5 + (d - b - 1) * (nz === 1 ? 0.5 : j / (nz - 1)), WALL_H - 0.002);
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
  collectParts();
  return obj;
}
const rebuildAll = () => { furn.clear(); items.forEach(rebuildItem); select(null); collectParts(); };
// Openable furniture parts (wardrobe doors / drawers) tagged by the builders with userData.part
let parts = [], ticks = [];
function collectParts() {
  parts = []; ticks = [];
  furn.traverse(o => {
    if (o.userData.part) { o.userData.part.open ??= false; o.userData.part.z0 ??= o.position.z; parts.push(o); }
    if (o.userData.tick) ticks.push(o.userData.tick);
  });
}

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
  Reception: 'Floor: wall-to-wall wool carpet (marbled sand / ivory) over the existing tile, ~20 cm tile margin · West side: full-height panorama glazing to the balcony · Walls: warm greige matte (≈ #E6DDD1) · TV wall: full-height fluted walnut · Ceiling: gypsum, recessed 2700 K downlights · Curtains: ceiling track, sheer + linen',
  Dining: 'Floor: wall-to-wall wool carpet, ivory with taupe border, over the existing tile · Pendants ×2 over table at 75 cm above top · Walls: warm greige',
  'Main bathroom': 'Floor + walls: warm grey concrete-look porcelain 60×120, full height, fine joints · Sink by the door, walk-in shower in the back corner beside the WC · Frameless glass with hinged door; rain head, hand shower, mixer and 2 body jets on the right wall; niche with 3 LED-lit shelves on the front wall · 50 L electric water heater on the left wall · Warm dim lighting',
  Balcony: 'Reception west wall opened as floor-to-ceiling panorama: 4 black-aluminium sliding glass panels · Balcony: stone floor, painted fascia, black-framed glass railing 1.1 m',
  Kitchen: 'Floor: travertine · Hob under the window (downdraft extractor), sink on the left wall, fridge column straight ahead from the door · Base units: handleless greige lacquer · Tall units: walnut · Worktop + splash: Calacatta 2 cm · Brass mixer',
  Bedroom: 'Floor: wall-to-wall plush ivory carpet over the existing wood-look tile; dark skirting kept · Two single beds 90×200 on the fluted walnut wall, shared nightstand · L-shaped study desk with PC + laptop where the wardrobe was · Curtains: sheer + linen',
  'Master bedroom': 'Floor: wall-to-wall ivory carpet with taupe border over the existing wood-look tile; dark skirting kept · Headboard wall: built-out full-height fluted walnut (hides the column) · Wardrobe: cream lacquer + light oak to ceiling, mirror doors, open lit shelf column',
  Corridor: 'Floor: wall-to-wall wool carpet, sand diamond lattice, over the existing tile · Art lighting · Doors: flush walnut, 2.25 m, brass levers; entrance: armoured, dark walnut',
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
let mode = 'orbit', locked = true;
const HELP = {
  orbit: 'Tap a room to step inside · Drag to rotate · Two fingers to pan · Pinch to zoom',
  inside: 'Drag to look around · Joystick / WASD to walk · Tap the floor to walk there · Tap doors, wardrobe doors, drawers or the shower door to open them · Tap the shower fittings to turn the water on/off',
  photo: 'Rendering a photo-real image… keep the camera still. Drag to change the angle (restarts).',
};
const helpText = () => mode === 'inside' ? HELP.inside : (locked ? '' : 'Drag furniture to move · R rotate · Del delete · ') + HELP.orbit;
function applyBackground() {
  const outdoors = wallMode === 0 || photo;
  scene.background = outdoors ? (view ?? sky ?? BG) : BG;
  ground.visible = !(outdoors && view);           // the panorama has its own ground far below
  scene.environment = photo && sky ? sky : envPMREM; // the path tracer needs an equirect environment
  ceiling.visible = wallMode === 0 && camera.position.y < WALL_H;
}
function setMode(m) {
  mode = m;
  ['orbit', 'top', 'walk'].forEach(k => $('v-' + k).classList.toggle('on', k === m || (k === 'walk' && m === 'inside')));
  $('help').textContent = helpText();
  orbit.enabled = m === 'orbit' || m === 'top';
  $('stick').hidden = $('exit-inside').hidden = m !== 'inside';
  document.body.classList.toggle('inside', m === 'inside');
  camera.fov = m === 'inside' ? (camera.aspect < 1 ? 78 : 65) : 45;
  camera.updateProjectionMatrix();
  renderer.toneMappingExposure = m === 'inside' ? 1.0 : 0.95;
  if (m === 'orbit' || m === 'top') {
    orbit.target.copy(CENTER);
    const k = Math.max(1, 1.3 / camera.aspect); // pull back on narrow (phone) screens so the whole flat fits
    if (m === 'top') camera.position.set(CENTER.x, 24 * k, CENTER.z + 0.01);
    else camera.position.set(CENTER.x - 3 * k, 13 * k, CENTER.z + 12 * k);
  }
  applyBackground();
}
$('v-orbit').onclick = () => setMode('orbit');
$('v-top').onclick = () => setMode('top');
$('v-walk').onclick = () => enterInside(4.7, 3.9, 2.0, 1.6);
$('exit-inside').onclick = () => { setWalls(1); setMode('orbit'); };
$('room-go').onchange = e => {
  const r = ROOMS[e.target.value]; if (!r) return;
  const [x1, z1, x2, z2] = r.rects[0];
  enterInside((x1 + x2) / 2, (z1 + z2) / 2);
  e.target.value = '';
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
let down = null;
renderer.domElement.addEventListener('pointerdown', e => {
  down = { x: e.clientX, y: e.clientY, t: performance.now(), lx: e.clientX, ly: e.clientY };
  if (photo || mode === 'flying') return;
  if (mode === 'inside') { renderer.domElement.setPointerCapture(e.pointerId); return; }
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
  if (mode === 'inside' && down && e.target === renderer.domElement) {
    yaw += (e.clientX - down.lx) * 0.005; pitch = THREE.MathUtils.clamp(pitch + (e.clientY - down.ly) * 0.005, -1.2, 1.2);
    down.lx = e.clientX; down.ly = e.clientY; walkTo = null;
    return;
  }
  if (!drag) return;
  pick(e);
  const p = new THREE.Vector3(); if (!ray.ray.intersectPlane(floorPlane, p)) return;
  const it = drag.obj.userData.item, snap = v => +(Math.round(v / SNAP) * SNAP).toFixed(2);
  it.x = snap(p.x + drag.dx); it.z = snap(p.z + drag.dz);
  place(drag.obj); outline.setFromObject(drag.obj);
});
addEventListener('pointerup', e => {
  const tap = down && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 8 && performance.now() - down.t < 400;
  down = null;
  if (drag) { save(); drag = null; furnBoxes = null; orbit.enabled = mode === 'orbit' || mode === 'top'; return; }
  if (!tap || photo || e.target !== renderer.domElement) return;
  pick(e);
  if (mode === 'inside') {
    const doorHit = ray.intersectObjects(doors.map(d => d.pivot), true)[0];
    const furnHit = ray.intersectObjects(furn.children.filter(o => o.visible), true)[0];
    let part = furnHit && furnHit.distance < 4 ? furnHit.object : null;
    while (part && !part.userData.part && part.parent !== furn) part = part.parent;
    part = part?.userData.part ? part : null;
    if (part && (!doorHit || furnHit.distance < doorHit.distance)) { part.userData.part.open = !part.userData.part.open; return; }
    if (doorHit && doorHit.distance < 4) { const st = doorState[doorHit.object.userData.door]; st.open = !st.open; return; }
    const p = new THREE.Vector3();
    if (ray.ray.intersectPlane(floorPlane, p) && p.distanceTo(camera.position) < 14) walkTo = p;
    return;
  }
  if ((mode === 'orbit' || mode === 'top') && (locked || !selected)) {
    const p = new THREE.Vector3();
    if (ray.ray.intersectPlane(floorPlane, p) && roomAt(p.x, p.z)) enterInside(p.x, p.z);
  }
});

const keys = {};
addEventListener('keydown', e => {
  if (['INPUT', 'SELECT'].includes(e.target.tagName)) return;
  keys[e.code] = true;
  if (mode !== 'inside' && !photo && !locked) {
    if (e.code === 'KeyR') rotate(e.shiftKey ? 15 : -90);
    if (e.code === 'Delete' || e.code === 'Backspace') $('del').click();
    if (e.code === 'Escape') select(null);
  }
  if (mode === 'inside' && e.code === 'Escape') $('exit-inside').click();
});
addEventListener('keyup', e => { keys[e.code] = false; });

// ---------- Inside mode: first-person, eye height, walls / furniture / closed doors are solid ----------
const EYE = 1.6, R = 0.22;
let yaw = 0, pitch = 0, walkTo = null, furnBoxes = null, fly = null;
const SKIP = new Set(['shower', 'water_heater', 'rug', 'rug_abstract', 'rug_border', 'rug_runner', 'rug_shag', 'rug_round', 'bath_mat', 'curtain', 'curtain_open', 'pendant', 'art', 'mirror_round', 'mirror_led', 'tv', 'hood', 'flowers', 'vase', 'ceramic_vase', 'table_lamp']);
const inPanoRect = ([a, b, c, d]) => a >= PANORAMA[0] - 0.01 && c <= PANORAMA[2] + 0.01 && b >= PANORAMA[1] - 0.01 && d <= PANORAMA[3] + 0.01;
const STATIC = PLAN.walls.concat(PLAN.windows).filter(r => !inPanoRect(r)).concat([PANORAMA]);
function solids() {
  furnBoxes ??= furn.children.filter(o => o.visible && !SKIP.has(o.userData.item.type) && (o.userData.item.y || 0) < 0.6).map(o => {
    const b = new THREE.Box3().setFromObject(o);
    return [b.min.x + 0.04, b.min.z + 0.04, b.max.x - 0.04, b.max.z - 0.04];
  });
  // shower: solid while its glass door is shut (unless you are already standing inside it)
  const showers = furn.children.filter(o => o.userData.item.type === 'shower').flatMap(o => {
    let open = false; o.traverse(c => { if (c.userData.part?.kind === 'hinge' && c.userData.part.open) open = true; });
    const b = new THREE.Box3().setFromObject(o), c = camera.position;
    const inside = c.x > b.min.x && c.x < b.max.x && c.z > b.min.z && c.z < b.max.z;
    return open || inside ? [] : [[b.min.x + 0.04, b.min.z + 0.04, b.max.x - 0.04, b.max.z - 0.04]];
  });
  return STATIC.concat(doors.filter((d, i) => !doorState[i].open).map(d => d.rect), furnBoxes, showers);
}
const blockedAt = (x, z) => solids().some(([a, b, c, d]) => x > a - R && x < c + R && z > b - R && z < d + R);
function freeSpot(x, z) {
  if (!blockedAt(x, z)) return [x, z];
  for (let r = 0.2; r < 2; r += 0.2) for (let k = 0; k < 16; k++) {
    const px = x + Math.cos(k / 16 * Math.PI * 2) * r, pz = z + Math.sin(k / 16 * Math.PI * 2) * r;
    if (!blockedAt(px, pz) && roomAt(px, pz)) return [px, pz];
  }
  return [x, z];
}
// Fly from wherever the camera is down to eye level in the room, looking across it.
function enterInside(x, z, lookX, lookZ) {
  select(null); furnBoxes = null; walkTo = null;
  setWalls(0);
  [x, z] = freeSpot(x, z);
  const room = roomAt(x, z), [x1, z1, x2, z2] = room ? room.rects[0] : [x - 1, z - 1, x + 1, z + 1];
  let tx = lookX ?? (x1 + x2) / 2, tz = lookZ ?? (z1 + z2) / 2;
  if (Math.hypot(tx - x, tz - z) < 0.8) { if (x2 - x1 > z2 - z1) tx = x < tx ? x2 : x1; else tz = z < tz ? z2 : z1; }
  yaw = Math.atan2(-(tx - x), -(tz - z)); pitch = -0.05;
  const endQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ'));
  fly = { t: 0, p0: camera.position.clone(), q0: camera.quaternion.clone(), p1: new THREE.Vector3(x, EYE, z), q1: endQ };
  mode = 'flying'; orbit.enabled = false;
  $('panel').hidden = true; $('menu-btn').textContent = '☰ Menu';
}
function tryMove(dx, dz) {
  const p = camera.position;
  if (!blockedAt(p.x + dx, p.z)) p.x += dx;
  if (!blockedAt(p.x, p.z + dz)) p.z += dz;
}
// On-screen joystick (bottom-left) for phones
const stick = { x: 0, y: 0 };
$('stick').addEventListener('pointerdown', e => { $('stick').setPointerCapture(e.pointerId); moveStick(e); });
$('stick').addEventListener('pointermove', e => { if (e.buttons) moveStick(e); });
$('stick').addEventListener('pointerup', () => { stick.x = stick.y = 0; $('knob').style.transform = ''; });
function moveStick(e) {
  const r = $('stick').getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, max = r.width / 2;
  let dx = e.clientX - cx, dy = e.clientY - cy; const len = Math.hypot(dx, dy);
  if (len > max) { dx *= max / len; dy *= max / len; }
  stick.x = dx / max; stick.y = dy / max; walkTo = null;
  $('knob').style.transform = `translate(${dx}px, ${dy}px)`;
}
function updateInside(dt) {
  const sp = 1.4 * dt, k = keys;
  let f = -stick.y + ((k.KeyW || k.ArrowUp) ? 1 : 0) - ((k.KeyS || k.ArrowDown) ? 1 : 0);
  let s = stick.x + (k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0);
  if (k.ArrowLeft || k.KeyQ) yaw += 1.6 * dt;
  if (k.ArrowRight || k.KeyE) yaw -= 1.6 * dt;
  if (f || s) walkTo = null;
  if (walkTo) {
    const dx = walkTo.x - camera.position.x, dz = walkTo.z - camera.position.z, d = Math.hypot(dx, dz);
    if (d < 0.08) walkTo = null;
    else { const before = camera.position.clone(); tryMove(dx / d * Math.min(sp, d), dz / d * Math.min(sp, d)); if (camera.position.distanceTo(before) < 1e-4) walkTo = null; }
  }
  const fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
  if (f || s) tryMove((fx * f + rx * s) * sp, (fz * f + rz * s) * sp);
  camera.position.y = EYE;
  camera.rotation.set(pitch, yaw, 0, 'YXZ');
}
// Smoothly swing door leaves toward their open/closed angle.
function updateDoors(dt) {
  const k = Math.min(1, dt * 6);
  for (const o of parts) {
    const p = o.userData.part;
    if (p.kind === 'hinge') o.rotation.y += ((p.open ? p.angle : 0) - o.rotation.y) * k;
    else if (p.kind === 'slide') o.position.z += (p.z0 + (p.open ? p.dist : 0) - o.position.z) * k;
  }
  for (const t of ticks) t(dt);
  doors.forEach((d, i) => {
    const target = doorState[i].open ? d.angOpen : d.angClosed, r = d.pivot.rotation;
    r.y += (target - r.y) * Math.min(1, dt * 6);
  });
}

// ---------- photo-real path tracing ----------
let photo = null;
$('photo').onclick = async () => {
  if (photo) return stopPhoto();
  $('photo').disabled = true; $('photo').textContent = 'Preparing…';
  try {
    const { WebGLPathTracer } = await import('https://esm.sh/three-gpu-pathtracer@0.0.27?external=three');
    select(null);
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
  updateDoors(dt);
  if (mode === 'flying') {
    fly.t = Math.min(1, fly.t + dt / 1.4);
    const e = fly.t < 0.5 ? 2 * fly.t * fly.t : 1 - (-2 * fly.t + 2) ** 2 / 2;
    camera.position.lerpVectors(fly.p0, fly.p1, e); camera.quaternion.slerpQuaternions(fly.q0, fly.q1, e);
    camera.fov = 45 + ((camera.aspect < 1 ? 78 : 65) - 45) * e; camera.updateProjectionMatrix();
    if (fly.t >= 1) setMode('inside');
  } else if (mode === 'inside') {
    const before = camera.position.clone(), r0 = yaw + pitch;
    updateInside(dt);
    if (photo && (camera.position.distanceTo(before) > 1e-5 || yaw + pitch !== r0)) photo.updateCamera();
  } else orbit.update();
  ceiling.visible = wallMode === 0 && camera.position.y < WALL_H;
  for (const t of tags) {
    const v = t.p.clone().project(camera);
    t.el.style.display = mode === 'inside' || mode === 'flying' || photo || v.z > 1 || camera.position.y < WALL_H ? 'none' : '';
    t.el.style.left = (v.x + 1) / 2 * innerWidth + 'px';
    t.el.style.top = (1 - v.y) / 2 * innerHeight + 'px';
  }
  if (photo) { photo.renderSample(); $('samples').textContent = `${Math.floor(photo.samples)} samples`; }
  else composer.render();
});
window.__app = { view: (x, z, tx, tz, p = -0.1) => { camera.position.set(x, EYE, z); yaw = Math.atan2(-(tx - x), -(tz - z)); pitch = p; }, parts: () => parts, tryMove, blockers: (x, z) => solids().filter(([a, b, c, d]) => x > a - R && x < c + R && z > b - R && z < d + R), scene, camera, orbit, items, setWalls, setMode, enterInside, doorState, get mode() { return mode; } };
