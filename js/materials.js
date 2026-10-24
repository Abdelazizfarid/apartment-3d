// Finish library. Real PBR scans from Poly Haven (CC0) + a generated Calacatta marble.
import * as THREE from 'three';

// Phones (iOS especially) get a simpler shading path: their GPUs render the physical
// extras (clearcoat, sheen, transmission) and area lights with black/grainy artifacts.
// "Fast" pipeline (standard materials, point lights, no post-processing) is the default on every device so laptops
// with integrated graphics stay smooth; "High" is opt-in from the menu (stored in localStorage, needs a reload).
export const TOUCH = matchMedia('(pointer: coarse)').matches;
export const PHONE = TOUCH || new URLSearchParams(location.search).has('phone') || localStorage.getItem('quality') !== 'high';
const PHYSICAL_ONLY = ['clearcoat', 'clearcoatRoughness', 'sheen', 'sheenRoughness', 'sheenColor', 'transmission', 'thickness', 'ior'];

const loader = new THREE.TextureLoader();
const texCache = new Map();
function tex(path, srgb, rotate) {
  const key = path + (rotate ? '|r' : '');
  if (!texCache.has(key)) {
    const t = loader.load(path);
    if (rotate) { t.rotation = Math.PI / 2; t.center.set(0.5, 0.5); }
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 8;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    texCache.set(key, t);
  }
  return texCache.get(key);
}
const scan = (name, { color = true, normal = 1, rotate = false } = {}) => ({
  ...(color && { map: tex(`assets/tex/${name}/diff.jpg`, true, rotate) }),
  normalMap: tex(`assets/tex/${name}/nor.jpg`, false, rotate),
  normalScale: new THREE.Vector2(normal, normal),
  roughnessMap: tex(`assets/tex/${name}/rough.jpg`, false, rotate),
});

// Calacatta: warm white stone with soft grey-gold veining, drawn once on a canvas (seeded, so it never changes).
// Warm grey concrete-look porcelain, 60×120 slabs with fine joints (texture covers 1.2 × 1.2 m: two slabs).
let stoneCanvas = null;
function stoneTexture() {
  if (stoneCanvas) return stoneCanvas;
  const c = document.createElement('canvas'); c.width = c.height = 1024;
  const g = c.getContext('2d');
  let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  g.fillStyle = '#77716b'; g.fillRect(0, 0, 1024, 1024);
  g.filter = 'blur(30px)';
  for (let i = 0; i < 60; i++) { g.fillStyle = rnd() < 0.5 ? 'rgba(140,134,128,0.35)' : 'rgba(95,90,85,0.35)'; g.beginPath(); g.arc(rnd() * 1024, rnd() * 1024, 40 + rnd() * 140, 0, 7); g.fill(); }
  g.filter = 'none';
  for (let i = 0; i < 40000; i++) { g.fillStyle = rnd() < 0.5 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)'; g.fillRect(rnd() * 1024, rnd() * 1024, 2, 2); }
  g.fillStyle = '#5c5751';
  for (const x of [0, 512, 1022]) g.fillRect(x - 1, 0, 3, 1024);
  g.fillRect(0, 0, 1024, 3); g.fillRect(0, 1022, 1024, 2);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return (stoneCanvas = t);
}

// Light white glossy porcelain, 60×60 with very soft grey veining (texture = 1.2 m = 2×2 tiles).
let whiteCanvas = null;
function whitePorcelainTexture() {
  if (whiteCanvas) return whiteCanvas;
  const c = document.createElement('canvas'); c.width = c.height = 1024;
  const g = c.getContext('2d');
  let seed = 23; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  g.fillStyle = '#f3f2ef'; g.fillRect(0, 0, 1024, 1024);
  g.filter = 'blur(25px)';
  for (let i = 0; i < 30; i++) { g.fillStyle = 'rgba(225,222,216,0.4)'; g.beginPath(); g.arc(rnd() * 1024, rnd() * 1024, 60 + rnd() * 140, 0, 7); g.fill(); }
  g.filter = 'blur(1.2px)'; g.strokeStyle = 'rgba(170,166,160,0.35)'; g.lineWidth = 1.5;
  for (let i = 0; i < 10; i++) { g.beginPath(); let x = rnd() * 1024, y = 0; g.moveTo(x, y); while (y < 1024) { x += (rnd() - 0.5) * 40; y += 20; g.lineTo(x, y); } g.stroke(); }
  g.filter = 'none'; g.fillStyle = '#d9d6d1';
  for (const k of [0, 512, 1022]) { g.fillRect(k - 1, 0, 3, 1024); g.fillRect(0, k - 1, 1024, 3); }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return (whiteCanvas = t);
}

