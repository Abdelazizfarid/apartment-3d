// Furniture catalog. Every builder returns a Group facing +z with its origin at the floor centre.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { M, mesh, PHONE } from './materials.js';
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
      for (const sx of [-1, 1]) {
        const p = rbox(w * 0.44, 0.5, 0.16, 0.07, linen, sx * w * 0.235, 0.5, -d / 2 + 0.2); p.rotation.x = -0.28; g.add(p);
        const q = rbox(w * 0.36, 0.42, 0.14, 0.06, sand, sx * w * 0.2, 0.52, -d / 2 + 0.36); q.rotation.x = -0.32; g.add(q);
      }
      const c = rbox(0.45, 0.3, 0.12, 0.06, olive, 0, 0.55, -d / 2 + 0.5); c.rotation.x = -0.3; g.add(c);
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
  wardrobe: { label: 'Wardrobe (floor-to-ceiling)', cat: 'Bedroom', w: 1.8, d: 0.6, h: 2.85,
    spec: 'Built-in wardrobe to ceiling, walnut veneer doors, slim brass bar handles, LED inside',
    build: ({ w, d, h }) => {
      const g = group(box(w, h - 0.08, d - 0.02, M('walnut_v'), 0, 0.08, -0.01), box(w - 0.04, 0.08, d - 0.08, M('shadowgap'), 0, 0, -0.03));
      const n = Math.max(1, Math.round(w / 0.5)), dw = w / n;
      for (let i = 0; i < n; i++) {
        const x = -w / 2 + dw * (i + 0.5);
        g.add(box(dw - 0.004, h - 0.09, 0.02, M('walnut_v'), x, 0.085, d / 2 - 0.01));
        g.add(box(0.012, 0.45, 0.025, M('brass'), x + (i % 2 ? -1 : 1) * (dw / 2 - 0.04), 0.95, d / 2 + 0.01));
      }
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
  counter: { label: 'Kitchen base unit', cat: 'Kitchen', w: 0.8, d: 0.6, h: 0.9,
    spec: 'Handleless base unit, greige matte lacquer, 2 cm Calacatta worktop', build: it => kitchenBase(it) },
  sink_unit: { label: 'Kitchen sink unit', cat: 'Kitchen', w: 0.9, d: 0.6, h: 0.9,
    spec: 'Sink base, undermount steel sink, brushed-brass gooseneck mixer', build: it => kitchenBase(it, 'sink') },
  hob_unit: { label: 'Hob + oven unit', cat: 'Kitchen', w: 0.9, d: 0.6, h: 0.9,
    spec: 'Built-in oven, 90 cm black-glass induction hob', build: it => kitchenBase(it, 'hob') },
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
    spec: 'Rimless wall-hung WC, concealed cistern, brushed-brass flush plate',
    build: ({ w, d, h }) => group(rbox(w, 0.33, d, 0.14, M('ceramic'), 0, h - 0.37), rbox(w - 0.02, 0.03, d - 0.05, 0.1, M('ceramic'), 0, h - 0.04, 0.02),
      box(0.22, 0.15, 0.01, M('brass'), 0, 0.95, -d / 2 - 0.004)) },
  vanity: { label: 'Floating vanity', cat: 'Bathroom', w: 0.8, d: 0.46, h: 0.85,
    spec: 'Wall-hung walnut vanity, Calacatta top, ceramic vessel basin, wall-mounted brass mixer',
    build: ({ w, d, h }) => group(box(w, 0.4, d, M('walnut'), 0, h - 0.43), box(w, 0.03, d, M('calacatta'), 0, h - 0.03),
      cyl(0.2, 0.15, 0.13, M('ceramic'), 0, h, 0.02, 48), cyl(0.18, 0.13, 0.001, M('shadowgap'), 0, h + 0.13, 0.02, 48), box(0.02, 0.02, 0.17, M('brass'), 0, h + 0.22, -d / 2 + 0.085)) },
  mirror_led: { wall: true, label: 'Backlit mirror', cat: 'Bathroom', w: 0.7, d: 0.03, h: 0.7, y: 1.25, spec: 'Round backlit LED mirror Ø70 cm',
    build: ({ w, d, h }) => {
      const r = Math.min(w, h) / 2, m = mesh(new THREE.CircleGeometry(r, 64), M('mirror')), halo = mesh(new THREE.RingGeometry(r - 0.01, r + 0.025, 64), M('ledstrip'));
      m.position.set(0, h / 2, d); halo.position.set(0, h / 2, 0.005);
      return group(m, halo);
    } },
  shower: { label: 'Walk-in shower', cat: 'Bathroom', w: 0.75, d: 1.2, h: 2.0,
    spec: 'Walk-in shower, fixed 8 mm clear glass with brass profile, ceiling rain head, linear drain',
    build: ({ w, d, h }) => group(box(w, 0.012, d, M('calacatta'), 0, 0), box(0.012, h, 0.6, M('glass'), -w / 2, 0, -d / 2 + 0.3),
      box(w, h, 0.012, M('glass'), 0, 0, -d / 2), box(w, 0.015, 0.015, M('brass'), 0, h, -d / 2), box(0.015, 0.015, 0.6, M('brass'), -w / 2, h, -d / 2 + 0.3),
      box(0.3, 0.012, 0.3, M('brass'), 0.05, 2.2, 0), box(0.03, 0.03, 0.4, M('brass'), w / 2 - 0.02, 1.0, 0.1), box(0.6, 0.004, 0.04, M('steel'), 0, 0.012, d / 2 - 0.08)) },
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
};

function kitchenBase({ w, d, h }, kind) {
  const g = group(box(w - 0.004, 0.1, d - 0.08, M('shadowgap'), 0, 0, -0.04), box(w - 0.004, h - 0.14, d - 0.02, M('lacquer'), 0, 0.1, -0.01),
    box(w, 0.02, d, M('calacatta'), 0, h - 0.02), box(w - 0.004, 0.02, 0.01, M('shadowgap'), 0, h - 0.06, d / 2 - 0.02));
  if (kind !== 'panel' && kind !== 'hob') for (const y of [0.32, 0.55]) g.add(box(w - 0.004, 0.004, 0.003, M('shadowgap'), 0, y, d / 2 - 0.01));
  if (kind === 'sink') {
    g.add(box(Math.min(0.6, w - 0.12), 0.003, d * 0.6, M('steel'), 0, h + 0.0005, 0.02));
    const neck = mesh(new THREE.TorusGeometry(0.1, 0.01, 10, 24, Math.PI), M('brass'));
    neck.position.set(0, h + 0.3, -d / 2 + 0.12); neck.rotation.y = Math.PI / 2;
    g.add(cyl(0.012, 0.012, 0.3, M('brass'), 0, h, -d / 2 + 0.02 + 0.1), neck);
  }
  if (kind === 'hob') g.add(box(w - 0.05, 0.006, d - 0.08, M('blackglass'), 0, h, 0), box(w - 0.04, 0.5, 0.004, M('blackglass'), 0, 0.15, d / 2 - 0.009));
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
