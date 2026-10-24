// Furniture catalog. Every builder returns a Group facing +z with its origin at the floor centre.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { M, mesh, PHONE, rugMaterial } from './materials.js';
import { WALL_H } from './plan.js';

// ---------- primitives (y = bottom of the part) ----------
const at = (m, x, y, z) => { m.position.set(x, y, z); return m; };
export function box(w, h, d, mat, x = 0, y = 0, z = 0) {
  return at(mesh(new THREE.BoxGeometry(w, h, d), mat), x, y + h / 2, z);
}
export function rbox(w, h, d, r, mat, x = 0, y = 0, z = 0) {
  r = Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001);
  return at(mesh(new RoundedBoxGeometry(w, h, d, 3, r), mat), x, y + h / 2, z);
}
function cyl(rt, rb, h, mat, x = 0, y = 0, z = 0, seg = 32, open = false) {
  return at(mesh(new THREE.CylinderGeometry(rt, rb, h, seg, 1, open), mat), x, y + h / 2, z);
}
const group = (...parts) => { const g = new THREE.Group(); g.add(...parts); return g; };

// Vertical walnut flutes on a backing board, facing +z. Merged into one mesh.
export function fluted(w, h, mat = M('walnut_v'), pitch = 0.04) {
  const geos = [];
  const n = Math.max(1, Math.floor(w / pitch));
  for (let i = 0; i < n; i++) {
    const g = new THREE.CylinderGeometry(pitch * 0.42, pitch * 0.42, h, 10, 1, false, -Math.PI / 2, Math.PI);
    g.translate(-w / 2 + pitch * (i + 0.5), h / 2, 0);
    geos.push(g);
  }
  const back = new THREE.BoxGeometry(w, h, 0.012); back.translate(0, h / 2, -0.006);
  geos.push(back);
  return mesh(mergeGeometries(geos.map(g => g.toNonIndexed())), mat);
}
// Upholstered vertical channels, facing +z.
export function channels(w, h, mat, pitch = 0.2) {
  const n = Math.max(1, Math.round(w / pitch)), cw = w / n, g = new THREE.Group();
  for (let i = 0; i < n; i++) g.add(rbox(cw - 0.006, h, 0.09, 0.04, mat, -w / 2 + cw * (i + 0.5), 0, 0.045));
  return g;
}

// ---------- scanned models ----------
const GLTF = {
  lounge:   ['mid_century_lounge_chair/mid_century_lounge_chair.gltf'],
  armchair: ['modern_arm_chair_01/modern_arm_chair_01.gltf'],
  coffee:   ['coffee_table_round_01/coffee_table_round_01.gltf'],
  cabinet:  ['modern_wooden_cabinet/modern_wooden_cabinet.gltf'],
  pendant:  ['modern_ceiling_lamp_01/modern_ceiling_lamp_01.gltf'],
  pachira:  ['pachira_aquatica_01/pachira_aquatica_01.gltf', ['pachira_aquatica_01_bark_d', 'pachira_aquatica_01_leaves_d']],
  calathea: ['calathea_orbifolia_01/calathea_orbifolia_01.gltf', ['calathea_orbifolia_01_a']],
  vase:     ['brass_vase_01/brass_vase_01.gltf'],
  ceramicvase: ['ceramic_vase_01/ceramic_vase_01.gltf'],
  frame:    ['hanging_picture_frame_02/hanging_picture_frame_02.gltf'],
  sidewood: ['side_table_01/side_table_01.gltf'],
  sheenchair: ['SheenChair/SheenChair.glb'],
  velvetsofa: ['GlamVelvetSofa/GlamVelvetSofa.glb'],
  flowers:  ['GlassVaseFlowers/GlassVaseFlowers.glb', ['Flowers2', 'GlassTransmission']],
};
const models = {};
export async function loadModels(onProgress) {
  const loader = new GLTFLoader();
  let done = 0;
  await Promise.all(Object.entries(GLTF).map(async ([key, [file, pick]]) => {
    try {
      const gltf = await loader.loadAsync(`assets/models/${file}`);
      let root = gltf.scene;
      if (pick) {
        const keep = new THREE.Group();
        root.updateMatrixWorld(true);
        for (const name of pick) {
          const o = root.getObjectByName(name);
          if (o) { o.applyMatrix4(o.parent.matrixWorld); keep.add(o); }
        }
        root = keep;
      }
      root.traverse(o => {
        if (!o.isMesh) return;
        o.castShadow = true; o.receiveShadow = true;
        if (PHONE && o.material.isMeshPhysicalMaterial) {
          const s = o.material;
          o.material = new THREE.MeshStandardMaterial({ name: s.name, color: s.color, map: s.map, normalMap: s.normalMap, normalScale: s.normalScale,
            roughness: s.roughness, roughnessMap: s.roughnessMap, metalness: s.metalness, metalnessMap: s.metalnessMap, aoMap: s.aoMap,
            emissive: s.emissive, emissiveMap: s.emissiveMap, transparent: s.transparent, opacity: s.opacity, alphaMap: s.alphaMap, alphaTest: s.alphaTest, side: s.side });
        }
      });
      const b = new THREE.Box3().setFromObject(root), c = b.getCenter(new THREE.Vector3());
      const wrap = new THREE.Group(); root.position.sub(new THREE.Vector3(c.x, b.min.y, c.z)); wrap.add(root);
      models[key] = { obj: wrap, size: b.getSize(new THREE.Vector3()) };
    } catch (e) { console.warn('model failed', key, e); }
    onProgress?.(++done / Object.keys(GLTF).length);
  }));
}
// fit: 'stretch' matches w/h/d exactly, 'uniform' keeps proportions inside w/h/d.
function model(key, w, h, d, fit = 'uniform', tint) {
  const m = models[key];
  if (!m) return box(w, h, d, M('lacquer'));
  const o = m.obj.clone(true), s = m.size;
  if (fit === 'stretch') o.scale.set(w / s.x, h / s.y, d / s.z);
  else o.scale.setScalar(Math.min(w / s.x, h / s.y, d / s.z));
  if (tint) o.traverse(n => {
    if (!n.isMesh || !(n.material.sheen || /fabric/i.test(n.material.name))) return;
    n.material = n.material.clone(); n.material.map = null; n.material.color.set(tint); n.material.sheenColor?.set(tint).offsetHSL(0, -0.1, 0.25);
  });
  return o;
}
function lampLight(y, intensity = 1.2, distance = 3.5) {
  if (PHONE) return new THREE.Group(); // ponytail: lamps only glow on phones; a dozen point lights is too much for mobile shaders
  const l = new THREE.PointLight('#ffc98a', intensity, distance, 2);
  l.position.y = y; l.userData.lamp = true;
  return l;
}