let calacattaCanvas = null;
function calacattaTexture() {
  if (calacattaCanvas) return calacattaCanvas;
  const c = document.createElement('canvas'); c.width = c.height = 1024;
  const g = c.getContext('2d');
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  g.fillStyle = '#f2efe9'; g.fillRect(0, 0, 1024, 1024);
  g.filter = 'blur(40px)';
  for (let i = 0; i < 18; i++) {
    g.fillStyle = `rgba(${200 + rnd() * 30},${195 + rnd() * 25},${185 + rnd() * 20},0.35)`;
    g.beginPath(); g.arc(rnd() * 1024, rnd() * 1024, 80 + rnd() * 200, 0, 7); g.fill();
  }
  const vein = (width, alpha, blur) => {
    g.filter = `blur(${blur}px)`;
    g.strokeStyle = `rgba(120,112,100,${alpha})`; g.lineWidth = width;
    let x = rnd() * 1024, y = -50, a = 0.9 + rnd() * 0.6;
    g.beginPath(); g.moveTo(x, y);
    while (y < 1100 && x > -100 && x < 1124) {
      a += (rnd() - 0.5) * 0.5; x += Math.cos(a) * 18; y += Math.abs(Math.sin(a)) * 18 + 4;
      g.lineTo(x, y);
      if (rnd() < 0.04) { g.stroke(); g.lineWidth = width * (0.4 + rnd()); g.beginPath(); g.moveTo(x, y); }
    }
    g.stroke();
  };
  for (let i = 0; i < 5; i++) vein(6 + rnd() * 6, 0.35, 3);
  for (let i = 0; i < 14; i++) vein(1 + rnd() * 2, 0.45, 0.6);
  g.filter = 'none';
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return (calacattaCanvas = t);
}

