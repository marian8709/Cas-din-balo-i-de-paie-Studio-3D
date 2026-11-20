import * as THREE from 'three';
import {
  ALL_LAYERS,
  BAY,
  BX,
  C,
  CEIL,
  COS,
  DOOR_H,
  ENDX,
  F,
  FL,
  FS,
  GATE,
  IWALLS,
  JW,
  L,
  LAYERS,
  LOFT,
  MIDZ,
  NRB,
  PARQ,
  PL,
  PR,
  PSP,
  PT,
  RAD,
  RAKE,
  RAMP,
  RIDGE,
  RIDGE_PILE_OFFSET,
  ROOMS,
  RX,
  SEASONS,
  SIDEZ,
  SIN,
  SITE,
  T,
  TAN,
  TILE,
  W,
  XL,
  XR,
  Y_BEAM,
  Y_DECK,
  Y_JOIST,
  Y_OSB,
  ZON,
  ZR,
  ceilArea,
  clearSky,
  createInitialWalls,
  getInteriorDoorSpecs,
  halfDay,
  hm,
  inLoft,
  nJ,
  plateTop,
  roofArea,
  roofY,
  slY,
  spJ,
  subtractRects,
  sunPos,
  toLocal,
  wp,
  yApex,
  yPB,
  yRB,
  yRBb,
  yz,
  type WallDef,
  type WallPostMeta,
} from './config';
import { createMaterialLibrary } from './textures';

export interface BomEntry {
  cat: string;
  name: string;
  unit: string;
  qty: number;
  note: string;
}

export interface TimEntry {
  sec: string;
  grade: string;
  len: number;
  uses: Set<string>;
  pcs: number[];
}

export interface JointCheck {
  el: string;
  desc: string;
  exp: number;
  tol: number;
  d: number;
  ok: boolean;
}

export interface BuildStepDef {
  t: string;
  layers: string[];
  key: 'idx' | 'y' | 'ytop' | 'n';
  dur: number;
  view: [[number, number, number], [number, number, number]];
  xray?: boolean;
  hide?: string[];
  p: string[];
  m: string;
  w: string;
  items: { m: THREE.Mesh; k: number }[];
}

export interface NeighDef {
  name: string;
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  eave?: number;
  ridge?: number;
  own?: boolean;
  vine?: boolean;
}

export interface ObstDef {
  x0?: number;
  x1?: number;
  z0?: number;
  z1?: number;
  cx?: number;
  cz?: number;
  r?: number;
  wall?: boolean;
}

export interface PvPanelBox {
  za: number;
  zb: number;
  x0: number;
  x1: number;
}

export interface BuiltSceneData {
  G: Record<string, THREE.Group>;
  TIER: Record<string, number>;
  XRAY: THREE.Material[];
  WALLS: WallDef[];
  PILES: { x: number; z: number; cap: THREE.Mesh; type: 'A' | 'B' }[];
  JOIST: { z: number; bot: THREE.Mesh; top: THREE.Mesh }[];
  BOMD: Map<string, BomEntry>;
  TIM: Map<string, TimEntry>;
  Q: Record<string, any>;
  JRES: JointCheck[];
  FURN: ObstDef[];
  OBST: ObstDef[];
  NEIGH: NeighDef[];
  TREES: { x: number; z: number; h: number; r: number; layer: string }[];
  PVP: PvPanelBox[];
  LABELS: THREE.Sprite[];
  STEPS: BuildStepDef[];
  septicVol: number;
  heatArea: number;
  heatKw: number;
  pvKw: number;
  batKwh: number;
  nPV: number;
  warmLights: THREE.PointLight[];
  stoveEmber: THREE.Mesh;
  dome: THREE.Group;
  updateSunVisuals: (n: number, hr: number) => {
    alt: number;
    az: number;
    lit: number;
    totalPv: number;
    ci: number;
    kwNow: number;
  };
  dayEnergy: (n: number) => { e: number; e0: number; sunH: number };
  dispose: () => void;
}