// ---------- catalog ----------
// tint: which finish the colour picker changes. spec: what to order / build.
export const CATALOG = {
  // Living
  sofa_l: { label: 'L-shaped sofa (bouclé)', cat: 'Living', w: 3.2, d: 1.8, h: 0.78, tint: 'boucle', color: '#e9e2d6',
    spec: 'Modular L sofa, cream bouclé, feather-wrapped cushions, recessed walnut plinth, seat height 44 cm',
    build: (it, fab) => {
      const { w, d, h } = it, arm = 0.22, back = 0.25, deep = 1.0, chaise = 0.95, g = new THREE.Group();
      const plinth = M('walnut'), velvet = M('velvet', '#6e6a4c'), velvet2 = M('velvet', '#9c6b4e');
      g.add(box(w - 0.1, 0.08, deep - 0.1, plinth, 0, 0, -d / 2 + deep / 2), box(chaise - 0.1, 0.08, d - 0.1, plinth, w / 2 - chaise / 2, 0, 0));
      g.add(rbox(w, h - 0.08, back, 0.05, fab, 0, 0.08, -d / 2 + back / 2));
      g.add(rbox(arm, 0.6 - 0.08, deep, 0.06, fab, -w / 2 + arm / 2, 0.08, -d / 2 + deep / 2));
      const seatW = w - arm - chaise;
      g.add(rbox(seatW, 0.24, deep - back, 0.04, fab, -w / 2 + arm + seatW / 2, 0.08, -d / 2 + back + (deep - back) / 2));
      g.add(rbox(chaise, 0.24, d - back, 0.04, fab, w / 2 - chaise / 2, 0.08, -d / 2 + back + (d - back) / 2));
      const n = Math.max(1, Math.round(seatW / 0.75));
      for (let i = 0; i < n; i++) g.add(rbox(seatW / n - 0.015, 0.13, deep - back - 0.02, 0.06, fab, -w / 2 + arm + seatW / n * (i + 0.5), 0.32, -d / 2 + back + (deep - back) / 2 + 0.01));
      g.add(rbox(chaise - 0.02, 0.13, d - back - 0.02, 0.06, fab, w / 2 - chaise / 2, 0.32, -d / 2 + back + (d - back) / 2));
      const bw = w - arm, nb = Math.max(1, Math.round(bw / 0.8));
      for (let i = 0; i < nb; i++) {
        const c = rbox(bw / nb - 0.02, 0.42, 0.18, 0.08, fab, -w / 2 + arm + bw / nb * (i + 0.5), 0.42, -d / 2 + back + 0.07);
        c.rotation.x = -0.14; g.add(c);
      }
      [[-w / 2 + arm + 0.3, velvet], [-w / 2 + arm + 0.62, velvet2], [w / 2 - 0.35, velvet], [w / 2 - 0.68, fab]].forEach(([x, m], i) => {
        const p = rbox(0.46, 0.44, 0.14, 0.07, m, x, 0.44, -d / 2 + back + 0.2); p.rotation.set(-0.25, (i - 1.5) * 0.08, 0); g.add(p);
      });
      return g;
    } },
  curved_sofa: { label: 'Curved velvet sofa', cat: 'Living', w: 2.2, d: 1.0, h: 0.79, tint: 'velvet', color: '#c9b79c',
    spec: 'Curved velvet sofa on tapered brass-tipped legs (Mercer41 “Frankie” style)',
    build: (it) => model('velvetsofa', it.w, it.h, it.d, 'stretch', it.color) },
  lounge_chair: { label: 'Leather lounge chair', cat: 'Living', w: 0.85, d: 0.95, h: 1.0,
    spec: 'Mid-century swivel lounge chair, cognac leather, walnut shell', build: it => model('lounge', it.w, it.h, it.d) },
  armchair: { label: 'Armchair (wood + leather)', cat: 'Living', w: 0.8, d: 0.95, h: 1.0,
    spec: 'Low armchair, solid oak frame, black leather cushions', build: it => model('armchair', it.w, it.h, it.d) },
  accent_chair: { label: 'Velvet accent chair', cat: 'Living', w: 0.83, d: 0.57, h: 0.69, tint: 'velvet', color: '#6e6a4c',
    spec: 'Channel-tufted velvet chair on walnut legs', build: it => model('sheenchair', it.w, it.h, it.d, 'uniform', it.color) },
  coffee_round: { label: 'Round marble coffee table', cat: 'Living', w: 1.0, d: 1.0, h: 0.42,
    spec: 'Ø100 cm marble top, black steel sculpted base', build: it => model('coffee', it.w, it.h, it.d, 'stretch') },
  side_table: { label: 'Marble side table', cat: 'Living', w: 0.45, d: 0.45, h: 0.55,
    spec: 'Ø45 cm cream marble top on brushed-brass pedestal',
    build: ({ w, h }) => group(cyl(w * 0.35, w * 0.38, 0.02, M('brass')), cyl(0.025, 0.025, h - 0.06, M('brass'), 0, 0.02), cyl(w / 2, w / 2, 0.04, M('cream'), 0, h - 0.04, 0, 48)) },
  tv_console: { label: 'Floating TV console', cat: 'Living', w: 2.4, d: 0.38, h: 0.32, y: 0.22,
    spec: 'Wall-hung walnut console with fluted fronts, cream marble top, warm LED underlight',
    build: ({ w, d, h }) => {
      const f = fluted(w - 0.02, h - 0.03, M('walnut_v'), 0.03); f.position.z = d / 2 - 0.01;
      const strip = box(w - 0.1, 0.01, 0.02, M('ledstrip'), 0, -0.005, d / 2 - 0.08);
      return group(box(w, h - 0.03, d - 0.03, M('walnut'), 0, 0, -0.015), f, box(w, 0.03, d, M('cream'), 0, h - 0.03), strip);
    } },
  tv: { label: 'TV 75" (wall-mounted)', cat: 'Living', w: 1.68, d: 0.04, h: 0.97, y: 1.0,
    spec: '75" OLED, flush wall mount', build: ({ w, d, h }) => group(box(w, h, d, M('blackmetal')), box(w - 0.02, h - 0.02, 0.002, M('blackglass'), 0, 0.01, d / 2)) },
  rug: { label: 'Rug (hand-tufted)', cat: 'Living', w: 2.4, d: 1.7, h: 0.012, tint: 'boucle', color: '#d9cfc0',
    spec: 'Hand-tufted wool rug, low pile, oatmeal', build: ({ w, d, h }, fab) => rbox(w, h, d, 0.005, fab) },
  rug_abstract: { label: 'Rug – marbled abstract', cat: 'Rugs', w: 3.2, d: 2.3, h: 0.015,
    spec: 'Hand-tufted wool & viscose rug, marbled abstract in sand / ivory / greige with fine bronze veins', build: ({ w, d, h }) => box(w, h, d, rugMaterial('abstract', w, d)) },
  rug_border: { label: 'Rug – ivory with border', cat: 'Rugs', w: 2.7, d: 2.3, h: 0.015,
    spec: 'Flat-weave wool rug, ivory field, taupe border band with fine bronze line', build: ({ w, d, h }) => box(w, h, d, rugMaterial('border', w, d)) },
  rug_runner: { label: 'Runner – diamond lattice', cat: 'Rugs', w: 3.0, d: 0.8, h: 0.012,
    spec: 'Wool runner, sand ground with taupe diamond lattice, greige + olive edge', build: ({ w, d, h }) => box(w, h, d, rugMaterial('geo', w, d)) },
  rug_shag: { label: 'Rug – plush ivory', cat: 'Rugs', w: 2.9, d: 1.9, h: 0.03,
    spec: 'Deep-pile plush wool rug, ivory', build: ({ w, d, h }) => rbox(w, h, d, 0.012, rugMaterial('shag', w, d)) },
  rug_round: { label: 'Rug – round rings', cat: 'Rugs', w: 1.6, d: 1.6, h: 0.015,
    spec: 'Round tufted wool rug Ø160, sand with greige / ivory rings', build: ({ w, h }) => cyl(w / 2, w / 2, h, rugMaterial('round', w, w), 0, 0, 0, 64) },
  bath_mat: { label: 'Bath mat', cat: 'Rugs', w: 0.8, d: 0.5, h: 0.015,
    spec: 'Ribbed cotton bath mat, ivory, anti-slip back', build: ({ w, d, h }) => box(w, h, d, rugMaterial('bath', w, d)) },
  floor_lamp: { label: 'Floor lamp', cat: 'Living', w: 0.4, d: 0.4, h: 1.6,
    spec: 'Brass floor lamp with pleated linen drum shade, 2700 K',
    build: ({ w, h }) => group(cyl(0.14, 0.15, 0.025, M('blackmetal')), cyl(0.012, 0.012, h - 0.3, M('brass'), 0, 0.025),
      cyl(w * 0.45, w * 0.5, 0.32, M('sheer', '#f3e9d8'), 0, h - 0.32, 0, 32, true), cyl(0.05, 0.05, 0.08, M('glow'), 0, h - 0.22), lampLight(h - 0.18)) },
  plant_tree: { label: 'Plant – Pachira tree', cat: 'Living', w: 0.7, d: 0.7, h: 1.9,
    spec: 'Pachira aquatica ~1.5 m in matte stone planter Ø45 cm',
    build: ({ w, d, h }) => { const p = model('pachira', w, h - 0.4, d); p.position.y = 0.38; return group(cyl(0.22, 0.17, 0.42, M('matteceramic')), p); } },
  plant_bush: { label: 'Plant – Calathea', cat: 'Living', w: 0.55, d: 0.55, h: 0.75,
    spec: 'Calathea orbifolia in low ceramic bowl Ø40 cm',
    build: ({ w, d, h }) => { const p = model('calathea', w, h - 0.3, d); p.position.y = 0.28; return group(cyl(0.2, 0.16, 0.3, M('matteceramic', '#cbbfae')), p); } },
  art: { wall: true, label: 'Framed art', cat: 'Decor', w: 0.75, d: 0.04, h: 0.5, y: 1.25,
    spec: 'Framed print, oak frame', build: it => model('frame', it.w, it.h, it.d, 'stretch') },
  vase: { label: 'Brass vase', cat: 'Decor', w: 0.23, d: 0.23, h: 0.6, y: 0.75, spec: 'Brass vase', build: it => model('vase', it.w, it.h, it.d) },
  ceramic_vase: { label: 'Ceramic vase', cat: 'Decor', w: 0.2, d: 0.2, h: 0.4, y: 0.75, spec: 'Glazed ceramic vase', build: it => model('ceramicvase', it.w, it.h, it.d) },
  flowers: { label: 'Glass vase with flowers', cat: 'Decor', w: 0.3, d: 0.2, h: 0.3, y: 0.76, spec: 'Fresh flowers in glass vase', build: it => model('flowers', it.w, it.h, it.d) },
  mirror_round: { wall: true, label: 'Round mirror (brass)', cat: 'Decor', w: 0.9, d: 0.03, h: 0.9, y: 1.2,
    spec: 'Round mirror, thin brushed-brass frame',
    build: ({ w, d, h }) => {
      const r = Math.min(w, h) / 2, m = mesh(new THREE.CircleGeometry(r - 0.015, 64), M('mirror')), ring = mesh(new THREE.TorusGeometry(r - 0.008, 0.012, 12, 96), M('brass'));
      m.position.set(0, h / 2, d / 2); ring.position.set(0, h / 2, d / 2);
      return group(m, ring);
    } },
  // Dining
  dining_table: { label: 'Dining table (marble)', cat: 'Dining', w: 1.8, d: 0.95, h: 0.76,
    spec: 'Cream marble top 180×95 cm, rounded corners, twin marble pedestals',
    build: ({ w, d, h }) => group(rbox(w, 0.04, d, 0.02, M('cream'), 0, h - 0.04),
      rbox(0.22, h - 0.04, d * 0.55, 0.05, M('cream'), -w * 0.28, 0), rbox(0.22, h - 0.04, d * 0.55, 0.05, M('cream'), w * 0.28, 0)) },
  dining_round: { label: 'Round dining table (marble)', cat: 'Dining', w: 1.3, d: 1.3, h: 0.76,
    spec: 'Round dining table Ø130 cm for 6, cream marble top, sculpted marble pedestal',
    build: ({ w, h }) => group(cyl(w / 2, w / 2, 0.04, M('cream'), 0, h - 0.04, 0, 64), cyl(0.16, 0.24, h - 0.12, M('cream'), 0, 0.06, 0, 48),
      cyl(0.36, 0.38, 0.06, M('cream'), 0, 0, 0, 48), cyl(0.24, 0.16, 0.08, M('cream'), 0, h - 0.12, 0, 48)) },
  dining_chair: { label: 'Dining chair (velvet)', cat: 'Dining', w: 0.48, d: 0.52, h: 0.86, tint: 'velvet', color: '#9a8670',
    spec: 'Upholstered dining chair, taupe velvet, solid walnut legs, seat height 47 cm',
    build: ({ w, d, h }, fab) => {
      const g = group(rbox(w, 0.09, d, 0.035, fab, 0, 0.38));
      const back = rbox(w - 0.02, h - 0.47, 0.07, 0.03, fab, 0, 0.46, -d / 2 + 0.04); back.rotation.x = -0.08; g.add(back);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        const l = cyl(0.016, 0.012, 0.38, M('walnut'), sx * (w / 2 - 0.05), 0, sz * (d / 2 - 0.06), 12); l.rotation.z = sx * 0.04; g.add(l);
      }
      return g;
    } },
  pendant: { label: 'Pendant light', cat: 'Lighting', w: 0.43, d: 0.43, h: 0.95, hang: true,
    spec: 'Opal-glass globe pendant, black cap, warm 2700 K',
    build: it => {
      const o = model('pendant', it.w, it.h, it.d);
      o.traverse(n => { if (n.isMesh && n.material.color && n.material.color.getHSL({}).l > 0.6) { n.material = n.material.clone(); n.material.emissive = new THREE.Color('#ffd9a0'); n.material.emissiveIntensity = 1.5; } });
      return group(o, lampLight(0.2, 2.5, 4));
    } },
  sideboard: { label: 'Fluted sideboard', cat: 'Dining', w: 1.6, d: 0.45, h: 0.75,
    spec: 'Walnut sideboard with fluted doors on black metal legs', build: it => model('cabinet', it.w, it.h, it.d, 'stretch') },
  // Bedroom
  bed: { label: 'Upholstered bed', cat: 'Bedroom', w: 1.6, d: 2.1, h: 0.55, tint: 'boucle', color: '#d8cdbd',
    spec: 'Upholstered bed with channel-tufted headboard (125 cm), bouclé, walnut plinth; linen bedding',
    build: ({ w, d, h }, fab) => {
      const g = new THREE.Group(), olive = M('velvet', '#6e6a4c'), linen = M('linen'), sand = M('linen', '#d9c9b2');
      g.add(box(w - 0.1, 0.08, d - 0.15, M('walnut'), 0, 0, 0.03));
      g.add(rbox(w, 0.27, d - 0.08, 0.03, fab, 0, 0.08, 0.04));
      g.add(rbox(w - 0.04, 0.22, d - 0.16, 0.06, M('mattress'), 0, 0.33, 0.06));
      const head = channels(w + 0.1, 1.25, fab, (w + 0.1) / 8); head.position.set(0, 0.12, -d / 2); g.add(head);
      g.add(rbox(w + 0.02, 0.07, d * 0.72, 0.03, linen, 0, 0.53, d / 2 - d * 0.36));
      g.add(rbox(w + 0.05, 0.035, 0.5, 0.015, olive, 0, 0.6, d / 2 - 0.4));
      const single = w < 1.2, k = single ? 1.8 : 1;                 // single bed: one pillow, full width
      for (const sx of single ? [0] : [-1, 1]) {
        const p = rbox(w * 0.44 * k, 0.5, 0.16, 0.07, linen, sx * w * 0.235, 0.5, -d / 2 + 0.2); p.rotation.x = -0.28; g.add(p);
        const q = rbox(w * 0.36 * k, 0.42, 0.14, 0.06, sand, sx * w * 0.2, 0.52, -d / 2 + 0.36); q.rotation.x = -0.32; g.add(q);
      }
      const c = rbox(Math.min(0.45, w * 0.45), 0.3, 0.12, 0.06, olive, 0, 0.55, -d / 2 + 0.5); c.rotation.x = -0.3; g.add(c);
      return g;
    } },
  nightstand: { label: 'Nightstand', cat: 'Bedroom', w: 0.5, d: 0.45, h: 0.5,
    spec: 'Walnut 2-drawer nightstand, cream marble top, brass pulls',
    build: ({ w, d, h }) => group(rbox(w, h - 0.03, d, 0.015, M('walnut')), box(w, 0.03, d, M('cream'), 0, h - 0.03),
      box(w - 0.02, 0.006, 0.004, M('shadowgap'), 0, (h - 0.03) / 2, d / 2), box(0.14, 0.012, 0.02, M('brass'), 0, (h - 0.03) * 0.75, d / 2 + 0.01), box(0.14, 0.012, 0.02, M('brass'), 0, (h - 0.03) * 0.25, d / 2 + 0.01)) },
  table_lamp: { label: 'Table lamp', cat: 'Lighting', w: 0.32, d: 0.32, h: 0.55, y: 0.5,
    spec: 'Ceramic table lamp, linen shade, 2700 K',
    build: ({ w, h }) => {
      const base = mesh(new THREE.SphereGeometry(w * 0.32, 32, 16), M('matteceramic', '#b9a48a')); base.scale.y = 1.15; base.position.y = w * 0.36;
      return group(base, cyl(0.01, 0.01, h * 0.3, M('brass'), 0, w * 0.6), cyl(w * 0.4, w * 0.5, h * 0.42, M('sheer', '#f3e9d8'), 0, h * 0.58, 0, 32, true), cyl(0.04, 0.04, 0.06, M('glow'), 0, h * 0.65), lampLight(h * 0.7, 0.8, 3));
    } },
  bench: { label: 'Bed-end bench', cat: 'Bedroom', w: 1.3, d: 0.42, h: 0.45, tint: 'velvet', color: '#6e6a4c',
    spec: 'Upholstered velvet bench on brushed-brass frame',
    build: ({ w, d, h }, fab) => group(rbox(w, 0.14, d, 0.05, fab, 0, h - 0.14), box(w - 0.06, 0.02, d - 0.06, M('brass'), 0, 0.06),
      ...[-1, 1].flatMap(sx => [-1, 1].map(sz => box(0.02, h - 0.14, 0.02, M('brass'), sx * (w / 2 - 0.04), 0, sz * (d / 2 - 0.04))))) },
  wardrobe: { label: 'Wardrobe (cream & oak, mirror)', cat: 'Bedroom', w: 2.4, d: 0.6, h: 2.85, tint: 'lacquer', color: '#ebe3d6',
    spec: 'Built-in wardrobe to ceiling: matte cream lacquer doors with top boxes, light-oak frame & plinth, long oak bar handles, central mirror doors over 2 oak drawers, open oak shelf column with warm LED under each shelf',
    build: ({ w, d, h }, door) => {
      const oak = M('lightoak'), T = 0.02, P = 0.08, inner = h - P - T, g = new THREE.Group();
      g.add(box(w, P, d - 0.03, oak, 0, 0, -0.015), box(w, T, d, oak, 0, h - T));
      for (const sx of [-1, 1]) g.add(box(T, inner, d, oak, sx * (w / 2 - T / 2), P));
      // open shelf column on the left, lit under every shelf
      const sw = w >= 1.6 ? 0.42 : 0, x0 = -w / 2 + T, scx = x0 + sw / 2;
      if (sw) {
        g.add(box(sw, inner, 0.02, oak, scx, P, -d / 2 + 0.035), box(T, inner, d, oak, x0 + sw + T / 2, P));
        for (let k = 1; k <= 5; k++) {
          const y = P + inner * k / 6;
          g.add(box(sw, 0.025, d - 0.04, oak, scx, y, -0.01), box(sw - 0.04, 0.006, 0.012, M('ledstrip'), scx, y - 0.006, d / 2 - 0.07));
        }
        g.add(box(sw - 0.04, 0.006, 0.012, M('ledstrip'), scx, h - T - 0.006, d / 2 - 0.07));
        const vase = model('ceramicvase', 0.16, 0.24, 0.16); vase.position.set(scx, P + inner * 2 / 6 + 0.025, -0.02);
        const plant = model('calathea', 0.3, 0.28, 0.3); plant.position.set(scx, P + inner * 4 / 6 + 0.025, -0.02);
        g.add(vase, plant);
      }
      // door modules: pairs of cream doors with top boxes; the middle one is mirror doors over drawers.
      // Every door is on a hinge pivot and every drawer slides (userData.part), so they can be opened in Inside mode.
      const xa = x0 + sw + (sw ? T : 0), xb = w / 2 - T, rest = xb - xa, mid = (xa + xb) / 2;
      const n = Math.max(1, Math.round(rest / 0.85)), mw = rest / n, mirrorAt = n >= 2 ? Math.floor(n / 2) : -1;
      const split = h - T - 0.55, fz = d / 2 - 0.01, gap = 0.004, cz = -0.03, cd = d - 0.08;
      // hollow carcass: back, dividers, top-box shelf
      g.add(box(rest, inner, 0.015, oak, mid, P, -d / 2 + 0.03), box(rest, 0.02, cd, oak, mid, split - 0.02, cz));
      for (let i = 1; i < n; i++) g.add(box(T, inner, cd, oak, xa + mw * i, P, cz));
      const COLORS = ['#e9e4da', '#c7b8a3', '#6e6a4c', '#2f3a4a', '#9c6b4e', '#f2f0eb', '#3a3a3c', '#b9a48a'];
      let seed = 3; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      const stack = (x, y, z, wd) => { for (let k = 0; k < 3 + Math.floor(rnd() * 2); k++) g.add(box(wd, 0.055, 0.28, M('linen', COLORS[Math.floor(rnd() * 8)]), x, y + k * 0.057, z)); };
      const doorLeaf = (hx, dir, y, dw, dh, mat, handle, mirror) => {
        const p = new THREE.Group(); p.position.set(hx, 0, fz);
        p.add(box(dw, dh, 0.02, mat, dir * dw / 2, y, 0));
        if (mirror) p.add(box(dw - 0.012, dh - 0.01, 0.003, M('mirror'), dir * dw / 2, y + 0.005, 0.0115));
        if (handle) p.add(box(0.018, 0.95, 0.025, oak, dir * (dw - 0.045), 0.75, 0.022));
        p.userData.part = { kind: 'hinge', angle: dir > 0 ? -1.75 : 1.75 };
        g.add(p);
      };
      for (let i = 0; i < n; i++) {
        const cx = xa + mw * (i + 0.5), hw = mw / 2 - gap, L = cx - mw / 2 + gap, R = cx + mw / 2 - gap;
        // top cupboard: two hinged doors, storage baskets inside
        doorLeaf(L, 1, split + gap / 2, hw, h - T - split - gap, door, false);
        doorLeaf(R, -1, split + gap / 2, hw, h - T - split - gap, door, false);
        for (const sx of [-1, 1]) g.add(box(mw * 0.4, 0.26, 0.36, M('linen', '#c9b79c'), cx + sx * mw / 4, split + 0.01, cz));
        if (i === mirrorAt) {
          // two sliding drawers with folded clothes, shelves with folded stacks behind the mirror doors
          for (let k = 0; k < 2; k++) {
            const dr = new THREE.Group(), y = P + 0.003 + k * 0.22;
            dr.add(box(mw - gap * 2, 0.215, 0.02, oak, cx, y, fz), box(0.16, 0.014, 0.02, oak, cx, y + 0.107, fz + 0.02));
            dr.add(box(mw - 0.06, 0.012, 0.45, oak, cx, y + 0.01, fz - 0.235), box(mw - 0.06, 0.16, 0.012, oak, cx, y + 0.01, fz - 0.455));
            for (const sx of [-1, 1]) dr.add(box(0.012, 0.16, 0.45, oak, cx + sx * (mw / 2 - 0.035), y + 0.01, fz - 0.235));
            for (let c = 0; c < 4; c++) dr.add(box(mw * 0.18, 0.07, 0.36, M('linen', COLORS[(c + k * 3) % 8]), cx - mw * 0.32 + c * mw * 0.21, y + 0.022, fz - 0.25));
            dr.userData.part = { kind: 'slide', dist: 0.38 };
            g.add(dr);
          }
          const top = P + 0.45, step = (split - 0.02 - top) / 3;
          for (let k = 0; k < 3; k++) {
            const y = top + k * step;
            g.add(box(mw - 0.01, 0.02, cd, oak, cx, y, cz));
            stack(cx - mw * 0.22, y + 0.02, cz + 0.02, mw * 0.36); stack(cx + mw * 0.22, y + 0.02, cz + 0.02, mw * 0.36);
          }
          doorLeaf(L, 1, P + 0.445, hw, split - P - 0.45, oak, false, true);
          doorLeaf(R, -1, P + 0.445, hw, split - P - 0.45, oak, false, true);
        } else {
          // hanging rail with clothes, shoe shelf at the bottom
          const railY = split - 0.1, count = Math.floor((mw - 0.1) / 0.075);
          g.add(box(mw - 0.03, 0.025, 0.025, M('steel'), cx, railY, cz), box(mw - 0.01, 0.02, cd, oak, cx, P + 0.2, cz));
          for (let k = 0; k < count; k++) {
            const len = 0.65 + rnd() * 0.45, x = cx - mw / 2 + 0.07 + k * 0.075;
            g.add(box(0.03, len, 0.42, M('linen', COLORS[Math.floor(rnd() * 8)]), x, railY - 0.04 - len, cz), box(0.006, 0.05, 0.36, M('blackmetal'), x, railY - 0.04, cz));
          }
          for (let k = 0; k < Math.floor(mw / 0.2); k++) g.add(box(0.1, 0.09, 0.26, M('leather'), cx - mw / 2 + 0.12 + k * 0.2, P + 0.22, cz + 0.05));
          doorLeaf(L, 1, P + gap / 2, hw, split - P - gap, door, true);
          doorLeaf(R, -1, P + gap / 2, hw, split - P - gap, door, true);
        }
      }
      return g;
    } },
  // L footprint: long leg (w) against the back wall, return leg at the +x end running forward to d. Top depth 65 cm.
  desk_l: { label: 'L-shaped desk (PC + laptop)', cat: 'Bedroom', w: 2.4, d: 1.6, h: 0.75,
    spec: 'L-shaped study desk, 65 cm deep light-oak top on black steel legs, 3-drawer pedestal, 27" monitor + PC tower, laptop, keyboard, mouse, desk lamp',
    build: ({ w, d, h }) => {
      const D = 0.65, T = 0.03, oak = M('lightoak'), k = M('blackmetal'), g = new THREE.Group();
      const bz = -d / 2, rx = w / 2 - D, rz0 = bz + D;                           // back edge, return-leg inner x, return-leg start z
      g.add(box(w, T, D, oak, 0, h - T, bz + D / 2), box(D, T, d - D, oak, rx + D / 2, h - T, rz0 + (d - D) / 2));
      for (const [x, z] of [[-w / 2 + 0.03, bz + 0.05], [-w / 2 + 0.03, bz + D - 0.05], [rx + 0.05, d / 2 - 0.05], [w / 2 - 0.05, d / 2 - 0.05], [rx + 0.05, rz0 + 0.05]])
        g.add(box(0.04, h - T, 0.04, k, x, 0, z));
      // drawer pedestal under the return leg
      g.add(box(0.42, 0.6, 0.5, oak, rx + D / 2, 0.02, d / 2 - 0.3));
      const px = rx + D / 2 - 0.211, pz = d / 2 - 0.3;               // pedestal front faces the seated user (-x)
      for (const y of [0.22, 0.42]) g.add(box(0.004, 0.004, 0.46, M('shadowgap'), px, y, pz));
      for (const y of [0.13, 0.33, 0.52]) g.add(box(0.02, 0.012, 0.14, k, px - 0.01, y, pz));
      // PC: monitor on a stand, keyboard, mouse; tower under the desk
      const mx = -w * 0.05, mz = bz + 0.18;
      g.add(box(0.24, 0.012, 0.18, k, mx, h, mz), box(0.035, 0.32, 0.03, k, mx, h, mz - 0.03));
      g.add(box(0.62, 0.37, 0.025, k, mx, h + 0.17, mz), box(0.6, 0.35, 0.003, M('blackglass'), mx, h + 0.18, mz + 0.014));
      g.add(box(0.44, 0.02, 0.14, M('steel'), mx, h, bz + 0.45), box(0.06, 0.02, 0.1, M('steel'), mx + 0.32, h, bz + 0.45));
      g.add(box(0.2, 0.45, 0.42, k, -w / 2 + 0.3, 0.02, bz + 0.3), box(0.004, 0.4, 0.36, M('ledstrip'), -w / 2 + 0.2 + 0.002, 0.04, bz + 0.3));
      // laptop on the return leg, open toward whoever sits on the -x side
      const lx = rx + D / 2 + 0.05, lz = rz0 + (d - D) * 0.55;
      g.add(box(0.23, 0.015, 0.33, M('steel'), lx, h, lz));
      const screen = box(0.008, 0.22, 0.33, M('steel'), 0, 0, 0); screen.position.set(lx + 0.115, h + 0.11, lz); screen.rotation.z = 0.25; g.add(screen);
      const disp = box(0.002, 0.2, 0.31, M('blackglass'), 0, 0, 0); disp.position.set(lx + 0.108, h + 0.11, lz); disp.rotation.z = 0.25; g.add(disp);
      // desk lamp in the corner
      g.add(cyl(0.07, 0.08, 0.02, k, rx + D / 2, h, bz + 0.15), cyl(0.008, 0.008, 0.4, k, rx + D / 2, h + 0.02, bz + 0.15, 8), cyl(0.06, 0.08, 0.1, k, rx + D / 2, h + 0.38, bz + 0.15, 16));
      return g;
    } },
  office_chair: { label: 'Ergonomic office chair', cat: 'Bedroom', w: 0.66, d: 0.66, h: 1.22,
    spec: 'Ergonomic task chair: graphite mesh back with adjustable lumbar pad and headrest, waterfall-edge upholstered seat, height-adjustable padded armrests, gas lift with cover, polished 5-star base on soft castors',
    build: ({ w, h }) => {
      const k = M('blackmetal'), al = M('steel'), fab = M('velvet', '#34363a'), mesh_ = M('frosted', '#2c2d30'), g = new THREE.Group(), r = w * 0.46;
      // base: 5 tapered polished legs with castors
      g.add(cyl(0.045, 0.05, 0.06, al, 0, 0.07));
      for (let i = 0; i < 5; i++) {
        const a = i / 5 * Math.PI * 2 + 0.3, leg = box(r, 0.03, 0.045, al, 0, 0, 0);
        leg.geometry.translate(r / 2, 0, 0); leg.position.set(0, 0.08, 0); leg.rotation.set(0, a, -0.08); g.add(leg);
        const cx = Math.cos(a) * r, cz = -Math.sin(a) * r;
        g.add(box(0.02, 0.04, 0.02, k, cx, 0.05, cz));
        for (const s of [-1, 1]) { const wheel = cyl(0.028, 0.028, 0.018, k, 0, 0, 0, 16); wheel.rotation.z = Math.PI / 2; wheel.position.set(cx + s * 0.012, 0.028, cz); g.add(wheel); }
      }
      // gas lift + cover, tilt mechanism, adjustment lever
      g.add(cyl(0.022, 0.022, 0.18, al, 0, 0.13), cyl(0.035, 0.03, 0.14, k, 0, 0.17), box(0.22, 0.05, 0.25, k, 0, 0.32, 0), box(0.12, 0.01, 0.015, k, 0.16, 0.33, 0.06));
      // seat: padded cushion with rounded waterfall front
      g.add(rbox(0.5, 0.075, 0.48, 0.035, fab, 0, 0.37, 0.01), box(0.48, 0.02, 0.46, k, 0, 0.355, 0.01));
      const wf = cyl(0.04, 0.04, 0.48, fab, 0, 0, 0, 16); wf.rotation.z = Math.PI / 2; wf.position.set(0, 0.405, 0.23); g.add(wf);
      // armrests: post + padded top
      for (const s of [-1, 1]) g.add(box(0.03, 0.22, 0.04, k, s * 0.27, 0.35, -0.04), box(0.08, 0.03, 0.04, k, s * 0.25, 0.35, -0.04), rbox(0.075, 0.03, 0.26, 0.012, fab, s * 0.27, 0.57, 0.0));
      // back: frame + mesh, lumbar pad, headrest, spine bar
      const back = new THREE.Group(); back.position.set(0, 0.47, -0.24); back.rotation.x = -0.12;
      const bh = h - 0.75;
      for (const s of [-1, 1]) back.add(rbox(0.03, bh, 0.03, 0.012, k, s * 0.23, 0, 0));
      back.add(rbox(0.49, 0.035, 0.035, 0.012, k, 0, bh - 0.035, 0), rbox(0.46, 0.035, 0.035, 0.012, k, 0, 0.02, 0), box(0.44, bh - 0.06, 0.006, mesh_, 0, 0.04, 0));
      back.add(rbox(0.32, 0.09, 0.04, 0.02, fab, 0, 0.16, 0.03), box(0.04, 0.18, 0.03, k, 0, -0.12, -0.03));
      const head = rbox(0.3, 0.12, 0.05, 0.03, fab, 0, bh + 0.06, 0.02); back.add(head, box(0.03, 0.08, 0.02, k, 0, bh, 0));
      g.add(back);
      return g;
    } },
  shoe_cabinet: { label: 'Shoe cabinet (floating)', cat: 'Other', w: 1.4, d: 0.32, h: 0.85, y: 0.12,
    spec: 'Wall-hung shoe cabinet, 32 cm deep: three tilt-out fluted walnut doors with angled shoe racks inside, cream marble top, warm LED strip underneath; key bowl and small vase on top',
    build: ({ w, d, h }) => {
      const g = group(box(w, h - 0.03, d - 0.02, M('walnut_v'), 0, 0, -0.01), box(w + 0.02, 0.03, d + 0.01, M('cream'), 0, h - 0.03, 0.005),
        box(w - 0.06, 0.006, 0.012, M('ledstrip'), 0, -0.006, d / 2 - 0.06));
      const n = 3, dw = w / n;
      for (let i = 0; i < n; i++) {
        const x = -w / 2 + dw * (i + 0.5), f = fluted(dw - 0.008, h - 0.05, M('walnut_v'), 0.03); f.position.set(x, 0.01, d / 2 - 0.005); g.add(f);
        g.add(box(0.1, 0.012, 0.02, M('brass'), x, h - 0.1, d / 2 + 0.01));
      }
      g.add(cyl(0.11, 0.07, 0.05, M('matteceramic', '#cbbfae'), w / 2 - 0.25, h, 0, 24), cyl(0.04, 0.03, 0.2, M('ceramic'), -w / 2 + 0.2, h, -0.03, 20));
      const pl = model('calathea', 0.15, 0.14, 0.15); pl.position.set(-w / 2 + 0.2, h + 0.18, -0.03); g.add(pl);
      return g;
    } },
  wall_sconce: { label: 'Wall light (brass)', cat: 'Lighting', w: 0.14, d: 0.16, h: 0.3, y: 1.55, wall: true,
    spec: 'Brass wall sconce with opal glass shade, warm 2700 K',
    build: ({ h }) => group(box(0.1, 0.16, 0.02, M('brass'), 0, 0, -0.07), box(0.016, 0.016, 0.12, M('brass'), 0, 0.07, -0.01),
      cyl(0.055, 0.045, 0.14, M('glow'), 0, 0.03, 0.05, 24), cyl(0.058, 0.058, 0.012, M('brass'), 0, 0.17, 0.05, 24), lampLight(0.1, 1.2, 3)) },
  bookcase: { label: 'Bookcase (oak, with books)', cat: 'Living', w: 0.9, d: 0.35, h: 2.4,
    spec: 'Open light-oak bookcase to the ceiling line, 5 shelves, styled with books, vases and small objects',
    build: ({ w, d, h }) => {
      const oak = M('lightoak'), g = group(box(w, h, 0.015, oak, 0, 0, -d / 2 + 0.008), box(0.025, h, d, oak, -w / 2 + 0.0125, 0), box(0.025, h, d, oak, w / 2 - 0.0125, 0));
      let seed = Math.round(w * 97 + h * 13); const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      const COLS = ['#e9e2d6', '#c7b8a3', '#6e6a4c', '#2f3a4a', '#9c6b4e', '#8a7560', '#3a3a3c', '#b9a48a'];
      const n = 6, step = (h - 0.05) / n;
      for (let k = 0; k <= n; k++) g.add(box(w - 0.05, 0.025, d - 0.02, oak, 0, k * step, 0.0));
      for (let k = 0; k < n; k++) {
        const y = k * step + 0.025; let x = -w / 2 + 0.04;
        const stop = k % 2 ? w * 0.35 : w / 2 - 0.05;
        while (x < stop) { const bw = 0.025 + rnd() * 0.03, bh = step * (0.55 + rnd() * 0.3); g.add(box(bw, bh, d * 0.7, M('linen', COLS[Math.floor(rnd() * 8)]), x + bw / 2, y, 0.01)); x += bw + 0.003; }
        if (k % 2) g.add(cyl(0.05, 0.04, step * 0.5, M('matteceramic', ['#b9a48a', '#e9e2d6'][k % 2 ? 1 : 0]), w * 0.38, y, 0, 20));
      }
      return g;
    } },
  office_pod: { label: 'Office pod (sliding doors)', cat: 'Bedroom', w: 1.9, d: 1.1, h: 2.6,
    spec: 'Built-in study pod: light-oak side panels and canopy, fluted walnut back, 1.8 m oak desk with drawers, shelf with books, LED in the canopy; front closed by two frosted-glass sliding doors in oak frames on a top track (tap to slide open)',
    build: ({ w, d, h }) => {
      const oak = M('lightoak'), k = M('blackmetal'), g = new THREE.Group(), iw = w - 0.08, bz = -d / 2;
      for (const s of [-1, 1]) g.add(box(0.04, h, d, oak, s * (w / 2 - 0.02), 0, 0));
      g.add(box(w, 0.08, d, oak, 0, h - 0.08, 0), box(iw - 0.04, 0.006, 0.015, M('ledstrip'), 0, h - 0.086, 0.05));
      const back = fluted(iw, h - 0.1); back.position.set(0, 0.02, bz + 0.015); g.add(back);
      g.add(box(iw, 0.035, 0.6, oak, 0, 0.74, bz + 0.31), box(0.42, 0.6, 0.5, oak, iw / 2 - 0.23, 0.12, bz + 0.27));
      for (const y of [0.32, 0.52]) g.add(box(0.4, 0.004, 0.004, M('shadowgap'), iw / 2 - 0.23, y, bz + 0.52));
      g.add(box(0.03, 0.74, 0.03, k, -iw / 2 + 0.03, 0, bz + 0.58));
      g.add(box(0.6, 0.35, 0.025, k, -0.1, 0.95, bz + 0.12), box(0.58, 0.33, 0.003, M('blackglass'), -0.1, 0.96, bz + 0.135), box(0.04, 0.2, 0.03, k, -0.1, 0.775, bz + 0.1), box(0.2, 0.012, 0.15, k, -0.1, 0.775, bz + 0.1));
      g.add(box(0.42, 0.018, 0.13, M('steel'), -0.1, 0.775, bz + 0.35), box(0.06, 0.02, 0.09, M('steel'), 0.18, 0.775, bz + 0.35));
      const lap = box(0.3, 0.012, 0.21, M('steel'), 0.42, 0.775, bz + 0.32), scr = box(0.3, 0.2, 0.008, M('steel'), 0.42, 0.787, bz + 0.215); scr.rotation.x = -0.25; g.add(lap, scr);
      g.add(box(iw, 0.025, 0.26, oak, 0, 1.55, bz + 0.15), box(iw - 0.04, 0.006, 0.012, M('ledstrip'), 0, 1.544, bz + 0.27));
      const COLS = ['#e9e2d6', '#6e6a4c', '#2f3a4a', '#9c6b4e', '#b9a48a'];
      for (let i = 0; i < 14; i++) g.add(box(0.03, 0.2 + (i % 3) * 0.03, 0.18, M('linen', COLS[i % 5]), -iw / 2 + 0.08 + i * 0.033, 1.575, bz + 0.13));
      g.add(cyl(0.05, 0.04, 0.16, M('matteceramic'), iw / 2 - 0.2, 1.575, bz + 0.14, 20));
      // sliding doors: outer one slides across the inner one to open
      const DW = w / 2 + 0.02, dh = h - 0.14, fz = d / 2;
      g.add(box(w, 0.04, 0.1, k, 0, h - 0.12, fz - 0.04), box(w, 0.012, 0.1, k, 0, 0, fz - 0.04));
      const door = (x, z) => {
        const p = new THREE.Group(); p.position.set(x, 0.012, z);
        for (const [bw, bh, bx, by] of [[DW, 0.05, 0, 0], [DW, 0.05, 0, dh - 0.05], [0.05, dh, -DW / 2 + 0.025, 0], [0.05, dh, DW / 2 - 0.025, 0]]) p.add(box(bw, bh, 0.03, oak, bx, by, 0));
        p.add(box(DW - 0.1, dh - 0.1, 0.006, M('frosted'), 0, 0.05, 0), box(0.02, 0.5, 0.02, k, -DW / 2 + 0.07, 0.8, 0.025));
        g.add(p); return p;
      };
      door(w / 4, fz - 0.065);
      const out = door(-w / 4, fz - 0.02); out.userData.part = { kind: 'slidex', dist: w / 2 - 0.04 };
      return g;
    } },
  office_pod_curve: { label: 'Curved office pod', cat: 'Bedroom', w: 1.9, d: 1.1, h: 2.5,
    spec: 'Curved study pod (in the corridor corner, lengthwise): smooth cream lacquer curved shell, light-oak canopy and plinth bands with hidden warm LED, curved reeded-glass door with brass ribs that glides round behind the shell (tap to open), fluted walnut back wall, oak desk with drawers, lit shelf with books',
    build: ({ w, d, h }) => {
      const oak = M('lightoak'), cream = M('lacquer', '#efe8dd'), g = new THREE.Group(), bz = -d / 2, half = w / 2;
      const zs = bz + 0.3, zf = d / 2, s = zf - zs, R = (half * half + s * s) / (2 * s), cz = zf - R, A = Math.asin(half / R);
      const D2R = Math.PI / 180, doorA = 50 * D2R, P = 0.1, TOP = 0.16, sh = h - P - TOP;
      const arc = (r, t0, tl, y0, hh, mat, seg = 64) => { const m = mesh(new THREE.CylinderGeometry(r, r, hh, seg, 1, true, t0, tl), mat); m.position.set(0, y0 + hh / 2, cz); return m; };
      // smooth cream shell (fixed part), oak plinth + canopy following the curve
      g.add(arc(R, -A + doorA, 2 * A - doorA, P, sh, cream));
      const shape = new THREE.Shape(); shape.moveTo(-half, bz);
      for (let i = 0; i <= 48; i++) { const t = -A + 2 * A * i / 48; shape.lineTo(Math.sin(t) * (R + 0.02), cz + Math.cos(t) * (R + 0.02)); }
      shape.lineTo(half, bz); shape.closePath();
      for (const [y, th, mat] of [[h - TOP, TOP, oak], [0, P, M('oak')]]) { const c = mesh(new THREE.ExtrudeGeometry(shape, { depth: th, bevelEnabled: false }), mat); c.rotation.x = Math.PI / 2; c.position.y = y + th;  g.add(c); }
      g.add(arc(R + 0.03, -A, 2 * A, P - 0.03, 0.03, oak));                                   // oak plinth lip
      const glow = arc(R + 0.025, -A, 2 * A, h - TOP - 0.012, 0.012, M('ledstrip')); g.add(glow);   // LED line under the canopy
      for (const sx of [-1, 1]) g.add(box(0.05, h, zs - bz, oak, sx * (half - 0.025), 0, (bz + zs) / 2));
      // interior
      const back = fluted(w - 0.1, h - 0.1); back.position.set(0, 0.02, bz + 0.015); g.add(back);
      g.add(box(w - 0.55, 0.035, 0.52, oak, 0, 0.74, bz + 0.27), box(0.4, 0.6, 0.45, oak, half - 0.5, 0.12, bz + 0.24));
      g.add(box(0.6, 0.35, 0.025, M('blackmetal'), -0.1, 0.95, bz + 0.12), box(0.58, 0.33, 0.003, M('blackglass'), -0.1, 0.96, bz + 0.135), box(0.04, 0.2, 0.03, M('blackmetal'), -0.1, 0.775, bz + 0.1));
      g.add(box(0.42, 0.018, 0.13, M('steel'), -0.1, 0.775, bz + 0.35));
      const scr = box(0.3, 0.2, 0.008, M('steel'), 0.42, 0.787, bz + 0.215); scr.rotation.x = -0.25; g.add(box(0.3, 0.012, 0.21, M('steel'), 0.42, 0.775, bz + 0.32), scr);
      g.add(box(w - 0.14, 0.025, 0.24, oak, 0, 1.55, bz + 0.14), box(w - 0.2, 0.006, 0.012, M('ledstrip'), 0, 1.544, bz + 0.25));
      const COLS = ['#e9e2d6', '#6e6a4c', '#2f3a4a', '#9c6b4e', '#b9a48a'];
      for (let i = 0; i < 22; i++) g.add(box(0.03, 0.2 + (i % 3) * 0.03, 0.18, M('linen', COLS[i % 5]), -half + 0.15 + i * 0.034, 1.575, bz + 0.13));
      // desk styling: book stack, task lamp, mug, pen pot, notebook + pen, phone, small plant, headphones; more on the shelf
      const dy = 0.775, dz = bz + 0.27;
      [['#2f3a4a', 0.24], ['#e9e2d6', 0.22], ['#9c6b4e', 0.2]].forEach(([c, bw], i) => { const b = box(bw, 0.03, 0.16, M('linen', c), -0.5, dy + i * 0.03, dz - 0.05); b.rotation.y = (i - 1) * 0.12; g.add(b); });
      g.add(cyl(0.06, 0.07, 0.015, M('blackmetal'), 0.55, dy, dz - 0.12, 20));
      const arm1 = box(0.012, 0.32, 0.012, M('blackmetal'), 0.55, dy + 0.015, dz - 0.12); arm1.rotation.x = 0.25; g.add(arm1);
      const arm2 = box(0.012, 0.012, 0.25, M('blackmetal'), 0.55, dy + 0.32, dz - 0.0); g.add(arm2);
      g.add(cyl(0.03, 0.06, 0.08, M('blackmetal'), 0.55, dy + 0.25, dz + 0.12, 20), cyl(0.05, 0.05, 0.003, M('glow'), 0.55, dy + 0.247, dz + 0.12, 20));
      const mug = cyl(0.035, 0.032, 0.09, M('ceramic', '#e9e2d6'), 0.12, dy, dz + 0.18, 20), hdl = mesh(new THREE.TorusGeometry(0.025, 0.007, 6, 14), M('ceramic', '#e9e2d6')); hdl.position.set(0.16, dy + 0.045, dz + 0.18); g.add(mug, hdl);
      g.add(cyl(0.03, 0.03, 0.09, M('lightoak'), -0.35, dy, dz - 0.15, 16));
      for (let i = 0; i < 4; i++) { const p = cyl(0.004, 0.004, 0.14, M(['blackmetal', 'brass', 'steel', 'blackmetal'][i]), -0.35 + (i - 1.5) * 0.012, dy + 0.02, dz - 0.15, 6); p.rotation.z = (i - 1.5) * 0.12; g.add(p); }
      const nb = box(0.21, 0.012, 0.29, M('linen', '#f4efe7'), -0.3, dy, dz + 0.1); nb.rotation.y = 0.15; g.add(nb, box(0.005, 0.005, 0.14, M('brass'), -0.27, dy + 0.014, dz + 0.1));
      g.add(rbox(0.075, 0.009, 0.155, 0.006, M('blackglass'), 0.3, dy, dz + 0.17));
      g.add(cyl(0.035, 0.03, 0.07, M('matteceramic'), -0.6, dy, dz - 0.17, 16)); { const pl = model('calathea', 0.13, 0.12, 0.13); pl.position.set(-0.6, dy + 0.07, dz - 0.17); g.add(pl); }
      const hp = mesh(new THREE.TorusGeometry(0.08, 0.012, 8, 24, Math.PI), M('blackmetal')); hp.position.set(0.33, dy + 0.012, dz - 0.15); hp.rotation.x = -Math.PI / 2; g.add(hp, cyl(0.03, 0.03, 0.02, M('blackmetal'), 0.25, dy, dz - 0.15, 16), cyl(0.03, 0.03, 0.02, M('blackmetal'), 0.41, dy, dz - 0.15, 16));
      g.add(cyl(0.04, 0.035, 0.12, M('ceramic', '#b9a48a'), half - 0.25, 1.575, bz + 0.13, 20), box(0.12, 0.16, 0.02, M('lightoak'), half - 0.45, 1.575, bz + 0.08), box(0.09, 0.12, 0.004, M('linen', '#c7b8a3'), half - 0.45, 1.595, bz + 0.091));
      // curved reeded-glass door inside the shell line; pivot at the arc centre, rotating slides it behind the shell
      const pivot = new THREE.Group(); pivot.position.set(0, 0, cz);
      const rd = R - 0.05, gh = sh - 0.02, t0 = -A;
      const gl = mesh(new THREE.CylinderGeometry(rd, rd, gh, 40, 1, true, t0, doorA), M('frosted')); gl.position.y = P + 0.01 + gh / 2; pivot.add(gl);
      for (let t = t0 + 5 * D2R; t < t0 + doorA - 1e-3; t += 5 * D2R) { const r = box(0.008, gh, 0.008, M('brass'), Math.sin(t) * (rd + 0.006), P + 0.01, Math.cos(t) * (rd + 0.006)); r.rotation.y = t; pivot.add(r); }
      for (const t of [t0, t0 + doorA]) { const e = box(0.03, gh, 0.035, oak, Math.sin(t) * rd, P + 0.01, Math.cos(t) * rd); e.rotation.y = t; pivot.add(e); }
      const ht = t0 + doorA - 0.06, hd = box(0.018, 0.7, 0.03, M('brass'), Math.sin(ht) * (rd + 0.03), 0.7, Math.cos(ht) * (rd + 0.03)); hd.rotation.y = ht; pivot.add(hd);
      pivot.userData.part = { kind: 'hinge', angle: doorA + 0.04 };
      g.add(pivot);
      return g;
    } },
  // Built aligned to the world (rotation 0): x = length (west wall at -x), z = depth (corridor side -z, back wall +z).
  office_capsule: { label: 'Office capsule (pivot door)', cat: 'Bedroom', w: 1.9, d: 1.0, h: 2.5,
    spec: 'Study capsule in the corridor corner: cream lacquer walls with brass inlay lines, rounded corner, light-oak canopy and plinth with hidden warm LED; reeded-glass pivot door in an oak frame; desk on the end wall (85 × 55 cm) with drawers, shelf with books, fluted walnut feature wall; 1.35 m of chair space',
    build: ({ w, d, h }) => {
      const oak = M('lightoak'), cream = M('lacquer', '#efe8dd'), g = new THREE.Group(), X = w / 2, Z = d / 2, Rc = 0.32, P = 0.1, TOP = 0.16, sh = h - P - TOP, T = 0.04;
      // walls: north (corridor side) straight, rounded NE corner, short east face beside the door
      g.add(box(w - Rc, sh, T, cream, -Rc / 2, P, -Z + T / 2));
      for (let x = -X + 0.3; x < X - Rc - 0.05; x += 0.3) g.add(box(0.01, sh, 0.004, M('brass'), x, P, -Z - 0.002));
      const corner = mesh(new THREE.CylinderGeometry(Rc, Rc, sh, 24, 1, true, Math.PI / 2, Math.PI / 2), cream); corner.position.set(X - Rc, P + sh / 2, -Z + Rc); g.add(corner);
      const DW = 0.66, dz0 = Z - DW - 0.01;                                       // door spans z dz0 → Z-0.01
      g.add(box(T, sh, dz0 - (-Z + Rc), cream, X - T / 2, P, (dz0 + (-Z + Rc)) / 2));
      // canopy + plinth: rounded-rectangle slabs
      const s = new THREE.Shape(); s.moveTo(-X, Z); s.lineTo(-X, -Z); s.lineTo(X - Rc, -Z); s.absarc(X - Rc, -Z + Rc, Rc, -Math.PI / 2, 0, false); s.lineTo(X, Z); s.closePath();
      for (const [y, th] of [[h - TOP, TOP], [0, P]]) { const c = mesh(new THREE.ExtrudeGeometry(s, { depth: th, bevelEnabled: false }), oak); c.rotation.x = Math.PI / 2; c.position.y = y + th; g.add(c); }
      g.add(box(w - Rc - 0.05, 0.012, 0.012, M('ledstrip'), -Rc / 2, h - TOP - 0.012, -Z - 0.006), box(0.012, 0.012, d - Rc - 0.05, M('ledstrip'), X + 0.006, h - TOP - 0.012, Rc / 2));
      // inside: fluted walnut feature wall at the desk end, LED in the canopy
      const fw = fluted(d - 0.02, sh); fw.rotation.y = Math.PI / 2; fw.position.set(-X + 0.015, P, 0); g.add(fw);
      g.add(box(w - 0.4, 0.006, 0.015, M('ledstrip'), 0, h - TOP - 0.01, 0));
      // desk on the end wall, drawer pedestal, shelf above
      const dy = 0.775, dx = -X + 0.275;
      g.add(box(0.55, 0.035, d - 0.15, oak, dx, 0.74, 0.0), box(0.5, 0.6, 0.4, oak, dx, 0.12, Z - 0.27), box(0.03, 0.64, 0.03, M('blackmetal'), dx + 0.24, 0.1, -Z + 0.12));
      for (const y of [0.32, 0.52]) g.add(box(0.004, 0.004, 0.36, M('shadowgap'), dx + 0.25, y, Z - 0.27));
      g.add(box(0.25, 0.025, d - 0.15, oak, -X + 0.14, 1.5, 0), box(0.012, 0.006, d - 0.2, M('ledstrip'), -X + 0.25, 1.494, 0));
      const COLS = ['#e9e2d6', '#6e6a4c', '#2f3a4a', '#9c6b4e', '#b9a48a'];
      for (let i = 0; i < 18; i++) g.add(box(0.18, 0.2 + (i % 3) * 0.03, 0.03, M('linen', COLS[i % 5]), -X + 0.12, 1.525, -0.38 + i * 0.034));
      g.add(cyl(0.04, 0.035, 0.12, M('ceramic', '#b9a48a'), -X + 0.13, 1.525, 0.32, 20));
      // desk styling: monitor, keyboard + mouse, laptop, lamp, books, mug, pen pot, notebook, phone, plant, headphones
      g.add(box(0.025, 0.35, 0.6, M('blackmetal'), -X + 0.1, 0.95, -0.02), box(0.003, 0.33, 0.58, M('blackglass'), -X + 0.114, 0.96, -0.02), box(0.04, 0.2, 0.04, M('blackmetal'), -X + 0.08, dy, -0.02), box(0.16, 0.012, 0.2, M('blackmetal'), -X + 0.1, dy, -0.02));
      g.add(box(0.13, 0.018, 0.42, M('steel'), dx + 0.1, dy, -0.05), box(0.09, 0.02, 0.06, M('steel'), dx + 0.1, dy, 0.25));
      g.add(box(0.21, 0.015, 0.3, M('steel'), -X + 0.13, dy, 0.3), box(0.2, 0.012, 0.29, M('linen', '#2f3a4a'), -X + 0.13, dy + 0.015, 0.3));
      g.add(cyl(0.06, 0.07, 0.015, M('blackmetal'), -X + 0.08, dy, 0.3, 20)); { const a1 = box(0.012, 0.34, 0.012, M('blackmetal'), -X + 0.08, dy + 0.015, 0.3); a1.rotation.z = -0.3; g.add(a1); }
      g.add(cyl(0.03, 0.06, 0.08, M('blackmetal'), -X + 0.24, dy + 0.27, 0.3, 20), cyl(0.05, 0.05, 0.003, M('glow'), -X + 0.24, dy + 0.267, 0.3, 20));
      [['#2f3a4a', 0.24], ['#e9e2d6', 0.22], ['#9c6b4e', 0.2]].forEach(([c, bw], i) => { const b = box(0.16, 0.03, bw, M('linen', c), -X + 0.12, dy + i * 0.03, -0.36); b.rotation.y = (i - 1) * 0.12; g.add(b); });
      const mug = cyl(0.035, 0.032, 0.09, M('ceramic', '#e9e2d6'), dx + 0.2, dy, 0.36, 20), hdl = mesh(new THREE.TorusGeometry(0.025, 0.007, 6, 14), M('ceramic', '#e9e2d6')); hdl.position.set(dx + 0.2, dy + 0.045, 0.4); hdl.rotation.y = Math.PI / 2; g.add(mug, hdl);
      g.add(cyl(0.03, 0.03, 0.09, oak, dx + 0.2, dy, -0.36, 16));
      for (let i = 0; i < 4; i++) { const pn = cyl(0.004, 0.004, 0.14, M(['blackmetal', 'brass', 'steel', 'blackmetal'][i]), dx + 0.2 + (i - 1.5) * 0.012, dy + 0.02, -0.36, 6); pn.rotation.x = (i - 1.5) * 0.12; g.add(pn); }
      const nb = box(0.21, 0.012, 0.29, M('linen', '#f4efe7'), dx + 0.12, dy, -0.24); nb.rotation.y = 0.2; g.add(nb, box(0.14, 0.005, 0.005, M('brass'), dx + 0.12, dy + 0.014, -0.24));
      g.add(rbox(0.155, 0.009, 0.075, 0.006, M('blackglass'), dx + 0.2, dy, 0.12));
      g.add(cyl(0.035, 0.03, 0.07, M('matteceramic'), -X + 0.13, 1.525, -0.38 + 18 * 0.034 + 0.06, 16));
      // reeded-glass pivot door on the east face (pivot near its north edge, swings inward)
      const door = new THREE.Group(); door.position.set(X - 0.02, 0, dz0);
      for (const [bz, bl] of [[0.02, 0.04], [DW - 0.02, 0.04]]) door.add(box(0.035, sh - 0.01, bl, oak, 0, P, bz));
      door.add(box(0.035, 0.05, DW, oak, 0, P, DW / 2), box(0.035, 0.05, DW, oak, 0, P + sh - 0.06, DW / 2), box(0.006, sh - 0.1, DW - 0.08, M('frosted'), 0, P + 0.05, DW / 2));
      for (let z = 0.08; z < DW - 0.05; z += 0.05) door.add(box(0.01, sh - 0.1, 0.006, M('brass'), 0.006, P + 0.05, z));
      door.add(box(0.03, 0.7, 0.02, M('brass'), 0.035, 0.75, DW - 0.09));
      door.userData.part = { kind: 'hinge', angle: -1.5 };
      g.add(door);
      return g;
    } },
  // Corridor office nook: uses the old laundry niche walls (west, south, bathroom wall) as its own walls and only adds a curved front.
  // Local origin = niche's NW inner corner; x runs east along the corridor (length w), z runs south to the back wall (depth d).
  // Corridor office nook: uses the old laundry niche walls (west, south, bathroom wall) as its own walls and only adds a front.
  // Local origin = NW corner of the nook's front line; x runs east along the corridor (length w), z runs south to the back wall (depth d).
  // West of wallEnd the nook only starts at z = E (the bathroom wall); east of it the front is pushed out E into the corridor.
  office_nook: { label: 'Office nook (curved front)', cat: 'Bedroom', w: 4.0, d: 1.06, h: 2.9,
    spec: 'Built-in study nook in the former laundry niche: existing walls kept, new cream lacquer front with brass inlay lines flush with the end of the bathroom wall, rounded end, oak canopy to the ceiling with hidden warm LED; reeded-glass pivot door in an oak frame; desk along the back (left) wall, open underneath on slim black steel legs, lit bookshelf above, fluted walnut end wall, oak floor',
    build: ({ w: L, d: D, h }) => {
      const oak = M('lightoak'), cream = M('lacquer', '#efe8dd'), g = new THREE.Group(), R = 0.5, TOP = 0.15, sh = h - TOP, T = 0.04, wallEnd = 0.909, E = D - 1.062;
      // rounded end + east face
      const curve = mesh(new THREE.CylinderGeometry(R, R, sh, 28, 1, true, Math.PI / 2, Math.PI / 2), cream); curve.position.set(L - R, sh / 2, R); g.add(curve);
      g.add(box(T, sh, D - R, cream, L - T / 2, 0, R + (D - R) / 2));
      for (let a = 0.15; a < Math.PI / 2; a += 0.3) { const b = box(0.004, sh, 0.01, M('brass'), L - R + Math.sin(a) * (R + 0.002), 0, R - Math.cos(a) * (R + 0.002)); b.rotation.y = a; g.add(b); }
      // short return from the end of the bathroom wall out to the new front line
      if (E > 0.01) g.add(box(T, sh, E, cream, wallEnd + T / 2, 0, E / 2));
      g.add(box(0.035, sh, 0.06, oak, wallEnd + 0.0175, 0, 0.03));
      // straight front from the return to the door, brass inlays
      const DW = 0.8, fx1 = L - R - DW - 0.04;
      g.add(box(fx1 - wallEnd, sh, T, cream, (wallEnd + fx1) / 2, 0, T / 2), box(0.035, sh, 0.06, oak, fx1 + 0.0175, 0, 0.03));
      for (let x = wallEnd + 0.3; x < fx1 - 0.1; x += 0.3) g.add(box(0.01, sh, 0.004, M('brass'), x, 0, -0.002));
      // oak canopy to the ceiling + floor, following the outline
      const s = new THREE.Shape(); s.moveTo(0, E); s.lineTo(wallEnd, E); s.lineTo(wallEnd, 0); s.lineTo(L - R, 0); s.absarc(L - R, R, R, -Math.PI / 2, 0, false); s.lineTo(L, D); s.lineTo(0, D); s.closePath();
      for (const [y, th] of [[sh, TOP], [0, 0.008]]) { const c = mesh(new THREE.ExtrudeGeometry(s, { depth: th, bevelEnabled: false }), oak); c.rotation.x = Math.PI / 2; c.position.y = y + th; g.add(c); }
      g.add(box(L - R - wallEnd, 0.012, 0.012, M('ledstrip'), (wallEnd + L - R) / 2, sh - 0.012, -0.006));
      const led = mesh(new THREE.TorusGeometry(R + 0.006, 0.006, 6, 24, Math.PI / 2), M('ledstrip')); led.rotation.x = -Math.PI / 2; led.position.set(L - R, sh - 0.006, R); g.add(led);
      g.add(box(L - 0.3, 0.006, 0.015, M('ledstrip'), L / 2, sh - 0.01, (E + D) / 2));
      // fluted walnut end wall
      const fw = fluted(D - E - 0.02, sh); fw.rotation.y = Math.PI / 2; fw.position.set(0.012, 0, (E + D) / 2); g.add(fw);
      // desk along the back wall (left as you walk in), drawer pedestal, lit bookshelf above
      const DL = Math.min(1.8, L - 1.0), DD = 0.5, dxc = 0.1 + DL / 2, dz = D - DD / 2, dy = 0.775, back = D - 0.06;
      g.add(box(DL, 0.035, DD, oak, dxc, 0.74, dz));                                         // open underneath: slim black steel legs only
      for (const lx of [0.13, 0.1 + DL - 0.03]) for (const lz of [D - DD + 0.03, D - 0.03]) g.add(box(0.03, 0.74, 0.03, M('blackmetal'), lx, 0, lz));
      g.add(box(DL - 0.06, 0.03, 0.02, M('blackmetal'), dxc, 0.7, D - 0.04));
      g.add(box(DL, 0.025, 0.26, oak, dxc, 1.5, D - 0.13), box(DL - 0.04, 0.006, 0.012, M('ledstrip'), dxc, 1.494, D - 0.25));
      const COLS = ['#e9e2d6', '#6e6a4c', '#2f3a4a', '#9c6b4e', '#b9a48a'];
      for (let i = 0; i < Math.floor((DL - 0.35) / 0.034); i++) g.add(box(0.03, 0.2 + (i % 3) * 0.03, 0.18, M('linen', COLS[i % 5]), 0.2 + i * 0.034, 1.525, D - 0.12));
      g.add(cyl(0.04, 0.035, 0.12, M('ceramic', '#b9a48a'), DL - 0.15, 1.525, D - 0.12, 20), cyl(0.035, 0.03, 0.1, M('matteceramic'), DL - 0.01, 1.525, D - 0.12, 16));
      // desk styling (facing the back wall): monitor, keyboard + mouse, laptop, lamp, books, mug, pen pot, notebook, phone
      g.add(box(0.6, 0.35, 0.025, M('blackmetal'), 0.85, 0.95, back), box(0.58, 0.33, 0.003, M('blackglass'), 0.85, 0.96, back - 0.014), box(0.04, 0.2, 0.04, M('blackmetal'), 0.85, dy, back + 0.02), box(0.2, 0.012, 0.16, M('blackmetal'), 0.85, dy, back));
      g.add(box(0.42, 0.018, 0.13, M('steel'), 0.85, dy, D - 0.38), box(0.06, 0.02, 0.09, M('steel'), 1.12, dy, D - 0.38));
      g.add(box(0.3, 0.015, 0.21, M('steel'), DL - 0.12, dy, D - 0.25), box(0.29, 0.012, 0.2, M('linen', '#2f3a4a'), DL - 0.12, dy + 0.015, D - 0.25));
      g.add(cyl(0.06, 0.07, 0.015, M('blackmetal'), 0.3, dy, back, 20)); { const a1 = box(0.012, 0.34, 0.012, M('blackmetal'), 0.3, dy + 0.015, back); a1.rotation.x = 0.3; g.add(a1); }
      g.add(cyl(0.03, 0.06, 0.08, M('blackmetal'), 0.3, dy + 0.27, back - 0.16, 20), cyl(0.05, 0.05, 0.003, M('glow'), 0.3, dy + 0.267, back - 0.16, 20));
      [['#2f3a4a', 0.24], ['#e9e2d6', 0.22], ['#9c6b4e', 0.2]].forEach(([c, bw], i) => { const b = box(bw, 0.03, 0.16, M('linen', c), 0.5, dy + i * 0.03, D - 0.3); b.rotation.y = (i - 1) * 0.12; g.add(b); });
      const mug = cyl(0.035, 0.032, 0.09, M('ceramic', '#e9e2d6'), 1.2, dy, D - 0.42, 20), hdl = mesh(new THREE.TorusGeometry(0.025, 0.007, 6, 14), M('ceramic', '#e9e2d6')); hdl.position.set(1.24, dy + 0.045, D - 0.42); g.add(mug, hdl);
      g.add(cyl(0.03, 0.03, 0.09, oak, 0.2, dy, D - 0.42, 16));
      for (let i = 0; i < 4; i++) { const pn = cyl(0.004, 0.004, 0.14, M(['blackmetal', 'brass', 'steel', 'blackmetal'][i]), 0.2 + (i - 1.5) * 0.012, dy + 0.02, D - 0.42, 6); pn.rotation.z = (i - 1.5) * 0.12; g.add(pn); }
      const nb = box(0.29, 0.012, 0.21, M('linen', '#f4efe7'), 0.6, dy, D - 0.45); nb.rotation.y = 0.2; g.add(nb);
      g.add(rbox(0.075, 0.009, 0.155, 0.006, M('blackglass'), DL - 0.02, dy, D - 0.42));
      // reeded-glass pivot door next to the rounded end: hinge at the curve, opens inward
      const door = new THREE.Group(); door.position.set(L - R, 0, 0.02);
      for (const x of [-0.02, -DW + 0.02]) door.add(box(0.04, sh - 0.01, 0.035, oak, x, 0.005, 0));
      door.add(box(DW, 0.05, 0.035, oak, -DW / 2, 0.005, 0), box(DW, 0.05, 0.035, oak, -DW / 2, sh - 0.06, 0), box(DW - 0.08, sh - 0.1, 0.006, M('frosted'), -DW / 2, 0.05, 0));
      for (let x = -0.07; x > -DW + 0.05; x -= 0.05) door.add(box(0.006, sh - 0.1, 0.01, M('brass'), x, 0.05, -0.006));
      door.add(box(0.02, 0.7, 0.03, M('brass'), -DW + 0.09, 0.75, -0.035));
      door.userData.part = { kind: 'hinge', angle: Math.PI / 2 - 0.05 };
      g.add(door);
      return g;
    } },
  coffee_bar: { label: 'Coffee corner', cat: 'Kitchen', w: 1.9, d: 0.6, h: 2.6,
    spec: 'Coffee corner: tall walnut pantry with brass bar handle; base unit with fluted walnut doors and cream marble top; Calacatta splash panel with two floating walnut shelves on brass rails, warm LED; walnut top cabinet; espresso machine, grinder, cups and jars',
    build: ({ w, d, h }) => {
      const wal = M('walnut_v'), g = new THREE.Group(), cw = 0.6, bx0 = -w / 2 + cw, bw = w - cw, bc = bx0 + bw / 2;
      g.add(box(cw, h, d, wal, -w / 2 + cw / 2, 0, 0), box(0.014, 0.9, 0.03, M('brass'), bx0 - 0.06, 0.8, d / 2 + 0.01), box(cw - 0.01, 0.004, 0.003, M('shadowgap'), -w / 2 + cw / 2, 1.55, d / 2 + 0.001));
      g.add(box(bw, 0.1, d - 0.06, M('shadowgap'), bc, 0, -0.03), box(bw, 0.78, d - 0.03, wal, bc, 0.1, -0.015));
      const fl = fluted(bw - 0.02, 0.76, wal, 0.035); fl.position.set(bc, 0.11, d / 2 - 0.005); g.add(fl);
      g.add(box(bw + 0.02, 0.04, d + 0.02, M('cream'), bc, 0.88, 0.01));
      g.add(box(bw, 1.3, 0.02, M('calacatta'), bc, 0.92, -d / 2 + 0.01), box(bw, 0.38, d * 0.6, wal, bc, h - 0.38, -d * 0.2), box(bw - 0.04, 0.006, 0.015, M('ledstrip'), bc, h - 0.386, d * 0.08));
      for (const y of [1.38, 1.78]) {
        g.add(box(bw - 0.1, 0.035, 0.24, wal, bc, y, -d / 2 + 0.14), box(bw - 0.1, 0.012, 0.012, M('brass'), bc, y + 0.06, -d / 2 + 0.25), box(bw - 0.14, 0.005, 0.012, M('ledstrip'), bc, y - 0.006, -d / 2 + 0.22));
        for (let i = 0; i < 5; i++) g.add(cyl(0.04, 0.032, 0.09, M('ceramic', ['#efe8dc', '#b9a48a', '#e9e2d6', '#8a7560', '#f4efe7'][i]), bc - 0.45 + i * 0.12, y + 0.035, -d / 2 + 0.14, 20));
        g.add(cyl(0.05, 0.05, 0.2, M('glass'), bc + 0.28, y + 0.035, -d / 2 + 0.14, 20), cyl(0.045, 0.045, 0.12, M('ceramic', '#6b4a33'), bc + 0.28, y + 0.04, -d / 2 + 0.14, 20));
      }
      const cm = CATALOG.coffee_machine.build({ w: 0.3, d: 0.38, h: 0.4 }); cm.position.set(bc - 0.25, 0.92, -0.02); g.add(cm);
      g.add(cyl(0.06, 0.05, 0.3, M('blackmetal'), bc + 0.05, 0.92, -0.1, 20), cyl(0.07, 0.04, 0.1, M('glass'), bc + 0.05, 1.22, -0.1, 20));
      g.add(box(0.36, 0.015, 0.2, M('walnut'), bc + 0.37, 0.92, 0.05));
      for (let i = 0; i < 4; i++) g.add(cyl(0.035, 0.03, 0.08, M('ceramic'), bc + 0.24 + (i % 2) * 0.1, 0.935, 0.0 + Math.floor(i / 2) * 0.09, 18));
      const pl = model('calathea', 0.2, 0.2, 0.2); pl.position.set(bc + 0.5, 1.06, -0.15); g.add(cyl(0.06, 0.05, 0.12, M('matteceramic'), bc + 0.5, 0.92, -0.15, 20), pl);
      return g;
    } },
  desk: { label: 'Dresser / desk', cat: 'Bedroom', w: 1.2, d: 0.5, h: 0.76,
    spec: 'Walnut dressing desk with drawer, slim brass legs',
    build: ({ w, d, h }) => group(rbox(w, 0.035, d, 0.01, M('walnut'), 0, h - 0.035), box(w - 0.04, 0.12, d - 0.04, M('walnut'), 0, h - 0.155),
      box(w * 0.3, 0.01, 0.02, M('brass'), 0, h - 0.1, d / 2 - 0.01),
      ...[-1, 1].flatMap(sx => [-1, 1].map(sz => box(0.025, h - 0.155, 0.025, M('brass'), sx * (w / 2 - 0.05), 0, sz * (d / 2 - 0.05))))) },
  vanity_stool: { label: 'Velvet pouf / stool', cat: 'Bedroom', w: 0.45, d: 0.45, h: 0.45, tint: 'velvet', color: '#c4a88a',
    spec: 'Round velvet pouf Ø45 cm, brass base ring',
    build: ({ w, h }, fab) => group(cyl(w * 0.42, w * 0.42, 0.04, M('brass')), rbox(w, h - 0.04, w, w * 0.3, fab, 0, 0.04)) },
  // Kitchen (counter modules share one builder)
  washer_int: { label: 'Washer-dryer (built in)', cat: 'Kitchen', w: 0.6, d: 0.6, h: 0.9,
    spec: 'Front-load washer-dryer built in under the worktop (water + drain from the sink wall)', build: it => kitchenBase(it, 'washer') },
  wall_cab: { label: 'Kitchen wall cabinets', cat: 'Kitchen', w: 1.2, d: 0.35, h: 0.8, y: 1.5,
    spec: 'Upper wall cabinets to match: handleless greige lacquer doors (tap to open), one glass display door in an oak frame per run, shelf inside, warm LED strip underneath',
    build: ({ w, d, h }) => {
      const L = M('lacquer'), T = 0.018, g = group(box(w - 0.04, 0.006, 0.015, M('ledstrip'), 0, -0.006, d / 2 - 0.05));
      // hollow carcass: back, top, bottom, ends, one shelf
      g.add(box(w, T, d - 0.02, L, 0, 0, -0.01), box(w, T, d - 0.02, L, 0, h - T, -0.01), box(w, h, 0.01, L, 0, 0, -d / 2 + 0.005),
            box(T, h, d - 0.02, L, -w / 2 + T / 2, 0, -0.01), box(T, h, d - 0.02, L, w / 2 - T / 2, 0, -0.01), box(w - 2 * T, 0.015, d - 0.05, L, 0, h / 2, -0.02));
      const n = Math.max(1, Math.round(w / 0.45)), dw = w / n, fz = d / 2 - 0.009, oak = M('lightoak');
      for (let i = 0; i < n; i++) {
        const x = -w / 2 + dw * (i + 0.5), glass = i === n - 1 && n > 1;
        if (i < n - 1) g.add(box(0.015, h - 2 * T, d - 0.04, L, -w / 2 + dw * (i + 1), T, -0.02));
        // contents: plates / bowls below, glasses or mugs above; jars in the display bay
        const lo = T + 0.005, hi = h / 2 + 0.01;
        if (glass) { for (const xx of [-0.08, 0.06]) g.add(cyl(0.035, 0.03, 0.14, M('glass'), x + xx, lo, -0.02, 16), cyl(0.04, 0.04, 0.16, M('glass'), x + xx, hi, -0.03, 16), cyl(0.032, 0.032, 0.02, oak, x + xx, hi + 0.16, -0.03, 16)); }
        else {
          for (let k = 0; k < 8; k++) g.add(cyl(0.12, 0.1, 0.012, M('ceramic'), x - dw * 0.15, lo + k * 0.014, -0.03, 32));
          for (let k = 0; k < 4; k++) g.add(cyl(0.075, 0.05, 0.05, M('ceramic', '#e7dfd2'), x + dw * 0.22, lo + k * 0.03, -0.03, 28));
          for (let k = 0; k < 3; k++) g.add(cyl(0.04, 0.035, 0.1, M('matteceramic', ['#b9a48a', '#6e6a4c', '#e9e2d6'][k]), x - dw * 0.25 + k * 0.1, hi, -0.02, 20));
        }
        // door on a hinge at its outer edge (alternating), swings out
        const left = i % 2 === 0, p = new THREE.Group(), W = dw - 0.004;
        p.position.set(left ? x - dw / 2 + 0.002 : x + dw / 2 - 0.002, 0, fz);
        const sx = left ? 1 : -1;
        if (glass) {
          for (const [bw, bh, bx, by] of [[W, 0.04, W / 2, 0], [W, 0.04, W / 2, h - 0.044], [0.04, h - 0.04, 0.02, 0], [0.04, h - 0.04, W - 0.02, 0]]) p.add(box(bw, bh, T, oak, sx * bx, by, 0));
          p.add(box(W - 0.08, h - 0.1, 0.004, M('glass'), sx * W / 2, 0.04, 0));
        } else p.add(box(W, h - 0.004, T, L, sx * W / 2, 0.002, 0), box(W, 0.004, 0.003, M('shadowgap'), sx * W / 2, h - 0.03, 0.01));
        p.userData.part = { kind: 'hinge', angle: left ? -1.6 : 1.6 };
        g.add(p);
      }
      return g;
    } },
  vanity_set: { label: 'Vanity: skincare, perfume & makeup', cat: 'Bedroom', w: 1.1, d: 0.42, h: 0.3, y: 0.76,
    spec: 'Dressing-table styling: mirrored tray of perfumes, skincare bottles & jars, lipstick and makeup organiser, brush cup, jewellery box, LED makeup mirror, candle, flowers',
    build: ({ w }) => {
      const g = new THREE.Group(), gold = M('brass'), glassM = M('glass'), pink = c => M('ceramic', c);
      // mirrored tray with perfumes (back left)
      const tx = -w / 2 + 0.2;
      g.add(rbox(0.32, 0.012, 0.2, 0.01, M('mirror'), tx, 0, -0.06), box(0.33, 0.016, 0.004, gold, tx, 0, 0.04), box(0.33, 0.016, 0.004, gold, tx, 0, -0.16));
      [[-0.1, 0.11, 0.06, '#e8c9b5'], [-0.02, 0.14, 0.045, '#f3e2c4'], [0.06, 0.09, 0.07, '#d7b8c9'], [0.12, 0.12, 0.04, '#c9a46a']].forEach(([x, hh, r, c], i) => {
        const bx = tx + x, bz = -0.06 + (i % 2 ? 0.03 : -0.03);
        g.add(i % 2 ? cyl(r / 2, r / 2, hh, glassM, bx, 0.012, bz, 20) : box(r, hh, r * 0.7, glassM, bx, 0.012, bz));
        g.add(box(r * 0.7, hh * 0.85, r * 0.45, pink(c), bx, 0.016, bz), cyl(0.012, 0.012, 0.03, gold, bx, 0.012 + hh, bz, 16));
      });
      // skincare line-up (back middle): pump bottles, dropper serums, cream jars
      const sx = -0.08;
      [[0, 0.17, '#f2ede6'], [0.06, 0.14, '#efe2d2'], [0.12, 0.1, '#e6d3c3']].forEach(([x, hh, c]) => g.add(cyl(0.022, 0.022, hh, pink(c), sx + x, 0, -0.12, 20), cyl(0.008, 0.008, 0.03, gold, sx + x, hh, -0.12, 10), box(0.03, 0.006, 0.006, gold, sx + x - 0.01, hh + 0.03, -0.12)));
      [[0.18, '#b97a4a'], [0.22, '#c79a6a']].forEach(([x, c]) => g.add(cyl(0.015, 0.015, 0.08, M('amber'), sx + x, 0, -0.13, 16), cyl(0.008, 0.006, 0.04, M('blackmetal'), sx + x, 0.08, -0.13, 10)));
      [[0.02, '#f6f1ea'], [0.1, '#ead9c7']].forEach(([x, c]) => g.add(cyl(0.035, 0.035, 0.035, pink(c), sx + x, 0, -0.02, 24), cyl(0.036, 0.036, 0.015, gold, sx + x, 0.035, -0.02, 24)));
      // acrylic makeup organiser with lipsticks + brush cup (right)
      const ox = w / 2 - 0.22;
      g.add(box(0.2, 0.09, 0.1, glassM, ox, 0, -0.1));
      for (let i = 0; i < 6; i++) g.add(cyl(0.008, 0.008, 0.06, i % 2 ? gold : M('blackmetal'), ox - 0.075 + i * 0.03, 0.02, -0.12, 10), cyl(0.006, 0.006, 0.02, pink(['#a8323e', '#c45b6a', '#8a2c3a'][i % 3]), ox - 0.075 + i * 0.03, 0.08, -0.12, 10));
      g.add(rbox(0.18, 0.025, 0.06, 0.01, pink('#d9a7a0'), ox, 0.01, -0.06));                    // palette
      g.add(cyl(0.035, 0.03, 0.1, pink('#e9d9cc'), ox + 0.14, 0, -0.1, 20));
      for (let i = 0; i < 5; i++) { const b = cyl(0.005, 0.004, 0.17, M('blackmetal'), ox + 0.14 + (i - 2) * 0.01, 0.06, -0.1, 8); b.rotation.z = (i - 2) * 0.08; g.add(b);
        const t = cyl(0.012, 0.005, 0.04, M('ceramic', '#3a2a22'), ox + 0.14 + (i - 2) * 0.01 - Math.sin((i - 2) * 0.08) * 0.17, 0.2, -0.1, 10); t.rotation.z = (i - 2) * 0.08; g.add(t); }
      // jewellery box (front right), candle + flowers (front left), small LED makeup mirror (centre front)
      g.add(rbox(0.16, 0.06, 0.1, 0.01, M('velvet', '#c9a7a0'), ox, 0, 0.07), box(0.16, 0.004, 0.1, gold, ox, 0.06, 0.07));
      g.add(cyl(0.035, 0.035, 0.07, pink('#f4efe7'), tx + 0.08, 0, 0.1, 20), cyl(0.03, 0.03, 0.002, M('glow'), tx + 0.08, 0.07, 0.1, 20));
      const fl = model('flowers', 0.18, 0.2, 0.12); fl.position.set(tx - 0.07, 0, 0.1); g.add(fl);
      const mr = new THREE.Group(); mr.position.set(0.12, 0, 0.02);
      mr.add(cyl(0.06, 0.07, 0.015, gold), cyl(0.006, 0.006, 0.12, gold, 0, 0.015, 0, 8));
      const face = mesh(new THREE.CircleGeometry(0.1, 40), M('mirror')); face.position.set(0, 0.24, 0.005); mr.add(face);
      const ring = mesh(new THREE.TorusGeometry(0.1, 0.008, 10, 48), M('ledstrip')); ring.position.set(0, 0.24, 0); mr.add(ring);
      g.add(mr);
      return g;
    } },
  // ---- worktop accessories (stand on the 90 cm worktop, back to the wall, facing +z) ----
  coffee_machine: { label: 'Coffee machine', cat: 'Kitchen', w: 0.26, d: 0.36, h: 0.36, y: 0.9, spec: 'Bean-to-cup espresso machine, black / steel',
    build: ({ w, d, h }) => group(rbox(w, h, d, 0.02, M('blackmetal')), box(w - 0.04, 0.04, 0.08, M('steel'), 0, 0.02, d / 2 - 0.03), box(w * 0.5, 0.08, 0.04, M('steel'), 0, h * 0.55, d / 2 + 0.01),
      cyl(0.035, 0.03, 0.08, M('ceramic'), 0, 0.06, d / 2 - 0.05, 20), box(0.08, 0.05, 0.003, M('ledstrip'), w * 0.25, h - 0.08, d / 2 + 0.001)) },
  kettle: { label: 'Kettle', cat: 'Kitchen', w: 0.2, d: 0.16, h: 0.24, y: 0.9, spec: 'Brushed-steel electric kettle',
    build: ({ h }) => { const hd = mesh(new THREE.TorusGeometry(0.06, 0.012, 8, 20, Math.PI), M('blackmetal')); hd.position.set(-0.06, h * 0.55, 0); hd.rotation.z = Math.PI / 2;
      return group(cyl(0.085, 0.085, 0.02, M('blackmetal')), cyl(0.065, 0.08, h - 0.04, M('steel'), 0, 0.02, 0, 28), cyl(0.03, 0.03, 0.03, M('blackmetal'), 0, h - 0.03, 0, 16), hd); } },
  toaster: { label: 'Toaster', cat: 'Kitchen', w: 0.28, d: 0.16, h: 0.19, y: 0.9, spec: '2-slice toaster, cream',
    build: ({ w, d, h }) => group(rbox(w, h, d, 0.03, M('ceramic', '#efe8dc')), box(0.12, 0.004, 0.025, M('shadowgap'), -0.04, h, -0.03), box(0.12, 0.004, 0.025, M('shadowgap'), -0.04, h, 0.03), box(0.02, 0.03, 0.02, M('steel'), w / 2 - 0.04, h * 0.4, d / 2)) },
  knife_block: { label: 'Knife block + board', cat: 'Kitchen', w: 0.5, d: 0.3, h: 0.3, y: 0.9, spec: 'Oak knife block with 5 knives, end-grain oak chopping board',
    build: () => { const b = box(0.12, 0.2, 0.1, M('lightoak'), 0.17, 0, -0.08); b.rotation.x = -0.25; const g = group(b, rbox(0.38, 0.03, 0.26, 0.01, M('lightoak'), -0.06, 0, 0.0));
      for (let i = 0; i < 5; i++) { const k = box(0.018, 0.1, 0.018, M('blackmetal'), 0.13 + (i % 3) * 0.035, 0.2, -0.11 + Math.floor(i / 3) * 0.03); k.rotation.x = -0.25; g.add(k); }
      g.add(box(0.03, 0.002, 0.2, M('steel'), -0.1, 0.031, 0.02), box(0.02, 0.015, 0.1, M('blackmetal'), -0.1, 0.031, 0.17));
      return g; } },
  cutlery_caddy: { label: 'Cutlery caddy', cat: 'Kitchen', w: 0.22, d: 0.12, h: 0.25, y: 0.9, spec: 'Brushed-steel cutlery caddy with forks, spoons and knives',
    build: () => { const g = group(box(0.22, 0.12, 0.11, M('steel')));
      for (let c = 0; c < 3; c++) for (let i = 0; i < 4; i++) {
        const x = -0.07 + c * 0.07 + (i % 2) * 0.015, z = -0.025 + Math.floor(i / 2) * 0.03, s = box(0.012, 0.13, 0.004, M('steel'), x, 0.1, z);
        s.rotation.z = (i - 1.5) * 0.06; g.add(s);
        if (c === 0) g.add(box(0.022, 0.05, 0.003, M('steel'), x, 0.22, z));                                   // fork heads
        else if (c === 1) { const sp = mesh(new THREE.SphereGeometry(0.018, 12, 8), M('steel')); sp.scale.set(1, 1.5, 0.3); sp.position.set(x, 0.24, z); g.add(sp); } // spoon bowls
        else g.add(box(0.016, 0.07, 0.003, M('steel'), x, 0.22, z));                                          // knife blades
      }
      return g; } },
  utensil_jar: { label: 'Utensil jar', cat: 'Kitchen', w: 0.14, d: 0.14, h: 0.35, y: 0.9, spec: 'Ceramic jar with olive-wood spatulas, ladle and whisk',
    build: () => { const g = group(cyl(0.06, 0.055, 0.15, M('matteceramic', '#cbbfae'), 0, 0, 0, 24));
      [[-0.02, 0.1], [0.02, -0.1], [0, 0], [0.025, 0.15]].forEach(([x, a], i) => { const s = cyl(0.007, 0.007, 0.28, i === 2 ? M('steel') : M('walnut'), x, 0.05, 0, 8); s.rotation.z = a; g.add(s);
        const head = i === 2 ? mesh(new THREE.SphereGeometry(0.03, 12, 8), M('steel')) : box(0.05, 0.07, 0.008, M('walnut')); head.position.set(x - Math.sin(a) * 0.28, 0.36, 0); g.add(head); });
      return g; } },
  oil_set: { label: 'Oil + salt & pepper', cat: 'Kitchen', w: 0.25, d: 0.12, h: 0.28, y: 0.9, spec: 'Glass oil & vinegar bottles, oak salt and pepper mills on a marble tray',
    build: () => group(box(0.25, 0.012, 0.12, M('calacatta')), cyl(0.03, 0.03, 0.22, M('amber'), -0.08, 0.012, 0, 16), cyl(0.026, 0.026, 0.2, M('glass'), -0.02, 0.012, 0, 16),
      cyl(0.024, 0.02, 0.17, M('lightoak'), 0.05, 0.012, 0, 16), cyl(0.024, 0.02, 0.17, M('walnut'), 0.1, 0.012, 0, 16)) },
  fruit_bowl: { label: 'Fruit bowl', cat: 'Kitchen', w: 0.3, d: 0.3, h: 0.14, y: 0.9, spec: 'Ceramic fruit bowl',
    build: () => { const g = group(cyl(0.15, 0.08, 0.08, M('matteceramic', '#e9e2d6'), 0, 0, 0, 32));
      [['#e8892b', -0.05, 0], ['#e8892b', 0.05, 0.03], ['#9cba3a', 0, -0.06], ['#b5262b', 0.02, 0.06], ['#f2d03b', -0.04, 0.07]].forEach(([c, x, z]) => {
        const s = mesh(new THREE.SphereGeometry(0.04, 16, 12), M('ceramic', c)); s.material = s.material.clone(); s.material.roughness = 0.5; s.position.set(x, 0.1, z); g.add(s); });
      return g; } },
  counter: { label: 'Kitchen base unit', cat: 'Kitchen', w: 0.8, d: 0.6, h: 0.9,
    spec: 'Handleless base unit, greige matte lacquer, 2 cm Calacatta worktop', build: it => kitchenBase(it) },
  sink_unit: { label: 'Kitchen sink unit', cat: 'Kitchen', w: 0.9, d: 0.6, h: 0.9,
    spec: 'Sink base, undermount steel sink, brushed-brass gooseneck mixer', build: it => kitchenBase(it, 'sink') },
  hob_unit: { label: 'Hob + oven unit', cat: 'Kitchen', w: 0.9, d: 0.6, h: 0.9,
    spec: 'Built-in oven, 90 cm black-glass induction hob with integrated downdraft extractor (sits under the window)', build: it => kitchenBase(it, 'hob') },
  dishwasher: { label: 'Dishwasher (integrated)', cat: 'Kitchen', w: 0.6, d: 0.6, h: 0.9,
    spec: 'Fully integrated 60 cm dishwasher behind lacquer panel', build: it => kitchenBase(it, 'panel') },
  fridge: { label: 'Fridge column (integrated)', cat: 'Kitchen', w: 0.61, d: 0.6, h: 2.4,
    spec: 'Integrated fridge-freezer in walnut tall unit, brass bar handle',
    build: ({ w, d, h }) => group(box(w, h, d - 0.02, M('walnut_v'), 0, 0, -0.01), box(w - 0.004, 0.004, 0.003, M('shadowgap'), 0, h * 0.62, d / 2),
      box(0.014, 0.6, 0.03, M('brass'), w / 2 - 0.05, h * 0.62 - 0.65, d / 2 + 0.01), box(0.014, 0.5, 0.03, M('brass'), w / 2 - 0.05, h * 0.62 + 0.1, d / 2 + 0.01)) },
  hood: { label: 'Cooker hood', cat: 'Kitchen', w: 0.9, d: 0.5, h: 0.45, y: 1.65,
    spec: 'Chimney hood, black steel, ducted', build: ({ w, d, h, y }) => group(box(w, 0.06, d, M('blackmetal')), box(w * 0.32, Math.max(0.1, WALL_H - y - 0.06), d * 0.5, M('blackmetal'), 0, 0.06, -d / 4)) },
  // Bathroom
  toilet: { label: 'Wall-hung toilet', cat: 'Bathroom', w: 0.37, d: 0.55, h: 0.42,
    spec: 'Rimless wall-hung WC, concealed cistern, gunmetal flush plate',
    build: ({ w, d, h }) => group(rbox(w, 0.33, d, 0.14, M('ceramic'), 0, h - 0.37), rbox(w - 0.02, 0.03, d - 0.05, 0.1, M('ceramic'), 0, h - 0.04, 0.02),
      box(0.22, 0.15, 0.01, M('gunmetal'), 0, 0.95, -d / 2 - 0.004)) },
  vanity: { label: 'Floating vanity', cat: 'Bathroom', w: 0.8, d: 0.46, h: 0.85,
    spec: 'Wall-hung oak vanity with grey porcelain top, white vessel basin, wall-mounted gunmetal mixer, LED strip underneath',
    build: ({ w, d, h }) => group(box(w, 0.4, d, M('lightoak'), 0, h - 0.43), box(w, 0.03, d, M('stone_grey'), 0, h - 0.03),
      box(w - 0.06, 0.006, 0.012, M('ledstrip'), 0, h - 0.437, d / 2 - 0.05),
      cyl(0.2, 0.15, 0.13, M('ceramic'), 0, h, 0.02, 48), cyl(0.18, 0.13, 0.001, M('shadowgap'), 0, h + 0.13, 0.02, 48), box(0.02, 0.02, 0.17, M('gunmetal'), 0, h + 0.22, -d / 2 + 0.085),
      ...bottles(w / 2 - 0.1, h, -d / 2 + 0.1, 2)) },
  mirror_led: { wall: true, label: 'Backlit mirror', cat: 'Bathroom', w: 0.7, d: 0.03, h: 0.7, y: 1.25, spec: 'Round backlit LED mirror Ø70 cm',
    build: ({ w, d, h }) => {
      const r = Math.min(w, h) / 2, m = mesh(new THREE.CircleGeometry(r, 64), M('mirror')), halo = mesh(new THREE.RingGeometry(r - 0.01, r + 0.025, 64), M('ledstrip'));
      m.position.set(0, h / 2, d); halo.position.set(0, h / 2, 0.005);
      return group(m, halo);
    } },
  shower: { label: 'Walk-in shower (rain + body jets)', cat: 'Bathroom', w: 0.8, d: 0.9, h: 2.0,
    spec: 'Full-length walk-in shower (wall to the sink): frameless 8 mm clear glass, minibus-style sliding door on the front (pops out and glides back on a top track) with gunmetal pull handle, flush grey porcelain floor with linear drain; on the right wall: gunmetal Ø30 rain head on arm, hand shower, thermostatic mixer and 2 body jets mounted high, angled down; niche with 3 LED-lit shelves on the front wall',
    // local frame: back (-z) and right (+x) are walls; glass on the front (+z, hinged door) and left (-x).
    // Tap the door to open/close it; tap any fitting on the right wall to turn the water on/off.
    build: ({ w, d, h }) => {
      const k = M('gunmetal'), gl = M('showerglass'), fz = d / 2 - 0.01, lx = -w / 2 + 0.01, bz = -d / 2, rx = w / 2, zc = 0;
      const g = group(box(w, 0.006, d, M('stone_grey')), box(w - 0.1, 0.004, 0.035, k, 0, 0.004, bz + 0.06));
      // front (-x, facing the room): fixed glass at the back + minibus-style sliding door at the front end;
      // the end next to the sink (+z) is fixed glass. Top + bottom tracks in gunmetal.
      const DW = Math.min(0.7, d * 0.5), fixedLen = d - DW;
      g.add(box(0.008, h, fixedLen, gl, lx, 0.01, bz + fixedLen / 2), box(w - 0.02, h, 0.008, gl, 0, 0.01, fz));
      g.add(box(0.03, 0.03, d, k, lx - 0.04, h - 0.01, 0), box(0.02, 0.012, d, k, lx - 0.04, 0.006, 0), box(0.03, h, 0.03, k, lx, 0, fz));
      const door = new THREE.Group(); door.position.set(lx - 0.04, 0, fz - DW / 2 - 0.01);
      door.add(box(0.008, h - 0.03, DW, gl, 0, 0.02, 0), box(0.012, h - 0.03, 0.02, k, 0, 0.02, DW / 2 - 0.01), box(0.012, h - 0.03, 0.02, k, 0, 0.02, -DW / 2 + 0.01));
      for (const zz of [-DW / 2 + 0.08, DW / 2 - 0.08]) door.add(box(0.03, 0.05, 0.05, k, 0, h - 0.04, zz));         // rollers on the top track
      door.add(box(0.02, 0.45, 0.02, k, -0.04, 0.85, DW / 2 - 0.08), box(0.04, 0.02, 0.02, k, -0.02, 0.86, DW / 2 - 0.08), box(0.04, 0.02, 0.02, k, -0.02, 1.28, DW / 2 - 0.08));
      door.userData.part = { kind: 'van', out: -0.05, slide: -(DW - 0.05) };                     // pops out, then slides back
      g.add(door);
      // big ceiling rain head for two (50 × 90 cm) on two drop rods, mixer + hand shower on the right wall,
      // two body jets high on the right wall angled down into the middle. One tappable group.
      const fit = new THREE.Group(), hx = 0.02, HW = 0.5, HD = 0.9, HY = 2.15;
      fit.add(box(HW, 0.03, HD, k, hx, HY, zc), box(HW - 0.03, 0.002, HD - 0.03, M('shadowgap'), hx, HY - 0.002, zc));
      for (const zz of [-HD / 2 + 0.15, HD / 2 - 0.15]) fit.add(cyl(0.012, 0.012, 2.9 - HY - 0.03, k, hx, HY + 0.03, zc + zz, 12));
      const hs = cyl(0.035, 0.02, 0.22, k, rx - 0.07, 1.5, zc + 0.08, 16); hs.rotation.z = 0.4; fit.add(hs);
      fit.add(box(0.03, 0.22, 0.16, k, rx - 0.015, 0.95, zc), cyl(0.03, 0.03, 0.05, k, rx - 0.045, 1.05, zc, 16), cyl(0.03, 0.03, 0.05, k, rx - 0.045, 0.98, zc, 16),
              cyl(0.012, 0.012, 0.5, k, rx - 0.035, 1.07, zc + 0.08, 12));
      const jets = [zc - 0.42, zc + 0.42].map(z => new THREE.Vector3(rx - 0.04, 1.95, z));
      for (const j of jets) {
        const n = cyl(0.045, 0.03, 0.07, k, 0, 0, 0, 24); n.geometry.translate(0, -0.035, 0);
        n.position.copy(j); n.rotation.z = -Math.PI / 4; fit.add(n, box(0.02, 0.08, 0.08, k, rx - 0.01, j.y - 0.04, j.z));
      }
      fit.userData.part = { kind: 'toggle', open: false };
      g.add(fit);
      // niche on the front (back) wall, right of the window
      const nx = rx - 0.14, nw = 0.24;
      g.add(box(nw, 1.15, 0.02, M('stone_grey'), nx, 0.75, bz + 0.01));
      for (const [i, y] of [0.75, 1.15, 1.55].entries()) {
        g.add(box(nw, 0.025, 0.12, M('stone_grey'), nx, y, bz + 0.06), box(nw - 0.03, 0.006, 0.006, M('ledstrip'), nx, y - 0.006, bz + 0.11));
        if (i === 1) { const pl = model('calathea', 0.14, 0.14, 0.12); pl.position.set(nx + 0.05, y + 0.1, bz + 0.07); g.add(cyl(0.04, 0.035, 0.08, M('ceramic'), nx + 0.05, y + 0.025, bz + 0.07, 20), pl); g.add(...bottles(nx - 0.05, y + 0.025, bz + 0.07, 1)); }
        else g.add(...bottles(nx - 0.04, y + 0.025, bz + 0.07, 1), ...bottles(nx + 0.04, y + 0.025, bz + 0.07, 1));
      }
      // running water: rain from the head, two jets spraying into the middle
      const wm = new THREE.LineBasicMaterial({ color: '#dceff8', transparent: true, opacity: 0.75 });
      const R = 420, J = 80, pos = new Float32Array((R + J * 2) * 6), geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const water = new THREE.LineSegments(geo, wm); water.frustumCulled = false; water.raycast = () => {}; water.visible = false;
      const drops = Array.from({ length: R }, () => [hx + (Math.random() - 0.5) * (HW - 0.04), zc + (Math.random() - 0.5) * (HD - 0.04), Math.random(), 0, 0]);
      const jetP = jets.flatMap(j => Array.from({ length: J }, () => [j, Math.random(), (Math.random() - 0.5) * 0.25, (Math.random() - 0.5) * 0.12]));
      g.add(water);
      g.userData.tick = dt => {
        water.visible = fit.userData.part.open;
        if (!water.visible) return;
        let o = 0;
        for (const dr of drops) {
          dr[2] = (dr[2] + dt * 2.3) % 1;
          const t = dr[2], y = HY - 0.01 - t * (HY - 0.02), spread = 0;
          pos.set([dr[0] + dr[3] * spread, y, dr[1] + dr[4] * spread, dr[0] + dr[3] * spread, y - 0.09, dr[1] + dr[4] * spread], o); o += 6;
        }
        for (const p of jetP) {                                          // jets: down and inward at ~45°, then gravity
          p[1] = (p[1] + dt * 1.6) % 1;
          const [j, s, sz, sy] = p, v = 1.1, t = s * 0.9, dz = (zc - j.z) * 0.25 + sz;
          const x = j.x - v * 0.7 * t, y = j.y - v * 0.7 * t - 2.2 * t * t + sy * t, z = j.z + dz * t;
          pos.set([x, y, z, x + 0.03, y + 0.03 + 0.09 * t, z - dz * 0.03], o); o += 6;
        }
        geo.attributes.position.needsUpdate = true;
      };
      return g;
    } },
  water_heater: { label: 'Electric water heater', cat: 'Bathroom', w: 0.45, d: 0.45, h: 0.8, y: 1.35,
    spec: 'Compact wall-mounted 30 L electric water heater, mounted high, white enamel tank with thermostat dial; hot / cold pipes concealed below',
    build: ({ w, h }) => {
      const r = w / 2, g = group(cyl(r, r, h, M('ceramic'), 0, 0, 0, 40), mesh(new THREE.SphereGeometry(r, 32, 12, 0, 6.283, 0, Math.PI / 2), M('ceramic')),
        box(0.12, 0.05, 0.2, M('gunmetal'), 0, h * 0.3, -r + 0.02), box(0.12, 0.05, 0.2, M('gunmetal'), 0, h * 0.75, -r + 0.02));
      g.children[1].position.y = h; g.children[1].scale.y = 0.35;
      const dial = cyl(0.04, 0.04, 0.02, M('gunmetal'), 0, 0, 0, 24); dial.rotation.x = Math.PI / 2; dial.position.set(0, h * 0.25, r + 0.005); g.add(dial);
      g.add(cyl(0.012, 0.012, 0.1, M('gunmetal'), -0.06, -0.1, -r + 0.03, 10), cyl(0.012, 0.012, 0.1, M('gunmetal'), 0.06, -0.1, -r + 0.03, 10), cyl(0.009, 0.009, 0.004, M('ledstrip'), 0.08, h * 0.25, r + 0.003, 10));
      return g;
    } },
  washer: { label: 'Washing machine', cat: 'Other', w: 0.6, d: 0.6, h: 0.85, spec: 'Front-load washer-dryer',
    build: ({ w, d, h }) => {
      const door = mesh(new THREE.CircleGeometry(0.16, 48), M('blackglass')), ring = mesh(new THREE.TorusGeometry(0.17, 0.015, 12, 64), M('steel'));
      door.position.set(0, h * 0.45, d / 2 + 0.002); ring.position.set(0, h * 0.45, d / 2 + 0.005);
      return group(rbox(w, h, d, 0.02, M('ceramic')), door, ring);
    } },
  curtain: { label: 'Curtains (sheer + linen)', cat: 'Decor', w: 2.0, d: 0.12, h: 2.86, tint: 'linen', color: '#d9c9b2', curtain: true,
    spec: 'Ceiling track, wave-pleat white sheer + sand linen side drapes (lined)',
    build: ({ w, d, h }, fab) => group(drape(w, h, M('sheer'), 0.035, 0.11, -d / 2 + 0.02, 0),
      drape(w * 0.22, h, fab, 0.05, 0.09, d / 2 - 0.03, -w / 2 + w * 0.11), drape(w * 0.22, h, fab, 0.05, 0.09, d / 2 - 0.03, w / 2 - w * 0.11),
      box(w + 0.1, 0.03, 0.06, M('ceiling'), 0, h - 0.01, 0)) },
  curtain_open: { label: 'Curtains – open side drapes', cat: 'Decor', w: 3.3, d: 0.12, h: 2.86, tint: 'linen', color: '#d9c9b2', curtain: true,
    spec: 'Ceiling track, sand linen drapes stacked at both ends to keep the panorama view clear',
    build: ({ w, d, h }, fab) => group(drape(0.45, h, fab, 0.055, 0.08, 0, -w / 2 + 0.25), drape(0.45, h, fab, 0.055, 0.08, 0, w / 2 - 0.25),
      box(w + 0.1, 0.03, 0.06, M('ceiling'), 0, h - 0.01, 0)) },
};