// tile = how many meters one texture repeat covers (UVs are generated in world meters).
const DEFS = {
  // The client's existing reception/dining floor, built from their photo: glossy marble-look porcelain, 60×60 assumed.
  existing_tile: { tile: 1.2, p: () => ({ map: tex('assets/tex/existing_tile/diff.jpg', true), roughnessMap: tex('assets/tex/existing_tile/rough.jpg'), roughness: 1, clearcoat: 0.7, clearcoatRoughness: 0.08 }) },
  // Client's existing bedroom floor (from photo): wood-look porcelain planks 15×60 assumed, taupe-brown, staggered, light grout.
  wood_tile:  { tile: 1.2, p: () => ({ map: tex('assets/tex/wood_tile/diff.jpg', true), roughnessMap: tex('assets/tex/wood_tile/rough.jpg'), roughness: 1 }) },
  wood_skirt: { tile: 1, p: () => ({ color: '#4b3b36', roughness: 0.5 }) },
  travertine: { tile: 1.6, p: () => ({ ...scan('marble_01', { normal: 0.6 }), roughness: 0.75, clearcoat: 0.25, clearcoatRoughness: 0.35 }) },
  parquet:    { tile: 1.8, p: () => ({ ...scan('herringbone_parquet', { normal: 0.8 }), roughness: 1 }) },
  stone_grey: { tile: 1.2, p: () => ({ map: stoneTexture(), normalMap: tex('assets/tex/plastered_wall_04/nor.jpg'), normalScale: new THREE.Vector2(0.35, 0.35), roughness: 0.55, clearcoat: 0.15, clearcoatRoughness: 0.4 }) },
  gunmetal:   { tile: 1, p: () => ({ color: '#2b2b2d', metalness: 0.9, roughness: 0.35 }) },
  amber:      { tile: 1, p: () => ({ color: '#2e1607', roughness: 0.08, metalness: 0, clearcoat: 1 }) },
  white_porcelain: { tile: 1.2, p: () => ({ map: whitePorcelainTexture(), roughness: 0.12, clearcoat: 0.6, clearcoatRoughness: 0.05 }) },
  calacatta:  { tile: 1.5, p: () => ({ map: calacattaTexture(), color: '#ffffff', roughness: 0.18, clearcoat: 0.6, clearcoatRoughness: 0.08 }) },
  cream:      { tile: 1.2, p: () => ({ map: calacattaTexture(), color: '#eadfcd', roughness: 0.25, clearcoat: 0.5, clearcoatRoughness: 0.1 }) },
  walnut_v:   { tile: 1.2, p: () => ({ ...scan('smoked_walnut_veneer', { normal: 0.5, rotate: true }), roughness: 1, clearcoat: 0.15, clearcoatRoughness: 0.5 }) },
  walnut:     { tile: 1.2, p: () => ({ ...scan('smoked_walnut_veneer', { normal: 0.5 }), roughness: 1, clearcoat: 0.15, clearcoatRoughness: 0.5 }) },
  lightoak:   { tile: 1.0, p: () => ({ ...scan('white_oak_veneer', { normal: 0.4 }), color: '#fff0dc', roughness: 1 }) },
  oak:        { tile: 1.2, p: () => ({ ...scan('oak_veneer_01', { normal: 0.5 }), roughness: 1 }) },
  paint:      { tile: 2.5, p: () => ({ ...scan('plastered_wall_04', { color: false, normal: 0.25 }), color: '#e6ddd1', roughness: 0.9 }) },
  ceiling:    { tile: 2.5, p: () => ({ color: '#f5f2ed', roughness: 0.95 }) },
  skirting:   { tile: 1, p: () => ({ color: '#d8cfc2', roughness: 0.5 }) },
  boucle:     { tile: 0.35, p: () => ({ ...scan('curly_teddy_natural', { color: false, normal: 1.2 }), color: '#e9e2d6', roughness: 1, sheen: 0.6, sheenRoughness: 0.8, sheenColor: '#ffffff' }) },
  velvet:     { tile: 0.4, p: () => ({ ...scan('velour_velvet', { color: false, normal: 0.6 }), color: '#8a7560', roughness: 0.9, sheen: 1, sheenRoughness: 0.35, sheenColor: '#d9c7b0' }) },
  linen:      { tile: 0.5, p: () => ({ ...scan('rough_linen', { color: false, normal: 0.7 }), color: '#efe9df', roughness: 1, side: THREE.DoubleSide }) },
  sheer:      { tile: 0.4, p: () => ({ ...scan('rough_linen', { color: false, normal: 0.4 }), color: '#fbf8f2', roughness: 1, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }) },
  leather:    { tile: 0.6, p: () => ({ ...scan('fabric_leather_02', { normal: 0.6 }), roughness: 0.8 }) },
  lacquer:    { tile: 1, p: () => ({ color: '#cfc5b7', roughness: 0.45, clearcoat: 0.2 }) },
  brass:      { tile: 1, p: () => ({ color: '#c8a35a', metalness: 1, roughness: 0.28 }) },
  blackmetal: { tile: 1, p: () => ({ color: '#1c1c1c', metalness: 0.7, roughness: 0.45 }) },
  steel:      { tile: 1, p: () => ({ color: '#9da3a8', metalness: 1, roughness: 0.3 }) },
  glass:      { tile: 1, p: () => ({ color: '#ffffff', metalness: 0, roughness: 0.02, transmission: 1, thickness: 0.01, ior: 1.5, transparent: true, opacity: PHONE ? 0.06 : 0.25, depthWrite: false }) },
  showerglass:{ tile: 1, p: () => ({ color: '#e8f0f0', roughness: 0.03, metalness: 0.1, transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide }) },
  frosted:    { tile: 1, p: () => ({ color: '#f4f1ec', roughness: 0.6, metalness: 0, transparent: true, opacity: 0.72, side: THREE.DoubleSide }) },
  mirror:     { tile: 1, p: () => ({ color: '#ffffff', metalness: 1, roughness: 0.02 }) },
  ceramic:    { tile: 1, p: () => ({ color: '#f6f4f0', roughness: 0.12, clearcoat: 0.8 }) },
  matteceramic:{ tile: 1, p: () => ({ color: '#d8d0c4', roughness: 0.7 }) },
  blackglass: { tile: 1, p: () => ({ color: '#0b0b0c', roughness: 0.05, clearcoat: 1 }) },
  shadowgap:  { tile: 1, p: () => ({ color: '#1a1714', roughness: 0.9 }) },
  mattress:   { tile: 1, p: () => ({ color: '#f4f1ea', roughness: 0.95 }) },
  glow:       { tile: 1, p: () => ({ color: '#fff3dd', emissive: '#ffd59a', emissiveIntensity: 2.2, roughness: 1 }) },
  ledstrip:   { tile: 1, p: () => ({ color: '#fff3dd', emissive: '#ffcf8a', emissiveIntensity: 4, roughness: 1 }) },
};