export function buildArchitecturalScene(
  scene: THREE.Scene,
  clipPlane: THREE.Plane,
  isSoftwareGl: boolean,
  maxAniso: number,
): BuiltSceneData {
  const lib = createMaterialLibrary(clipPlane, isSoftwareGl, maxAniso);
  const { MAT, STRAW, parquetTex, tileTex, texMat } = lib;

  const G: Record<string, THREE.Group> = {};
  const TIER: Record<string, number> = {};
  for (const [, items] of LAYERS) {
    for (const [id, , tier] of items) {
      G[id] = new THREE.Group();
      TIER[id] = tier;
      scene.add(G[id]);
    }
  }

  // Far countryside ground plane with soft grass texture
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(320, 64),
    MAT.farGround,
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.03;
  ground.receiveShadow = true;
  scene.add(ground);

  const XRAY: THREE.Material[] = [ground.material];

  const BOMD = new Map<string, BomEntry>();
  const TIM = new Map<string, TimEntry>();
  const Q: Record<string, any> = {
    piles: 0,
    pilesHouse: 0,
    pileT: { A: 0, B: 0 },
    pileTH: { A: 0, B: 0 },
    posts: 0,
    joists: 0,
    rafters: 0,
    chord: 0,
    osbArea: 0,
    baleWall: 0,
    baleFloor: 0,
    baleRoof: 0,
    plExt: 0,
    plInt: 0,
    stakeS: 0,
    stakeL: 0,
    sill: 0,
    deckBoards: 0,
    tJoists: 0,
    diag: 0,
    hd: 0,
    brk: 0,
    anchors: 0,
  };

  function bom(cat: string, name: string, unit: string, qty: number, note = '') {
    const k = cat + '|' + name;
    const e = BOMD.get(k) || { cat, name, unit, qty: 0, note };
    e.qty += qty;
    if (note) e.note = note;
    BOMD.set(k, e);
  }

  function tim(sec: string, len: number, use: string, grade = 'C24', n = 1) {
    const e = TIM.get(sec + grade) || { sec, grade, len: 0, uses: new Set<string>(), pcs: [] };
    e.len += len;
    e.uses.add(use);
    for (let i = 0; i < n; i++) e.pcs.push(len / n);
    TIM.set(sec + grade, e);
  }

  const JOINTS: { el: string; desc: string; exp: number; tol: number; f: () => number }[] = [];
  let strawN = 0;
  const straw = () => STRAW[(strawN = (strawN * 7 + 3) % 11) % STRAW.length];

  const WORLD = { axis: 'x' as const, c: 0, dir: 1 as const };

  function hexa(
    layer: string,
    mat: THREE.Material,
    wall: { axis: 'x' | 'z'; c: number; dir: number },
    f: (fx: number, fy: number, fz: number) => [number, number, number],
  ) {
    const g = new THREE.BoxGeometry(1, 1, 1);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const [u, v, w] = f(p.getX(i) + 0.5, p.getY(i) + 0.5, p.getZ(i) + 0.5);
      const ww = wall.c + wall.dir * w;
      if (wall.axis === 'x') p.setXYZ(i, u, v, ww);
      else p.setXYZ(i, ww, v, u);
    }
    const a = g.index!.array as Uint16Array | Uint32Array;
    const A = new THREE.Vector3();
    const B = new THREE.Vector3();
    const D = new THREE.Vector3();
    let vol = 0;
    for (let i = 0; i < a.length; i += 3) {
      A.fromBufferAttribute(p, a[i]);
      B.fromBufferAttribute(p, a[i + 1]);
      D.fromBufferAttribute(p, a[i + 2]);
      vol += A.dot(B.cross(D));
    }
    if (vol < 0) {
      for (let i = 0; i < a.length; i += 3) {
        const k = a[i + 1];
        (a as any)[i + 1] = a[i + 2];
        (a as any)[i + 2] = k;
      }
    }
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, mat);
    m.castShadow = m.receiveShadow = true;
    G[layer].add(m);
    return m;
  }

  function prism(
    layer: string,
    mat: THREE.Material,
    wall: { axis: 'x' | 'z'; c: number; dir: number },
    u0: number,
    u1: number,
    b0: number,
    b1: number,
    t0: number,
    t1: number,
    w0: number,
    w1: number,
    tw = 0,
  ) {
    return hexa(layer, mat, wall, (fx, fy, fz) => {
      const b = b0 + (b1 - b0) * fx;
      const t = t0 + (t1 - t0) * fx + tw * fz;
      return [u0 + (u1 - u0) * fx, b + (t - b) * fy, w0 + (w1 - w0) * fz];
    });
  }

  const wbox = (
    layer: string,
    mat: THREE.Material,
    wall: { axis: 'x' | 'z'; c: number; dir: number },
    u0: number,
    u1: number,
    v0: number,
    v1: number,
    w0: number,
    w1: number,
  ) => prism(layer, mat, wall, u0, u1, v0, v0, v1, v1, w0, w1);

  const box = (layer: string, mat: THREE.Material, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number) =>
    wbox(layer, mat, WORLD, x0, x1, y0, y1, z0, z1);

  function sl(side: 'N' | 'S', layer: string, mat: THREE.Material, z0: number, z1: number, n0: number, n1: number, x0: number, x1: number) {
    return hexa(layer, mat, WORLD, (fx, fy, fz) => {
      const zz = z0 + (z1 - z0) * fx;
      const n = n0 + (n1 - n0) * fy;
      return [x0 + (x1 - x0) * fz, F + C.hE + zz * TAN + n / COS, side === 'N' ? zz : L - zz];
    });
  }

  function cyl(layer: string, mat: THREE.Material, x: number, z: number, r: number, y0: number, y1: number, seg = 20) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, y1 - y0, seg), mat);
    m.position.set(x, (y0 + y1) / 2, z);
    m.castShadow = m.receiveShadow = true;
    G[layer].add(m);
    return m;
  }

  const wcyl = (
    layer: string,
    mat: THREE.Material,
    wl: { axis: 'x' | 'z'; c: number; dir: number },
    u: number,
    w: number,
    r: number,
    v0: number,
    v1: number,
  ) => (wl.axis === 'x' ? cyl(layer, mat, u, wl.c + wl.dir * w, r, v0, v1, 8) : cyl(layer, mat, wl.c + wl.dir * w, u, r, v0, v1, 8));

  const UP = new THREE.Vector3(0, 1, 0);
  function pipe(layer: string, mat: THREE.Material, pts: [number, number, number][], r: number) {
    let len = 0;
    for (let k = 0; k < pts.length - 1; k++) {
      const a = new THREE.Vector3(...pts[k]);
      const b = new THREE.Vector3(...pts[k + 1]);
      const d = b.clone().sub(a);
      const l = d.length();
      if (l < 1e-4) continue;
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, l + r, 10), mat);
      m.position.copy(a).add(b).multiplyScalar(0.5);
      m.quaternion.setFromUnitVectors(UP, d.normalize());
      m.castShadow = r > 0.01;
      G[layer].add(m);
      len += l;
    }
    return len;
  }

  const splitAt = (rects: { u0: number; u1: number; v0: number; v1: number }[], R?: number) =>
    R == null ? rects : rects.flatMap((r) => (r.u0 < R - 1e-6 && r.u1 > R + 1e-6 ? [{ ...r, u1: R }, { ...r, u0: R }] : [r]));

  function emit(
    layer: string,
    matFn: () => THREE.Material,
    wall: { axis: 'x' | 'z'; c: number; dir: number; ridge?: number },
    rects: { u0: number; u1: number; v0: number; v1: number }[],
    lim: (u: number) => number,
    w0: number,
    w1: number,
    inset = 0,
  ) {
    let area = 0;
    for (const r of splitAt(rects, wall.ridge)) {
      const u0 = r.u0 + inset;
      const u1 = r.u1 - inset;
      const v0 = r.v0 + inset;
      let t0 = Math.min(r.v1, lim(u0)) - inset;
      let t1 = Math.min(r.v1, lim(u1)) - inset;
      if (Math.max(t0, t1) < v0 + 0.04) continue;
      t0 = Math.max(t0, v0 + 0.005);
      t1 = Math.max(t1, v0 + 0.005);
      prism(layer, matFn(), wall, u0, u1, v0, v0, t0, t1, w0, w1);
      area += (r.u1 - r.u0) * ((t0 + t1) / 2 + inset - r.v0);
    }
    return area;
  }

  const PILES: { x: number; z: number; cap: THREE.Mesh; type: 'A' | 'B' }[] = [];
  function pile(x: number, z: number, h: number, layer = 'piloni', type: 'A' | 'B' = 'A') {
    const P = PT[type];
    const y0 = h - P.len;
    cyl(layer, MAT.steel, x, z, P.d / 2, y0 + 0.12, h - 0.012, 12);
    cyl(layer, MAT.steel, x, z, P.d / 4, y0, y0 + 0.12, 8);
    P.hel.forEach((dh, i) => cyl(layer, MAT.steel, x, z, dh / 2, y0 + 0.20 + i * 0.75, y0 + 0.212 + i * 0.75, 20));
    const cap = box(layer, MAT.steel, x - 0.11, x + 0.11, h - 0.012, h, z - 0.11, z + 0.11);
    Q.piles++;
    Q.pileT[type]++;
    if (layer === 'piloni') {
      Q.pileTH[type]++;
      PILES.push({ x, z, cap, type });
    }
    return cap;
  }

  function stairs(layer: string, wl: { axis: 'x' | 'z'; c: number; dir: number }, wd: number, us: number, yTop: number, sgn = 1) {
    const Bx = (mat: THREE.Material, a: number, b: number, ba: number, bb: number, ta: number, tb: number, w0: number, w1: number) =>
      a < b ? prism(layer, mat, wl, a, b, ba, bb, ta, tb, w0, w1) : prism(layer, mat, wl, b, a, bb, ba, tb, ta, w0, w1);
    const n = Math.ceil(yTop / 0.18);
    const rise = yTop / n;
    const run = 0.28;
    const len = (n - 1) * run;
    for (let k = 1; k < n; k++) {
      const y = yTop - k * rise;
      Bx(MAT.deck, us + sgn * (k - 1) * run, us + sgn * (k * run + 0.02), y - 0.04, y - 0.04, y, y, 0, wd);
    }
    const b0 = yTop - rise - 0.26;
    const b1 = b0 - (n - 1) * rise;
    for (const w of [0.03, wd - 0.08]) {
      Bx(MAT.woodDark, us, us + sgn * len, b0, Math.max(b1, 0), b0 + 0.22, Math.max(b1 + 0.22, 0.03), w, w + 0.05);
    }
    tim('5×25', 2 * Math.hypot(len, yTop), 'vanguri trepte', 'C24', 2);
    bom('Terasă și trepte', 'Dulap trepte 4×28 cm (larice/stejar)', 'm', (n - 1) * wd);
    return len;
  }

  const rc = new THREE.Raycaster();
  function hitsAlong(mesh: THREE.Object3D, o: THREE.Vector3, d: THREE.Vector3) {
    rc.set(o, d);
    rc.far = 200;
    return rc.intersectObject(mesh, false).map((h) => h.point);
  }
  function contact(el: string, desc: string, A: THREE.Object3D, B: THREE.Object3D, x: number, y: number, z: number, axis: 'x' | 'y' | 'z' = 'y', exp = 0, tol = 0.003) {
    JOINTS.push({
      el,
      desc,
      exp,
      tol,
      f: () => {
        const o = new THREE.Vector3(x, y, z);
        const d = new THREE.Vector3();
        o[axis] = -100;
        d[axis] = 1;
        const a = hitsAlong(A, o, d).map((p) => p[axis]);
        const b = hitsAlong(B, o, d).map((p) => p[axis]);
        if (!a.length || !b.length) return NaN;
        return Math.min(...a) - Math.max(...b);
      },
    });
  }
  function axisCheck(el: string, desc: string, fn: () => number, exp = 0, tol = 0.003) {
    JOINTS.push({ el, desc, exp, tol, f: fn });
  }
  const bbox = (m: THREE.Object3D) => new THREE.Box3().setFromObject(m);

  /* ============================== FUNDAȚIE: PILONI ȘURUB + GRINZI ============================== */
  const pileCaps: Record<string, THREE.Mesh> = {};
  const pk = (x: number, z: number) => x.toFixed(2) + '|' + z.toFixed(3);
  const pileU = (x: number, z: number, beamAlong: 'x' | 'z') => {
    const h = C.pileH;
    if (beamAlong === 'z') {
      for (const sx of [-0.079, 0.075]) box('piloni', MAT.steel, x + sx, x + sx + 0.004, h, h + 0.19, z - 0.085, z + 0.085);
      for (const [dz, dy] of [[-0.045, 0.07], [0.045, 0.16]]) {
        const b = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.21, 8), MAT.steel);
        b.rotation.z = Math.PI / 2;
        b.position.set(x, h + dy, z + dz);
        G.piloni.add(b);
      }
    } else {
      for (const sz of [-0.079, 0.075]) box('piloni', MAT.steel, x - 0.085, x + 0.085, h, h + 0.19, z + sz, z + sz + 0.004);
      for (const [dx, dy] of [[-0.045, 0.07], [0.045, 0.16]]) {
        const b = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.21, 8), MAT.steel);
        b.rotation.x = Math.PI / 2;
        b.position.set(x + dx, h + dy, z);
        G.piloni.add(b);
      }
    }
  };
  for (const z of [0.2, L - 0.2])
    for (const x of ENDX) {
      pileCaps[pk(x, z)] = pile(x, z, C.pileH, 'piloni', 'B');
      pileU(x, z, BX.includes(x) ? 'z' : 'x');
    }
  for (const x of [BX[0], BX[2]])
    for (const z of SIDEZ.slice(1, -1)) {
      pileCaps[pk(x, z)] = pile(x, z, C.pileH, 'piloni', Math.abs(z - ZR) <= RIDGE_PILE_OFFSET + 0.05 ? 'B' : 'A');
      pileU(x, z, 'z');
    }
  for (const z of MIDZ.slice(1, -1)) {
    pileCaps[pk(BX[1], z)] = pile(BX[1], z, C.pileH, 'piloni', 'A');
    pileU(BX[1], z, 'z');
  }
  Q.pilesHouse = Q.piles;

  const BEAM: Record<number, THREE.Mesh> = {};
  for (const x of BX) {
    BEAM[x] = box('grinzi', MAT.woodDark, x - 0.075, x + 0.075, Y_BEAM, Y_OSB, 0, L);
    tim('15×24', L, 'grinzi fundație');
  }
  // Steel flitch transfer plates (10×220 S235, L = 1,40 m) on outer faces of gable beams across the 1.00 m ridge-pile pair
  for (const bx of [BX[0], BX[2]]) {
    for (const sx of [-0.085, 0.075]) {
      box('feronerie', MAT.steel, bx + sx, bx + sx + 0.010, Y_BEAM + 0.01, Y_OSB - 0.01, ZR - 0.70, ZR + 0.70);
    }
    for (const dz of [-0.55, -0.25, 0.25, 0.55]) {
      for (const dy of [0.06, 0.18]) {
        const b = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.20, 8), MAT.steel);
        b.rotation.z = Math.PI / 2;
        b.position.set(bx, Y_BEAM + dy, ZR + dz);
        G.feronerie.add(b);
      }
    }
  }
  const ENDB: THREE.Mesh[] = [];
  for (const z of [0.2, L - 0.2]) {
    for (const [a, b] of [
      [BX[0] + 0.075, BX[1] - 0.075],
      [BX[1] + 0.075, BX[2] - 0.075],
    ]) {
      ENDB.push(box('grinzi', MAT.woodDark, a, b, Y_BEAM, Y_OSB, z - 0.075, z + 0.075));
      tim('15×24', b - a, 'grinzi fundație');
      for (const x of [a, b]) box('feronerie', MAT.steel, x - 0.004, x + 0.004, Y_BEAM + 0.01, Y_OSB - 0.01, z - 0.085, z + 0.085);
      Q.brk += 2;
    }
  }
  contact('Fundație', 'pilon de colț (V) ↔ grinda longitudinală', BEAM[BX[0]], pileCaps[pk(BX[0], 0.2)], BX[0], 0, 0.2);
  contact('Fundație', 'pilon sub stâlpul de coamă ↔ grinda longitudinală', BEAM[BX[0]], pileCaps[pk(BX[0], ZR - RIDGE_PILE_OFFSET)], BX[0], 0, ZR - RIDGE_PILE_OFFSET);
  contact('Fundație', 'pilon median ↔ grinda mediană', BEAM[BX[1]], pileCaps[pk(BX[1], MIDZ[2])], BX[1], 0, MIDZ[2]);
  contact('Fundație', 'pilon sub peretele N ↔ grinda de capăt', ENDB[0], pileCaps[pk(1.9, 0.2)], 1.9, 0, 0.2);
  contact('Fundație', 'pilon fronton (tip A) ↔ grinda longitudinală E', BEAM[BX[2]], pileCaps[pk(BX[2], SIDEZ[6])], BX[2], 0, SIDEZ[6]);

  /* ============================== PLATFORMĂ ============================== */
  const osbBottom = box('platforma', MAT.osb, 0, W, Y_OSB, Y_JOIST, 0, L);
  bom('Plăci', 'OSB3 18 mm (fund platformă + închideri)', 'm²', W * L + 2 * L * 0.4);
  box('platforma', MAT.osb, 0, 0.018, Y_JOIST, Y_DECK, 0, L);
  box('platforma', MAT.osb, W - 0.018, W, Y_JOIST, Y_DECK, 0, L);
  box('platforma', MAT.osb, 0.018, W - 0.018, Y_JOIST, Y_DECK, 0, 0.018);
  box('platforma', MAT.osb, 0.018, W - 0.018, Y_JOIST, Y_DECK, L - 0.018, L);
  Q.osbArea += W * L + 2 * L * 0.4 + 2 * W * 0.4;
  const JOIST: { z: number; bot: THREE.Mesh; top: THREE.Mesh }[] = [];
  const ridgeBlocks: THREE.Mesh[] = [];
  {
    const ladder = (z: number) => {
      box('platforma', MAT.osb, 0.018, W - 0.018, Y_JOIST, Y_DECK, z, z + 0.012);
      const bot = box('platforma', MAT.wood, 0.018, W - 0.018, Y_JOIST, Y_JOIST + 0.095, z + 0.012, z + JW);
      const top = box('platforma', MAT.wood, 0.018, W - 0.018, Y_DECK - 0.095, Y_DECK, z + 0.012, z + JW);
      for (const bx of BX) {
        box('platforma', MAT.woodDark, bx - 0.0225, bx + 0.0225, Y_JOIST + 0.095, Y_DECK - 0.095, z + 0.012, z + JW);
      }
      tim('4,5×9,5', 2 * W + 3 * 0.21, 'tălpi și montanți reazem grinzi-scară podea', 'C24', 2);
      Q.chord += 2 * W;
      Q.joists++;
      bom('Plăci', 'OSB3 12 mm (inimi grinzi-scară, fâșii de 40 cm)', 'm²', W * 0.40);
      JOIST.push({ z, bot, top });
    };
    const EXZ = [0.2, L - 0.2];
    for (const zc of EXZ) ladder(zc - JW / 2);
    const rb = Math.floor((ZR - JW) / spJ);
    for (let i = 0; i <= nJ; i++) {
      const z = i * spJ;
      ladder(z);
      if (i === nJ) break;
      const zc = i === 0 ? EXZ[0] : i === nJ - 1 ? EXZ[1] : null;
      const strips: [number, number][] = zc === null ? [[z + JW, z + spJ]] : [[z + JW, zc - JW / 2], [zc + JW / 2, z + spJ]];
      let xa = 0.018;
      let xb = W - 0.018;
      if (i === rb) {
        for (const [a, b] of [
          [0.018, 0.40],
          [W - 0.40, W - 0.018],
        ]) {
          ridgeBlocks.push(box('platforma', MAT.glulam, a, b, Y_JOIST, Y_DECK, z + JW, z + spJ));
        }
        tim('38×40', 2 * (spJ - JW), 'blocuri sub stâlpii de coamă (în platformă)', 'GL24h', 2);
        xa = 0.40;
        xb = W - 0.40;
      }
      let x = xa;
      let len = i % 2 ? 0.5 : 1.0;
      while (x < xb - 0.03) {
        const x1 = Math.min(x + len, xb);
        for (const [za, zb] of strips) {
          box('paiePod', straw(), x + 0.005, x1 - 0.005, Y_JOIST + 0.003, Y_DECK - 0.003, za + 0.004, zb - 0.004);
          Q.baleFloor += ((x1 - x) / C.baleLen) * ((zb - za) / (spJ - JW));
        }
        x = x1;
        len = 1.0;
      }
    }
  }
  const deck = box('podea', MAT.osb, 0, W, Y_DECK, FS, 0, L);
  bom('Plăci', 'OSB3 22 mm (podea brută, nut și feder)', 'm²', W * L);
  Q.osbArea += W * L;
  contact('Platformă', 'grinda longitudinală ↔ OSB 18 (fundul platformei)', osbBottom, BEAM[BX[0]], BX[0], 0, 3.0);
  contact('Platformă', 'OSB 18 ↔ talpa de jos a grinzii-scară', JOIST[5].bot, osbBottom, W / 2, 0, JOIST[5].z + 0.035);
  contact('Platformă', 'talpa de sus a grinzii-scară ↔ OSB 22', deck, JOIST[5].top, W / 2, 0, JOIST[5].z + 0.035);
  contact('Platformă', 'bloc sub stâlpul de coamă ↔ OSB 18', ridgeBlocks[0], osbBottom, 0.2, 0, ZR);
  contact('Platformă', 'OSB 22 ↔ bloc sub stâlpul de coamă', deck, ridgeBlocks[0], 0.2, 0, ZR);

  const parq = PARQ.map(([x0, x1, z0, z1]) =>
    box('parchet', texMat(parquetTex, (x1 - x0) / 1.12, (z1 - z0) / 1.12), x0, x1, FS, F, z0, z1),
  );
  for (const [x0, x1, z0, z1] of TILE) {
    box('parchet', texMat(tileTex, (x1 - x0) / 0.6, (z1 - z0) / 0.6, { roughness: 0.32 }), x0, x1, FS, F, z0, z1);
  }
  contact('Pardoseală', 'parchet (cu suport și folie) ↔ OSB 22', parq[0], deck, 2.0, 0, 2.0);

  /* ============================== PEREȚI EXTERIORI ============================== */
  const WALLS = createInitialWalls();
  const wallMeshes: Record<string, any> = {};

  function holdDown(wl: WallDef, u: number, s: number) {
    wbox('feronerie', MAT.steel, wl, s > 0 ? u : u - 0.006, s > 0 ? u + 0.006 : u, FS + 0.10, FS + 0.45, 0.16, 0.24);
    wbox('feronerie', MAT.steel, wl, s > 0 ? u : u - 0.07, s > 0 ? u + 0.07 : u, FS + 0.10, FS + 0.112, 0.16, 0.24);
    wcyl('feronerie', MAT.steel, wl, u + s * 0.035, 0.2, 0.008, Y_BEAM - 0.04, FS + 0.13);
    wbox('feronerie', MAT.steel, wl, u + s * 0.035 - 0.045, u + s * 0.035 + 0.045, Y_BEAM - 0.012, Y_BEAM, 0.155, 0.245);
    Q.hd++;
  }

  function buildWall(wl: WallDef) {
    const rake = wl.plate === 'rake';
    const P = C.post / 2;
    const D = wl.pd / 2;
    const wA = 0.5 * T - D;
    const wB = 0.5 * T + D;
    const pA = 0.5 * T - 0.06;
    const pB = 0.5 * T + 0.06;
    const lim = rake ? (u: number) => roofY(u) : () => plateTop(pA);
    const limB = rake ? (u: number) => roofY(u) - RAKE : () => yPB;
    wl.lim = lim;
    wl.limB = limB;
    wl.frame = [];
    wl.posts = [];
    wl.wA = wA;
    wl.wB = wB;
    const wm: any = { posts: [], sills: [], lintels: [], plateM: null, rakeM: [], ridgePost: null };
    wallMeshes[wl.id] = wm;

    const S = (
      layer: string,
      mat: THREE.Material,
      k: string | null,
      u0: number,
      u1: number,
      b0: number,
      b1: number,
      t0: number,
      t1: number,
      w0: number,
      w1: number,
      tw = 0,
    ) => {
      const m = prism(layer, mat, wl, u0, u1, b0, b1, t0, t1, w0, w1, tw);
      if (k) wl.frame!.push({ k, pts: [[u0, b0], [u1, b1], [u1, t1], [u0, t0]] });
      return m;
    };

    for (const o of wl.openings) {
      o.v0 = o.type === 'door' ? F : F + (o.sill ?? C.winSill);
      o.v1 = F + C.head;
      o.lh = o.lh ?? 0.15;
    }
    const inOpening = (u: number) => wl.openings.some((o) => u > o.u0 && u < o.u1);

    const jack = new Map<number, any>();
    const pts: number[] = [];
    if (wl.corners) pts.push(wl.u0 + 0.2, wl.u1 - 0.2);
    for (const o of wl.openings) {
      pts.push(o.u0 - P, o.u1 + P);
      jack.set(o.u0 - P, o);
      jack.set(o.u1 + P, o);
    }
    if (rake && wl.ridge !== undefined) {
      pts.push(wl.ridge);
      for (const u of [wl.u0 + 0.06, wl.u1 - 0.06]) if (!pts.some((q) => Math.abs(q - u) < 0.3)) pts.push(u);
    }
    const anchors = [...pts, ...(wl.corners ? [] : [wl.u0, wl.u1])].sort((a, b) => a - b);
    for (let i = 0; i < anchors.length - 1; i++) {
      const a = anchors[i];
      const b = anchors[i + 1];
      const gap = b - a;
      if (gap > C.maxPost + 0.01 && !inOpening((a + b) / 2)) {
        const n = Math.ceil(gap / C.maxPost);
        for (let k = 1; k < n; k++) pts.push(a + (k * gap) / n);
      }
    }
    pts.sort((a, b) => a - b);
    const secP = `${Math.round(C.post * 100)}×${Math.round(wl.pd * 100)}`;

    for (const u of pts) {
      const o = jack.get(u);
      const R = rake && wl.ridge !== undefined && Math.abs(u - wl.ridge) < 1e-6;
      const h = R ? RIDGE.b / 2 : P;
      const w0 = R ? 0.10 : wA;
      const w1 = R ? 0.30 : wB;
      const corner = wl.corners && (Math.abs(u - wl.u0 - 0.2) < 1e-6 || Math.abs(u - wl.u1 + 0.2) < 1e-6);
      let m: THREE.Mesh;
      if (o) {
        m = S('structura', MAT.wood, 'post', u - h, u + h, FS + 0.10, FS + 0.10, o.v1, o.v1, w0, w1);
        S('structura', MAT.wood, 'post', u - h, u + h, o.v1 + o.lh, o.v1 + o.lh, limB(u - h), limB(u + h), w0, w1);
        tim(secP, o.v1 - FS - 0.10, 'stâlpi de gol (sub buiandrug)');
        tim(secP, limB(u) - o.v1 - o.lh, 'montanți peste buiandrug');
      } else if (R) {
        m = S('coama', MAT.glulam, 'ridge', u - h, u + h, FS + 0.10, FS + 0.10, yRBb, yRBb, w0, w1);
        tim('20×20', yRBb - FS - 0.10, 'stâlpi de coamă', 'GL24h');
        wm.ridgePost = m;
      } else {
        m = S('structura', MAT.wood, 'post', u - h, u + h, FS + 0.10, FS + 0.10, limB(u - h), limB(u + h), w0, w1);
        tim(secP, limB(u) - FS - 0.10, rake ? 'stâlpi fronton (12×20, pentru vânt)' : 'stâlpi pereți N/S');
      }
      const tr = wbox('structura', MAT.woodDark, wl, u - h, u + h, FS, FS + 0.10, 0.10, 0.30);
      tim('10×10', 0.20, 'traverse tălpi');
      Q.posts++;
      for (const [a, b] of [
        [0.004, w0],
        [w1, T - 0.004],
      ]) {
        prism('baloti', MAT.stuff, wl, u - h, u + h, FS + 0.10, FS + 0.10, R ? yRBb : limB(u - h), R ? yRBb : limB(u + h), a, b);
      }
      if (!R) {
        for (const s of [-1, 1]) {
          for (const [v0, v1] of [
            [FS + 0.10, FS + 0.19],
            [limB(u) - 0.10, limB(u) - 0.01],
          ]) {
            wbox('feronerie', MAT.steel, wl, s > 0 ? u + h : u - h - 0.004, s > 0 ? u + h + 0.004 : u - h, v0, v1, 0.17, 0.23);
            Q.brk++;
          }
        }
      }
      const kind: WallPostMeta['kind'] = o ? 'jack' : R ? 'ridge' : corner ? 'corner' : 'post';
      wl.posts!.push({ u, h, w0, w1, kind });
      wm.posts.push({ u, h, w0, w1, kind, m, tr });
    }

    const doors = wl.openings.filter((o) => o.type === 'door').map((o) => ({ u0: o.u0, u1: o.u1, v0: -9, v1: 99 }));
    for (const r of subtractRects([{ u0: wl.u0, u1: wl.u1, v0: FS, v1: FS + 0.10 }], doors)) {
      wm.sills.push(S('structura', MAT.woodDark, 'sill', r.u0, r.u1, FS, FS, FS + 0.10, FS + 0.10, 0, 0.10));
      S('structura', MAT.woodDark, null, r.u0, r.u1, FS, FS, FS + 0.10, FS + 0.10, 0.30, 0.40);
      tim('10×10', 2 * (r.u1 - r.u0), 'tălpi duble', 'C24', 2);
      Q.sill += 2 * (r.u1 - r.u0);
    }

    if (!rake) {
      wm.plateM = S('structura', MAT.woodDark, 'plate', XL, XR, yPB, yPB, plateTop(pA), plateTop(pA), pA, pB, plateTop(pB) - plateTop(pA));
      tim('12×20', XR - XL, 'cosoroabe pereți N/S (teșite, cu console)');
      for (const [a, b] of [
        [0.004, pA],
        [pB, T - 0.004],
      ]) {
        prism('baloti', MAT.stuff, wl, wl.u0, wl.u1, yPB, yPB, plateTop(a) - 0.004, plateTop(a) - 0.004, a, b, plateTop(b) - plateTop(a));
      }
    } else {
      for (const [a, b] of [
        [0.26, wl.ridge! - RIDGE.b / 2],
        [wl.ridge! + RIDGE.b / 2, L - 0.26],
      ]) {
        wm.rakeM.push(S('structura', MAT.woodDark, 'plate', a, b, roofY(a) - RAKE, roofY(b) - RAKE, roofY(a), roofY(b), pA, pB));
        tim('12×15', (b - a) / COS, 'cosoroabe înclinate fronton');
        const ua = Math.max(a, wl.u0);
        const ub = Math.min(b, wl.u1);
        for (const [c0, c1] of [
          [0.004, pA],
          [pB, T - 0.004],
        ]) {
          prism('baloti', MAT.stuff, wl, ua, ub, limB(ua), limB(ub), lim(ua) - 0.005, lim(ub) - 0.005, c0, c1);
        }
      }
    }

    for (const o of wl.openings) {
      const ow = o.u1 - o.u0;
      const oh = o.v1! - o.v0!;
      const t = 0.022;
      const lintel = S('structura', MAT.woodDark, 'lintel', o.u0 - 2 * P, o.u1 + 2 * P, o.v1!, o.v1!, o.v1! + o.lh!, o.v1! + o.lh!, wA, wB);
      wm.lintels.push({ o, m: lintel });
      tim(`${Math.round(wl.pd * 100)}×15`, ow + 4 * P, 'buiandrugi');
      for (const [a, b] of [
        [0.004, wA],
        [wB, T - 0.004],
      ]) {
        wbox('baloti', MAT.stuff, wl, o.u0, o.u1, o.v1!, o.v1! + o.lh!, a, b);
      }
      if (o.type === 'win') {
        S('structura', MAT.woodDark, 'parapet', o.u0, o.u1, o.v0! - 0.12, o.v0! - 0.12, o.v0!, o.v0!, wA, wB);
        tim(`${Math.round(wl.pd * 100)}×12`, ow, 'rigle parapet');
        for (const [a, b] of [
          [0.004, wA],
          [wB, T - 0.004],
        ]) {
          wbox('baloti', MAT.stuff, wl, o.u0, o.u1, o.v0! - 0.12, o.v0!, a, b);
        }
        // Centered cripple stud beneath wide windows (supports parapet sill without sagging)
        if (ow >= 1.20 && o.v0! - 0.12 > FS + 0.12) {
          const uc = (o.u0 + o.u1) / 2;
          S('structura', MAT.wood, 'post', uc - P, uc + P, FS + 0.10, FS + 0.10, o.v0! - 0.12, o.v0! - 0.12, wA, wB);
          wbox('structura', MAT.woodDark, wl, uc - P, uc + P, FS, FS + 0.10, 0.10, 0.30);
          tim(secP, o.v0! - 0.12 - (FS + 0.10), 'montanți sub parapet');
          tim('10×10', 0.20, 'traverse tălpi');
        }
        wbox('structura', MAT.osb, wl, o.u0, o.u1, o.v0!, o.v0! + t, 0, T);
      }
      wbox('structura', MAT.osb, wl, o.u0, o.u1, o.v1! - t, o.v1!, 0, T);
      wbox('structura', MAT.osb, wl, o.u0, o.u0 + t, o.v0!, o.v1!, 0, T);
      wbox('structura', MAT.osb, wl, o.u1 - t, o.u1, o.v0!, o.v1!, 0, T);
      const boxA = (2 * oh + (o.type === 'win' ? 2 : 1) * ow) * T;
      bom('Plăci', 'OSB3 22 mm (cutii ferestre/uși, fâșii de 40 cm)', 'm²', boxA);
      Q.osbArea += boxA;

      const u0 = o.u0 + t;
      const u1 = o.u1 - t;
      const vb = o.v0! + (o.type === 'win' ? t : 0);
      const vt = o.v1! - t;
      const fw = 0.06;
      const a = 0.08;
      const b = 0.15;
      const lay = 'tamplarie';
      wbox(lay, MAT.frame, wl, u0, u1, vb, vb + fw, a, b);
      wbox(lay, MAT.frame, wl, u0, u1, vt - fw, vt, a, b);
      wbox(lay, MAT.frame, wl, u0, u0 + fw, vb + fw, vt - fw, a, b);
      wbox(lay, MAT.frame, wl, u1 - fw, u1, vb + fw, vt - fw, a, b);
      if (o.double) {
        const m = (u0 + u1) / 2;
        wbox(lay, MAT.frame, wl, m - fw / 2, m + fw / 2, vb + fw, vt - fw, a, b);
      }
      const gl = wbox(lay, o.light ? MAT.frost : MAT.glass, wl, u0 + fw, u1 - fw, vb + fw, vt - fw, 0.11, 0.12);
      gl.castShadow = false;
      if (o.type === 'win') {
        const isSeat = ow >= 1.20 && (o.sill ?? C.winSill) <= 0.50;
        wbox(lay, MAT.metal, wl, o.u0 - 0.03, o.u1 + 0.03, vb - 0.014, vb, -0.09, a);
        if (isSeat) {
          // Banchetă profundă de șezut din stejar în grosimea peretelui de 40 cm + consolă 6 cm spre cameră
          wbox(lay, MAT.woodLight, wl, o.u0 + t, o.u1 - t, vb, vb + 0.035, b, T + PL + 0.06);
          wbox(lay, MAT.woodLight, wl, o.u0 + t, o.u1 - t, vb - 0.04, vb, T + PL, T + PL + 0.055);
          bom('Tâmplărie', 'Banchetă glaf interior stejar lamelat (spațiu șezut în perete 40 cm)', 'm', ow);
        } else {
          wbox(lay, MAT.woodLight, wl, o.u0, o.u1, vb - 0.02, vb, b, T + PL + 0.02);
          bom('Tâmplărie', 'Glaf interior lemn, lățime 30 cm', 'm', ow);
        }
        bom('Tâmplărie', 'Glaf exterior tablă/lemn, lățime 20 cm', 'm', ow + 0.06);
      }
      const dim = `${Math.round((u1 - u0) * 100)} × ${Math.round((vt - vb) * 100)} cm`;
      bom(
        'Tâmplărie',
        o.type === 'win'
          ? o.light
            ? `Fereastră de lumină fixă, geam mat triplu, ${dim}`
            : `Fereastră lemn stratificat, geam triplu, ${o.double ? '2 canate' : '1 canat'}, ${dim}`
          : `Ușă exterioară ${o.double ? 'dublă vitrată' : 'vitrată'}, ${dim}`,
        'buc',
        1,
      );
    }

    const obs = wl.openings
      .map((o) => ({ u0: o.u0, u1: o.u1, v0: o.type === 'door' ? -9 : o.v0! - 0.12, v1: o.v1! + o.lh! }))
      .concat(
        wl.openings
          .filter((o) => o.type === 'win' && o.u1 - o.u0 >= 1.20 && o.v0! - 0.12 > FS + 0.12)
          .map((o) => {
            const uc = (o.u0 + o.u1) / 2;
            return { u0: uc - P, u1: uc + P, v0: FS, v1: o.v0! - 0.12 };
          }),
      )
      .concat(wl.posts!.map((p) => ({ u0: p.u - p.h, u1: p.u + p.h, v0: -9, v1: 99 })));
    const top = rake ? limB(wl.ridge!) : yPB;
    for (let k = 0, v = FS + 0.10; v < top; k++, v += C.baleH) {
      const row = [];
      let u = wl.u0;
      let bl = k % 2 ? C.baleLen / 2 : C.baleLen;
      while (u < wl.u1 - 0.01) {
        const e = Math.min(u + bl, wl.u1);
        row.push({ u0: u, u1: e, v0: v, v1: v + C.baleH });
        u = e;
        bl = C.baleLen;
      }
      Q.baleWall += emit('baloti', straw, wl, subtractRects(row, obs), limB, 0, T, 0.005) / (C.baleLen * C.baleH);
    }

    const clear = (u: number, a: number, b: number) =>
      !wl.posts!.some((p) => Math.abs(p.u - u) < p.h + 0.04) &&
      !wl.openings.some((o) => u > o.u0 - 0.05 && u < o.u1 + 0.05 && (o.type === 'door' ? -9 : o.v0! - 0.12) < b && o.v1! + o.lh! > a);
    for (let u = wl.u0 + 0.25, i = 0; u < wl.u1 - 0.1; u += 0.5, i++) {
      if (clear(u, FS, FS + 0.45)) {
        wcyl('tarusi', MAT.stake, wl, u, 0.2, 0.015, FS + 0.06, FS + 0.42);
        Q.stakeS++;
      }
      const w = i % 2 ? 0.13 : 0.27;
      for (let y0 = FS + 0.95; y0 + 1.1 < limB(u) - 0.05; y0 += 1.0) {
        if (clear(u, y0, y0 + 1.1)) {
          wcyl('tarusi', MAT.stake, wl, u, Math.round(y0) % 2 ? T - w : w, 0.015, y0, y0 + 1.1);
          Q.stakeL++;
        }
      }
    }

    const ps = wl.posts!.slice().sort((a, b) => a.u - b.u);
    const spans = [];
    for (let i = 0; i < ps.length - 1; i++) {
      for (let j = i + 1; j <= Math.min(i + 2, ps.length - 1); j++) {
        const a = ps[i].u + ps[i].h;
        const b = ps[j].u - ps[j].h;
        if (b - a < 0.55 || wl.openings.some((o) => b > o.u0 && a < o.u1) || ps.slice(i + 1, j).some((p) => p.kind !== 'post')) continue;
        const vb = FS + 0.16;
        const ta = limB(a) - 0.06;
        const tb = limB(b) - 0.06;
        const th1 = Math.atan2(tb - vb, b - a);
        const th2 = Math.atan2(ta - vb, b - a);
        spans.push({
          a,
          b,
          vb,
          ta,
          tb,
          th1,
          th2,
          L1: Math.hypot(b - a, tb - vb),
          L2: Math.hypot(b - a, ta - vb),
          cap: Math.min(Math.cos(th1), Math.cos(th2)),
        });
      }
    }
    spans.sort((p, q) => q.cap - p.cap);
    wl.xb = [];
    for (const sp of spans) {
      if (wl.xb.length >= 2) break;
      if (!wl.xb.some((o) => sp.b > o.a - 0.01 && sp.a < o.b + 0.01)) wl.xb.push(sp);
    }
    const toW = (u: number, v: number): [number, number, number] => {
      const [x, z] = wp(wl, u, 0.2);
      return [x, v, z];
    };
    for (const x of wl.xb) {
      for (const [p0, p1] of [
        [toW(x.a, x.vb), toW(x.b, x.tb)],
        [toW(x.b, x.vb), toW(x.a, x.ta)],
      ]) {
        pipe('structura', MAT.steel, [p0, p1], 0.010);
        const mid = p0.map((c, k) => (c + p1[k]) / 2) as [number, number, number];
        const d = p0.map((c, k) => (p1[k] - c) * 0.06);
        pipe(
          'feronerie',
          MAT.metal,
          [
            [mid[0] - d[0], mid[1] - d[1], mid[2] - d[2]],
            [mid[0] + d[0], mid[1] + d[1], mid[2] + d[2]],
          ],
          0.022,
        );
      }
      for (const [u, v] of [
        [x.a, x.vb],
        [x.b, x.vb],
        [x.a, x.ta],
        [x.b, x.tb],
      ]) {
        wbox('feronerie', MAT.steel, wl, u - (u === x.a ? 0 : 0.16), u + (u === x.a ? 0.16 : 0), v - 0.10, v + 0.10, 0.19, 0.21);
        Q.brk++;
      }
      wl.frame!.push({ k: 'rod', pts: [[x.a, x.vb], [x.b, x.tb]] }, { k: 'rod', pts: [[x.b, x.vb], [x.a, x.ta]] });
      Q.diag += 2;
      Q.rodLen = (Q.rodLen || 0) + x.L1 + x.L2;
      holdDown(wl, x.a, 1);
      holdDown(wl, x.b, -1);
    }
    for (const p of [ps[0], ps[ps.length - 1]]) {
      if (!wl.xb.some((x) => Math.abs(x.a - p.u - p.h) < 0.01 || Math.abs(x.b - p.u + p.h) < 0.01)) {
        holdDown(wl, p === ps[0] ? p.u + p.h : p.u - p.h, p === ps[0] ? 1 : -1);
      }
    }

    const holes = wl.openings.map((o) => ({ u0: o.u0, u1: o.u1, v0: o.type === 'door' ? -9 : o.v0!, v1: o.v1! }));
    const ext = wl.corners ? PL : T;
    Q.plExt += emit('tencuiala', () => MAT.plaster, wl, subtractRects([{ u0: wl.u0 - ext, u1: wl.u1 + ext, v0: FS, v1: 99 }], holes), rake ? roofY : () => F + C.hE - 0.02, -PL, 0);
    // Subtle dark architectural plinth trim along exterior wall base for clean visual grounding
    for (const r of subtractRects([{ u0: wl.u0 - ext, u1: wl.u1 + ext, v0: Y_OSB, v1: FS }], wl.openings.filter((o) => o.type === 'door').map((o) => ({ u0: o.u0, u1: o.u1, v0: -9, v1: 99 })))) {
      wbox('tencuiala', MAT.metal, wl, r.u0, r.u1, Y_BEAM + 0.02, FS, -PL - 0.005, 0.005);
    }
    const iu0 = wl.corners ? wl.u0 + T : wl.u0;
    const iu1 = wl.corners ? wl.u1 - T : wl.u1;
    Q.plInt += emit('tencuiala', () => MAT.plasterInt, wl, subtractRects([{ u0: iu0, u1: iu1, v0: F, v1: 99 }], holes), rake ? (u) => roofY(u) - CEIL : () => roofY(T) - CEIL, T, T + PL);
  }
  WALLS.forEach(buildWall);
  // Corner wall-plate steel L-tie straps (D7: colțar + bandă perforată între cosoroaba N/S și cosoroaba înclinată)
  for (const [cx, cz, sx, sz] of [
    [0.2, 0.2, 1, 1],
    [W - 0.2, 0.2, -1, 1],
    [0.2, L - 0.2, 1, -1],
    [W - 0.2, L - 0.2, -1, -1],
  ]) {
    const yc = plateTop(0.14);
    box('feronerie', MAT.steel, Math.min(cx, cx + sx * 0.24), Math.max(cx, cx + sx * 0.24), yc - 0.03, yc + 0.005, cz - 0.025, cz + 0.025);
    box('feronerie', MAT.steel, cx - 0.025, cx + 0.025, yc - 0.03, yc + 0.005, Math.min(cz, cz + sz * 0.24), Math.max(cz, cz + sz * 0.24));
  }
  G.tencuiala.traverse((m) => {
    m.castShadow = false;
  });
  const [WA, WB, WLw, WRw] = WALLS;

  /* ============================== PEREȚI INTERIORI (5×10 + PLACARE) + POD DE DEPOZITARE ============================== */
  const IWM: THREE.Mesh[] = [];
  for (const iw of IWALLS) {
    const wl = { axis: iw.axis, c: iw.c, dir: 1, ridge: iw.axis === 'z' ? ZR : undefined };
    const lim = iw.top ? () => iw.top! : iw.axis === 'x' ? () => Math.min(roofY(iw.c), roofY(iw.c + 0.10)) - CEIL : (u: number) => roofY(u) - CEIL;
    const holes = iw.doors.map((d) => ({ u0: d[0], u1: d[1], v0: -9, v1: F + DOOR_H }));
    const specs = getInteriorDoorSpecs(iw);
    const pocketZones = specs.flatMap((s) => s.pockets).map((p) => ({ u0: p.p0, u1: p.p1, v0: -9, v1: F + DOOR_H }));

    // 1. Real 5×10 cm C24 timber framing + pocket-door cassettes in 'interiorStr'
    const botSpans = subtractRects([{ u0: iw.u0, u1: iw.u1, v0: F, v1: F + 0.05 }], [...holes, ...pocketZones]);
    let firstPlate: THREE.Mesh | null = null;
    for (const r of botSpans) {
      const m = wbox('interiorStr', MAT.woodDark, wl, r.u0, r.u1, r.v0, r.v1, 0.0125, 0.0875);
      if (!firstPlate) firstPlate = m;
    }
    if (firstPlate) IWM.push(firstPlate);

    // Top plate (segmented at ridge if z-axis)
    const topSegs = iw.axis === 'z' && iw.u0 < ZR && iw.u1 > ZR ? [[iw.u0, ZR], [ZR, iw.u1]] : [[iw.u0, iw.u1]];
    for (const [ua, ub] of topSegs) {
      prism('interiorStr', MAT.woodDark, wl, ua, ub, lim(ua) - 0.05, lim(ub) - 0.05, lim(ua), lim(ub), 0.0125, 0.0875);
    }

    // Vertical studs at ≤ 0.60 m + pocket-door span headers, cassette ribs & cripples
    const studCenters = new Set<number>([iw.u0 + 0.025, iw.u1 - 0.025]);
    const inAnySpan = (u: number) => specs.some((s) => u > s.spanU0 - 0.01 && u < s.spanU1 + 0.01);

    for (const s of specs) {
      const spanU0 = Math.max(iw.u0, s.spanU0);
      const spanU1 = Math.min(iw.u1, s.spanU1);
      // Outer king studs framing the entire opening + pocket cassette(s)
      if (spanU0 - 0.025 >= iw.u0) studCenters.add(spanU0 - 0.025);
      if (spanU1 + 0.025 <= iw.u1) studCenters.add(spanU1 + 0.025);
      // Solid closing-side jamb stud if not a pocket throat
      if (!s.pockets.some((p) => Math.abs(p.p1 - s.u0) < 1e-4)) studCenters.add(s.u0 - 0.025);
      if (!s.pockets.some((p) => Math.abs(p.p0 - s.u1) < 1e-4)) studCenters.add(s.u1 + 0.025);

      // Pocket-door header lintel 5×12 spanning BOTH doorway and pocket cassette(s)
      wbox(
        'interiorStr',
        MAT.woodDark,
        wl,
        Math.max(iw.u0, spanU0 - 0.05),
        Math.min(iw.u1, spanU1 + 0.05),
        F + DOOR_H,
        F + DOOR_H + 0.12,
        0.0125,
        0.0875,
      );

      // Cripple studs above the pocket-door header up to top plate
      const nCrip = Math.max(2, Math.ceil((spanU1 - spanU0) / 0.55) + 1);
      for (let i = 0; i < nCrip; i++) {
        const cu = spanU0 + ((spanU1 - spanU0) * i) / (nCrip - 1);
        const ca = Math.max(iw.u0, cu - 0.025);
        const cb = Math.min(iw.u1, cu + 0.025);
        if (cb - ca > 0.01 && lim(cu) - 0.05 > F + DOOR_H + 0.14) {
          prism('interiorStr', MAT.wood, wl, ca, cb, F + DOOR_H + 0.12, F + DOOR_H + 0.12, lim(ca) - 0.05, lim(cb) - 0.05, 0.0125, 0.0875);
        }
      }

      // Galvanized metal pocket cassette split uprights (leaving 4.6 cm hollow slot inside 0.0125..0.0875)
      for (const p of s.pockets) {
        const nRibs = Math.max(2, Math.ceil((p.p1 - p.p0) / 0.28) + 1);
        for (let i = 0; i < nRibs; i++) {
          const ru = p.p0 + 0.02 + ((p.p1 - p.p0 - 0.04) * i) / (nRibs - 1);
          wbox('interiorStr', MAT.steel, wl, ru - 0.012, ru + 0.012, F, F + DOOR_H, 0.013, 0.027);
          wbox('interiorStr', MAT.steel, wl, ru - 0.012, ru + 0.012, F, F + DOOR_H, 0.073, 0.087);
        }
      }
    }

    const anchors = [...studCenters].sort((a, b) => a - b);
    for (let i = 0; i < anchors.length - 1; i++) {
      const a = anchors[i];
      const b = anchors[i + 1];
      if (inAnySpan((a + b) / 2)) continue;
      if (b - a > 0.62) {
        const n = Math.ceil((b - a) / 0.60);
        for (let k = 1; k < n; k++) studCenters.add(a + (k * (b - a)) / n);
      }
    }
    for (const u of studCenters) {
      if (inAnySpan(u)) continue;
      const ua = Math.max(iw.u0, u - 0.025);
      const ub = Math.min(iw.u1, u + 0.025);
      if (ub - ua < 0.01) continue;
      prism('interiorStr', MAT.wood, wl, ua, ub, F + 0.05, F + 0.05, lim(ua) - 0.05, lim(ub) - 0.05, 0.0125, 0.0875);
    }

    // 2. Double-sided 12.5 mm gypsum-fiber / clay boards in 'interior' (enclosing pocket cassettes)
    const rects = subtractRects([{ u0: iw.u0, u1: iw.u1, v0: F, v1: 99 }], holes);
    const areaA = emit('interior', () => MAT.iwall, wl, rects, lim, 0, 0.0125);
    emit('interior', () => MAT.iwall, wl, rects, lim, 0.0875, 0.10);
    const len = iw.u1 - iw.u0;
    const hAvg = (lim(iw.u0) + lim(iw.u1)) / 2 - F;
    tim('5×10', 2 * len, 'schelet pereți interiori', 'C24', 2);
    const ns = Math.ceil(len / 0.6) + 1 + 2 * iw.doors.length;
    tim('5×10', ns * hAvg, 'schelet pereți interiori', 'C24', ns);
    bom('Pereți interiori', 'Plăci gips-fibră / argilă 12,5 mm (ambele fețe)', 'm²', 2 * areaA);
    bom('Pereți interiori', 'Izolație cânepă / vată 10 cm', 'm²', areaA);

    // 3. Retractable pocket-door tracks, split pocket throat jambs, oak leaves & recessed flush pulls
    for (const s of specs) {
      const hasLeftPocket = s.pockets.some((p) => Math.abs(p.p1 - s.u0) < 1e-4);
      const hasRightPocket = s.pockets.some((p) => Math.abs(p.p0 - s.u1) < 1e-4);

      // Top frame trim + overhead brushed aluminum sliding rail extending into pocket(s)
      wbox('interior', MAT.frame, wl, s.u0, s.u1, F + DOOR_H - 0.04, F + DOOR_H, -0.01, 0.032);
      wbox('interior', MAT.frame, wl, s.u0, s.u1, F + DOOR_H - 0.04, F + DOOR_H, 0.068, 0.11);
      wbox('interior', MAT.steel, wl, s.spanU0 + 0.03, s.spanU1 - 0.03, F + DOOR_H - 0.044, F + DOOR_H - 0.016, 0.034, 0.066);

      // Left jamb (split throat with brush seals if pocket side, else solid closing strike jamb)
      if (hasLeftPocket) {
        wbox('interior', MAT.frame, wl, s.u0, s.u0 + 0.035, F, F + DOOR_H, -0.01, 0.030);
        wbox('interior', MAT.frame, wl, s.u0, s.u0 + 0.035, F, F + DOOR_H, 0.070, 0.11);
        wbox('interior', MAT.metal, wl, s.u0 + 0.002, s.u0 + 0.032, F, F + DOOR_H - 0.04, 0.030, 0.034);
        wbox('interior', MAT.metal, wl, s.u0 + 0.002, s.u0 + 0.032, F, F + DOOR_H - 0.04, 0.066, 0.070);
      } else {
        wbox('interior', MAT.frame, wl, s.u0, s.u0 + 0.04, F, F + DOOR_H, -0.01, 0.11);
        wbox('interior', MAT.steel, wl, s.u0 + 0.036, s.u0 + 0.043, F + 0.94, F + 1.06, 0.042, 0.058);
      }

      // Right jamb (split throat with brush seals if pocket side, else solid closing strike jamb)
      if (hasRightPocket) {
        wbox('interior', MAT.frame, wl, s.u1 - 0.035, s.u1, F, F + DOOR_H, -0.01, 0.030);
        wbox('interior', MAT.frame, wl, s.u1 - 0.035, s.u1, F, F + DOOR_H, 0.070, 0.11);
        wbox('interior', MAT.metal, wl, s.u1 - 0.032, s.u1 - 0.002, F, F + DOOR_H - 0.04, 0.030, 0.034);
        wbox('interior', MAT.metal, wl, s.u1 - 0.032, s.u1 - 0.002, F, F + DOOR_H - 0.04, 0.066, 0.070);
      } else {
        wbox('interior', MAT.frame, wl, s.u1 - 0.04, s.u1, F, F + DOOR_H, -0.01, 0.11);
        wbox('interior', MAT.steel, wl, s.u1 - 0.043, s.u1 - 0.036, F + 0.94, F + 1.06, 0.042, 0.058);
      }

      // Sliding oiled-oak door leaf/leaves (partially retracted into wall slot so clearly visible & walkable)
      for (const p of s.pockets) {
        wbox('interior', MAT.woodDark, wl, p.leafU0, p.leafU1, F + 0.008, F + DOOR_H - 0.048, 0.035, 0.065);
        const leadU = p.slideDir < 0 ? p.leafU1 : p.leafU0;
        const handleC = leadU + (p.slideDir < 0 ? -0.055 : 0.055);
        // Leading-edge dark edge pull + recessed flush pocket pulls on both sides
        wbox('interior', MAT.metal, wl, leadU - 0.004, leadU + 0.004, F + 0.95, F + 1.05, 0.041, 0.059);
        wbox('interior', MAT.metal, wl, handleC - 0.018, handleC + 0.018, F + 0.93, F + 1.07, 0.032, 0.036);
        wbox('interior', MAT.metal, wl, handleC - 0.018, handleC + 0.018, F + 0.93, F + 1.07, 0.064, 0.068);
      }

      const kindLabel = s.pockets.length === 2 ? 'casetă 2 foi simetrice' : 'casetă 1 foaie';
      bom(
        'Tâmplărie',
        `Ușă interioară retractabilă în perete (${kindLabel}), ${Math.round((s.u1 - s.u0) * 100)} × 205 cm`,
        'buc',
        1,
      );
    }
  }
  {
    const { x0, x1, z0, z1, y } = LOFT;
    box('interior', MAT.ceiling, x0, x1, y - 0.02, y, z0, z1);
    box('interior', MAT.osb, x0, x1, y + 0.15, y + 0.172, z0, z1);
    const nj = Math.ceil((z1 - z0) / 0.5) + 1;
    for (let i = 0; i < nj; i++) {
      const z = z0 + (i * (z1 - z0 - 0.05)) / (nj - 1);
      box('interiorStr', MAT.wood, x0, x1, y, y + 0.15, z, z + 0.05);
    }
    box('interiorStr', MAT.frame, 5.65, 6.35, y - 0.03, y - 0.02, 7.05, 7.65);
    tim('5×15', nj * (x1 - x0), 'grinzișoare pod depozitare');
    bom('Plăci', 'OSB3 22 mm (podina podului de depozitare)', 'm²', (x1 - x0) * (z1 - z0));
    bom('Pereți interiori', 'Chepeng izolat 70×60 cm cu scară escamotabilă', 'buc', 1);
  }

  /* ============================== ACOPERIȘ ============================== */
  const RAF: { N: { i: number; x: number; web: THREE.Mesh; bot: THREE.Mesh }[]; S: { i: number; x: number; web: THREE.Mesh; bot: THREE.Mesh }[] } = { N: [], S: [] };
  const ridgeBeam = box('coama', MAT.glulam, XL, XR, yRBb, yRB, ZR - RIDGE.b / 2, ZR + RIDGE.b / 2);
  const BEV = [-1, 1].map((s) =>
    hexa('coama', MAT.glulam, WORLD, (fx, fy, fz) => [XL + (XR - XL) * fx, yRB + fy * fz * (yApex - yRB), ZR + s * (RIDGE.b / 2) * (1 - fz)]),
  );
  tim(`${Math.round(RIDGE.b * 100)}×${Math.round(RIDGE.h * 100)}`, XR - XL, 'pană de coamă (o bucată)', 'GL24h');
  for (const wl of [WLw, WRw]) {
    for (const s of [-1, 1]) {
      wbox('feronerie', MAT.steel, wl, ZR + (s * RIDGE.b) / 2 - (s > 0 ? 0 : 0.006), ZR + (s * RIDGE.b) / 2 + (s > 0 ? 0.006 : 0), yRBb - 0.22, yRBb + 0.25, 0.10, 0.30);
      Q.brk++;
    }
    // 4 M16 bolts piercing the ridge post splice plates (D6)
    for (const [uz, vy] of [[-0.055, yRBb - 0.14], [0.055, yRBb - 0.04], [-0.055, yRBb + 0.09], [0.055, yRBb + 0.18]]) {
      const [bx, bz] = wp(wl, ZR + uz, 0.2);
      const bm = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.24, 8), MAT.steel);
      bm.rotation.z = Math.PI / 2;
      bm.position.set(bx, vy, bz);
      G.feronerie.add(bm);
    }
    // Beam hangers (papuci de grindă) where inclined gable wall plates join ridge beam (D6)
    for (const s of [-1, 1]) {
      const za = ZR + s * (RIDGE.b / 2);
      const zb = ZR + s * (RIDGE.b / 2 + 0.07);
      wbox('feronerie', MAT.steel, wl, Math.min(za, zb), Math.max(za, zb), yRB - 0.20, yRB - 0.04, 0.135, 0.265);
    }
  }
  for (const side of ['N', 'S'] as const) {
    for (let i = 0; i < RX.length; i++) {
      const x0 = RX[i] - JW / 2;
      const za = -C.ovE;
      const zb = ZR;
      const len = (zb - za) / COS;
      const web = sl(side, 'acopStr', MAT.osb, za, zb, 0, 0.40, x0, x0 + 0.012);
      const bot = sl(side, 'acopStr', MAT.wood, za, zb, 0, 0.095, x0 + 0.012, x0 + JW);
      sl(side, 'acopStr', MAT.wood, za, zb, 0.305, 0.40, x0 + 0.012, x0 + JW);
      // Web bearing stiffeners (montanți de capăt/reazem) over wall plates, ridge, and eave tail
      for (const [sz0, sz1] of [[-C.ovE, -C.ovE + 0.055], [0.16, 0.24], [ZR - 0.22, ZR - 0.14]]) {
        sl(side, 'acopStr', MAT.woodDark, sz0, sz1, 0.095, 0.305, x0 + 0.012, x0 + JW);
      }
      for (const [a, b] of [
        [x0 - 0.018, x0],
        [x0 + JW, x0 + JW + 0.018],
      ]) {
        sl(side, 'acopStr', MAT.osb, ZR - 0.36, ZR, 0.04, 0.36, a, b);
      }
      sl(side, 'feronerie', MAT.steel, 0.12, 0.30, -0.10, 0.09, x0 + JW, x0 + JW + 0.003);
      Q.anchors++;
      sl(side, 'invelitoare', MAT.woodLight, -C.ovE, ZR, 0.412, 0.462, RX[i] - 0.025, RX[i] + 0.025);
      tim('4,5×9,5', 2 * len, 'tălpi căpriori-scară', 'C24', 2);
      tim('5×5', len, 'contra-șipci ventilație');
      Q.chord += 2 * len;
      Q.rafters++;
      bom('Plăci', 'OSB3 12 mm (inimi grinzi-scară, fâșii de 40 cm)', 'm²', len * 0.40);
      RAF[side].push({ i, x: RX[i], web, bot });
    }
    // Gable overhang ladder outriggers (traverse consolă fronton) connecting outer barge rafters back to gable wall rafters
    for (const [xa, xb] of [
      [RX[0] + JW / 2, RX[1] - JW / 2],
      [RX[NRB + 1] + JW / 2, RX[NRB + 2] - JW / 2],
    ]) {
      for (const zOut of [-0.45, 0.65, 1.85, 3.05, 4.25, 5.30]) {
        sl(side, 'acopStr', MAT.woodDark, zOut, zOut + 0.045, 0.21, 0.305, xa, xb);
        tim('4,5×9,5', xb - xa, 'traverse consolă fronton');
      }
    }
    // Roof slope diagonal wind-bracing straps (bandă perforată 40×2 mm în X pe fiecare versant)
    for (const [bx0, bx1] of [[0.50, 3.30], [3.90, 6.70]]) {
      for (const [za, zb] of [[0.30, ZR - 0.30], [ZR - 0.30, 0.30]]) {
        const dx = bx1 - bx0;
        const dz = (zb - za) / COS;
        const l = Math.hypot(dx, dz);
        const nx = (0.02 * dz) / l;
        const nz = (-0.02 * dx) / l;
        hexa('feronerie', MAT.steel, WORLD, (fx, fy, fz) => {
          const xc = bx0 + dx * fx + (fz - 0.5) * 2 * nx;
          const zzc = za + (zb - za) * fx + (fz - 0.5) * 2 * nz * COS;
          return [xc, slY(zzc, 0.400 + fy * 0.004), side === 'N' ? zzc : L - zzc];
        });
      }
    }
    for (let i = 1; i <= NRB; i++) {
      const xa = RX[i] + JW / 2;
      const xb = RX[i + 1] - JW / 2;
      sl(side, 'acopStr', MAT.osb, -0.018, 0, 0, 0.40, xa, xb);
      const cSide = C.chim.z < ZR ? 'N' : 'S';
      const cz = cSide === 'N' ? C.chim.z : L - C.chim.z;
      const chim = side === cSide && C.chim.x > xa && C.chim.x < xb ? [cz - 0.32, Math.min(cz + 0.32, ZR - 0.01)] : null;
      if (chim) sl(side, 'paieAcop', MAT.mwool, chim[0], chim[1], 0.004, 0.396, xa + 0.004, xb - 0.004);
      let z = 0;
      let k = i % 2 ? 0.5 : 1.0;
      while (z < ZR - 0.01) {
        const e = Math.min(z + k * COS, ZR);
        const segs = chim
          ? subtractRects([{ u0: z, u1: e, v0: 0, v1: 1 }], [{ u0: chim[0], u1: chim[1], v0: -1, v1: 2 }]).map((r) => [r.u0, r.u1])
          : [[z, e]];
        for (const [a, b] of segs) {
          sl(side, 'paieAcop', straw(), a + 0.004, b - 0.004, 0.004, 0.396, xa + 0.004, xb - 0.004);
          Q.baleRoof += (b - a) / COS / C.baleLen;
        }
        z = e;
        k = 1.0;
      }
    }
    sl(side, 'tavan', MAT.ceiling, T, ZR - RIDGE.b / 2, -CEIL, -CEIL + 0.02, T, W - T);
    // 4×5 cm ceiling furring battens (lăți de instalații 4 cm, D4) placed AFTER ceiling mesh so G.tavan.children[0] stays intact
    for (let zb = T + 0.25; zb < ZR - RIDGE.b / 2 - 0.05; zb += 0.50 * COS) {
      sl(side, 'tavan', MAT.woodLight, zb, zb + 0.05 * COS, -0.04, 0, T, W - T);
    }
    sl(side, 'invelitoare', MAT.woodLight, -C.ovE, 0, -0.02, 0, RX[1], RX[NRB + 1]);
    for (const [a, b] of [
      [RX[0] + JW / 2, RX[1] - JW / 2],
      [RX[NRB + 1] + JW / 2, RX[NRB + 2] - JW / 2],
    ]) {
      sl(side, 'invelitoare', MAT.woodLight, -C.ovE, ZR, -0.02, 0, a, b);
    }
    sl(side, 'invelitoare', MAT.woodDark, -C.ovE - 0.024, -C.ovE, -0.01, 0.49, XL, XR);
    sl(side, 'invelitoare', MAT.woodDark, -C.ovE, ZR, -0.01, 0.49, XL - 0.024, XL);
    sl(side, 'invelitoare', MAT.woodDark, -C.ovE, ZR, -0.01, 0.49, XR, XR + 0.024);
    sl(side, 'invelitoare', MAT.osb, -C.ovE, ZR, 0.40, 0.412, XL, XR);
    sl(side, 'invelitoare', MAT.woodLight, -C.ovE, ZR, 0.462, 0.486, XL, XR);
    sl(side, 'invelitoare', MAT.metal, -C.ovE - 0.04, ZR, 0.486, 0.492, XL - 0.04, XR + 0.04);
    for (let x = XL; x <= XR + 0.01; x += 0.52) sl(side, 'invelitoare', MAT.metal, -C.ovE - 0.04, ZR, 0.492, 0.517, x - 0.006, x + 0.006);
    sl(side, 'invelitoare', MAT.metal, ZR - 0.22, ZR, 0.53, 0.55, XL - 0.04, XR + 0.04);
    const zg = side === 'N' ? -C.ovE - 0.10 : L + C.ovE + 0.10;
    const yg = slY(-C.ovE, 0.40) - 0.03;
    const gut = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, XR - XL + 0.1, 16, 1, true, Math.PI, Math.PI), MAT.metal);
    gut.rotation.z = Math.PI / 2;
    gut.position.set((XL + XR) / 2, yg, zg);
    G.invelitoare.add(gut);
    for (const x of [XL + 0.25, XR - 0.25]) cyl('invelitoare', MAT.metal, x, zg, 0.05, 0.10, yg - 0.05, 12);
  }
  for (const s of [0.53, 0.60]) sl('S', 'invelitoare', MAT.steel, 0.08, 0.11, s, s + 0.03, XL + 0.2, XR - 0.2);
  Q.osbArea += roofArea;

  /* ============================== TERASE ============================== */
  let terrPile: { c: THREE.Mesh; x: number; z: number; b: THREE.Mesh } | null = null;
  {
    const t = C.terrace;
    const lay = 'terasa';
    const x0 = 0;
    const x1 = W;
    const z0 = L + PL + 0.015;
    const z1 = z0 + t.depth;
    const yT = F - 0.03;
    const yJ = yT - 0.028;
    const yB = yJ - 0.15;
    const hP = yB - 0.20;
    const rail = (xa: number, xb: number, za: number, zb: number) => {
      for (const y of [yT + 0.45, yT + 0.95]) box(lay, MAT.woodLight, xa, xb, y, y + 0.095, za, zb);
      tim('4,5×9,5', 2 * Math.max(xb - xa, zb - za), 'balustradă terase', 'C24', 2);
    };
    const post = (x: number, z: number) => {
      box(lay, MAT.wood, x, x + 0.09, yT - 0.15, yT + 1.0, z, z + 0.09);
      tim('9×9', 1.25, 'stâlpi balustradă');
    };
    const tb: THREE.Mesh[] = [];
    for (const z of [z0 + 0.65, (z0 + 0.65 + z1 - 0.20) / 2, z1 - 0.20]) {
      tb.push(box(lay, MAT.woodDark, x0, x1, hP, yB, z - 0.05, z + 0.05));
      tim('10×20', W, 'grinzi terase');
      for (const x of [0.15, 1.875, 3.6, 5.325, W - 0.15]) {
        const c = pile(x, z, hP, lay);
        if (!terrPile) terrPile = { c, x, z, b: tb[tb.length - 1] };
      }
    }
    const nj = Math.ceil(W / 0.5);
    for (let i = 0; i <= nj; i++) {
      const x = x0 + (i * (W - 0.05)) / nj;
      box(lay, MAT.wood, x, x + 0.05, yB, yJ, z0, z1);
      tim('5×15', t.depth, 'grinzișoare terase');
      Q.tJoists++;
    }
    for (let z = z0; z < z1 - 0.05; z += 0.15) {
      box(lay, MAT.deck, x0, x1, yJ, yT, z, Math.min(z + 0.145, z1));
      Q.deckBoards++;
    }
    let deckM = Q.deckBoards * W;
    const sx0 = 3.11;
    const sx1 = 5.11;
    stairs(lay, { axis: 'z', c: sx0, dir: 1 }, sx1 - sx0, z1, yT);
    const a0 = W + PL + 0.015;
    const a1 = a0 + t.sideDepth;
    const c0 = t.sideZ0;
    const c1 = z0 + t.sideDepth + 0.1;
    const sl2 = c1 - c0;
    for (const x of [a0 + 0.55, a1 - 0.15]) {
      box(lay, MAT.woodDark, x - 0.05, x + 0.05, hP, yB, c0, c1);
      tim('10×20', sl2, 'grinzi terase');
      for (let k = 0; k < 5; k++) pile(x, c0 + 0.12 + (k * (sl2 - 0.27)) / 4, hP, lay);
    }
    const ns = Math.ceil(sl2 / 0.5);
    for (let i = 0; i <= ns; i++) {
      const z = c0 + (i * (sl2 - 0.05)) / ns;
      box(lay, MAT.wood, a0, a1, yB, yJ, z, z + 0.05);
      tim('5×15', t.sideDepth, 'grinzișoare terase');
      Q.tJoists++;
    }
    let nb = 0;
    for (let x = a0; x < a1 - 0.05; x += 0.15) {
      box(lay, MAT.deck, x, Math.min(x + 0.145, a1), yJ, yT, c0, c1);
      nb++;
    }
    box(lay, MAT.deck, W, a0, yJ, yT, z0, c1);
    deckM += nb * sl2 + 2;

    const ramp = (uTop: number, dir: number) => {
      const wl = { axis: 'z' as const, c: a0, dir: 1 };
      const wd = t.sideDepth;
      const { yT: hT, lo, rise, fl, land } = RAMP;
      const hMid = hT - rise / 2;
      const parts = land > 0 ? [[0, fl, hT, hMid], [fl, fl + land, hMid, hMid], [fl + land, 2 * fl + land, hMid, lo]] : [[0, RAMP.total, hT, lo]];
      let hyp = 0;
      let nSup = 0;
      let nPosts = 0;
      for (const [s0, s1, h0, h1] of parts) {
        const u0 = uTop + dir * s0;
        const u1 = uTop + dir * s1;
        const a = Math.min(u0, u1);
        const b = Math.max(u0, u1);
        const tA = u0 < u1 ? h0 : h1;
        const tB = u0 < u1 ? h1 : h0;
        const len = b - a;
        const topAt = (u: number) => tA + ((tB - tA) * (u - a)) / len;
        prism(lay, MAT.deck, wl, a, b, tA - 0.06, tB - 0.06, tA, tB, 0, wd);
        for (const w of [0.02, wd - 0.07]) {
          prism(lay, MAT.woodDark, wl, a, b, Math.max(tA - 0.28, 0), Math.max(tB - 0.28, 0), tA - 0.06, tB - 0.06, w, w + 0.05);
        }
        // Bottom entry piles (clear of NE house corner by ~1.97 m)
        const uFoot = a + 0.12;
        for (const w of [0.05, wd - 0.07]) {
          const [px, pz] = wp(wl, uFoot, w);
          pile(px, pz, 0.03, lay);
        }
        // 3 intermediate transverse cross-headers on non-colliding pile lines (x = a0+0.55 and a1-0.15); top of ramp bears on East terrace head beam
        for (const u of [0.65, 2.65, 4.65]) {
          const yBot = Math.max(topAt(u) - 0.28, 0.11);
          wbox(lay, MAT.woodDark, wl, u - 0.05, u + 0.05, yBot - 0.06, yBot + 0.06, 0.01, wd - 0.01);
          tim('10×12', wd, 'traverse reazem rampă');
          for (const w of [0.55, wd - 0.15]) {
            const [px, pz] = wp(wl, u, w);
            const yc = Math.min(0.15, yBot - 0.06);
            pile(px, pz, yc, lay);
            if (yBot - 0.06 - yc > 0.03) {
              box(lay, MAT.woodDark, px - 0.045, px + 0.045, yc, yBot - 0.06, pz - 0.045, pz + 0.045);
              nSup++;
            }
          }
        }
        const nP = Math.max(2, Math.ceil(len / 1.2) + 1);
        for (const w of [0, wd - 0.09]) {
          for (let i = 0; i < nP; i++) {
            const u = a + 0.045 + ((len - 0.09) * i) / (nP - 1);
            wbox(lay, MAT.wood, wl, u - 0.045, u + 0.045, Math.max(topAt(u) - 0.1, 0), topAt(u) + 1.0, w, w + 0.09);
          }
          for (const h of [0.45, 0.95]) {
            prism(lay, MAT.woodLight, wl, a, b, tA + h, tB + h, tA + h + 0.095, tB + h + 0.095, w + 0.02, w + 0.07);
          }
        }
        nPosts += 2 * nP;
        hyp += Math.hypot(len, tB - tA);
      }
      tim('9×9', nPosts * 1.15, 'stâlpi balustradă rampe');
      tim('4,5×9,5', 4 * hyp, 'balustradă rampe', 'C24', 4);
      tim('5×25', 2 * hyp, 'vanguri rampe', 'C24', 2);
      tim('9×9', nSup * 0.6, 'stâlpi de sprijin rampe');
      bom(
        'Terasă și trepte',
        'Dușumea terase 2,8×14,5 cm (rampe de acces, antiderapantă)',
        'm',
        (hyp * wd) / 0.15,
        `rampă de ${RAMP.total.toFixed(1).replace('.', ',')} m, pantă ${Math.round(RAMP.slope * 100)} % (1:${Math.round(1 / RAMP.slope)}), fără palier`,
      );
      return hyp;
    };
    ramp(c0, -1);
    stairs(lay, { axis: 'z', c: a0, dir: 1 }, t.sideDepth, c1, yT);
    for (let k = 0; k < 5; k++) post(a1 - 0.09, c0 + (k * (sl2 - 0.09)) / 4);
    rail(a1 - 0.085, a1 - 0.04, c0, c1);
    post(W - 0.09, c1);
    post(W - 0.09, (c1 + z1) / 2);
    post(W - 0.09, z1 - 0.09);
    rail(W - 0.085, W - 0.04, c1, z1);
    for (const x of [0, 1.55, sx0 - 0.09, sx1, 6.15]) post(x, z1 - 0.09);
    rail(x0, sx0, z1 - 0.05, z1 - 0.005);
    rail(sx1, x1, z1 - 0.05, z1 - 0.005);
    post(0, z0);
    post(0, z0 + t.depth / 2);
    rail(0.005, 0.05, z0, z1);

    // Attractive terrace lounge ensemble (outdoor wooden bench + coffee table on SW side, clear of S-center door stairs)
    const loungeMat = MAT.woodDark;
    const cushionMat = new THREE.MeshStandardMaterial({ color: 0xd9d2c5, roughness: 0.9, clippingPlanes: [clipPlane] });
    const plantLeafMat = new THREE.MeshStandardMaterial({ color: 0x4b7433, roughness: 0.85, clippingPlanes: [clipPlane] });
    const potTerraMat = new THREE.MeshStandardMaterial({ color: 0xb6673d, roughness: 0.78, clippingPlanes: [clipPlane] });
    // South-west terrace lounge sofa + low table (clear of 3.35..4.87 terrace door)
    box(lay, loungeMat, 1.00, 2.70, yT, yT + 0.34, z0 + 0.55, z0 + 1.30);
    box(lay, cushionMat, 1.05, 2.65, yT + 0.34, yT + 0.44, z0 + 0.60, z0 + 1.25);
    box(lay, cushionMat, 1.05, 2.65, yT + 0.34, yT + 0.72, z0 + 0.55, z0 + 0.72);
    box(lay, loungeMat, 1.35, 2.35, yT + 0.36, yT + 0.40, z0 + 1.65, z0 + 2.35);
    for (const [lx, lz] of [[1.40, z0 + 1.70], [2.30, z0 + 1.70], [1.40, z0 + 2.30], [2.30, z0 + 2.30]]) {
      box(lay, loungeMat, lx - 0.025, lx + 0.025, yT, yT + 0.36, lz - 0.025, lz + 0.025);
    }
    // Planter pots flanking south terrace stairs
    for (const px of [sx0 - 0.32, sx1 + 0.32]) {
      cyl(lay, potTerraMat, px, z1 - 0.35, 0.22, yT, yT + 0.40, 14);
      const bush = new THREE.Mesh(new THREE.DodecahedronGeometry(0.28, 1), plantLeafMat);
      bush.position.set(px, yT + 0.55, z1 - 0.35);
      bush.scale.set(1, 1.15, 1);
      bush.castShadow = true;
      G[lay].add(bush);
    }

    bom(
      'Terasă și trepte',
      'Dușumea terase 2,8×14,5 cm (larice/termolemn), cu rost 5 mm',
      'm',
      deckM,
      `terasa mare ${Q.deckBoards} rânduri × ${W} m; terasa mică ${nb} rânduri × ${sl2.toFixed(2)} m`,
    );
    bom('Terasă și trepte', 'Suprafață terasă mare (informativ)', 'm²', t.depth * W);
    bom('Terasă și trepte', 'Suprafață terasă mică (informativ)', 'm²', t.sideDepth * sl2);
    if (terrPile) contact('Terase', 'pilon terasă ↔ grinda 10×20', terrPile.b, terrPile.c, terrPile.x, 0, terrPile.z);
  }

  /* ============================== TEREN 10 × 100 m & PEISAJ NATURAL ============================== */
  const TREES: { x: number; z: number; h: number; r: number; layer: string }[] = [];
  const TRUNK = new THREE.MeshStandardMaterial({ color: 0x62452b, roughness: 0.92, clippingPlanes: [clipPlane] });
  const LEAF = new THREE.MeshStandardMaterial({ color: 0x4c7733, roughness: 0.88, clippingPlanes: [clipPlane] });
  const LEAF2 = new THREE.MeshStandardMaterial({ color: 0x5d8b3c, roughness: 0.88, clippingPlanes: [clipPlane] });
  const LAVENDER = new THREE.MeshStandardMaterial({ color: 0x7a659e, roughness: 0.9, clippingPlanes: [clipPlane] });

  // Multi-part organic tree helper (trunk + 3 canopy clusters) for natural silhouettes
  function addOrganicTree(layer: string, x: number, z: number, h: number, r: number, mat: THREE.Material) {
    const grp = new THREE.Group();
    const trunkH = h * 0.42;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.05, r * 0.09, trunkH, 8), TRUNK);
    trunk.position.set(x, trunkH / 2, z);
    trunk.castShadow = true;
    grp.add(trunk);
    const offsets: [number, number, number, number][] = [
      [0, h - r * 0.9, 0, 1.0],
      [-r * 0.42, h - r * 1.15, r * 0.25, 0.72],
      [r * 0.38, h - r * 1.05, -r * 0.25, 0.76],
    ];
    offsets.forEach(([ox, oy, oz, sc], idx) => {
      const m = new THREE.Mesh(new THREE.DodecahedronGeometry(r * sc, 1), idx === 1 ? LEAF2 : mat);
      m.position.set(x + ox, oy, z + oz);
      m.scale.y = 0.88;
      m.rotation.y = idx * 1.1;
      m.castShadow = m.receiveShadow = true;
      grp.add(m);
    });
    G[layer].add(grp);
    TREES.push({ x, z, h, r, layer });
  }

  {
    const lay = 'teren';
    const { x0, x1, z0, z1 } = SITE;
    const soil = new THREE.MeshStandardMaterial({ color: 0x5c442e, roughness: 0.98, clippingPlanes: [clipPlane] });
    const fen = new THREE.MeshStandardMaterial({ color: 0x957245, roughness: 0.85, clippingPlanes: [clipPlane] });
    const veg = new THREE.MeshStandardMaterial({ color: 0x588f3b, roughness: 0.92, clippingPlanes: [clipPlane] });
    const flat = (mat: THREE.Material, xa: number, xb: number, za: number, zb: number, y = 0.02) => {
      const m = box(lay, mat, xa, xb, 0, y, za, zb);
      m.castShadow = false;
      return m;
    };
    XRAY.push(MAT.gravel, MAT.lawn);
    const lw = flat(MAT.lawn, x0, x1, z0, z1, 0.012);
    lw.receiveShadow = true;

    const fence = (xa: number, xb: number, za: number, zb: number) => {
      const alongZ = Math.abs(zb - za) > Math.abs(xb - xa);
      const len = alongZ ? zb - za : xb - xa;
      const n = Math.max(1, Math.round(len / 2.5));
      box(lay, fen, xa - (alongZ ? 0.015 : 0), xb + (alongZ ? 0.015 : 0), 0.15, 1.6, za - (alongZ ? 0 : 0.015), zb + (alongZ ? 0 : 0.015));
      for (let i = 0; i <= n; i++) {
        const u = (i * len) / n;
        const x = alongZ ? xa : xa + u;
        const z = alongZ ? za + u : za;
        box(lay, MAT.woodDark, x - 0.05, x + 0.05, 0, 1.7, z - 0.05, z + 0.05);
      }
    };
    fence(x0, x0, z0, z1);
    fence(x1, x1, z0, z1);
    fence(x0, x1, z1, z1);

    const red = new THREE.MeshStandardMaterial({ color: 0xa2282a, roughness: 0.55, metalness: 0.25, clippingPlanes: [clipPlane] });
    const white = new THREE.MeshStandardMaterial({ color: 0xe9e6dd, roughness: 0.85, clippingPlanes: [clipPlane] });
    box(lay, red, x0, GATE.x0, 0.15, 1.5, z0 - 0.015, z0 + 0.015);
    for (const x of [x0, GATE.x0 - 0.12, GATE.x1]) box(lay, white, x, x + 0.14, 0, 1.75, z0 - 0.07, z0 + 0.07);
    box(lay, red, GATE.x0 + 0.02, GATE.x0 + 0.62, 0.05, 1.6, z0 - 0.02, z0 + 0.02);
    box(lay, red, GATE.x0 + 0.64, GATE.x1 - 0.02, 0.05, 1.6, z0 - 0.02, z0 + 0.02);
    box(lay, white, GATE.x1 + 0.14, x1, 0.0, 0.45, z0 - 0.06, z0 + 0.06);
    box(lay, white, GATE.x1 + 0.14, x1, 0.45, 1.3, z0 - 0.03, z0 + 0.03);
    for (let x = GATE.x1 + 1.5; x < x1; x += 1.5) box(lay, white, x - 0.08, x + 0.08, 0, 1.45, z0 - 0.08, z0 + 0.08);
    flat(new THREE.MeshStandardMaterial({ color: 0x52555a, roughness: 0.92, clippingPlanes: [clipPlane] }), x0 - 15, x1 + 15, z0 - 6.0, z0 - 0.4, 0.015);

    // Gravel driveway & stepping stone paths
    flat(MAT.gravel, GATE.x0 + 0.1, GATE.x1, z0, yz(-5.4));
    flat(MAT.gravel, -0.3, x1 - 0.2, yz(-5.4), -0.6);
    flat(MAT.gravel, W + 0.25, x1 - 0.25, -0.6, C.terrace.sideZ0 - 1.15);
    flat(MAT.gravel, 2.9, 5.2, L + C.terrace.depth + 1.2, L + C.terrace.depth + 3.0);
    flat(MAT.gravel, 4.0, 4.8, L + C.terrace.depth + 3.0, 52);

    // Natural stone stepping pavers leading from south stairs into the garden
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0xc2bcb0, roughness: 0.85, clippingPlanes: [clipPlane] });
    for (let i = 0; i < 6; i++) {
      const sz = L + C.terrace.depth + 3.4 + i * 0.85;
      const sx = 4.4 + Math.sin(i * 0.8) * 0.2;
      box(lay, stoneMat, sx - 0.35, sx + 0.35, 0.01, 0.04, sz - 0.24, sz + 0.24);
    }

    // Lavender & ornamental shrub border along the south terrace edge (low height <= 0.55m, zero PV shading)
    const addShrubCluster = (cx: number, cz: number, seed: number, isLavender: boolean) => {
      const puffs = 3;
      for (let p = 0; p < puffs; p++) {
        const ang = seed * 1.7 + p * 2.1;
        const dist = p === 0 ? 0 : 0.11 + ((seed * 7 + p) % 5) * 0.015;
        const rad = (p === 0 ? 0.21 : 0.14) + ((seed + p * 3) % 4) * 0.015;
        const m = new THREE.Mesh(
          new THREE.DodecahedronGeometry(rad, 1),
          isLavender ? (p === 2 ? veg : LAVENDER) : p === 0 ? LEAF2 : veg,
        );
        m.position.set(cx + Math.cos(ang) * dist, rad * 0.72, cz + Math.sin(ang) * dist);
        m.scale.set(1.08, 0.78 + ((seed + p) % 3) * 0.08, 0.96);
        m.rotation.set(p * 0.3, ang, p * 0.2);
        m.castShadow = m.receiveShadow = true;
        G[lay].add(m);
      }
    };
    for (let i = 0; i < 6; i++) {
      const lx = 0.48 + i * 0.41 + ((i % 2) * 0.06 - 0.03);
      const lz = L + C.terrace.depth + 0.52 + (i % 3) * 0.07;
      addShrubCluster(lx, lz, i + 1, i % 2 === 0);
    }
    for (let i = 0; i < 4; i++) {
      const lx = 5.42 + i * 0.44 + ((i % 2) * 0.05 - 0.02);
      const lz = L + C.terrace.depth + 0.54 + (i % 2) * 0.08;
      addShrubCluster(lx, lz, i + 9, i % 2 === 0);
    }

    // Vegetable raised beds
    for (let i = 0; i < 4; i++) {
      for (const xa of [0.0, 4.6]) {
        const za = 39 + i * 3.1;
        box(lay, soil, xa, xa + 3.3, 0, 0.25, za, za + 1.4);
        for (let k = 0; k < 7; k++) {
          const m = new THREE.Mesh(new THREE.SphereGeometry(0.17, 8, 6), veg);
          m.position.set(xa + 0.35 + k * 0.43, 0.33, za + 0.45 + (k % 2) * 0.5);
          G[lay].add(m);
        }
      }
    }

    // Distant village trees outside plot & far to the north/sides so skyline feels natural (not blocking south PV sun!)
    const distantTrees: [number, number, number, number][] = [
      [-14, -22, 7.5, 2.8],
      [-24, 6, 8.2, 3.1],
      [-18, 28, 6.8, 2.5],
      [20, -18, 7.8, 2.9],
      [25, 12, 8.5, 3.2],
      [18, 34, 7.0, 2.6],
      [-12, 58, 9.0, 3.4],
      [16, 62, 8.8, 3.3],
      [4, 78, 9.5, 3.6],
    ];
    for (const [tx, tz, th, tr] of distantTrees) {
      addOrganicTree(lay, tx, tz, th, tr, LEAF);
    }

    const sh = new THREE.Shape();
    sh.moveTo(0, -1.6);
    sh.lineTo(0.55, 0.4);
    sh.lineTo(0, 0);
    sh.lineTo(-0.55, 0.4);
    sh.closePath();
    const ar = new THREE.Mesh(new THREE.ShapeGeometry(sh), new THREE.MeshBasicMaterial({ color: 0xb02020, side: THREE.DoubleSide }));
    ar.rotation.x = -Math.PI / 2;
    ar.position.set(SITE.x1 + 2.2, 0.05, -2.5);
    G[lay].add(ar);
  }

  /* ============================== CURTEA EXISTENTĂ ============================== */
  const NEIGH: NeighDef[] = [];
  {
    const lay = 'vecini';
    const wallM = new THREE.MeshStandardMaterial({ color: 0xd5cab0, roughness: 0.9, clippingPlanes: [clipPlane] });
    const roofM = new THREE.MeshStandardMaterial({ color: 0x8f5d42, metalness: 0.28, roughness: 0.58, clippingPlanes: [clipPlane] });
    const glassM = new THREE.MeshStandardMaterial({ color: 0xb9d6e0, transparent: true, opacity: 0.55, roughness: 0.15, clippingPlanes: [clipPlane] });
    const roof = (X0: number, X1: number, Z0: number, Z1: number, eave: number, ridge: number, type: 'hip' | 'gable') =>
      hexa(lay, roofM, WORLD, (fx, fy, fz) => {
        const hw = type === 'hip' ? Math.min((X1 - X0) / 2, (Z1 - Z0) / 2) : 0;
        const xm = (X0 + X1) / 2;
        return [X0 + (X1 - X0) * fz + fy * (xm - (X0 + (X1 - X0) * fz)), eave + fy * (ridge - eave), Z0 + hw * fy + (Z1 - Z0 - 2 * hw * fy) * fx];
      });
    const bldg = (name: string, x0: number, x1: number, z0: number, z1: number, eave: number, ridge: number, type: 'hip' | 'gable', o = 0.4) => {
      box(lay, wallM, x0, x1, 0, eave, z0, z1);
      roof(x0 - o, x1 + o, z0 - o, z1 + o, eave - 0.05, ridge, type);
      NEIGH.push({ name, x0, x1, z0, z1, eave, ridge, own: true });
    };
    bldg('Casa veche (se păstrează)', 4.7, 9.0, yz(-21.0), yz(-12.4), 2.9, 5.6, 'hip');
    box(lay, wallM, 3.55, 4.7, 0, 0.9, yz(-19.6), yz(-12.9));
    box(lay, glassM, 3.55, 3.6, 0.9, 2.3, yz(-19.6), yz(-12.9));
    box(lay, wallM, 3.55, 4.7, 2.3, 2.6, yz(-19.6), yz(-12.9));
    hexa(lay, roofM, WORLD, (fx, fy, fz) => [3.25 + 1.45 * fz, 2.55 + fy * 0.12 + fz * 0.45, yz(-19.9) + 7.3 * fx]);
    NEIGH.push({ name: 'geamlâc', x0: 3.55, x1: 4.7, z0: yz(-19.6), z1: yz(-12.9), own: true });
    bldg('Anexă (bucătărie de vară)', 5.0, 9.0, yz(-11.0), yz(-6.2), 2.5, 3.9, 'hip', 0.3);

    const steelV = new THREE.MeshStandardMaterial({ color: 0x3a3d40, metalness: 0.55, roughness: 0.45, clippingPlanes: [clipPlane] });
    const vine = new THREE.MeshStandardMaterial({ color: 0x558930, roughness: 0.9, clippingPlanes: [clipPlane] });
    const vine2 = new THREE.MeshStandardMaterial({ color: 0x6b9d40, roughness: 0.9, clippingPlanes: [clipPlane] });
    const A = { x0: 0.75, x1: 3.25, z0: yz(-21.6), z1: yz(-14.9), h: 2.4 };
    for (const x of [A.x0, A.x1]) {
      for (let z = A.z0; z <= A.z1 + 0.01; z += (A.z1 - A.z0) / 4) {
        box(lay, steelV, x - 0.03, x + 0.03, 0, A.h, z - 0.03, z + 0.03);
        cyl(lay, TRUNK, x + (x < 2 ? 0.12 : -0.12), z, 0.035, 0, A.h, 6);
      }
    }
    for (const x of [A.x0, A.x1]) box(lay, steelV, x - 0.025, x + 0.025, A.h, A.h + 0.05, A.z0, A.z1);
    for (let z = A.z0; z <= A.z1 + 0.01; z += 0.55) box(lay, steelV, A.x0, A.x1, A.h + 0.05, A.h + 0.08, z - 0.015, z + 0.015);
    let k = 0;
    for (let z = A.z0 + 0.15; z < A.z1; z += 0.42) {
      for (let x = A.x0 + 0.15; x < A.x1; x += 0.42, k++) {
        if (k % 7 === 3) continue;
        const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.26 + (k % 3) * 0.04, 0), k % 2 ? vine : vine2);
        m.scale.y = 0.45;
        m.rotation.y = k;
        m.position.set(x + ((k * 37) % 10) / 50 - 0.1, A.h + 0.18, z + ((k * 53) % 10) / 50 - 0.1);
        m.castShadow = m.receiveShadow = true;
        G[lay].add(m);
      }
    }
    NEIGH.push({ name: 'boltă cu viță de vie', x0: A.x0, x1: A.x1, z0: A.z0, z1: A.z1, vine: true });
  }

  /* ============================== INSTALAȚII ============================== */
  let septicVol = 0;
  let heatArea = 0;
  let heatKw = 0;
  let pvKw = 0;
  const batKwh = 15;
  let nPV = 0;
  const PVP: PvPanelBox[] = [];
  const warmLights: THREE.PointLight[] = [];

  {
    const E = 'instExt';
    const PM = 'instPod';
    const I = 'instInt';
    const EL = 'electric';
    const HT = 'incalzire';
    const CAT = 'Instalații apă și canalizare';
    const CE = 'Instalație electrică și încălzire';
    const mSew = new THREE.MeshStandardMaterial({ color: 0xc9661f, roughness: 0.6, clippingPlanes: [clipPlane] });
    const mCold = new THREE.MeshStandardMaterial({ color: 0x2a6fdb, roughness: 0.5, clippingPlanes: [clipPlane] });
    const mHot = new THREE.MeshStandardMaterial({ color: 0xd23b2a, roughness: 0.5, clippingPlanes: [clipPlane] });
    const mPE = new THREE.MeshStandardMaterial({ color: 0x1b3f8f, roughness: 0.6, clippingPlanes: [clipPlane] });
    const mConc = new THREE.MeshStandardMaterial({ color: 0xb4b1a8, roughness: 0.95, clippingPlanes: [clipPlane] });
    const mIron = new THREE.MeshStandardMaterial({ color: 0x2e3033, metalness: 0.55, roughness: 0.45, clippingPlanes: [clipPlane] });
    const mVent = new THREE.MeshStandardMaterial({ color: 0x8d9399, roughness: 0.6, clippingPlanes: [clipPlane] });
    const mIns = new THREE.MeshStandardMaterial({ color: 0x55595e, roughness: 1, clippingPlanes: [clipPlane] });
    const mLight = new THREE.MeshStandardMaterial({ color: 0xe6c229, roughness: 0.6, clippingPlanes: [clipPlane] });
    const mSock = new THREE.MeshStandardMaterial({ color: 0x2f9e58, roughness: 0.6, clippingPlanes: [clipPlane] });
    const mDC = new THREE.MeshStandardMaterial({ color: 0x8e44ad, roughness: 0.6, clippingPlanes: [clipPlane] });
    const mBox = new THREE.MeshStandardMaterial({ color: 0xf2f2f0, roughness: 0.5, clippingPlanes: [clipPlane] });
    const mBat = new THREE.MeshStandardMaterial({ color: 0x2f4f3a, roughness: 0.5, clippingPlanes: [clipPlane] });
    const mInv = new THREE.MeshStandardMaterial({ color: 0xe9e9e6, roughness: 0.4, clippingPlanes: [clipPlane] });
    const mLamp = new THREE.MeshStandardMaterial({ color: 0xfff6cf, emissive: 0xffd57a, emissiveIntensity: 0.7, roughness: 0.3, clippingPlanes: [clipPlane] });
    const mHeat = new THREE.MeshStandardMaterial({ color: 0xf07a1a, emissive: 0xc04a00, emissiveIntensity: 0.35, clippingPlanes: [clipPlane] });
    const mHeatBase = new THREE.MeshStandardMaterial({ color: 0xb9c0c8, roughness: 0.85, clippingPlanes: [clipPlane] });
    const mAlu = new THREE.MeshStandardMaterial({ color: 0xc8ccd0, metalness: 0.72, roughness: 0.35, clippingPlanes: [clipPlane] });

    const riser = (x: number, z: number, r: number, mat: THREE.Material, yTop: number) => {
      pipe(PM, mIns, [[x, 0.2, z], [x, Y_OSB, z]], r + 0.035);
      return pipe(PM, mat, [[x, 0.15, z], [x, yTop, z]], r);
    };

    const S = C.septic;
    const cx = 5.6;
    const zK = 10.30;
    const zC = -1.2;
    const yc = (z: number) => -0.60 - 0.02 * (zK - z);
    const xh = (S.x0 + S.x1) / 2;
    const yA = yc(zC);
    const yB2 = yA - 0.02 * (cx - xh);
    const yIn = yB2 - 0.02 * (zC - S.z1);
    let l110 = pipe(E, mSew, [[cx, yc(zK), zK], [cx, yA, zC]], 0.055) + pipe(E, mSew, [[cx, yA, zC], [xh, yB2, zC], [xh, yIn, S.z1 + 0.1]], 0.055);
    let l50 = 0;
    const drop = (x: number, z: number, r: number) => {
      const l = pipe(E, mSew, [[x, 0.15, z], [x, yc(z), z], [cx, yc(z), z]], r) + riser(x, z, r, mSew, F - 0.02);
      if (r > 0.04) l110 += l;
      else l50 += l;
    };
    drop(6.45, zK, 0.025);   // scurgere bucătărie
    drop(5.85, 7.95, 0.025); // scurgere mașină de spălat + sifon cameră tehnică
    drop(6.55, 6.25, 0.025); // scurgere duș walk-in
    drop(5.68, 4.95, 0.025); // scurgere lavoar baie
    drop(5.12, 6.40, 0.055); // scurgere WC
    const ventL = pipe(I, mVent, [[6.70, F, 4.95], [6.70, roofY(4.95) + 1.0, 4.95]], 0.045);
    cyl(E, mConc, cx, zC, 0.22, yA - 0.1, 0.04);
    cyl(E, mIron, cx, zC, 0.24, 0.04, 0.07);

    const t = 0.20;
    const yTop = 0.05;
    const yB = yTop - S.depth;
    const lx = S.x1 - S.x0;
    const lz = S.z1 - S.z0;
    box(E, mConc, S.x0, S.x1, yB, yB + t, S.z0, S.z1);
    box(E, mConc, S.x0, S.x0 + t, yB + t, yTop - 0.15, S.z0, S.z1);
    box(E, mConc, S.x1 - t, S.x1, yB + t, yTop - 0.15, S.z0, S.z1);
    box(E, mConc, S.x0 + t, S.x1 - t, yB + t, yTop - 0.15, S.z0, S.z0 + t);
    box(E, mConc, S.x0 + t, S.x1 - t, yB + t, yTop - 0.15, S.z1 - t, S.z1);
    box(E, mConc, S.x0, S.x1, yTop - 0.15, yTop, S.z0, S.z1);
    for (const x of [S.x0 + 0.7, S.x1 - 0.7]) cyl(E, mIron, x, (S.z0 + S.z1) / 2, 0.32, yTop, yTop + 0.04);
    pipe(E, mVent, [[S.x0 + 0.3, yTop, S.z0 + 0.3], [S.x0 + 0.3, 2.2, S.z0 + 0.3]], 0.055);
    const hWall = S.depth - t - 0.15;
    const vConc = lx * lz * (t + 0.15) + 2 * (lx + lz - 2 * t) * t * hWall;
    septicVol = (lx - 2 * t) * (lz - 2 * t) * (hWall - 0.3);

    const Wl = C.well;
    const nRing = Math.ceil(Wl.depth + 0.8);
    const yW = -1.0;
    const rx = 6.55;
    const rz = 7.98;
    const WROUTE: [number, number][] = [[Wl.x, Wl.z], [4.2, Wl.z], [4.2, yz(-5.2)], [rx, yz(-5.2)], [rx, rz]];
    cyl(E, mConc, Wl.x, Wl.z, 0.60, -Wl.depth, 0.80);
    cyl(E, mIron, Wl.x, Wl.z, 0.63, 0.80, 0.86);
    const lPE =
      pipe(E, mPE, [[Wl.x, -Wl.depth + 1, Wl.z], ...WROUTE.map(([x, z]): [number, number, number] => [x, yW, z]), [rx, 0.15, rz]], 0.02) +
      riser(rx, rz, 0.02, mPE, F + 0.35);

    const yCw = F + 0.04;
    const yH = F + 0.10;
    const lCold =
      pipe(I, mCold, [[rx, F + 0.35, rz], [6.70, F + 0.65, 7.60], [6.74, yCw, 7.45], [6.74, yCw, 4.95], [5.68, yCw, 4.95]], 0.012) +
      pipe(I, mCold, [[6.74, yCw, 7.45], [6.74, yCw, 10.30], [6.55, yCw, 10.30]], 0.012) +
      pipe(I, mCold, [[6.72, F + 0.65, 7.45], [6.50, F + 0.65, 7.05]], 0.012);
    const lHot =
      pipe(I, mHot, [[6.45, F + 0.60, 7.12], [6.70, F + 0.60, 7.30], [6.70, yH, 7.30], [6.70, yH, 5.02], [5.72, yH, 5.02]], 0.012) +
      pipe(I, mHot, [[6.70, yH, 7.30], [6.70, yH, 10.38], [6.55, yH, 10.38]], 0.012);

    const cy = (z: number) => roofY(z) - 0.03;
    const J: [number, number] = [5.20, 6.72];
    const cab = (mat: THREE.Material, pts: [number, number, number][]) => pipe(EL, mat, pts, 0.008);
    const ceil = (a: [number, number], b: [number, number]): [number, number, number][] => {
      const p: [number, number, number][] = [[a[0], cy(a[1]), a[1]]];
      if ((a[1] - ZR) * (b[1] - ZR) < 0) p.push([a[0], cy(ZR), ZR]);
      p.push([a[0], cy(b[1]), b[1]], [b[0], cy(b[1]), b[1]]);
      return p;
    };

    // Cameră tehnică – Ansamblu fotovoltaic complet (tablou AC + AAR, invertor hibrid, 3× baterii LiFePO4, tablou protecție DC, canal cablu)
    const mRack = new THREE.MeshStandardMaterial({ color: 0x26292e, metalness: 0.45, roughness: 0.48, clippingPlanes: [clipPlane] });
    const mScreen = new THREE.MeshStandardMaterial({ color: 0x162432, emissive: 0x1e5c4e, emissiveIntensity: 0.45, roughness: 0.25, clippingPlanes: [clipPlane] });
    const mPolyWin = new THREE.MeshStandardMaterial({ color: 0x8ea4b5, transparent: true, opacity: 0.55, roughness: 0.2, clippingPlanes: [clipPlane] });
    const mSpdRed = new THREE.MeshStandardMaterial({ color: 0xc9302c, roughness: 0.4, clippingPlanes: [clipPlane] });
    const mLedOk = new THREE.MeshStandardMaterial({ color: 0x35c46b, emissive: 0x27ae60, emissiveIntensity: 0.9, roughness: 0.3, clippingPlanes: [clipPlane] });

    // 1. Tablou distribuție AC 24 module + AAR transfer rețea/generator (perete nord cameră tehnică)
    box(EL, mBox, 4.98, 5.38, F + 1.24, F + 1.82, 6.665, 6.75);
    box(EL, mRack, 5.02, 5.34, F + 1.32, F + 1.74, 6.745, 6.755);
    box(EL, mSpdRed, 5.27, 5.33, F + 1.62, F + 1.71, 6.75, 6.762);
    // 2. Canal de cabluri PVC orizontal & vertical spre pod
    box(EL, mBox, 4.98, 6.38, F + 1.03, F + 1.10, 6.665, 6.72);
    box(EL, mBox, 5.16, 5.23, F + 1.82, LOFT.y, 6.665, 6.715);
    // 3. Rack ventilat 19" + 3 baterii LiFePO4 48V (total 15 kWh) + bare colectoare DC
    box(EL, mRack, 5.44, 6.06, F + 0.01, F + 0.98, 6.67, 7.05);
    for (let k = 0; k < 3; k++) {
      const by0 = F + 0.05 + k * 0.30;
      box(EL, mBat, 5.47, 6.03, by0, by0 + 0.25, 6.69, 7.035);
      box(EL, mLedOk, 5.51, 5.66, by0 + 0.17, by0 + 0.20, 7.033, 7.042);
      box(EL, mRack, 5.88, 5.99, by0 + 0.14, by0 + 0.21, 7.033, 7.042);
    }
    // 4. Invertor hibrid off-grid 48V 8–10 kW deasupra rack-ului de baterii
    box(EL, mInv, 5.48, 6.02, F + 1.14, F + 1.74, 6.665, 6.86);
    box(EL, mScreen, 5.63, 5.87, F + 1.38, F + 1.54, 6.858, 6.866);
    box(EL, mLedOk, 5.54, 5.58, F + 1.58, F + 1.61, 6.858, 6.866);
    // Cabluri DC de putere (roșu + / negru -) între baterii și invertor
    pipe(EL, mHot, [[5.62, F + 0.96, 6.78], [5.62, F + 1.15, 6.78]], 0.014);
    pipe(EL, mRack, [[5.88, F + 0.96, 6.78], [5.88, F + 1.15, 6.78]], 0.014);
    // 5. Tablou protecție DC fotovoltaic (separator DC, descărcătoare SPD, fuzibile stringuri)
    box(EL, mVent, 6.08, 6.38, F + 1.22, F + 1.66, 6.665, 6.79);
    box(EL, mPolyWin, 6.11, 6.35, F + 1.28, F + 1.60, 6.788, 6.798);
    box(EL, mSpdRed, 6.13, 6.21, F + 1.38, F + 1.52, 6.77, 6.79);
    box(EL, mLight, 6.25, 6.33, F + 1.38, F + 1.52, 6.77, 6.795);

    const plate = (x: number, z: number, ax: 'x' | 'z', y0: number, y1: number, w = 0.045) =>
      ax === 'x' ? box(EL, mBox, x - 0.015, x + 0.015, y0, y1, z - w, z + w) : box(EL, mBox, x - w, x + w, y0, y1, z - 0.015, z + 0.015);
    let lLight = cab(mLight, [[J[0], F + 1.8, J[1]], [J[0], cy(J[1]), J[1]]]);
    let lSock = cab(mSock, [[J[0] + 0.1, F + 1.8, J[1]], [J[0] + 0.1, cy(J[1]), J[1]]]);
    const lamps: [number, number][] = [
      [1.87, 2.55],
      [5.12, 2.55],
      [2.25, 6.65],
      [2.05, 9.85],
      [4.35, 8.80],
      [4.35, 9.58],
      [5.50, 9.60],
      [5.85, 10.55],
      [5.60, 5.65],
      [5.65, 7.40],
    ];
    for (const l of lamps) {
      lLight += cab(mLight, ceil(J, l));
      const yl = inLoft(l[0], l[1]) ? LOFT.y - 0.06 : Math.min(cy(l[1]) - 0.05, F + 2.75);
      if (yl < cy(l[1]) - 0.06) lLight += cab(mLight, [[l[0], cy(l[1]), l[1]], [l[0], yl, l[1]]]);
      cyl(EL, mLamp, l[0], l[1], 0.13, yl - 0.05, yl);
    }
    const extL: [number, number][] = [[4.11, L + 0.06], [W + 0.06, 9.8], [W / 2, -0.06]];
    for (const l of extL) {
      lLight += cab(mLight, ceil(J, [Math.min(l[0], W - 0.45), Math.min(Math.max(l[1], 0.45), L - 0.45)]));
      box(EL, mLamp, l[0] - 0.08, l[0] + 0.08, F + 2.15, F + 2.27, l[1] - 0.08, l[1] + 0.08);
    }

    // 3 warm unshadowed point lights for cozy interior / terrace ambiance at golden hour / dusk
    const lightPositions: [number, number, number][] = [
      [2.2, F + 2.4, 7.6],   // Living + Fireside
      [5.2, F + 2.4, 9.5],   // Enlarged Kitchen + Island
      [4.11, F + 2.2, L + 1.2], // South terrace door
    ];
    for (const [lx, ly, lz] of lightPositions) {
      const pl = new THREE.PointLight(0xffcb80, 0, 10, 1.8);
      pl.position.set(lx, ly, lz);
      G.electric.add(pl);
      warmLights.push(pl);
    }

    const CIRC: [string, [number, number, number][]][] = [
      ['Prize dormitoare', [[0.46, 1.25, 0.3], [0.46, 3.40, 0.3], [2.95, 0.46, 0.3], [3.48, 0.95, 0.3], [3.48, 3.30, 0.3], [6.74, 2.95, 0.3], [6.74, 0.70, 0.3]]],
      ['Prize living', [[0.95, 4.86, 0.3], [1.95, 4.86, 0.3], [4.33, 6.45, 0.3], [0.46, 5.55, 0.3], [0.46, 8.60, 0.3], [4.96, 11.27, 0.3], [4.80, 8.28, 0.3]]],
      ['Bucătărie (circuit separat)', [[6.74, 8.55, 0.3], [6.74, 9.15, 0.3], [6.74, 9.80, 0.3], [6.48, 11.27, 1.1], [5.20, 11.27, 1.1], [5.75, 11.27, 2.10]]],
      ['Plită (circuit dedicat)', [[5.75, 11.27, 0.60]]],
      ['Baie + cameră tehnică', [[5.88, 4.87, 1.1], [5.72, 8.08, 1.0], [6.35, 8.08, 0.5]]],
      ['Boiler (circuit dedicat)', [[6.74, 7.05, 1.65]]],
    ];
    const SW: [number, number, 'x' | 'z'][] = [
      [3.31, 4.52, 'x'],
      [3.45, 4.52, 'x'],
      [4.36, 6.58, 'x'],
      [4.36, 8.20, 'x'],
      [3.21, L - T - PL - 0.01, 'z'],
    ];
    for (const [x, z, ax] of SW) plate(x, z, ax, F + 1.04, F + 1.16);
    const lSw = SW.reduce((a, [x, z]) => a + Math.abs(x - J[0]) + Math.abs(z - J[1]) + 2.0, 0);
    let nSock = 0;
    for (const [, list] of CIRC) {
      let prev: [number, number] = J;
      for (const [x, z, h] of list) {
        lSock += cab(mSock, ceil(prev, [x, z])) + cab(mSock, [[x, cy(z), z], [x, F + h, z]]);
        box(EL, mBox, x - 0.045, x + 0.045, F + h - 0.045, F + h + 0.045, z - 0.045, z + 0.045);
        prev = [x, z];
        nSock++;
      }
    }

    const PVL = 1.762;
    const PVW = 1.134;
    const nRow = 3;
    const nCol = 6;
    const gap = 0.02;
    const sTop = (ZR + C.ovE) / COS - 0.28;
    const s0 = sTop - nRow * PVL - (nRow - 1) * gap;
    const xs0 = W / 2 - (nCol * PVW + (nCol - 1) * gap) / 2;
    for (let r = 0; r < nRow; r++) {
      const sa = s0 + r * (PVL + gap);
      const za = -C.ovE + sa * COS;
      const zb = -C.ovE + (sa + PVL) * COS;
      for (let k = 0; k < nCol; k++) {
        const x0 = xs0 + k * (PVW + gap);
        sl('S', 'pv', MAT.pv, za, zb, 0.56, 0.595, x0, x0 + PVW);
        PVP.push({ za, zb, x0, x1: x0 + PVW });
        nPV++;
      }
      for (const s of [sa + 0.40, sa + PVL - 0.40]) {
        const zr = -C.ovE + s * COS;
        sl('S', 'pv', mAlu, zr - 0.02, zr + 0.02, 0.517, 0.56, xs0, xs0 + nCol * PVW + (nCol - 1) * gap);
      }
    }
    pvKw = nPV * 0.45;
    const dz = L - 6.3;
    const lDC =
      pipe('pv', mDC, [[6.22, slY(dz, 0.56), 6.3], [6.22, cy(6.3), 6.3]], 0.01) +
      cab(mDC, [[6.22, cy(6.3), 6.3], [6.22, cy(6.72), 6.72], [6.22, F + 1.66, 6.72]]);

    // Detector de fum în camera tehnică
    cyl(EL, mBox, 5.65, 7.35, 0.055, LOFT.y - 0.05, LOFT.y - 0.02, 12);

    let lHeatCab = 0;
    for (const [, rects, w, th] of ZON) {
      for (const [x0, x1, z0, z1] of rects) {
        const hb = box(HT, mHeatBase, x0, x1, FS + 0.0005, FS + FL.under, z0, z1);
        hb.castShadow = false;
        for (let z = z0 + 0.06; z < z1 - 0.05; z += 0.52) {
          const m = box(HT, mHeat, x0 + 0.05, x1 - 0.05, FS + FL.under, FS + FL.under + 0.0015, z, Math.min(z + 0.50, z1 - 0.03));
          m.castShadow = false;
        }
        heatArea += (x1 - x0) * (z1 - z0);
        heatKw += ((x1 - x0) * (z1 - z0) * w) / 1000;
      }
      plate(th[0], th[1], th[2], F + 1.35, F + 1.47);
      lHeatCab += Math.abs(th[0] - J[0]) + Math.abs(th[1] - J[1]) + 2 * 1.6;
    }
    const filmA = ZON.filter((z) => z[2] < 100).reduce((a, z) => a + z[1].reduce((s, [x0, x1, z0, z1]) => s + (x1 - x0) * (z1 - z0), 0), 0);

    const R1 = (x: number) => Math.round(x * 10) / 10;
    const C5 = (x: number) => Math.ceil(x / 5) * 5;
    bom(CAT, 'Hazna etanșă din beton armat, ' + `${lx.toFixed(1)} × ${lz.toFixed(1)} × ${S.depth} m (≈ ${septicVol.toFixed(1)} m³ utili)`, 'buc', 1, 'alternativ: bazin prefabricat de 10–12 m³');
    bom(CAT, 'Beton C25/30 impermeabil pentru hazna (radier, pereți 20 cm, placă 15 cm)', 'm³', vConc * 1.05);
    bom(CAT, 'Oțel-beton pentru hazna (≈ 90 kg/m³ beton)', 'kg', Math.ceil((vConc * 90) / 10) * 10);
    bom(CAT, 'Capac cămin Ø600 cu ramă, carosabil (guri de vidanjare)', 'buc', 2);
    bom(CAT, 'Hidroizolație interioară hazna (mortar impermeabil)', 'm²', (lx - 2 * t) * (lz - 2 * t) + 2 * (lx + lz - 4 * t) * hWall);
    bom(CAT, 'Cămin de vizitare PVC Ø400 cu capac', 'buc', 1);
    bom(CAT, 'Țeavă PVC-KG Ø110 SN4 (colector îngropat, coborâre WC, aerisire hazna)', 'm', l110 + 2.2);
    bom(CAT, 'Țeavă PVC Ø50 (lavoar, duș, chiuvetă, mașină de spălat)', 'm', l50);
    bom(CAT, 'Țeavă PVC Ø75–110 aerisire coloană + căciulă + trecere etanșă prin acoperiș', 'm', ventL);
    bom(CAT, 'Ramificații, coturi 45°, reducții PVC (set)', 'buc', 18);
    bom(CAT, 'Manșon izolație 30 mm + cablu încălzitor pe coloanele din golul de sub casă (5 canalizare + 1 apă)', 'm', 6 * 1.0);
    bom(CAT, 'Manșete etanșe la trecerea coloanelor prin platformă', 'buc', 6);
    bom(CAT, 'Sifon pardoseală + sifoane obiecte sanitare', 'buc', 5);
    bom(CAT, 'Tub beton puț Ø1000, h = 1 m (IPOTEZĂ: puț de ' + Wl.depth + ' m)', 'buc', nRing);
    bom(CAT, 'Capac puț + pietriș filtrant la bază (0,5 m³)', 'buc', 1);
    bom(CAT, 'Pompă submersibilă + hidrofor 100 L + presostat + clapetă de sens', 'buc', 1);
    bom(CAT, 'Stație filtrare dublă (sedimente 20 µm + cărbune activ) + robineți izolare/golire', 'buc', 1);
    bom(CAT, 'Distribuitor apă rece/caldă cu robineți + vas expansiune sanitar 12 L + supapă siguranță', 'set', 1);
    bom(CAT, 'Țeavă PEHD Ø32 PN10 (puț → camera tehnică, îngropată la 1 m)', 'm', lPE);
    bom(CAT, 'Cablu electric îngropat pentru pompă (3×2,5) în tub de protecție', 'm', lPE);
    bom(CAT, 'Țeavă PPR Ø20/25 apă rece', 'm', lCold);
    bom(CAT, 'Țeavă PPR Ø20 apă caldă', 'm', lHot);
    bom(CAT, 'Cochilii izolație pentru țevile PPR', 'm', lCold + lHot);
    bom(CAT, 'Boiler electric 100 L (vertical, cu termostat și anod magneziu)', 'buc', 1);
    bom(CAT, 'Bandă avertizoare + nisip pentru pat de pozare (10 cm sub și peste țeavă)', 'm³', R1((l110 + lPE) * 0.4 * 0.25));
    bom(CAT, 'Săpătură: șanțuri pentru țevi', 'm³', R1(l110 * 0.5 * 0.9 + lPE * 0.4 * 1.1));
    bom(CAT, 'Săpătură: groapa haznalei', 'm³', R1((lx + 1) * (lz + 1) * S.depth));
    bom(CE, 'Panou fotovoltaic 450 W (' + nPV + ' buc = ' + pvKw.toFixed(1) + ' kWp, versantul sud la 30°)', 'buc', nPV, 'sursa de încărcare a bateriilor');
    bom(CE, 'Sistem de montaj pe tablă fălțuită (cleme pe falț, fără găurire) + șine aluminiu', 'm', 2 * nRow * (nCol * PVW + 0.1));
    bom(CE, 'Invertor hibrid off-grid 48 V, 8–10 kW, cu regulator MPPT și intrare de generator/rețea', 'buc', 1);
    bom(CE, 'Baterie LiFePO4 48 V – 5 kWh (total ' + batKwh + ' kWh) + rack ventilat 19" și BMS', 'buc', 3);
    bom(CE, 'Tablou protecție DC fotovoltaic (separator DC, descărcătoare SPD, siguranțe fuzibile stringuri)', 'buc', 1);
    bom(CE, 'Cablu solar 6 mm² (roșu + negru)', 'm', C5((lDC + 20) * 2));
    bom(CE, 'Tablou electric AC 24 module + comutator transfer rețea/generator (AAR), diferențial 30 mA, ' + (CIRC.length + 3 + ZON.length) + ' siguranțe', 'buc', 1);
    bom(CE, 'Canal de cabluri PVC perforat + bare colectoare cupru DC în camera tehnică', 'set', 1);
    bom(CE, 'Stingător portativ P6 cu pulbere (camera tehnică)', 'buc', 1);
    bom(CE, 'Priză de pământ: 2 țăruși 1,5 m + platbandă zincată 25×4', 'm', 10);
    bom(CE, 'Cablu CYY-F 3×1,5 mm² (iluminat + întrerupătoare)', 'm', C5((lLight + lSw) * 1.15));
    bom(CE, 'Cablu CYY-F 3×2,5 mm² (prize + circuite de încălzire)', 'm', C5((lSock + lHeatCab) * 1.15));
    bom(CE, 'Copex ignifug fără halogeni Ø20 (obligatoriu la traseele prin/peste pereții de paie)', 'm', C5((lLight + lSw + lSock + lHeatCab) * 1.15));
    bom(CE, 'Doză de aparat + doză de derivație (etanșe, montate în tencuială)', 'buc', nSock + SW.length + lamps.length + ZON.length + 10);
    bom(CE, 'Priză cu împământare (baie și bucătărie: cu capac IP44)', 'buc', nSock);
    Object.assign(Q, { nSock, nSw: SW.length, nCirc: CIRC.length, nLamp: lamps.length });
    bom(CE, 'Întrerupător (câte unul la fiecare ușă; dublu la intrări: lustră + aplică exterioară)', 'buc', SW.length);
    bom(CE, 'Corp de iluminat LED interior (lustre suspendate sub tavanul înalt)', 'buc', lamps.length);
    bom(CE, 'Corp de iluminat exterior IP44 (terase + fațada nordică)', 'buc', extL.length);
    bom(CE, 'Folie încălzitoare de carbon 70 W/m², pentru parchet (temperatură max. 27 °C)', 'm²', filmA);
    bom(CE, 'Covor încălzitor 150 W/m² sub gresie (baie)', 'm²', heatArea - filmA);
    bom(CE, 'Termostat programabil cu senzor de pardoseală (limitare 27 °C sub parchet)', 'buc', ZON.length, 'câte unul pe zonă');
    bom(CE, 'Detector de fum (dormitoare, living, cameră tehnică)', 'buc', 4);
  }

  /* ============================== MOBILIER ============================== */
  const FURN: ObstDef[] = [];
  let stoveEmber!: THREE.Mesh;
  {
    const FM = {
      fabric: new THREE.MeshStandardMaterial({ color: 0x5c6e70, roughness: 0.92, clippingPlanes: [clipPlane] }),
      fabricLt: new THREE.MeshStandardMaterial({ color: 0x8da09f, roughness: 0.90, clippingPlanes: [clipPlane] }),
      boucle: new THREE.MeshStandardMaterial({ color: 0xe6dfd3, roughness: 0.94, clippingPlanes: [clipPlane] }),
      pillow: new THREE.MeshStandardMaterial({ color: 0xc97b4b, roughness: 0.88, clippingPlanes: [clipPlane] }),
      ochre: new THREE.MeshStandardMaterial({ color: 0xd9a441, roughness: 0.88, clippingPlanes: [clipPlane] }),
      rug: new THREE.MeshStandardMaterial({ color: 0xd5c9b8, roughness: 0.96, clippingPlanes: [clipPlane] }),
      rugWarm: new THREE.MeshStandardMaterial({ color: 0xc5b39c, roughness: 0.96, clippingPlanes: [clipPlane] }),
      linen: new THREE.MeshStandardMaterial({ color: 0xf4f0e7, roughness: 0.9, clippingPlanes: [clipPlane] }),
      duvet: new THREE.MeshStandardMaterial({ color: 0x8fa899, roughness: 0.9, clippingPlanes: [clipPlane] }),
      duvet2: new THREE.MeshStandardMaterial({ color: 0x8d9eb0, roughness: 0.9, clippingPlanes: [clipPlane] }),
      oak: MAT.woodLight,
      walnut: MAT.woodDark,
      cab: new THREE.MeshStandardMaterial({ color: 0xf2eee6, roughness: 0.42, clippingPlanes: [clipPlane] }),
      cabSage: new THREE.MeshStandardMaterial({ color: 0x869788, roughness: 0.5, clippingPlanes: [clipPlane] }),
      top: new THREE.MeshStandardMaterial({ color: 0x3a3d42, roughness: 0.35, clippingPlanes: [clipPlane] }),
      marble: new THREE.MeshStandardMaterial({ color: 0xeae5dc, roughness: 0.28, clippingPlanes: [clipPlane] }),
      steel: MAT.steel,
      brass: new THREE.MeshStandardMaterial({ color: 0xb88b3d, metalness: 0.72, roughness: 0.32, clippingPlanes: [clipPlane] }),
      black: new THREE.MeshStandardMaterial({ color: 0x1a1b1e, roughness: 0.35, clippingPlanes: [clipPlane] }),
      plant: new THREE.MeshStandardMaterial({ color: 0x4b7c38, roughness: 0.85, clippingPlanes: [clipPlane] }),
      plantLt: new THREE.MeshStandardMaterial({ color: 0x629648, roughness: 0.85, clippingPlanes: [clipPlane] }),
      pot: new THREE.MeshStandardMaterial({ color: 0xb8663d, roughness: 0.78, clippingPlanes: [clipPlane] }),
      ceramic: new THREE.MeshStandardMaterial({ color: 0xfafafa, roughness: 0.25, clippingPlanes: [clipPlane] }),
      hydroBlue: new THREE.MeshStandardMaterial({ color: 0x2665b5, metalness: 0.2, roughness: 0.4, clippingPlanes: [clipPlane] }),
      fireRed: new THREE.MeshStandardMaterial({ color: 0xc22723, roughness: 0.4, clippingPlanes: [clipPlane] }),
      mirror: new THREE.MeshStandardMaterial({ color: 0xcad8df, metalness: 0.65, roughness: 0.12, clippingPlanes: [clipPlane] }),
      mirrorGlow: new THREE.MeshStandardMaterial({ color: 0xfff1d4, emissive: 0xffd58f, emissiveIntensity: 0.55, roughness: 0.4, clippingPlanes: [clipPlane] }),
    };

    const f = (mat: THREE.Material, x0: number, x1: number, z0: number, z1: number, h: number, y = 0) => {
      if (y < 1.0 && (x1 - x0) * (z1 - z0) > 0.025) FURN.push({ x0, x1, z0, z1 });
      return box('mobilier', mat, x0, x1, F + y, F + y + h, z0, z1);
    };
    const legs = (mat: THREE.Material, x0: number, x1: number, z0: number, z1: number, h: number, t = 0.045) => {
      for (const [x, z] of [
        [x0, z0],
        [x1 - t, z0],
        [x0, z1 - t],
        [x1 - t, z1 - t],
      ]) {
        box('mobilier', mat, x, x + t, F, F + h, z, z + t);
      }
    };
    const table = (matTop: THREE.Material, matLeg: THREE.Material, x0: number, x1: number, z0: number, z1: number, h: number) => {
      f(matTop, x0, x1, z0, z1, 0.04, h - 0.04);
      legs(matLeg, x0 + 0.05, x1 - 0.05, z0 + 0.05, z1 - 0.05, h - 0.04);
    };
    const chair = (cx: number, cz: number, dx: number, dz: number, seatMat: THREE.Material = FM.boucle) => {
      const s = 0.21;
      f(FM.oak, cx - s, cx + s, cz - s, cz + s, 0.03, 0.42);
      box('mobilier', seatMat, cx - s + 0.02, cx + s - 0.02, F + 0.45, F + 0.48, cz - s + 0.02, cz + s - 0.02);
      legs(FM.oak, cx - s + 0.01, cx + s - 0.01, cz - s + 0.01, cz + s - 0.01, 0.42, 0.035);
      if (dx) {
        box('mobilier', FM.oak, cx + dx * s - 0.018, cx + dx * s + 0.018, F + 0.45, F + 0.87, cz - s + 0.01, cz + s - 0.01);
        box('mobilier', seatMat, cx + dx * (s - 0.025) - 0.015, cx + dx * (s - 0.025) + 0.015, F + 0.66, F + 0.85, cz - s + 0.03, cz + s - 0.03);
      } else {
        box('mobilier', FM.oak, cx - s + 0.01, cx + s - 0.01, F + 0.45, F + 0.87, cz + dz * s - 0.018, cz + dz * s + 0.018);
        box('mobilier', seatMat, cx - s + 0.03, cx + s - 0.03, F + 0.66, F + 0.85, cz + dz * (s - 0.025) - 0.015, cz + dz * (s - 0.025) + 0.015);
      }
    };
    const bed = (x0: number, x1: number, z0: number, z1: number, dir: number, duvetMat: THREE.Material, accentMat: THREE.Material) => {
      // Sculpted oak plinth + recessed dark feet
      legs(FM.walnut, x0 + 0.08, x1 - 0.08, z0 + 0.08, z1 - 0.08, 0.12, 0.06);
      f(FM.oak, x0, x1, z0, z1, 0.22, 0.12);
      // Upholstered fluted headboard
      const hx0 = dir > 0 ? x1 - 0.08 : x0;
      const hx1 = dir > 0 ? x1 : x0 + 0.08;
      box('mobilier', FM.walnut, hx0, hx1, F, F + 1.12, z0 - 0.03, z1 + 0.03);
      const u0 = dir > 0 ? hx0 - 0.025 : hx1;
      const u1 = dir > 0 ? hx0 : hx1 + 0.025;
      box('mobilier', FM.boucle, u0, u1, F + 0.34, F + 1.08, z0 + 0.02, z1 - 0.02);
      // Plush mattress + folded duvet + throw blanket + layered pillows
      box('mobilier', FM.linen, x0 + 0.04, x1 - 0.04, F + 0.34, F + 0.54, z0 + 0.04, z1 - 0.04);
      const d0 = dir > 0 ? x0 + 0.03 : x0 + 0.58;
      const d1 = dir > 0 ? x1 - 0.58 : x1 - 0.03;
      box('mobilier', duvetMat, d0, d1, F + 0.54, F + 0.61, z0 + 0.02, z1 - 0.02);
      const th0 = dir > 0 ? x0 + 0.04 : x1 - 0.54;
      const th1 = dir > 0 ? x0 + 0.54 : x1 - 0.04;
      box('mobilier', accentMat, th0, th1, F + 0.61, F + 0.635, z0 + 0.02, z1 - 0.02);
      const px0 = dir > 0 ? x1 - 0.54 : x0 + 0.11;
      const px1 = px0 + 0.40;
      const zm = (z0 + z1) / 2;
      const ax0 = dir > 0 ? px0 - 0.12 : px1 - 0.14;
      if (z1 - z0 <= 1.15) {
        // Single bed: one wide pillow + one centered accent cushion
        box('mobilier', FM.ceramic, px0, px1, F + 0.54, F + 0.66, z0 + 0.14, z1 - 0.14);
        box('mobilier', accentMat, ax0, ax0 + 0.18, F + 0.55, F + 0.71, zm - 0.18, zm + 0.18);
      } else {
        box('mobilier', FM.ceramic, px0, px1, F + 0.54, F + 0.66, z0 + 0.09, zm - 0.04);
        box('mobilier', FM.ceramic, px0, px1, F + 0.54, F + 0.66, zm + 0.04, z1 - 0.09);
        box('mobilier', accentMat, ax0, ax0 + 0.18, F + 0.55, F + 0.71, zm - 0.30, zm - 0.06);
        box('mobilier', accentMat, ax0, ax0 + 0.18, F + 0.55, F + 0.71, zm + 0.06, zm + 0.30);
      }
    };
    const wardrobe = (x0: number, x1: number, z0: number, z1: number, h = 2.25) => {
      f(FM.cab, x0, x1, z0, z1, h);
      // Warm oak recessed plinth + vertical door panel seams & brass handles
      box('mobilier', FM.oak, x0, x1, F, F + 0.06, z0 - 0.005, z1 + 0.005);
      const alongX = x1 - x0 > z1 - z0;
      const nDoors = Math.max(2, Math.round((alongX ? x1 - x0 : z1 - z0) / 0.55));
      for (let i = 1; i < nDoors; i++) {
        if (alongX) {
          const sx = x0 + (i * (x1 - x0)) / nDoors;
          box('mobilier', FM.walnut, sx - 0.005, sx + 0.005, F + 0.08, F + h - 0.03, z0 - 0.005, z1 + 0.005);
          box('mobilier', FM.brass, sx - 0.045, sx - 0.025, F + 0.90, F + 1.25, z0 - 0.015, z0);
          box('mobilier', FM.brass, sx + 0.025, sx + 0.045, F + 0.90, F + 1.25, z0 - 0.015, z0);
        }
      }
    };
    const nightstand = (x0: number, x1: number, z0: number, z1: number, lamp = true) => {
      legs(FM.walnut, x0 + 0.03, x1 - 0.03, z0 + 0.03, z1 - 0.03, 0.18, 0.03);
      f(FM.walnut, x0, x1, z0, z1, 0.28, 0.18);
      box('mobilier', FM.oak, x0 + 0.02, x1 - 0.02, F + 0.21, F + 0.42, z0 + 0.02, z1 - 0.02);
      if (lamp) {
        const lx = (x0 + x1) / 2;
        const lz = (z0 + z1) / 2;
        cyl('mobilier', FM.brass, lx, lz, 0.055, F + 0.46, F + 0.58, 12);
        cyl('mobilier', FM.linen, lx, lz, 0.105, F + 0.56, F + 0.72, 14);
      }
    };
    const stool = (cx: number, cz: number) => {
      cyl('mobilier', FM.black, cx, cz, 0.15, F, F + 0.025, 14);
      cyl('mobilier', FM.black, cx, cz, 0.022, F + 0.025, F + 0.60, 10);
      cyl('mobilier', FM.oak, cx, cz, 0.175, F + 0.60, F + 0.63, 16);
      cyl('mobilier', FM.boucle, cx, cz, 0.165, F + 0.63, F + 0.66, 16);
      FURN.push({ cx, cz, r: 0.18 });
    };

    // ---- 0. SPAȚII DE ȘEZUT ÎN GLAFUL FERESTRELOR JOASE (PEREȚI 40 CM) ----
    for (const wl of WALLS) {
      for (const o of wl.openings) {
        if (o.type !== 'win' || o.u1 - o.u0 < 1.20 || (o.sill ?? C.winSill) > 0.50) continue;
        const vb = F + (o.sill ?? C.winSill) + 0.022;
        const t = 0.022;
        // Saltea moale de șezut în nișa ferestrei + două perne de spătar pe laterale
        wbox('mobilier', FM.linen, wl, o.u0 + t + 0.015, o.u1 - t - 0.015, vb + 0.035, vb + 0.095, 0.165, T + PL + 0.055);
        wbox('mobilier', FM.ochre, wl, o.u0 + t + 0.02, o.u0 + t + 0.16, vb + 0.095, vb + 0.36, 0.19, T + PL + 0.02);
        wbox('mobilier', FM.duvet, wl, o.u1 - t - 0.16, o.u1 - t - 0.02, vb + 0.095, vb + 0.36, 0.19, T + PL + 0.02);
        const [px0, pz0] = wp(wl, o.u0 + 0.04, T + PL);
        const [px1, pz1] = wp(wl, o.u1 - 0.04, T + PL + 0.09);
        FURN.push({ x0: Math.min(px0, px1), x1: Math.max(px0, px1), z0: Math.min(pz0, pz1), z1: Math.max(pz0, pz1) });
      }
    }

    // ---- 1. SOBĂ PE LEMNE + COȘ + SUPORT LEMNE (colțul SV, lângă bancheta ferestrei de sud) ----
    const stx = C.chim.x;
    const stz = C.chim.z;
    cyl('mobilier', MAT.stove, stx, stz, 0.27, F + 0.12, F + 1.06);
    cyl('mobilier', MAT.stove, stx, stz, 0.33, F, F + 0.12);
    const emberMat = new THREE.MeshStandardMaterial({ color: 0xff6e20, emissive: 0xff5a00, emissiveIntensity: 1.4, roughness: 0.4, clippingPlanes: [clipPlane] });
    stoveEmber = box('mobilier', emberMat, stx - 0.14, stx + 0.14, F + 0.36, F + 0.68, stz - 0.28, stz - 0.22); // focar spre N (living / zonă șemineu)
    FURN.push({ cx: stx, cz: stz, r: 0.33 });
    box('mobilier', MAT.ceramic, T + PL, T + PL + 0.03, F, F + 1.65, 10.35, L - T - PL); // ecran termic V
    box('mobilier', MAT.ceramic, T + PL, 1.46, F, F + 1.65, L - T - PL - 0.03, L - T - PL); // ecran termic S
    box('mobilier', FM.top, 0.48, 1.46, F, F + 0.014, 10.38, 11.26); // placă protecție pardoseală SV
    const chTop = yApex + 0.568 + 0.60;
    cyl('mobilier', MAT.stove, stx, stz, 0.08, F + 1.06, chTop);
    cyl('mobilier', MAT.steel, stx, stz, 0.11, roofY(stz) - 0.1, chTop - 0.05, 16);
    // Suport lemne minimalist la nord de sobă (colț SV)
    f(FM.black, T + PL + 0.02, T + PL + 0.32, 9.72, 10.24, 0.78);
    box('mobilier', FM.oak, T + PL + 0.05, T + PL + 0.29, F + 0.06, F + 0.68, 9.76, 10.20);

    // ---- 2. LIVING REARANJAT + ZONĂ COZY DE STAT LÂNGĂ ȘEMINEU (ax liber spre ușa de terasă 3.35..4.87) ----
    // Zonă media N (x = 0.72..2.22, ferită de ușa retractabilă Dormitor 1)
    f(FM.walnut, 0.72, 2.22, 4.84, 5.22, 0.34, 0.12);
    legs(FM.black, 0.78, 2.16, 4.88, 5.18, 0.12, 0.04);
    box('mobilier', FM.oak, 0.84, 2.10, F + 0.52, F + 1.72, 4.835, 4.86);
    box('mobilier', FM.black, 0.94, 2.00, F + 0.78, F + 1.52, 4.865, 4.90);

    // Covor țesut + măsuțe cafea suprapuse + canapea 3 locuri lângă bancheta ferestrei de Vest (6.18..8.38)
    box('mobilier', FM.rug, 1.25, 3.25, F, F + 0.015, 5.45, 7.88);
    cyl('mobilier', FM.marble, 2.05, 6.12, 0.35, F + 0.36, F + 0.40, 24);
    cyl('mobilier', FM.black, 2.05, 6.12, 0.03, F, F + 0.36, 10);
    cyl('mobilier', FM.oak, 2.52, 5.90, 0.23, F + 0.30, F + 0.34, 20);
    cyl('mobilier', FM.black, 2.52, 5.90, 0.025, F, F + 0.30, 10);

    f(FM.fabric, 1.40, 3.20, 6.85, 7.72, 0.22, 0.10);
    legs(FM.walnut, 1.45, 3.15, 6.90, 7.67, 0.10, 0.05);
    box('mobilier', FM.fabric, 1.40, 3.20, F + 0.32, F + 0.80, 7.52, 7.72); // spătar
    box('mobilier', FM.fabric, 1.40, 1.58, F + 0.32, F + 0.62, 6.85, 7.72); // braț V
    box('mobilier', FM.fabric, 3.02, 3.20, F + 0.32, F + 0.62, 6.85, 7.72); // braț E
    for (let i = 0; i < 3; i++) {
      box('mobilier', FM.fabricLt, 1.60 + i * 0.47, 2.05 + i * 0.47, F + 0.32, F + 0.45, 6.88, 7.50);
      box('mobilier', FM.fabricLt, 1.62 + i * 0.47, 2.03 + i * 0.47, F + 0.45, F + 0.78, 7.37, 7.52);
    }
    box('mobilier', FM.pillow, 1.62, 1.86, F + 0.46, F + 0.72, 7.20, 7.36);
    box('mobilier', FM.ochre, 2.72, 2.98, F + 0.46, F + 0.72, 7.20, 7.36);

    // Zonă de stat lângă șemineu (SV: 2 fotolii lounge + puf rotund + măsuță laterală + covor cald + bancheta ferestrei S)
    box('mobilier', FM.rugWarm, 1.48, 2.98, F, F + 0.015, 9.08, 10.98);
    // Fotoliu lounge V orientat spre est / șemineu
    f(FM.boucle, 0.52, 1.16, 8.62, 9.26, 0.22, 0.14);
    legs(FM.walnut, 0.56, 1.12, 8.66, 9.22, 0.14, 0.035);
    box('mobilier', FM.boucle, 0.52, 0.72, F + 0.36, F + 0.78, 8.62, 9.26);
    // Fotoliu principal lângă șemineu (orientat spre sud / vatră și bancheta ferestrei 1.55..3.07)
    f(FM.boucle, 1.62, 2.32, 9.48, 10.14, 0.22, 0.14);
    legs(FM.walnut, 1.66, 2.28, 9.52, 10.10, 0.14, 0.035);
    box('mobilier', FM.boucle, 1.62, 2.32, F + 0.36, F + 0.78, 9.48, 9.68); // spătar pe nord -> privește spre șemineu
    box('mobilier', FM.ochre, 1.82, 2.12, F + 0.38, F + 0.62, 9.68, 9.82); // pernă accent
    // Puf rotund bouclé lângă vatră + măsuță laterală + lampadar
    cyl('mobilier', FM.fabricLt, 1.86, 10.52, 0.23, F + 0.03, F + 0.36, 20);
    cyl('mobilier', FM.walnut, 1.86, 10.52, 0.20, F, F + 0.03, 18);
    FURN.push({ cx: 1.86, cz: 10.52, r: 0.24 });
    cyl('mobilier', FM.oak, 2.55, 9.78, 0.20, F + 0.46, F + 0.49, 16);
    cyl('mobilier', FM.black, 2.55, 9.78, 0.025, F, F + 0.46, 10);
    cyl('mobilier', FM.brass, 0.64, 9.46, 0.015, F, F + 1.62, 10); // lampadar lectură lângă șemineu
    cyl('mobilier', FM.linen, 0.64, 9.46, 0.18, F + 1.44, F + 1.68, 16);

    // ---- 3. BUCĂTĂRIE MĂRITĂ ÎN L (PE TOT PERETELE E 8.20..11.27 + SUD 4.90..6.76) + INSULĂ MARE ----
    // Insulă mărită (x = 3.88..4.82, z = 8.38..9.90) cu blat cascadă în consolă spre Vest + 3 scaune de bar (liber față de ușa S 3.35..4.87)
    f(FM.cabSage, 3.88, 4.82, 8.38, 9.90, 0.86);
    box('mobilier', FM.oak, 3.86, 3.88, F + 0.06, F + 0.86, 8.38, 9.90); // placare decorativă stejar spre living
    box('mobilier', FM.oak, 3.88, 4.82, F, F + 0.06, 8.38, 9.90); // plintă stejar
    box('mobilier', FM.marble, 3.63, 4.84, F + 0.86, F + 0.90, 8.36, 9.92); // blat marmură cu consolă bar 25 cm
    box('mobilier', FM.ceramic, 4.22, 4.46, F + 0.90, F + 0.96, 9.02, 9.26); // bol ceramic decorativ pe insulă
    stool(3.43, 8.64);
    stool(3.43, 9.14);
    stool(3.43, 9.64);

    // Coloane înalte pe peretele de Est eliberat de ușa exterioară (z = 8.22..9.44): frigider + cuptor/cămară
    f(FM.steel, 6.14, 6.75, 8.22, 8.82, 2.08); // turn frigider/congelator înalt
    box('mobilier', FM.black, 6.135, 6.15, F + 0.90, F + 1.60, 8.26, 8.30); // mâner vertical frigider
    f(FM.steel, 6.14, 6.75, 8.84, 9.44, 2.08); // turn cuptor încorporat + cămară
    box('mobilier', FM.black, 6.135, 6.16, F + 0.92, F + 1.42, 8.90, 9.38); // geam cuptor încorporat spre insulă

    // Blat E continuu (z = 9.46..10.66) cu mașină de spălat integrată + chiuvetă centrată sub fereastra E (9.95..11.05)
    f(FM.ceramic, 6.16, 6.75, 9.52, 10.12, 0.85); // mașină de spălat frontală
    box('mobilier', FM.black, 6.145, 6.165, F + 0.25, F + 0.62, 9.64, 10.00); // hublou sticlă
    box('mobilier', FM.steel, 6.15, 6.168, F + 0.72, F + 0.82, 9.56, 10.08); // panou comenzi inox + sertar
    f(FM.cabSage, 6.16, 6.76, 10.12, 10.66, 0.86);
    box('mobilier', FM.marble, 6.14, 6.76, F + 0.86, F + 0.90, 9.46, 10.66);
    box('mobilier', FM.steel, 6.24, 6.68, F + 0.90, F + 0.915, 10.20, 10.64); // chiuvetă sub fereastra E
    cyl('mobilier', FM.brass, 6.68, 10.42, 0.015, F + 0.90, F + 1.12, 10); // baterie bucătărie

    // Blat S continuu (x = 4.90..6.76, z = 10.66..11.27) cu mașină de spălat vase + plită + hotă + corpuri suspendate
    f(FM.cabSage, 4.90, 6.76, 10.66, 11.27, 0.86);
    box('mobilier', FM.marble, 4.88, 6.76, F + 0.86, F + 0.90, 10.64, 11.27);
    box('mobilier', FM.cab, 4.90, 5.42, F + 1.56, F + 2.15, 10.92, 11.27); // corp suspendat stânga hotei
    box('mobilier', FM.cab, 6.14, 6.75, F + 1.56, F + 2.15, 11.06, 11.27); // corp suspendat dreapta hotei (liber de fereastra E)
    box('mobilier', FM.black, 5.46, 6.04, F + 0.90, F + 0.915, 10.76, 11.18); // plită inducție
    box('mobilier', FM.steel, 5.44, 6.06, F + 1.56, F + 1.76, 10.78, 11.27); // hotă inox
    box('mobilier', FM.steel, 5.64, 5.86, F + 1.76, F + 2.40, 11.02, 11.27); // coș hotă

    // ---- 4. DORMITOR MATRIMONIAL (+1,00 m lățime: x = 3.43..6.76, z = 0.43..4.72, fără plante) ----
    box('mobilier', FM.rugWarm, 3.65, 6.10, F, F + 0.015, 0.95, 3.35);
    bed(3.45, 5.55, 1.25, 3.05, -1, FM.duvet, FM.pillow);
    nightstand(3.46, 3.90, 0.78, 1.20, true);
    nightstand(3.46, 3.90, 3.10, 3.52, true);
    wardrobe(4.58, 6.75, 4.10, 4.70, 2.25); // dulap mare pe peretele sud-est (liber față de ușă 3.47..4.37)
    f(FM.oak, 6.32, 6.75, 2.55, 3.65, 0.68, 0.14);
    legs(FM.walnut, 6.36, 6.71, 2.60, 3.60, 0.14, 0.035);
    const mirDorm = box('mobilier', FM.mirror, 6.74, 6.76, F + 1.05, F + 1.82, 2.75, 3.45);
    mirDorm.castShadow = false;
    f(FM.boucle, 6.04, 6.64, 0.46, 0.92, 0.22, 0.14); // fotoliu lounge colț NE (liber față de bancheta ferestrelor N și E)
    box('mobilier', FM.boucle, 6.42, 6.64, F + 0.36, F + 0.78, 0.46, 0.92);

    // ---- 5. DORMITOR 1 (PAT MIC 100×200 cm + BIROU LUMINOS + BANCHETĂ LA FEREASTRĂ) ----
    box('mobilier', FM.rug, 0.90, 2.72, F, F + 0.015, 1.55, 3.15);
    bed(0.44, 2.44, 1.85, 2.85, -1, FM.duvet2, FM.ochre); // pat mic single 100×200 cm
    nightstand(0.45, 0.88, 1.36, 1.78, true);
    // Birou pe peretele E (lângă fereastra nordică 1.11..2.62, lăsând liberă bancheta de șezut de la fereastră)
    table(FM.walnut, FM.oak, 2.76, 3.30, 0.55, 1.65, 0.75);
    box('mobilier', FM.black, 2.90, 3.16, F + 0.75, F + 0.77, 0.92, 1.28);
    box('mobilier', FM.steel, 3.16, 3.18, F + 0.77, F + 0.99, 0.94, 1.26);
    chair(2.50, 1.10, -1, 0, FM.fabricLt);
    f(FM.walnut, 0.45, 1.08, 0.44, 0.82, 1.85); // bibliotecă colț NV (liberă față de fereastra 1.11..2.62)
    wardrobe(0.45, 2.18, 4.10, 4.70, 2.25); // dulap pe peretele SV (liber față de ușă 2.37..3.27)

    // ---- 6. BAIE (x = 4.48..6.76, z = 4.82..6.55) ----
    // Mobilier suspendat lavoar nuc + blat ceramic + oglindă iluminată (perete N)
    f(FM.walnut, 5.35, 6.20, 4.84, 5.28, 0.50, 0.32);
    box('mobilier', FM.ceramic, 5.33, 6.22, F + 0.82, F + 0.86, 4.84, 5.30);
    cyl('mobilier', FM.ceramic, 5.77, 5.07, 0.21, F + 0.86, F + 0.98, 20);
    cyl('mobilier', FM.brass, 5.77, 4.92, 0.014, F + 0.86, F + 1.10, 10);
    box('mobilier', FM.mirrorGlow, 5.38, 6.16, F + 1.12, F + 1.84, 4.828, 4.842);
    const mir = box('mobilier', FM.mirror, 5.41, 6.13, F + 1.15, F + 1.81, 4.842, 4.852);
    mir.castShadow = false;
    // Dulap înalt prosoape (colț NV, la nord de ușa 5.20..6.00)
    f(FM.cab, 4.50, 5.15, 4.84, 5.16, 1.95);
    // Vas WC suspendat + poliță rezervor (perete S, centrat liber între ușă și paravanul de duș)
    box('mobilier', FM.cab, 4.94, 5.58, F, F + 1.08, 6.36, 6.54);
    f(FM.ceramic, 5.08, 5.44, 6.02, 6.38, 0.34, 0.12);
    // Duș walk-in colț SE (intrare 65 cm) + paravan sticlă + cap de duș tip ploaie
    f(FM.marble, 5.85, 6.76, 5.35, 6.54, 0.05);
    const gl = box('mobilier', MAT.glass, 5.85, 5.865, F + 0.05, F + 2.05, 6.00, 6.54);
    gl.castShadow = false;
    cyl('mobilier', FM.brass, 6.35, 6.50, 0.015, F + 1.05, F + 2.08, 10);
    cyl('mobilier', FM.brass, 6.35, 6.26, 0.12, F + 2.04, F + 2.07, 16);
    // Radiator port-prosop pe peretele V sud de ușă
    box('mobilier', FM.steel, 4.49, 4.55, F + 0.65, F + 1.55, 6.08, 6.46);

    // ---- 7. CAMERĂ TEHNICĂ (x = 4.48..6.76, z = 6.65..8.15) – COMPLETĂ FOTOVOLTAIC + APĂ ----
    // Mașină de spălat rufe frontală (perete S, 52 cm liber până la rack-ul de baterii)
    f(FM.ceramic, 5.38, 5.98, 7.57, 8.13, 0.85);
    box('mobilier', FM.black, 5.50, 5.86, F + 0.25, F + 0.62, 7.555, 7.575);
    box('mobilier', FM.steel, 5.42, 5.94, F + 0.72, F + 0.82, 7.56, 7.575);
    // Boiler electric 100 L (vertical, colț NE) + vas de expansiune sanitar 12 L + distribuitor
    cyl('mobilier', FM.ceramic, 6.48, 7.00, 0.24, F + 0.55, F + 1.65, 22);
    box('mobilier', FM.black, 6.42, 6.54, F + 0.95, F + 1.05, 7.22, 7.25);
    FURN.push({ cx: 6.48, cz: 7.00, r: 0.24 });
    cyl('mobilier', FM.hydroBlue, 6.54, 7.36, 0.13, F + 0.85, F + 1.24, 16); // vas expansiune 12 L
    box('mobilier', FM.brass, 6.68, 6.75, F + 0.55, F + 0.78, 7.25, 7.65); // distribuitor apă rece/caldă
    // Hidrofor 100 L + pompă + filtre sedimente & cărbune activ (colț SE)
    f(FM.hydroBlue, 6.18, 6.70, 7.64, 8.10, 0.44, 0.04);
    cyl('mobilier', FM.steel, 6.44, 7.86, 0.09, F + 0.48, F + 0.70, 14);
    cyl('mobilier', FM.hydroBlue, 6.60, 7.86, 0.065, F + 0.90, F + 1.26, 14); // filtru sedimente
    cyl('mobilier', FM.hydroBlue, 6.60, 8.02, 0.065, F + 0.90, F + 1.26, 14); // filtru cărbune activ
    // Stingător portativ P6 lângă intrarea în camera tehnică
    cyl('mobilier', FM.fireRed, 4.65, 7.98, 0.08, F + 0.10, F + 0.65, 14);
    cyl('mobilier', FM.black, 4.65, 7.98, 0.025, F + 0.65, F + 0.74, 10);
    FURN.push({ cx: 4.65, cz: 7.98, r: 0.09 });
    // Înregistrare coliziune pentru rack-ul de baterii din stratul electric
    FURN.push({ x0: 5.44, x1: 6.06, z0: 6.67, z1: 7.05 });
  }

  /* ============================== VERIFICĂRI DE ÎMBINARE ============================== */
  {
    const r5 = RAF.N[6];
    const r5s = RAF.S[6];
    const rG = RAF.N[1];
    const rV = RAF.N[0];
    contact('Acoperiș', 'căprior N ↔ cosoroaba teșită a peretelui N', r5.bot, wallMeshes[WA.id].plateM, r5.x + 0.01, 0, 0.20);
    contact('Acoperiș', 'căprior S ↔ cosoroaba teșită a peretelui S', r5s.bot, wallMeshes[WB.id].plateM, r5s.x + 0.01, 0, L - 0.20);
    contact('Acoperiș', 'căprior de margine (consolă) ↔ cosoroaba N', rV.bot, wallMeshes[WA.id].plateM, rV.x + 0.01, 0, 0.20);
    contact('Acoperiș', 'căprior N ↔ pana de coamă (teșitura)', r5.bot, BEV[0], r5.x + 0.01, 0, ZR - 0.05);
    contact('Acoperiș', 'căprior S ↔ pana de coamă (teșitura)', r5s.bot, BEV[1], r5s.x + 0.01, 0, ZR + 0.05);
    contact('Acoperiș', 'căprior de fronton V ↔ cosoroaba înclinată', rG.bot, wallMeshes[WLw.id].rakeM[0], rG.x + 0.01, 0, 2.5);
    contact('Acoperiș', 'pana de coamă ↔ stâlpul de coamă V', ridgeBeam, wallMeshes[WLw.id].ridgePost, 0.2, 0, ZR);
    contact('Acoperiș', 'pana de coamă ↔ stâlpul de coamă E', ridgeBeam, wallMeshes[WRw.id].ridgePost, W - 0.2, 0, ZR);
    contact('Acoperiș', 'cosoroaba înclinată V ↔ fața de nord a penei', ridgeBeam, wallMeshes[WLw.id].rakeM[0], 0.2, yRB - 0.08, ZR - 0.2, 'z');
    contact('Acoperiș', 'cosoroaba înclinată V ↔ fața interioară a cosoroabei N', wallMeshes[WLw.id].rakeM[0], wallMeshes[WA.id].plateM, 0.2, F + C.hE + 0.08, 0.2, 'z');
    axisCheck('Acoperiș', 'căpriorul de fronton V cade pe axul peretelui (x = 0,20)', () => (bbox(rG.web).min.x + bbox(rG.bot).max.x) / 2 - 0.20);
    axisCheck('Acoperiș', 'căpriorul de fronton E cade pe axul peretelui (x = 7,00)', () => {
      const r = RAF.N[NRB + 1];
      return (bbox(r.web).min.x + bbox(r.bot).max.x) / 2 - (W - 0.20);
    });
    contact('Acoperiș', 'căprior ↔ lambriul tavanului (lăți de instalații 4 cm)', r5.bot, G.tavan.children[0], r5.x + 0.01, 0, 2.5, 'y', 0.04 / COS);

    const pA = wallMeshes[WB.id].posts.find((p: any) => p.kind === 'post');
    const pc = wallMeshes[WA.id].posts.find((p: any) => p.kind === 'corner');
    contact('Pereți', 'talpa dublă ↔ OSB 22 (perete N)', wallMeshes[WA.id].sills[0], deck, W / 2, 0, 0.05);
    contact('Pereți', 'traversa de sub stâlp ↔ OSB 22 (perete S)', pA.tr, deck, pA.u, 0, L - 0.2);
    contact('Pereți', 'stâlp ↔ traversa dintre tălpi (perete S)', pA.m, pA.tr, pA.u, 0, L - 0.2);
    contact('Pereți', 'cosoroaba S ↔ capul stâlpului', wallMeshes[WB.id].plateM, pA.m, pA.u, 0, L - 0.2);
    contact('Pereți', 'cosoroaba N ↔ stâlpul de colț', wallMeshes[WA.id].plateM, pc.m, pc.u, 0, 0.2);
    const g = wallMeshes[WLw.id].posts.find((p: any) => p.kind === 'post' && p.u > 1 && p.u < ZR - 0.5);
    contact('Pereți', 'cosoroaba înclinată ↔ stâlp de fronton (V)', wallMeshes[WLw.id].rakeM[0], g.m, 0.2, 0, g.u);
    contact('Pereți', 'stâlpul de coamă V ↔ traversă', wallMeshes[WLw.id].ridgePost, wallMeshes[WLw.id].posts.find((p: any) => p.kind === 'ridge').tr, 0.2, 0, ZR);
    contact('Pereți', 'traversa stâlpului de coamă ↔ OSB 22 (peste blocul masiv)', wallMeshes[WLw.id].posts.find((p: any) => p.kind === 'ridge').tr, deck, 0.2, 0, ZR);
    axisCheck('Fundație', 'stâlpul de coamă V e la mijlocul perechii de piloni', () => {
      const z = (bbox(wallMeshes[WLw.id].ridgePost).min.z + bbox(wallMeshes[WLw.id].ridgePost).max.z) / 2;
      return z - (ZR - RIDGE_PILE_OFFSET + (ZR + RIDGE_PILE_OFFSET)) / 2;
    });
    const door = WB.openings.find((o) => o.type === 'door')!;
    const jp = wallMeshes[WB.id].posts.find((p: any) => p.kind === 'jack' && Math.abs(p.u - (door.u0 - 0.06)) < 1e-6);
    const doorLin = wallMeshes[WB.id].lintels.find((l: any) => l.o === door).m;
    contact('Pereți', 'buiandrugul ușii de pe sud ↔ stâlpul de gol', doorLin, jp.m, jp.u, 0, L - 0.2);
    contact('Pereți', 'perete interior ↔ parchet', IWM[0], parq[1], 0.90, 0, 4.77);
    for (const wl of [WLw, WRw]) {
      axisCheck('Pereți', `golurile din frontonul ${wl.name} nu taie stâlpul de coamă`, () =>
        Math.max(0, ...wl.openings.map((o) => Math.min(o.u1, wl.ridge! + 0.10) - Math.max(o.u0, wl.ridge! - 0.10))),
      );
    }
    axisCheck('Acoperiș', 'coșul trece între panouri și peretele de sud (la cel puțin 5 cm de fiecare)', () => {
      const cz = C.chim.z;
      const r = 0.11;
      const gPV = cz - r - Math.max(...PVP.map((q) => L - q.za));
      const gW = L - T - (cz + r);
      return Math.max(0, 0.05 - Math.min(gPV, gW));
    });
  }

  /* ============================== OBSTACOLE PLIMBARE ============================== */
  const OBST: ObstDef[] = [];
  for (const wl of WALLS) {
    const ext = wl.corners ? PL : 0;
    const doors = wl.openings.filter((o) => o.type === 'door').map((o) => ({ u0: o.u0, u1: o.u1, v0: -1, v1: 2 }));
    for (const r of subtractRects([{ u0: wl.u0 - ext, u1: wl.u1 + ext, v0: 0, v1: 1 }], doors)) {
      const [ax, az] = wp(wl, r.u0, -PL);
      const [bx, bz] = wp(wl, r.u1, T + PL);
      OBST.push({ x0: Math.min(ax, bx), x1: Math.max(ax, bx), z0: Math.min(az, bz), z1: Math.max(az, bz), wall: true });
    }
  }
  for (const iw of IWALLS) {
    const wl = { axis: iw.axis, c: iw.c, dir: 1 };
    for (const r of subtractRects([{ u0: iw.u0, u1: iw.u1, v0: 0, v1: 1 }], iw.doors.map((d) => ({ u0: d[0], u1: d[1], v0: -1, v1: 2 })))) {
      const [ax, az] = wp(wl, r.u0, 0);
      const [bx, bz] = wp(wl, r.u1, 0.10);
      OBST.push({ x0: Math.min(ax, bx), x1: Math.max(ax, bx), z0: Math.min(az, bz), z1: Math.max(az, bz), wall: true });
    }
  }
  for (const n of FURN) OBST.push(n);
  for (const n of NEIGH) if (n.own && n.x1 > n.x0) OBST.push({ x0: n.x0, x1: n.x1, z0: n.z0, z1: n.z1 });

  /* ============================== CANTITĂȚI BOM DERIVATE ============================== */
  {
    const R = Math.round;
    const C1 = Math.ceil;
    const aFl = (W - 2 * T) * (L - 2 * T);
    const aTile = TILE.reduce((a, [x0, x1, z0, z1]) => a + (x1 - x0) * (z1 - z0), 0);
    const aParq = aFl - aTile;
    bom('Fundație', 'Pilon șurub zincat tip B: Ø133×5 mm, L = 3,0 m, 2 elice Ø400, cap reglabil în U', 'buc', Q.pileT.B, `sub pereții N/S (${Q.pileTH.B - 4}) + perechile de sub stâlpii de coamă (4, la 1,00 m = 2,5D); cuplu final ≥ ${PT.B.T} kN·m`);
    bom('Fundație', 'Pilon șurub zincat tip A: Ø108×4 mm, L = 2,5 m, elice Ø300, cap reglabil în U', 'buc', Q.pileT.A, `${Q.pileTH.A} sub casă (9 median + 12 frontoane), ${Q.pileT.A - Q.pileTH.A} sub terase și rampă (fără suprapuneri de elice); cuplu final ≥ ${PT.A.T} kN·m`);
    bom('Fundație', 'Bulon M12×200 cu piuliță și 2 șaibe late (grindă pe capul pilonului + eclise coamă)', 'buc', Q.piles * 2 + 16);
    bom('Fundație', 'Platbandă oțel S235 10×220 mm, L = 1,40 m (eclise transfer sub stâlpii de coamă)', 'buc', 4);
    bom('Fundație', 'Închiriere utilaj de înșurubat cu cuplu-metru (proces-verbal cu cuplul final al fiecărui pilon)', 'zi', 2);
    bom('Fundație', 'Papuc metalic 150×240 (grinzi de capăt în grinzile longitudinale)', 'buc', 8);
    bom('Fundație', 'Bandă bitum/EPDM sub grinzi și sub tălpi (lățime 15 cm)', 'm', R(Q.sill + 3 * L + 2 * W));
    const baleNet = Q.baleWall + Q.baleFloor + Q.baleRoof;
    bom('Baloți de paie', 'Baloți pereți (pe cant), 50×40×100 cm', 'buc', C1(Q.baleWall), 'net, din suprafața pereților fără goluri (frontoanele până sub căpriori)');
    bom('Baloți de paie', 'Baloți platformă (culcați între grinzi)', 'buc', C1(Q.baleFloor));
    bom('Baloți de paie', 'Baloți acoperiș (culcați între căpriori, pe ambii versanți)', 'buc', C1(Q.baleRoof));
    bom('Baloți de paie', 'TOTAL de comandat (+10 % pierderi, tăieri, umpluturi)', 'buc', C1(baleNet * 1.10), 'densitate 90–120 kg/m³, umiditate < 15 %');
    bom('Baloți de paie', 'Sfoară polipropilenă pentru relegat baloți tăiați', 'rolă', 2);
    bom('Baloți de paie', 'Țăruși alun/salcâm Ø3 cm × 35 cm (în talpă, la 50 cm)', 'buc', Q.stakeS);
    bom('Baloți de paie', 'Țăruși alun/salcâm Ø3 cm × 110 cm (prin rânduri, la 50 cm)', 'buc', Q.stakeL);
    const vE = Q.plExt * PL * 1.25;
    const vI = Q.plInt * PL * 1.25;
    bom('Tencuieli', 'Suprafață tencuială exterioară de var (3 straturi, 3,5 cm)', 'm²', Q.plExt);
    bom('Tencuieli', 'Var hidraulic natural NHL 3,5 (≈250 kg/m³ mortar)', 'kg', R((vE * 250) / 25) * 25, `mortar ≈ ${vE.toFixed(1)} m³`);
    bom('Tencuieli', 'Nisip 0–4 mm pentru tencuiala de var', 'm³', vE * 1.05);
    bom('Tencuieli', 'Suprafață tencuială interioară de argilă (3,5 cm)', 'm²', Q.plInt);
    bom('Tencuieli', 'Argilă (lut) cernută', 'm³', vI * 0.35, `mortar ≈ ${vI.toFixed(1)} m³`);
    bom('Tencuieli', 'Nisip 0–4 mm pentru tencuiala de argilă', 'm³', vI * 0.9);
    bom('Tencuieli', 'Paie tocate pentru tencuiala de argilă', 'kg', R(vI * 25));
    bom('Tencuieli', 'Plasă fibră de sticlă/iută (peste lemn, colțuri, goluri)', 'm²', (Q.plExt + Q.plInt) * 0.3);
    bom('Tencuieli', 'Plasă zincată ochi 6 mm anti-rozătoare la baza pereților (50 cm)', 'm²', 2 * (W + L) * 0.5);
    bom('Acoperiș', 'Tablă fălțuită (dublu fălț) 0,5–0,6 mm, lățime utilă ~52 cm', 'm²', roofArea * 1.08, `net ${roofArea.toFixed(1)} m² pe 2 versanți; fâșii de ${((ZR + C.ovE) / COS + 0.1).toFixed(2)} m`);
    bom('Acoperiș', 'Cleme fixe + mobile pentru tablă fălțuită', 'buc', R(roofArea * 8));
    bom('Acoperiș', 'Membrană de separare structurată sub tablă', 'm²', roofArea * 1.1);
    bom('Acoperiș', 'Astereală scândură 2,4 cm', 'm²', roofArea * 1.1, `≈ ${(roofArea * 1.1 * 0.024).toFixed(2)} m³`);
    bom('Acoperiș', 'Membrană de difuzie (peste OSB 12, sub contra-șipci)', 'm²', roofArea * 1.1);
    bom('Plăci', 'OSB3 12 mm (peste căpriori)', 'm²', roofArea);
    bom('Plăci', 'OSB3 18 mm – eclise la coamă (2 pe fiecare pereche de căpriori, 36×70 cm)', 'm²', RX.length * 2 * 0.36 * 0.70);
    bom('Acoperiș', 'Frână de vapori la tavan + bandă de etanșare', 'm²', ceilArea * 1.1);
    bom('Acoperiș', 'Lăți 4×5 pentru stratul de instalații de sub tavan (la 50 cm)', 'm', R(ceilArea / 0.5));
    bom('Acoperiș', 'Lambriu/scândură tavan 2 cm', 'm²', ceilArea * 1.1);
    bom('Acoperiș', 'Lambriu exterior pentru streașini (sofit) + grilă anti-insecte la intrarea aerului', 'm²', 2 * C.ovE * (XR - XL) + (4 * 0.5 * (ZR + C.ovE)) / COS);
    bom('Acoperiș', 'Pazie scândură 2,4×25 cm (2 rânduri pe contur)', 'm', 2 * (2 * (XR - XL) + (4 * (ZR + C.ovE)) / COS));
    bom('Acoperiș', 'Coamă ventilată (profil + bandă de etanșare respirantă)', 'm', XR - XL + 0.1);
    bom('Acoperiș', 'Șorț de streașină + borduri laterale din tablă', 'm', 2 * (XR - XL) + (4 * (ZR + C.ovE)) / COS);
    bom('Acoperiș', 'Jgheab Ø150 (pe ambele streașini)', 'm', 2 * (XR - XL + 0.1));
    bom('Acoperiș', 'Cârlige jgheab', 'buc', 2 * (C1((XR - XL) / 0.6) + 1));
    bom('Acoperiș', 'Burlan Ø100 (4 coborâri) + coturi, racorduri, capace', 'm', 4 * C1(slY(-C.ovE, 0.4)));
    bom('Acoperiș', 'Parazăpezi tubulari pe tablă fălțuită (2 rânduri, versantul sud)', 'm', 2 * (XR - XL - 0.4));
    bom('Acoperiș', 'Bandă perforată 40×2 mm – contravântuire în planul acoperișului', 'm', 4 * C1(Math.hypot((ZR + C.ovE) / COS, XR - XL)) + 2);
    bom('Acoperiș', 'Coș de fum inox izolat Ø150 + trecere prin acoperiș (manșon, distanțe față de paie)', 'm', C1(yApex + 0.568 + 0.6 - F - 1.05));
    bom('Pardoseli', 'Parchet stratificat stejar 14 mm, compatibil cu încălzirea în pardoseală (R ≤ 0,15 m²K/W)', 'm²', aParq * 1.06);
    bom('Pardoseli', 'Suport izolant-reflectorizant 6 mm pentru folie încălzitoare', 'm²', aParq * 1.05);
    bom('Pardoseli', 'Folie PE 0,2 mm (barieră de vapori peste folia încălzitoare)', 'm²', aParq * 1.15);
    bom('Pardoseli', 'Plintă lemn 1,5×6 cm (rost de dilatare 10 mm la pereți)', 'm', R(2 * (W - 2 * T + L - 2 * T) + 2 * 2 * 3.0 + 6));
    bom('Pardoseli', 'Placă cimentoasă 12 mm + hidroizolație (baie, cameră tehnică)', 'm²', aTile * 1.1);
    bom('Pardoseli', 'Gresie 30×60 + adeziv flexibil (baie, cameră tehnică)', 'm²', aTile * 1.1);
    bom('Tratamente', 'Soluție de protecție lemn (borax/insecto-fungicid), ~0,2 L/m²', 'L', 60);
    bom('Tratamente', 'Ulei/lazură pentru terasă, trepte și pazii', 'L', 10);
    const kg = (n: number, perKg: number) => C1(n / perKg);
    const col = Q.joists * 3 * 2;
    bom('Feronerie și fixări', 'Colțar 90×90×65×2,5 (grinzi-scară de podea pe grinzile de fundație)', 'buc', col);
    bom('Feronerie și fixări', 'Ancoră de căprior / colțar 90×90 (căpriori-scară pe cosoroabele N/S)', 'buc', Q.anchors);
    bom('Feronerie și fixări', 'Șurub pentru colțare 5×50', 'buc', C1(((col + Q.anchors) * 8) / 100) * 100);
    bom('Feronerie și fixări', 'Colțar întărit 105×105×90×3 (stâlpi: 2 jos + 2 sus)', 'buc', Q.brk);
    bom('Feronerie și fixări', 'Ancoră de ridicare (hold-down) ≥ 75 kN (tip WHT 740) + tijă filetată M20 prin platformă și grinda de fundație, cu placă sub grindă', 'buc', Q.hd, 'la capetele fiecărei cruci de tiranți și la capetele pereților');
    bom('Feronerie și fixări', 'Tirant oțel Ø20 S355, capete filetate M20, cu întinzător, gusee de capăt 8 mm și 2 buloane M16 pe gusee', 'buc', Q.diag, `lungime totală ${(Q.rodLen || 0).toFixed(1)} m; în planul stâlpilor, baloții se crestează 2 cm`);
    bom('Feronerie și fixări', 'Eclise metalice 6 mm + 4 buloane M16 (pana pe stâlpii de coamă)', 'set', 2);
    bom('Feronerie și fixări', 'Papuc de grindă (cosoroabele înclinate în fețele penei)', 'buc', 4);
    bom('Feronerie și fixări', 'Holzșurub cap disc 8×300 (căpriori în pană), 8×240 (căpriori pe cosoroabe, buiandrugi)', 'buc', C1((RX.length * 2 * 2 + Q.rafters + Q.posts * 2) / 50) * 50);
    bom('Feronerie și fixări', 'Șurub 8×160 (colțuri cosoroabe, gusee tiranți)', 'buc', C1((Q.diag * 4 + 16) / 25) * 25);
    bom('Feronerie și fixări', 'Tirfon 10×160 + șaibă (tălpi în platformă, la 60 cm)', 'buc', C1(Q.sill / 0.6));
    bom('Feronerie și fixări', 'Cuie 2,8×65 (inimi OSB pe tălpi, la 10 cm, 2 rânduri)', 'kg', kg(Q.chord / 0.10, 340), `≈ ${R(Q.chord / 0.10)} buc`);
    bom('Feronerie și fixări', 'Cuie 3,1×80 (eclise OSB la coamă, la 7 cm; astereală; pazii)', 'kg', kg(roofArea * 35 + RX.length * 2 * 60, 210));
    bom('Feronerie și fixări', 'Șurub 4,5×50 pentru plăci OSB (~25 buc/m²)', 'buc', C1((Q.osbArea * 25) / 500) * 500);
    bom('Feronerie și fixări', 'Cuie 4×100 (contra-șipci pe căpriori, la 40 cm)', 'kg', kg((Q.rafters * (ZR + C.ovE)) / COS / 0.4, 100));
    bom('Feronerie și fixări', 'Cuie 2×40 / capse pentru lambriu tavan', 'kg', kg(ceilArea * 40, 1100));
    bom('Feronerie și fixări', 'Șurub inox 5×60 pentru terasă și trepte', 'buc', C1((Q.deckBoards * Q.tJoists * 2 + 120) / 100) * 100);
    bom('Feronerie și fixări', 'Șurub 8×160 (structură terasă, balustradă, vanguri)', 'buc', 100);
    bom('Feronerie și fixări', 'Șurub 4×25 cu garnitură (cleme tablă, șorțuri)', 'buc', C1((roofArea * 10) / 100) * 100);
    bom('Feronerie și fixări', 'Șurub 3,9×35 pentru plăci pereți interiori', 'buc', 1500);
    bom('Feronerie și fixări', 'Spumă/bandă precomprimată pentru montaj tâmplărie', 'm', 45);
  }

  /* ============================== ETICHETE ARHITECTURALE CURATE ============================== */
  const LABELS: THREE.Sprite[] = [];
  function makeLabel(text: string, x: number, z: number, color = '#24292e', y = 0.7, sc = 1, parent?: THREE.Object3D) {
    const cv = document.createElement('canvas');
    cv.width = 1024;
    cv.height = 128;
    const g = cv.getContext('2d')!;
    g.font = '600 54px "Plus Jakarta Sans", "Segoe UI", sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const tw = Math.min(960, g.measureText(text).width + 72);
    const rx = (1024 - tw) / 2;
    g.fillStyle = 'rgba(255, 253, 248, 0.86)';
    g.strokeStyle = 'rgba(36, 41, 46, 0.22)';
    g.lineWidth = 4;
    g.beginPath();
    g.roundRect(rx, 20, tw, 88, 18);
    g.fill();
    g.stroke();
    g.fillStyle = color;
    g.fillText(text, 512, 65);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
    sp.scale.set(7.2 * sc, 0.9 * sc, 1);
    sp.position.set(x, y, z);
    if (parent) parent.add(sp);
    else {
      scene.add(sp);
      LABELS.push(sp);
    }
    return sp;
  }

  makeLabel('N ↑  Str. Blocului', W / 2 + 4, SITE.z0 - 4.0, '#1d2024', 0.85, 0.9);
  makeLabel('POARTĂ', (GATE.x0 + GATE.x1) / 2, SITE.z0 + 1.2, '#1d2024', 2.2, 0.55);
  makeLabel('CASA VECHE (se păstrează)', 6.85, yz(-16.7), '#42474e', 6.4, 0.78);
  makeLabel('BOLTĂ CU VIȚĂ', 2.0, yz(-18.2), '#2f5d1e', 3.6, 0.52);
  makeLabel('☀ SUD – GRĂDINA', W / 2 + 0.6, L + 16, '#2f5d1e', 0.85, 0.9);

  /* ============================== SOARE & DOME SOLAR ============================== */
  const SUNT = new THREE.Vector3(W / 2, 0, L / 2);
  const DOME_R = 28;
  const dome = new THREE.Group();
  dome.position.copy(SUNT);
  scene.add(dome);

  const lineOf = (pts: THREE.Vector3[], color: number, dashed = false) => {
    const g = new THREE.BufferGeometry().setFromPoints(pts);
    const m = dashed ? new THREE.LineDashedMaterial({ color, dashSize: 0.8, gapSize: 0.5 }) : new THREE.LineBasicMaterial({ color });
    const l = new THREE.Line(g, m);
    if (dashed) l.computeLineDistances();
    return l;
  };
  const pathPts = (n: number) => {
    const p: THREE.Vector3[] = [];
    for (let h = 3; h <= 21; h += 0.1) {
      const s = sunPos(n, h);
      if (s.alt > -0.02) p.push(new THREE.Vector3(s.vx, s.vy, s.vz).multiplyScalar(DOME_R));
    }
    return p;
  };
  {
    const ring: THREE.Vector3[] = [];
    for (let a = 0; a <= 64; a++) ring.push(new THREE.Vector3(DOME_R * Math.sin((a / 64) * 2 * Math.PI), 0.05, -DOME_R * Math.cos((a / 64) * 2 * Math.PI)));
    dome.add(lineOf(ring, 0x666666));
    for (const [a, t, col] of [
      [0, 'N', '#b02020'],
      [90, 'E', '#333'],
      [180, 'S', '#333'],
      [270, 'V', '#333'],
    ] as [number, string, string][]) {
      const r = a * RAD;
      const sp = makeLabel(t, 0, 0, col, 0.6, 1.0, dome);
      sp.position.set((DOME_R + 1.5) * Math.sin(r), 0.6, -(DOME_R + 1.5) * Math.cos(r));
      dome.add(lineOf([new THREE.Vector3(0, 0.05, 0), new THREE.Vector3(DOME_R * Math.sin(r), 0.05, -DOME_R * Math.cos(r))], 0x999999));
    }
    for (const [n, name, , col] of SEASONS.filter((s) => s[0] !== 266)) {
      dome.add(lineOf(pathPts(n), col));
      const noon = sunPos(n, 12);
      const sp = makeLabel(
        `${name === 'Primăvară' ? 'echinocțiu' : name} · ${Math.round(noon.alt / RAD)}° la prânz`,
        0,
        0,
        '#' + col.toString(16).padStart(6, '0'),
        0.6,
        1.15,
        dome,
      );
      sp.position.set(noon.vx, noon.vy, noon.vz).multiplyScalar(DOME_R + 1.2);
    }
  }
  let todayPath: THREE.Line | null = null;
  const hourDots = new THREE.Group();
  dome.add(hourDots);
  const sunBall = new THREE.Mesh(new THREE.SphereGeometry(0.9, 20, 14), new THREE.MeshBasicMaterial({ color: 0xffd23f }));
  dome.add(sunBall);
  const sunRay = lineOf([new THREE.Vector3(), new THREE.Vector3(0, 1, 0)], 0xffb000, true);
  dome.add(sunRay);
  const dotMat = new THREE.MeshBasicMaterial({ color: 0x222222 });
  let lastDomeDay = -1;

  function buildToday(n: number) {
    if (todayPath) {
      dome.remove(todayPath);
      todayPath.geometry.dispose();
    }
    todayPath = lineOf(pathPts(n), 0xffe066, true);
    dome.add(todayPath);
    for (const c of [...hourDots.children] as any[]) {
      hourDots.remove(c);
      if (c.material && c.material.map) {
        c.material.map.dispose();
        c.material.dispose();
      }
    }
    for (let h = 4; h <= 20; h++) {
      const s = sunPos(n, h);
      if (s.alt <= 0) continue;
      const d = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 6), dotMat);
      d.position.set(s.vx, s.vy, s.vz).multiplyScalar(DOME_R);
      hourDots.add(d);
      if (h % 2 === 0) {
        const sp = makeLabel(hm(toLocal(n, h)), 0, 0, '#333', 0.6, 0.72, hourDots);
        sp.position.set(s.vx, s.vy, s.vz).multiplyScalar(DOME_R + 1.0);
      }
    }
  }

  const PV_N = new THREE.Vector3(0, COS, SIN);
  const PV_C = PVP.map((q) => new THREE.Vector3((q.x0 + q.x1) / 2, slY((q.za + q.zb) / 2, 0.6), L - (q.za + q.zb) / 2));
  const OCC: THREE.Object3D[] = [];
  for (const g of [G.teren, G.vecini]) g.traverse((m) => { if ((m as THREE.Mesh).isMesh) OCC.push(m); });
  const rcS = new THREE.Raycaster();
  const _sunVec = new THREE.Vector3();

  function litPanels(v: THREE.Vector3) {
    let lit = 0;
    rcS.far = 120;
    for (const c of PV_C) {
      rcS.set(c, v);
      if (!rcS.intersectObjects(OCC, false).some((h) => h.distance > 0.05)) lit++;
    }
    return lit;
  }

  function dayEnergy(n: number) {
    const hd = halfDay(n);
    const dt = 0.25;
    let e = 0;
    let e0 = 0;
    let sunH = 0;
    for (let h = 12 - hd + dt / 2; h < 12 + hd; h += dt) {
      const s = sunPos(n, h);
      const dni = clearSky(s.alt);
      _sunVec.set(s.vx, s.vy, s.vz);
      const ci = Math.max(0, _sunVec.dot(PV_N));
      const dif = (0.12 * dni * (1 + COS)) / 2;
      const f = ci > 0 ? litPanels(_sunVec) / PV_C.length : 0;
      e += (dni * ci * f + dif) * dt;
      e0 += (dni * ci + dif) * dt;
      if (ci > 0 && f > 0.5) sunH += dt;
    }
    const k = (pvKw / 1000) * 0.85;
    return { e: e * k, e0: e0 * k, sunH };
  }

  function updateSunVisuals(n: number, hr: number) {
    const s = sunPos(n, hr);
    _sunVec.set(s.vx, s.vy, s.vz);
    sunBall.position.copy(_sunVec).multiplyScalar(DOME_R);
    sunBall.visible = s.alt > -0.02;
    sunRay.geometry.setFromPoints([new THREE.Vector3(0, 1, 0), _sunVec.clone().multiplyScalar(DOME_R)]);
    sunRay.computeLineDistances();
    sunRay.visible = s.alt > 0;
    if (n !== lastDomeDay) {
      buildToday(n);
      lastDomeDay = n;
    }
    const ci = _sunVec.dot(PV_N);
    const lit = s.alt > 0 && ci > 0 ? litPanels(_sunVec) : 0;
    const kwNow = s.alt > 0 && ci > 0 ? (((clearSky(s.alt) * ci * lit) / PV_C.length) * pvKw) / 1000 * 0.85 : 0;
    return { alt: s.alt, az: s.az, lit, totalPv: PV_C.length, ci, kwNow };
  }

  /* ============================== ETAPE DE CONSTRUCȚIE ============================== */
  const RF = ['coama', 'acopStr', 'tavan', 'paieAcop', 'invelitoare', 'pv'];
  const cX = W / 2;
  const cZ = L / 2;
  const V: Record<string, [[number, number, number], [number, number, number]]> = {
    low: [[8.7, 4.2, -4.0], [3.4, 0.2, 5.5]],
    plat: [[cX + 8.5, 7, cZ + 11], [cX, 0.6, cZ]],
    frame: [[cX + 11, 7, cZ + 13], [cX, 2.2, cZ]],
    roof: [[cX + 10, 14, cZ + 13], [cX, 3.5, cZ]],
    house: [[cX + 12, 8, cZ + 16], [cX, 2.2, cZ]],
    inside: [[cX + 5, 13, cZ + 8.5], [cX, 1, cZ]],
    under: [[cX + 16, 12, -28], [3.5, -1, -9]],
    piles: [[8.7, 2.8, -3.8], [3.2, -1.2, 5.5]],
    all: [[cX + 13, 9, cZ + 19], [cX, 1.8, cZ + 1.5]],
    ridge: [[cX + 6, 8, cZ + 7], [cX, 4.5, cZ]],
  };
  const B = Math.ceil;
  const nfLocal = (x: number, d = 1) => x.toLocaleString('ro-RO', { minimumFractionDigits: d, maximumFractionDigits: d });

  const STEPS: BuildStepDef[] = [
    {
      t: 'Piloni șurub',
      layers: ['piloni'],
      key: 'idx',
      dur: 6,
      view: V.piles,
      xray: true,
      p: [
        'Se trasează conturul casei (7,20 × 11,73 m), cu latura lungă pe direcția nord–sud, și se verifică diagonalele.',
        `Se marchează cele 3 șiruri de piloni (vest, mijloc, est), pe aceeași grilă, la ${nfLocal(PSP, 2)} m, și pilonii de sub pereții de nord și de sud, la 1,70 m.`,
        'Sub pereții N/S (care poartă acoperișul) și în PERECHI sub fiecare stâlp de coamă: piloni grei tip B (Ø133, 2 elice Ø400, L 3 m). În rest: tip A (Ø108, elice Ø300, L 2,5 m).',
        `Fiecare pilon se înșurubează cu cuplu-metru și se notează cuplul final: cel puțin ${PT.A.T} kN·m la tipul A și ${PT.B.T} kN·m la tipul B; dacă nu se atinge, se prelungește. Capetele se taie la ~25 cm peste sol.`,
      ],
      m: `${Q.pileTH.B} piloni tip B + ${Q.pileTH.A} piloni tip A, capete în U, ${Q.pilesHouse * 2} buloane M12.`,
      w: `Pilonii de sub stâlpii de coamă sunt cei mai încărcați (~57 kN de calcul fiecare, ${PT.B.Rd} kN capacitate presupusă) – capacitatea se confirmă prin cuplul de înșurubare.`,
      items: [],
    },
    {
      t: 'Grinzi de fundație 15×24',
      layers: ['grinzi'],
      key: 'idx',
      dur: 4,
      view: V.low,
      p: [
        'Se pune bandă bituminoasă în fiecare cap de pilon.',
        'Se așază cele 3 grinzi longitudinale (N–S); înnădirile se fac numai deasupra unui pilon.',
        'Se montează grinzile de capăt (sub pereții N și S) în papuci metalici.',
        'Se reglează nivelul și se strâng buloanele.',
      ],
      m: `≈ ${nfLocal(3 * L + 4 * (BX[1] - BX[0] - 0.15), 0)} m grindă 15×24 C24, 8 papuci metalici.`,
      w: 'Diferența de nivel admisă între colțuri: cel mult 5 mm.',
      items: [],
    },
    {
      t: 'Hazna, puț și rețelele îngropate',
      layers: ['instExt'],
      key: 'idx',
      dur: 6,
      view: V.under,
      xray: true,
      p: [
        'Cât terenul de sub casă este liber, se sapă șanțul colectorului Ø110, cu pantă de 2 %, de sub bucătărie spre nord.',
        'Se lasă coborârile pentru bucătărie, camera tehnică, duș, lavoar și WC.',
        'Se montează căminul de vizitare și se toarnă hazna în curtea casei vechi (accesibilă vidanjei).',
        'Se sapă puțul în curte, lângă gardul de vest, și se pozează PEHD-ul la 1 m adâncime: spre est pe nord de hazna, apoi spre sud pe sub casă.',
      ],
      m: 'PVC-KG Ø110 și Ø50, cămin Ø400, beton și armătură pentru hazna, tuburi de puț, PEHD Ø32 și cablul pompei.',
      w: 'După platformă nu se mai poate săpa sub casă. Puț ↔ hazna: 10 m, hazna ↔ casă: 5 m – confirmă distanțele cu autoritatea sanitară locală.',
      items: [],
    },
    {
      t: 'Platforma: OSB de fund și grinzi-scară',
      layers: ['platforma', 'instPod'],
      key: 'idx',
      dur: 7,
      view: V.plat,
      p: [
        'Peste grinzi se fixează OSB de 18 mm – fundul cutiei.',
        'Se montează grinzile-scară de 40 cm (E–V) la ' + nfLocal(spJ, 3) + ' m, cu 2 colțare pe reazem.',
        'Sub pereții N și S (care poartă acoperișul) se pune câte o grindă-scară suplimentară chiar peste grinda de capăt.',
        'În câmpul de sub fiecare stâlp de coamă se pune un bloc lamelar 38×40 (nu paie).',
        'Se scot coloanele de canalizare și apă, cu manșon izolator.',
      ],
      m: `${Q.joists} grinzi-scară de 7,2 m, ${nfLocal(W * L + 2 * L * 0.4, 0)} m² OSB 18, 2 blocuri lamelare.`,
      w: 'Lumina dintre grinzi trebuie să fie 48–49 cm, altfel baloții nu intră strâns.',
      items: [],
    },
    {
      t: 'Baloți în platformă',
      layers: ['paiePod'],
      key: 'idx',
      dur: 6,
      view: V.plat,
      p: [
        'Baloții se așază culcați (40 cm) între grinzile-scară, presați.',
        'Rosturile se decalează de la un câmp la altul.',
        'Golurile se îndeasă cu paie libere.',
      ],
      m: `≈ ${B(Q.baleFloor)} baloți 50×40×100.`,
      w: 'Numai pe vreme uscată; ce s-a umplut se acoperă în aceeași zi.',
      items: [],
    },
    {
      t: 'Podea brută OSB 22',
      layers: ['podea'],
      key: 'idx',
      dur: 3,
      view: V.plat,
      p: [
        'OSB de 22 mm cu nut și feder, înșurubat în fiecare grindă-scară.',
        'Placa este șaiba orizontală care rigidizează platforma.',
        'Tălpile pereților se pun DIRECT pe acest OSB; parchetul vine la final, între pereți.',
      ],
      m: `${nfLocal(W * L, 0)} m² OSB 22 mm.`,
      w: 'Până la acoperiș, platforma se ține acoperită cu folie.',
      items: [],
    },
    {
      t: 'Cadrul de lemn al pereților',
      layers: ['structura', 'feronerie'],
      key: 'y',
      dur: 10,
      view: V.frame,
      p: [
        'Tălpile duble 10×10 se prind cu tirfoane, cu traverse sub fiecare stâlp.',
        'Stâlpi 12×12 la pereții N/S și 12×20 la frontoanele de est și vest, la cel mult 1,80 m și de o parte și de alta a golurilor.',
        'Buiandrugii stau PE stâlpii de gol. Pe pereții N/S, cosoroaba 12×20 cu fața de sus teșită la 30° trece peste stâlpii de colț și iese 42 cm în consolă.',
        'Cruci din tiranți de oțel Ø20 cu întinzător, câte două în fiecare perete, în panourile fără goluri; ancore de ridicare la capete.',
        'Pe frontoane: cosoroabele înclinate, de la cosoroaba N/S până la locul penei.',
        'Pe frontonul de vest, fereastra mare (2,20 m) stă la sud de stâlpul de coamă, în dreptul canapelei, între doi stâlpi de gol, cu buiandrug 20×15 – stâlpul de coamă coboară neîntrerupt până în platformă.',
      ],
      m: `${Q.posts} stâlpi, ${Q.diag} tiranți Ø20, ${Q.hd} ancore de ridicare, cosoroabe 12×20 și 12×15.`,
      w: 'Stâlpii se verifică la fir cu plumb și se sprijină provizoriu (șipci în diagonală) până se întind tiranții.',
      items: [],
    },
    {
      t: 'Stâlpii de coamă și pana',
      layers: ['coama'],
      key: 'idx',
      dur: 5,
      view: V.ridge,
      p: [
        'Se ridică cei doi stâlpi de coamă 20×20, la mijlocul frontoanelor, peste perechile de piloni.',
        `Pana GL24h ${Math.round(RIDGE.b * 100)}×${Math.round(RIDGE.h * 100)}, o singură bucată de ${nfLocal(XR - XL, 2)} m, se ridică cu macara sau palan.`,
        'Pana se prinde de stâlpi cu eclise metalice de 6 mm pe ambele fețe și 4 buloane M16.',
        'Cosoroabele înclinate ale frontoanelor se prind în fețele penei cu papuci de grindă.',
      ],
      m: `2 stâlpi 20×20 GL24h, pană ${nfLocal(RIDGE.b * RIDGE.h * (XR - XL), 2)} m³ GL24h (~${Math.round(RIDGE.b * RIDGE.h * (XR - XL) * 420)} kg).`,
      w: 'Pana este cea mai grea piesă: se ridică doar cu mijloace de ridicat și cu stâlpii sprijiniți provizoriu.',
      items: [],
    },
    {
      t: 'Căpriorii-scară',
      layers: ['acopStr'],
      key: 'idx',
      dur: 7,
      view: V.roof,
      p: [
        `Căpriori-scară de 40 cm la ${nfLocal(PR, 3)} m, câte ${RX.length} pe fiecare versant, de la streașină (0,80 m) până peste pană.`,
        'Talpa de jos stă pe fața teșită a cosoroabei N/S (ancoră de căprior) și pe teșitura penei.',
        'Capetele de la coamă se taie vertical, se lipesc pereche și se prind cu eclise OSB 18 pe ambele fețe + 2 holzșuruburi 8×300 în pană.',
        'Câte un căprior cade exact pe axul fiecărui fronton; căpriorii de margine stau pe consolele cosoroabelor și ale penei.',
      ],
      m: `${Q.rafters} căpriori-scară de ${nfLocal((ZR + C.ovE) / COS, 2)} m.`,
      w: 'Acoperișul se face ÎNAINTEA pereților de paie, ca baloții să fie puși la adăpost.',
      items: [],
    },
    {
      t: 'Tavan și baloți în acoperiș',
      layers: ['tavan', 'paieAcop'],
      key: 'idx',
      dur: 6,
      view: V.roof,
      p: [
        'De dedesubt: frâna de vapori, lățile de instalații de 4 cm și lambriul – ele susțin baloții.',
        'De sus, baloții se așază culcați între căpriori, pe ambii versanți.',
        'Coșul trece printre doi căpriori, pe versantul sudic, în zona colțului sud-vest: acolo se pune un manșon de vată minerală (nu paie) și o ramă de tablă la tavan.',
      ],
      m: `≈ ${B(Q.baleRoof)} baloți, ${nfLocal(ceilArea, 0)} m² lambriu și frână de vapori.`,
      w: 'Frâna de vapori se lipește etanș la toate îmbinările.',
      items: [],
    },
    {
      t: 'Astereală și tablă fălțuită',
      layers: ['invelitoare'],
      key: 'n',
      dur: 7,
      view: V.roof,
      p: [
        'OSB de 12 mm și membrană de difuzie.',
        'Contra-șipci 5×5 pe fiecare căprior – stratul ventilat, cu intrarea aerului la streașini și ieșirea prin coama ventilată.',
        'Astereală de 24 mm și membrană de separare.',
        'Tablă fălțuită, jgheaburi pe ambele streașini, 4 burlane, parazăpezi pe versantul sud.',
      ],
      m: `${nfLocal(roofArea, 0)} m² pe doi versanți.`,
      w: 'La 30° tabla și panourile se descarcă repede de zăpadă – de aceea parazăpezile deasupra terasei.',
      items: [],
    },
    {
      t: 'Pereții de baloți',
      layers: ['tarusi', 'baloti'],
      key: 'ytop',
      dur: 12,
      view: V.house,
      p: [
        'Primul rând se înfige în țărușii din talpă.',
        'Baloții pe cant (rânduri de 50 cm, perete de 40 cm), țesuți ca la zidărie.',
        'Baloții se crestează 2 cm în dreptul tiranților; la stâlpi și goluri se taie și se releagă. Tiranții se întind după montarea baloților.',
        'Pe frontoane baloții urcă până sub căpriori; țăruși lungi prin rânduri la fiecare metru.',
      ],
      m: `≈ ${B(Q.baleWall)} baloți, ${Q.stakeS} țăruși scurți și ${Q.stakeL} lungi.`,
      w: 'Baloți cu umiditate sub 15 %. Pereții se tencuiesc cât mai repede.',
      items: [],
    },
    {
      t: 'Ferestre și uși',
      layers: ['tamplarie'],
      key: 'idx',
      dur: 4,
      view: V.house,
      p: [
        'Tâmplăria se montează în cutiile de OSB, spre fața exterioară.',
        'Etanșare cu bandă precomprimată și folii de racord.',
        'Glafuri exterioare cu picurător.',
      ],
      m: `${WALLS.reduce((a, w) => a + w.openings.filter((o) => o.type === 'win').length, 0)} ferestre, ${WALLS.reduce((a, w) => a + w.openings.filter((o) => o.type === 'door').length, 0)} uși exterioare.`,
      w: 'Fereastra mare de vest (2,20 × 1,65 m, parapet 0,40 m cu banchetă) e fereastră de lumină: fixă, cu geam mat. La 0,8 m de limită, Codul civil (art. 615–616) nu permite fereastră de vedere fără acordul vecinului.',
      items: [],
    },
    {
      t: 'Tencuieli: var la exterior, argilă la interior',
      layers: ['tencuiala'],
      key: 'idx',
      dur: 6,
      view: V.house,
      p: [
        'Pereții se tund drept, iar lemnul și colțurile se acoperă cu plasă.',
        'Tuburile electrice și dozele din pereții exteriori se pun acum.',
        '3 straturi, în total 3–4 cm.',
      ],
      m: `${nfLocal(Q.plExt, 0)} m² var, ${nfLocal(Q.plInt, 0)} m² argilă.`,
      w: 'Tencuiala este și protecția la foc a paielor.',
      items: [],
    },
    {
      t: 'Pereți interiori, pod de depozitare, apă și canalizare',
      layers: ['interiorStr', 'interior', 'instInt'],
      key: 'idx',
      dur: 6,
      view: V.inside,
      hide: RF,
      p: [
        'Pereții despărțitori pe schelet 5×10 cu casete pentru uși interioare retractabile în perete (1 foaie la dormitoare, 2 foi simetrice la baie și camera tehnică).',
        'Peste baie și camera tehnică: tavan drept la 2,50 m și pod de depozitare cu chepeng.',
        'Apa rece (albastru) și caldă (roșu); aerisirea coloanei prin versantul nordic.',
      ],
      m: '≈ 19 m PPR, plăci gips-fibră.',
      w: 'Acoperișul este ascuns în această vedere.',
      items: [],
    },
    {
      t: 'Instalația electrică pe baterii',
      layers: ['electric'],
      key: 'idx',
      dur: 7,
      view: V.inside,
      hide: RF,
      p: [
        'În camera tehnică: invertorul hibrid, 3 baterii LiFePO4 (15 kWh), tabloul DC fotovoltaic (SPD/separator) și tabloul AC cu transfer rețea/generator.',
        'Cablurile merg în stratul de instalații de sub tavan (nu străpung frâna de vapori); lustre suspendate sub tavanul înalt.',
        `Prizele: ${Q.nCirc} circuite (plita și boilerul pe circuite proprii), coborâri în tub, lângă mobilierul care le folosește; întrerupătoarele lângă clanța fiecărei uși, termostatele deasupra lor.`,
      ],
      m: `cabluri CYY-F, tub ignifug, ${Q.nSock} prize, ${Q.nSw} întrerupătoare, ${Q.nLamp} corpuri de iluminat.`,
      w: 'Niciun cablu liber prin paie: numai în tub ignifug.',
      items: [],
    },
    {
      t: 'Panouri fotovoltaice pe versantul sud',
      layers: ['pv'],
      key: 'idx',
      dur: 4,
      view: V.roof,
      p: [
        `${nPV} panouri pe șine prinse cu cleme pe falțul tablei, fără găurirea învelitorii.`,
        'Panourile stau pe versantul sud la 30° – orientarea cea bună la această latitudine.',
        'Cablul de curent continuu coboară în camera tehnică.',
        'Panourile sunt urcate la 0,28 m sub coamă, ca între rândul de jos și peretele de sud să rămână loc liber pentru coșul sobei.',
      ],
      m: `${nPV} panouri de 450 W (${nfLocal(pvKw)} kWp), șine, cablu solar.`,
      w: 'Verifică umbrirea cu simularea soarelui (21 dec), mai ales dacă plantezi pomi la sud.',
      items: [],
    },
    {
      t: 'Încălzire în pardoseală + parchet',
      layers: ['incalzire', 'parchet'],
      key: 'idx',
      dur: 5,
      view: V.inside,
      hide: RF,
      p: [
        'Peste OSB-ul de 22 mm: suport izolant-reflectorizant de 6 mm.',
        'Folie de carbon de 70 W/m² pe zone, fără a intra sub mobilierul fix și sub sobă.',
        'Folie PE de 0,2 mm, apoi parchet stratificat de stejar de 14 mm, montat flotant, cu rost de 10 mm la pereți.',
        'În baie și în camera tehnică: covor de 150 W/m² în adeziv, sub gresie.',
      ],
      m: `${heatArea.toFixed(0)} m² încălziți, ${heatKw.toFixed(1)} kW, ${ZON.length} termostate cu senzor de pardoseală.`,
      w: 'Senzorul de pardoseală limitează temperatura sub parchet la 27 °C.',
      items: [],
    },
    {
      t: 'Terasele și treptele',
      layers: ['terasa'],
      key: 'idx',
      dur: 8,
      view: V.all,
      p: [
        'Pilonii teraselor și ai rampei (tip A) și grinzile 10×20; sub rampă, popi 9×9 pe capetele pilonilor – nimic din lemn în pământ.',
        'Grinzișoare 5×15 la 50 cm.',
        'Dușumea cu rost de 5 mm.',
        'Balustrade; trepte spre grădină la terasa mare și la capătul sudic al platformei laterale; la capătul nordic, rampă de acces cu pantă 10 % (8,4 m).',
      ],
      m: 'piloni, dușumea de terasă, grinzi 10×20.',
      w: 'Structura teraselor rămâne separată de casă, cu rost de 2 cm.',
      items: [],
    },
    {
      t: 'Sobă, finisaje și mobilier',
      layers: ['mobilier'],
      key: 'idx',
      dur: 5,
      view: V.all,
      p: [
        'Soba în colțul de sud-vest, lângă bancheta ferestrei de sud și zona cozy de șemineu (2 fotolii, puf, măsuță); ferestrele joase au spații de șezut în grosimea peretelui de 40 cm.',
        'Coșul inox izolat urcă drept prin versantul sudic (la sud de panourile PV, fără să le umbrească) și depășește coama cu cel puțin 0,6 m.',
        'Suportul de lemne lângă sobă, zona media cu riflaj pe peretele nordic al livingului, obiectele sanitare, bucătăria mărită în L pe tot peretele de est cu insulă centrală și echipamentele din camera tehnică.',
      ],
      m: `coș inox izolat Ø150, ${B(yApex + 0.568 + 0.6 - F - 1.05)} m.`,
      w: 'Distanța dintre coș și paie/lemn: cel puțin 40 cm sau manșon izolat omologat.',
      items: [],
    },
  ];

  const bb = new THREE.Box3();
  for (const st of STEPS) {
    st.items = [];
    st.layers.forEach((id, li) => {
      let i = 0;
      G[id].traverse((m) => {
        if (!(m as THREE.Mesh).isMesh) return;
        let k = li * 1e6 + i;
        if (st.key === 'y') {
          bb.setFromObject(m);
          k = Math.round(bb.min.y * 10) * 1e5 + li * 1e4 + i;
        } else if (st.key === 'ytop') {
          bb.setFromObject(m);
          k = Math.round(bb.max.y * 10) * 1e5 + li * 1e4 + i;
        } else if (st.key === 'n') {
          bb.setFromObject(m);
          k = Math.round(bb.min.y * 100) * 1e4 + i;
        }
        st.items.push({ m: m as THREE.Mesh, k });
        i++;
      });
    });
    st.items.sort((a, b) => a.k - b.k);
  }

  scene.updateMatrixWorld(true);
  const JRES: JointCheck[] = JOINTS.map((j) => {
    const d = j.f();
    return { ...j, d, ok: !isNaN(d) && Math.abs(d - j.exp) <= j.tol };
  });

  // Dispose helper
  const dispose = () => {
    lib.dispose();
    for (const id of ALL_LAYERS) {
      G[id].traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        if (mesh.material) {
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          mats.forEach((mt) => mt.dispose());
        }
      });
    }
  };

  return {
    G,
    TIER,
    XRAY,
    WALLS,
    PILES,
    JOIST,
    BOMD,
    TIM,
    Q,
    JRES,
    FURN,
    OBST,
    NEIGH,
    TREES,
    PVP,
    LABELS,
    STEPS,
    septicVol,
    heatArea,
    heatKw,
    pvKw,
    batKwh,
    nPV,
    warmLights,
    stoveEmber,
    dome,
    updateSunVisuals,
    dayEnergy,
    dispose,
  };
}
