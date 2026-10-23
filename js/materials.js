// Finish library. Real PBR scans from Poly Haven (CC0) + a generated Calacatta marble.
import * as THREE from 'three';

// Phones (iOS especially) get a simpler shading path: their GPUs render the physical
// extras (clearcoat, sheen, transmission) and area lights with black/grainy artifacts.
export const PHONE = matchMedia('(pointer: coarse)').matches || new URLSearchParams(location.search).has('phone');
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
  travertine: { tile: 1.6, p: () => ({ ...scan('marble_01', { normal: 0.6 }), roughness: 0.75, clearcoat: 0.25, clearcoatRoughness: 0.35 }) },
  parquet:    { tile: 1.8, p: () => ({ ...scan('herringbone_parquet', { normal: 0.8 }), roughness: 1 }) },
  calacatta:  { tile: 1.5, p: () => ({ map: calacattaTexture(), color: '#ffffff', roughness: 0.18, clearcoat: 0.6, clearcoatRoughness: 0.08 }) },
  cream:      { tile: 1.2, p: () => ({ map: calacattaTexture(), color: '#eadfcd', roughness: 0.25, clearcoat: 0.5, clearcoatRoughness: 0.1 }) },
  walnut_v:   { tile: 1.2, p: () => ({ ...scan('smoked_walnut_veneer', { normal: 0.5, rotate: true }), roughness: 1, clearcoat: 0.15, clearcoatRoughness: 0.5 }) },
  walnut:     { tile: 1.2, p: () => ({ ...scan('smoked_walnut_veneer', { normal: 0.5 }), roughness: 1, clearcoat: 0.15, clearcoatRoughness: 0.5 }) },
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
  glass:      { tile: 1, p: () => ({ color: '#ffffff', metalness: 0, roughness: 0.02, transmission: 1, thickness: 0.01, ior: 1.5, transparent: true, opacity: 0.25, depthWrite: false }) },
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