const cache = new Map();
export function M(name, color) {
  const key = color ? `${name}|${color}` : name;
  if (!cache.has(key)) {
    const d = DEFS[name];
    const props = d.p();
    if (PHONE) PHYSICAL_ONLY.forEach(k => delete props[k]);
    const m = PHONE ? new THREE.MeshStandardMaterial(props) : new THREE.MeshPhysicalMaterial(props);
    if (color) m.color.set(color);
    m.userData.tile = d.tile;
    cache.set(key, m);
  }
  return cache.get(key);
}
export const FINISHES = Object.keys(DEFS);

// UVs in world meters / tile so textures keep real scale on any box size.
export function worldUV(geo, tile) {
  const p = geo.attributes.position, n = geo.attributes.normal, uv = geo.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    let u, v;
    if (ay >= ax && ay >= az) { u = p.getX(i); v = p.getZ(i); }
    else if (ax >= az) { u = p.getZ(i); v = p.getY(i); }
    else { u = p.getX(i); v = p.getY(i); }
    uv.setXY(i, u / tile, v / tile);
  }
  uv.needsUpdate = true;
  return geo;
}

export function mesh(geo, mat, { shadow = true } = {}) {
  if (geo.attributes.uv && geo.attributes.normal && mat.userData.tile) worldUV(geo, mat.userData.tile);
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = shadow && !mat.transparent;
  m.receiveShadow = true;
  return m;
}