// Amber glass pump bottles with black tops, laid out along z from (x, y, z).
function bottles(x, y, z, n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const bz = z + i * 0.08;
    out.push(cyl(0.028, 0.028, 0.17, M('amber'), x, y, bz, 20), box(0.03, 0.006, 0.06, M('ceramic', '#e9e2d6'), x + 0.0, y + 0.07, bz + 0.0).translateX(0.029),
             cyl(0.01, 0.01, 0.04, M('blackmetal'), x, y + 0.17, bz, 10), box(0.035, 0.008, 0.008, M('blackmetal'), x - 0.01, y + 0.205, bz));
  }
  return out;
}

function kitchenBase({ w, d, h }, kind) {
  const g = group(box(w - 0.004, 0.1, d - 0.08, M('shadowgap'), 0, 0, -0.04), box(w - 0.004, h - 0.14, d - 0.02, M('lacquer'), 0, 0.1, -0.01),
    box(w, 0.02, d, M('calacatta'), 0, h - 0.02), box(w - 0.004, 0.02, 0.01, M('shadowgap'), 0, h - 0.06, d / 2 - 0.02));
  if (kind !== 'panel' && kind !== 'hob' && kind !== 'washer') for (const y of [0.32, 0.55]) g.add(box(w - 0.004, 0.004, 0.003, M('shadowgap'), 0, y, d / 2 - 0.01));
  if (!kind && w >= 0.4) {                                   // top drawer: tap to slide out, cutlery organiser inside
    const dr = new THREE.Group(), y0 = 0.565, dh = h - 0.07 - y0, iw = w - 0.06, dd = d - 0.12;
    dr.add(box(w - 0.004, dh, 0.02, M('lacquer'), 0, y0, d / 2 - 0.002), box(iw, 0.01, dd, M('lightoak'), 0, y0 + 0.01, d / 2 - 0.02 - dd / 2),
           box(iw, dh - 0.04, 0.01, M('lightoak'), 0, y0 + 0.01, d / 2 - 0.02 - dd), ...[-1, 1].map(s => box(0.01, dh - 0.04, dd, M('lightoak'), s * iw / 2, y0 + 0.01, d / 2 - 0.02 - dd / 2)));
    const zc = d / 2 - 0.02 - dd / 2;
    for (let c = 0; c < 4; c++) {
      const x = -iw / 2 + iw * (c + 0.5) / 4;
      if (c) dr.add(box(0.006, 0.05, dd - 0.02, M('lightoak'), x - iw / 8, y0 + 0.02, zc));
      for (let k = 0; k < 4; k++) {
        const xx = x - iw / 16 + k * iw / 40, len = c === 3 ? 0.22 : 0.18;
        dr.add(box(0.012, 0.004, len, M('steel'), xx, y0 + 0.022 + k * 0.004, zc));
        if (c === 0) dr.add(box(0.024, 0.003, 0.05, M('steel'), xx, y0 + 0.026 + k * 0.004, zc - len / 2));                   // forks
        if (c === 1) { const b = mesh(new THREE.SphereGeometry(0.016, 10, 6), M('steel')); b.scale.set(1, 0.3, 1.6); b.position.set(xx, y0 + 0.028 + k * 0.004, zc - len / 2); dr.add(b); } // spoons
        if (c === 2) dr.add(box(0.018, 0.003, 0.07, M('steel'), xx, y0 + 0.026 + k * 0.004, zc - len / 2 + 0.01));             // knives
      }
    }
    dr.userData.part = { kind: 'slide', dist: d - 0.15 };
    g.add(dr);
  }
  if (kind === 'sink') {
    g.add(box(Math.min(0.6, w - 0.12), 0.003, d * 0.6, M('steel'), 0, h + 0.0005, 0.02));
    const neck = mesh(new THREE.TorusGeometry(0.1, 0.01, 10, 24, Math.PI), M('brass'));
    neck.position.set(0, h + 0.3, -d / 2 + 0.12); neck.rotation.y = Math.PI / 2;
    g.add(cyl(0.012, 0.012, 0.3, M('brass'), 0, h, -d / 2 + 0.02 + 0.1), neck);
  }
  if (kind === 'washer') {                                       // built-in washer-dryer under the worktop
    const fz = d / 2 - 0.005, door = mesh(new THREE.CircleGeometry(0.16, 48), M('blackglass')), ring = mesh(new THREE.TorusGeometry(0.175, 0.018, 12, 64), M('steel'));
    door.position.set(0, 0.42, fz + 0.012); ring.position.set(0, 0.42, fz + 0.014);
    g.add(box(w - 0.02, h - 0.17, 0.012, M('ceramic'), 0, 0.1, fz), door, ring, box(w - 0.06, 0.07, 0.006, M('blackglass'), 0, h - 0.17, fz + 0.007));
  }
  if (kind === 'hob') g.add(box(w - 0.05, 0.006, d - 0.08, M('blackglass'), 0, h, 0.04), box(w - 0.04, 0.5, 0.004, M('blackglass'), 0, 0.15, d / 2 - 0.009),
    box(w - 0.08, 0.03, 0.06, M('blackglass'), 0, h, -d / 2 + 0.08));                // downdraft extractor bar (window above, no hood)
  return g;
}

// Wave-pleated fabric panel, facing +z.
function drape(w, h, mat, amp, pitch, z, x) {
  const geo = new THREE.PlaneGeometry(w, h, Math.max(8, Math.round(w / pitch * 8)), 4);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin((p.getX(i) / pitch) * Math.PI * 2) * amp);
  geo.computeVertexNormals();
  const m = mesh(geo, mat, { shadow: false });
  m.position.set(x, h / 2, z);
  return m;
}

export function build(it) {
  const c = CATALOG[it.type];
  return c.build(it, c.tint ? M(c.tint, it.color) : null);
}