// ---------- Rugs: patterned wool textures drawn once per (pattern, size), so the design is never stretched ----------
const RUG = { ivory: '#ece4d6', sand: '#d6c8b4', greige: '#b8ac9b', taupe: '#8c7b69', olive: '#6e6a4c', bronze: '#a88d62', terra: '#9c6b4e' };
const rugCache = new Map();
export function rugMaterial(pattern, w, d) {
  const key = `${pattern}|${w}|${d}`;
  if (rugCache.has(key)) return rugCache.get(key);
  const W = 1024, H = Math.max(128, Math.round(W * d / w)), ppm = W / w;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  let seed = pattern.length * 97 + Math.round(w * 13 + d * 7); const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const band = (inset, width, color) => { g.strokeStyle = color; g.lineWidth = width; g.strokeRect(inset, inset, W - inset * 2, H - inset * 2); };
  if (pattern === 'abstract') {           // marbled, softly blurred bands with fine taupe veins and a slim ivory edge
    g.fillStyle = RUG.sand; g.fillRect(0, 0, W, H);
    g.filter = 'blur(18px)';
    for (let i = 0; i < 7; i++) {
      g.strokeStyle = [RUG.ivory, RUG.greige, '#e3d7c4'][i % 3]; g.globalAlpha = 0.65; g.lineWidth = 50 + rnd() * 110;
      g.beginPath(); g.moveTo(-50, rnd() * H);
      g.bezierCurveTo(W * 0.3, rnd() * H, W * 0.6, rnd() * H, W + 50, rnd() * H); g.stroke();
    }
    g.filter = 'none'; g.globalAlpha = 0.6;
    for (let i = 0; i < 6; i++) {
      g.strokeStyle = i % 2 ? RUG.taupe : RUG.bronze; g.lineWidth = 2;
      g.beginPath(); g.moveTo(-20, rnd() * H); g.bezierCurveTo(W * 0.35, rnd() * H, W * 0.65, rnd() * H, W + 20, rnd() * H); g.stroke();
    }
    g.globalAlpha = 1; band(ppm * 0.03, ppm * 0.03, RUG.ivory);
  } else if (pattern === 'border') {      // calm ivory field framed by a taupe band and a fine bronze line
    g.fillStyle = RUG.ivory; g.fillRect(0, 0, W, H);
    band(ppm * 0.12, ppm * 0.06, RUG.taupe); band(ppm * 0.2, ppm * 0.012, RUG.bronze);
  } else if (pattern === 'geo') {         // runner: sand ground, taupe diamond lattice, greige edge
    g.fillStyle = RUG.sand; g.fillRect(0, 0, W, H);
    g.strokeStyle = RUG.taupe; g.globalAlpha = 0.55; g.lineWidth = Math.max(2, ppm * 0.012);
    const s = ppm * 0.22;
    for (let x = -H; x < W + H; x += s) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + H, H); g.stroke(); g.beginPath(); g.moveTo(x, H); g.lineTo(x + H, 0); g.stroke(); }
    g.globalAlpha = 1; band(ppm * 0.05, ppm * 0.08, RUG.greige); band(ppm * 0.1, ppm * 0.01, RUG.olive);
  } else if (pattern === 'shag') {        // deep ivory pile: soft cloudy tone variation
    g.fillStyle = RUG.ivory; g.fillRect(0, 0, W, H); g.filter = 'blur(10px)';
    for (let i = 0; i < 160; i++) { g.fillStyle = rnd() < 0.5 ? '#f4eee4' : '#ddd2c1'; g.globalAlpha = 0.5; g.beginPath(); g.arc(rnd() * W, rnd() * H, 10 + rnd() * 40, 0, 7); g.fill(); }
    g.filter = 'none'; g.globalAlpha = 1;
  } else if (pattern === 'round') {       // concentric greige rings on sand
    g.fillStyle = RUG.sand; g.fillRect(0, 0, W, H);
    for (let r = 0.48; r > 0.05; r -= 0.07) { g.strokeStyle = r > 0.4 ? RUG.taupe : RUG.ivory; g.lineWidth = W * 0.012; g.beginPath(); g.arc(W / 2, H / 2, W * r, 0, 7); g.stroke(); }
  } else {                                // bath: ivory cotton with ribbing
    g.fillStyle = RUG.ivory; g.fillRect(0, 0, W, H);
    g.fillStyle = '#ddd3c4'; for (let y = 0; y < H; y += 14) g.fillRect(0, y, W, 5);
  }
  // woven speckle so it reads as wool, not print
  for (let i = 0; i < W * H / 60; i++) { g.fillStyle = rnd() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'; g.fillRect(rnd() * W, rnd() * H, 2, 2); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  // real cut-pile surface: scanned carpet normal + roughness, repeated every 50 cm
  const pile = n => { const x = tex(`assets/tex/carpet/${n}.jpg`, false).clone(); x.repeat.set(w / 0.5, d / 0.5); x.needsUpdate = true; return x; };
  const props = { map: t, normalMap: pile('nor'), normalScale: new THREE.Vector2(0.9, 0.9), roughnessMap: pile('rough'), roughness: 1,
    ...(PHONE ? {} : { sheen: 0.8, sheenRoughness: 0.7, sheenColor: '#fff6ea' }) };
  const mat = PHONE ? new THREE.MeshStandardMaterial(props) : new THREE.MeshPhysicalMaterial(props);
  rugCache.set(key, mat);
  return mat;
}
