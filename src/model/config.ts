/* ============================== CONFIGURAȚIE ARHITECTURALĂ & INGINEREASCĂ (metri) ==============================
   Axe: −Z = NORD (Str. Blocului, poarta, casa veche) · +Z = SUD (grădina) · +X = EST · −X = VEST.
   Casa: x 0…7,20 (vest → est), z 0…11,73 (nord → sud). Coama acoperișului e pe direcția E–V, la z = L/2. */

export const C = {
  W: 7.20,
  L: 11.73,
  T: 0.40,
  pileH: 0.25,
  slopeDeg: 30,
  hE: 2.40,
  ovE: 0.80,
  baleLen: 1.00,
  baleH: 0.50,
  post: 0.12,
  postG: 0.20,
  maxPost: 1.80,
  winSill: 0.40,
  head: 2.05,
  snowSk: 2.0,
  ag: 0.30,
  qp: 0.75,
  terrace: { depth: 4.0, sideDepth: 1.5, sideZ0: 6.55 },
  septic: { x0: 0.2, x1: 3.8, z0: -7.5, z1: -5.1, depth: 2.40 },
  well: { x: 0.3, z: -17.7, depth: 8.0 },
  site: { width: 10, length: 100, front: 30, yard: 8, west: 0.8 },
  chim: { x: 1.05, z: 6.30 },
  lat: 44.3185,
  lon: 25.6992,
};

export const RAD = Math.PI / 180;
export const SL = C.slopeDeg * RAD;
export const TAN = Math.tan(SL);
export const COS = Math.cos(SL);
export const SIN = Math.sin(SL);
export const JW = 0.057;
export const BAY = 0.49;
export const Y_BEAM = C.pileH;
export const Y_OSB = Y_BEAM + 0.24;
export const Y_JOIST = Y_OSB + 0.018;
export const Y_DECK = Y_JOIST + 0.40;
export const FS = Y_DECK + 0.022;
export const FL = { under: 0.006, film: 0.001, parquet: 0.014 };
export const F = FS + FL.under + FL.film + FL.parquet;
export const { W, L, T } = C;
export const ZR = L / 2;
export const yz = (z: number) => z - C.site.yard;

export const RAMP = (() => {
  const yT = F - 0.03;
  const lo = 0.08;
  const rise = yT - lo;
  const slope = 0.10;
  const total = rise / slope;
  return { yT, lo, rise, slope, total, fl: total, land: 0 };
})();

export const roofY = (z: number) => F + C.hE + Math.min(z, L - z) * TAN;
export const PL = 0.035;
export const CEIL = 0.06;
export const RAKE = 0.15 / COS;
export const plateTop = (w: number) => F + C.hE + w * TAN;
export const yPB = plateTop(0.14) - 0.20;

export const NRB = 12;
export const PR = (W - 0.40) / NRB;
export const RX: number[] = [];
for (let i = -1; i <= NRB + 1; i++) RX.push(0.20 + i * PR);
export const XL = RX[0] - JW / 2 - 0.03;
export const XR = RX[RX.length - 1] + JW / 2 + 0.03;

export const LD = (() => {
  const gR = 0.90;
  const gPV = 0.15;
  const s = 0.8 * C.snowSk;
  const lr = ZR - 0.20;
  const gRh = (gR + gPV) / COS;
  return { gR, gPV, s, lr, cc: PR, gRh, qd: 1.35 * gRh + 1.5 * s, qk: gRh + s };
})();

export const RIDGE = (() => {
  const fm = (24 * 0.8) / 1.25;
  const E = 11500;
  const lB = W - 0.40;
  for (const [b, h] of [
    [0.20, 0.48],
    [0.20, 0.52],
    [0.20, 0.56],
    [0.24, 0.56],
    [0.24, 0.60],
    [0.28, 0.64],
  ]) {
    const q = LD.qd * LD.lr + 1.35 * b * h * 4.2;
    const M = (q * lB * lB) / 8;
    const Wm = (b * 1000 * (h * 1000) ** 2) / 6;
    const sig = (M * 1e6) / Wm;
    const qk = LD.qk * LD.lr + b * h * 4.2;
    const w = (5 * qk * (lB * 1000) ** 4) / ((384 * E * b * 1000 * (h * 1000) ** 3) / 12);
    if (sig / fm <= 0.80 && w <= (lB * 1000) / 300) {
      return { b, h, q, qk, M, sig, w, fm, lB };
    }
  }
  return { b: 0.28, h: 0.64, q: 0, qk: 0, M: 0, sig: 0, w: 0, fm, lB };
})();

export const yApex = roofY(ZR);
export const yRB = roofY(ZR - RIDGE.b / 2);
export const yRBb = yRB - RIDGE.h;
export const slY = (zz: number, n: number) => F + C.hE + zz * TAN + n / COS;
export const roofArea = (2 * (XR - XL) * (ZR + C.ovE)) / COS;
export const ceilArea = (2 * (W - 2 * T) * (ZR - T)) / COS;

export const BX = [0.2, W / 2, W - 0.2];
export const NPS = 10;
export const PSP = (L - 0.4) / NPS;
export const MIDZ: number[] = [];
for (let j = 0; j <= NPS; j++) MIDZ.push(0.2 + j * PSP);
export const RIDGE_PILE_OFFSET = 0.50;
export const SIDE_HALF_SPANS = 4;
export const SIDE_PSP = (ZR - RIDGE_PILE_OFFSET - 0.2) / SIDE_HALF_SPANS;
export const SIDEZ: number[] = [
  0.2,
  ...Array.from({ length: SIDE_HALF_SPANS }, (_, j) => 0.2 + (j + 1) * SIDE_PSP),
  ...Array.from({ length: SIDE_HALF_SPANS + 1 }, (_, j) => ZR + RIDGE_PILE_OFFSET + j * SIDE_PSP),
];
export const ENDX = [BX[0], 1.9, BX[1], 5.3, BX[2]];

export const nJ = Math.round((L - JW) / (BAY + JW));
export const spJ = (L - JW) / nJ;

export const PT = {
  A: { d: 0.108, tw: 4, hel: [0.30], len: 2.5, Rd: 35, T: 3.3, name: 'Ø108×4, elice Ø300, L 2,5 m' },
  B: { d: 0.133, tw: 5, hel: [0.40, 0.40], len: 3.0, Rd: 70, T: 7.8, name: 'Ø133×5, 2 elice Ø400, L 3,0 m' },
} as const;

export function kc(Lcr: number, b: number, fck = 21, E05 = 7400, beta = 0.2): number {
  const lr = (Lcr / (0.289 * b) / Math.PI) * Math.sqrt(fck / E05);
  const k = 0.5 * (1 + beta * (lr - 0.3) + lr * lr);
  return Math.min(1, 1 / (k + Math.sqrt(k * k - lr * lr)));
}

export interface OpeningDef {
  u0: number;
  u1: number;
  type: 'win' | 'door';
  double?: boolean;
  sill?: number;
  light?: boolean;
  v0?: number;
  v1?: number;
  lh?: number;
}

export interface WallFramePart {
  k: string;
  pts: [number, number][];
}

export interface WallPostMeta {
  u: number;
  h: number;
  w0: number;
  w1: number;
  kind: 'jack' | 'ridge' | 'corner' | 'post';
}

export interface WallXBrace {
  a: number;
  b: number;
  vb: number;
  ta: number;
  tb: number;
  th1: number;
  th2: number;
  L1: number;
  L2: number;
  cap: number;
}

export interface WallDef {
  id: string;
  name: string;
  axis: 'x' | 'z';
  c: number;
  dir: 1 | -1;
  u0: number;
  u1: number;
  plate: 'level' | 'rake';
  corners: boolean;
  pd: number;
  ridge?: number;
  openings: OpeningDef[];
  lim?: (u: number) => number;
  limB?: (u: number) => number;
  frame?: WallFramePart[];
  posts?: WallPostMeta[];
  xb?: WallXBrace[];
  wA?: number;
  wB?: number;
}

export function createInitialWalls(): WallDef[] {
  return [
    {
      id: 'A',
      name: 'Nord',
      axis: 'x',
      c: 0,
      dir: 1,
      u0: 0,
      u1: W,
      plate: 'level',
      corners: true,
      pd: C.post,
      openings: [
        { u0: 1.11, u1: 2.62, type: 'win', double: true },
        { u0: 4.20, u1: 6.00, type: 'win', double: true },
      ],
    },
    {
      id: 'B',
      name: 'Sud',
      axis: 'x',
      c: L,
      dir: -1,
      u0: 0,
      u1: W,
      plate: 'level',
      corners: true,
      pd: C.post,
      openings: [
        { u0: 1.15, u1: 2.67, type: 'door', double: true },
        { u0: 3.15, u1: 4.85, type: 'win', double: true },
      ],
    },
    {
      id: 'Lw',
      name: 'Vest',
      axis: 'z',
      c: 0,
      dir: 1,
      u0: T,
      u1: L - T,
      plate: 'rake',
      corners: false,
      pd: C.postG,
      ridge: ZR,
      openings: [{ u0: 8.45, u1: 10.85, type: 'win', double: true, sill: 0.60, light: true }],
    },
    {
      id: 'Rw',
      name: 'Est',
      axis: 'z',
      c: W,
      dir: -1,
      u0: T,
      u1: L - T,
      plate: 'rake',
      corners: false,
      pd: C.postG,
      ridge: ZR,
      openings: [
        { u0: 0.95, u1: 2.35, type: 'win', double: true },
        { u0: 4.95, u1: 5.60, type: 'win', sill: 1.20 },
        { u0: 8.52, u1: 9.69, type: 'door' },
        { u0: 9.95, u1: 11.05, type: 'win', sill: 1.05 },
      ],
    },
  ];
}

export const DOOR_H = 2.05;

export type InteriorDoorType = 'pocket-left' | 'pocket-right' | 'pocket-biparting';

export interface InteriorDoorDef {
  u0: number;
  u1: number;
  type: InteriorDoorType;
  label: string;
}

export interface InteriorPocketLeaf {
  p0: number;
  p1: number;
  leafU0: number;
  leafU1: number;
  slideDir: 1 | -1;
}

export interface InteriorPocketSpec {
  u0: number;
  u1: number;
  type: InteriorDoorType;
  label: string;
  spanU0: number;
  spanU1: number;
  pockets: InteriorPocketLeaf[];
}

export interface IWallDef {
  axis: 'x' | 'z';
  c: number;
  u0: number;
  u1: number;
  doors: [number, number][];
  doorDefs?: InteriorDoorDef[];
  side?: number;
  top?: number;
}

export const IWALLS: IWallDef[] = [
  {
    axis: 'x',
    c: 4.72,
    u0: T,
    u1: W - T,
    doors: [[2.37, 3.27], [3.47, 4.37]],
    doorDefs: [
      { u0: 2.37, u1: 3.27, type: 'pocket-left', label: 'Dormitor 1' },
      { u0: 3.47, u1: 4.37, type: 'pocket-right', label: 'Dormitor matrimonial' },
    ],
    side: -1,
  },
  { axis: 'z', c: 3.33, u0: T, u1: 4.72, doors: [] },
  {
    axis: 'z',
    c: 4.38,
    u0: 4.82,
    u1: 8.25,
    doors: [[5.25, 6.05], [7.05, 7.75]],
    doorDefs: [
      { u0: 5.25, u1: 6.05, type: 'pocket-biparting', label: 'Baie' },
      { u0: 7.05, u1: 7.75, type: 'pocket-biparting', label: 'Cameră tehnică' },
    ],
    side: 1,
  },
  { axis: 'x', c: 6.55, u0: 4.48, u1: W - T, doors: [], top: F + 2.50 },
  { axis: 'x', c: 8.15, u0: 4.48, u1: W - T, doors: [] },
];

export function getInteriorDoorSpecs(iw: IWallDef): InteriorPocketSpec[] {
  const defs: InteriorDoorDef[] =
    iw.doorDefs ?? iw.doors.map(([u0, u1], i) => ({ u0, u1, type: 'pocket-left', label: `Ușă ${i + 1}` }));

  return defs.map((def) => {
    const w = def.u1 - def.u0;
    if (def.type === 'pocket-left') {
      const pocketLen = w + 0.03;
      const p0 = def.u0 - pocketLen;
      const p1 = def.u0;
      const show = Math.min(0.18, w * 0.22);
      return {
        ...def,
        spanU0: p0,
        spanU1: def.u1,
        pockets: [{ p0, p1, leafU0: def.u0 - w + show, leafU1: def.u0 + show, slideDir: -1 }],
      };
    }
    if (def.type === 'pocket-right') {
      const pocketLen = w + 0.03;
      const p0 = def.u1;
      const p1 = def.u1 + pocketLen;
      const show = Math.min(0.18, w * 0.22);
      return {
        ...def,
        spanU0: def.u0,
        spanU1: p1,
        pockets: [{ p0, p1, leafU0: def.u1 - show, leafU1: def.u1 + w - show, slideDir: 1 }],
      };
    }
    // Bi-parting symmetrical pocket leaves (2 halves sliding into both adjacent wall piers)
    const half = w / 2;
    const pocketLen = half + 0.015;
    const pLeft0 = def.u0 - pocketLen;
    const pRight1 = def.u1 + pocketLen;
    const show = Math.min(0.11, half * 0.28);
    return {
      ...def,
      spanU0: pLeft0,
      spanU1: pRight1,
      pockets: [
        { p0: pLeft0, p1: def.u0, leafU0: def.u0 - half + show, leafU1: def.u0 + show, slideDir: -1 },
        { p0: def.u1, p1: pRight1, leafU0: def.u1 - show, leafU1: def.u1 + half - show, slideDir: 1 },
      ],
    };
  });
}

export interface RoomDef {
  n: string;
  fin: 'parchet' | 'gresie';
  r: [number, number, number, number][];
}

export const ROOMS: RoomDef[] = [
  { n: 'Dormitor 1', fin: 'parchet', r: [[T, 3.33, T, 4.72]] },
  { n: 'Dormitor matrimonial', fin: 'parchet', r: [[3.43, W - T, T, 4.72]] },
  { n: 'Living + loc de masă + bucătărie', fin: 'parchet', r: [[T, 4.38, 4.82, L - T], [4.38, W - T, 8.25, L - T]] },
  { n: 'Baie', fin: 'gresie', r: [[4.48, W - T, 4.82, 6.55]] },
  { n: 'Cameră tehnică', fin: 'gresie', r: [[4.48, W - T, 6.65, 8.15]] },
];

export const LOFT = { x0: 4.48, x1: W - T, z0: 4.82, z1: 8.15, y: F + 2.50 };
export const inLoft = (x: number, z: number) => x > LOFT.x0 && x < LOFT.x1 && z > LOFT.z0 && z < LOFT.z1;

export const SITE = {
  x0: -C.site.west,
  x1: -C.site.west + C.site.width,
  z0: -C.site.front,
  z1: -C.site.front + C.site.length,
};
export const GATE = { x0: 0.45, x1: 3.45 };

export const PARQ: [number, number, number, number][] = [
  [T, W - T, T, 4.72],
  [T, 4.48, 4.72, L - T],
  [4.48, W - T, 8.15, L - T],
];
export const TILE: [number, number, number, number][] = [[4.48, W - T, 4.72, 8.15]];

export const ZON: [string, [number, number, number, number][], number, [number, number, 'x' | 'z']][] = [
  ['Dormitor 1', [[0.55, 3.20, 0.55, 4.00]], 70, [3.31, 4.52, 'x']],
  ['Dormitor matrimonial', [[3.53, 6.65, 0.55, 4.00]], 70, [4.52, 4.70, 'z']],
  [
    'Living (fără zona sobei și comoda TV)',
    [
      [1.25, 4.25, 5.35, 8.20],
      [0.55, 3.05, 8.20, 11.15],
    ],
    70,
    [4.36, 6.35, 'x'],
  ],
  ['Loc de masă / bucătărie', [[4.45, 6.05, 8.35, 10.50]], 70, [5.10, 8.27, 'z']],
  ['Baie (covor sub gresie)', [[4.65, 5.75, 5.35, 6.45]], 150, [4.36, 6.12, 'x']],
];

export const LAYERS: [string, [string, string, number][]][] = [
  [
    'Teren',
    [
      ['vecini', 'Curtea existentă: casa veche, anexa, poarta, bolta cu viță', 0],
      ['teren', 'Teren 10×100 m, gard, alei, grădină', 0],
    ],
  ],
  [
    'Fundație',
    [
      ['piloni', 'Piloni șurub', 0],
      ['grinzi', 'Grinzi fundație 15×24', 0],
    ],
  ],
  [
    'Platformă',
    [
      ['platforma', 'Grinzi-scară podea + OSB', 1],
      ['paiePod', 'Baloți în platformă', 1],
      ['podea', 'Podea brută OSB 22', 1],
      ['parchet', 'Parchet (gresie în baie)', 1],
      ['terasa', 'Terase (mare + mică)', 1],
    ],
  ],
  [
    'Pereți',
    [
      ['structura', 'Structură lemn pereți + tiranți în X', 2],
      ['feronerie', 'Feronerie: colțare, ancore, papuci', 2],
      ['tarusi', 'Țăruși de fixare', 2],
      ['baloti', 'Baloți de paie', 2],
      ['tencuiala', 'Tencuială var / argilă', 2],
      ['interiorStr', 'Schelet pereți interiori (5×10) + pod', 2],
      ['interior', 'Pereți interiori + pod depozitare', 2],
      ['tamplarie', 'Ferestre și uși', 2],
      ['mobilier', 'Mobilier, sobă', 2],
    ],
  ],
  [
    'Acoperiș',
    [
      ['coama', 'Pană de coamă + stâlpi de coamă', 3],
      ['acopStr', 'Căpriori-scară + eclise', 3],
      ['tavan', 'Tavan (lambriu)', 3],
      ['paieAcop', 'Baloți în acoperiș', 4],
      ['invelitoare', 'Astereală, tablă, jgheaburi', 5],
    ],
  ],
  [
    'Instalații',
    [
      ['instExt', 'Hazna, puț, rețele îngropate', 0],
      ['instPod', 'Coloane izolate prin platformă', 1],
      ['instInt', 'Apă și canalizare în casă', 2],
      ['electric', 'Electric: baterii, tablou, circuite', 2],
      ['incalzire', 'Încălzire în pardoseală (sub parchet)', 1],
      ['pv', 'Panouri fotovoltaice (versant sud)', 5],
    ],
  ],
];

export const ALL_LAYERS = LAYERS.flatMap(([, items]) => items.map(([id]) => id));

export const PRESETS: Record<string, string[]> = {
  finisata: ALL_LAYERS.filter((i) => i !== 'feronerie'),
  paie: ALL_LAYERS.filter((i) => i !== 'tencuiala'),
  structura: ['teren', 'vecini', 'piloni', 'grinzi', 'platforma', 'podea', 'structura', 'interiorStr', 'feronerie', 'tarusi', 'coama', 'acopStr', 'terasa'],
  plan: ALL_LAYERS.filter((i) => !['tencuiala', 'coama', 'acopStr', 'tavan', 'paieAcop', 'invelitoare', 'pv', 'feronerie'].includes(i)),
  instalatii: ['teren', 'vecini', 'piloni', 'grinzi', 'instExt', 'instPod', 'instInt', 'electric', 'incalzire', 'interior', 'mobilier'],
  imbinari: ['piloni', 'grinzi', 'platforma', 'podea', 'structura', 'interiorStr', 'feronerie', 'coama', 'acopStr', 'teren'],
};

export const VIEWS: Record<string, [[number, number, number], [number, number, number]]> = {
  persp: [[W / 2 + 13.5, 8.2, L / 2 + 17.5], [W / 2, 2.2, L / 2 + 1.0]],
  sus: [[W / 2, 34, L / 2 + 0.01], [W / 2, 0, L / 2]],
  nord: [[W / 2 - 2, 4, -16], [W / 2, 2.2, L / 2 + 1.0]],
  sud: [[W / 2 + 2, 4, L + 22], [W / 2, 2.2, L / 2 + 1.0]],
  est: [[W + 22, 4, L / 2], [W / 2, 2.2, L / 2 + 1.0]],
  vest: [[-22, 4, L / 2 + 1], [W / 2, 2.2, L / 2 + 1.0]],
  interior: [[W / 2 - 1.2, F + 1.6, L - 0.9], [W / 2 - 1.5, F + 2.4, 3.0]],
  teren: [[46, 38, -4], [W / 2, 0, -12]],
  inst: [[W / 2 + 16, 12, -28], [3.5, -1, -9]],
  poarta: [[GATE.x0 + 2.2, 1.7, SITE.z0 - 5.5], [2.6, 1.9, SITE.z0 + 9]],
  soare: [[W / 2 + 46, 34, L / 2 + 52], [W / 2, 7, L / 2 - 2]],
};

export const JVIEWS: Record<string, [[number, number, number], [number, number, number]]> = {
  coama: [[3.4, F + 2.3, ZR + 0.9], [0.2, yRBb - 0.25, ZR]],
  capriori: [[3.9, F + 2.4, ZR - 2.2], [3.5, yApex - 0.3, ZR]],
  streasina: [[W + 1.9, F + C.hE - 0.9, -2.6], [W - 0.6, F + C.hE + 0.1, 0.15]],
  colt: [[1.9, F + C.hE + 1.6, 2.3], [0.2, F + C.hE, 0.2]],
  baza: [[2.0, FS + 1.4, 4.0], [0.2, FS + 0.3, 2.3]],
  pilon: [[3.0, 1.3, -2.9], [0.7, -0.8, 0.5]],
};

export const WALK_AT: Record<string, [number, number, number, number]> = {
  intrare: [W + 0.85, 9.10, 3.0, 9.10],
  living: [3.55, 8.25, 1.8, 5.8],
  bucatarie: [4.75, 8.95, 5.5, 10.5],
  dorm1: [2.82, 4.08, 1.4, 2.2],
  dorm2: [4.05, 4.08, 5.3, 1.8],
  baie: [4.85, 5.58, 6.3, 5.3],
  tehnica: [4.85, 7.36, 6.2, 7.25],
  terasa: [1.91, L + 2.2, 1.91, L + 12],
};

/* ============================== FUNCȚII SOLARE & UTILITARE PURE ============================== */

export const LUNI = ['ian', 'feb', 'mar', 'apr', 'mai', 'iun', 'iul', 'aug', 'sep', 'oct', 'nov', 'dec'];
export const PV30S = [2.1, 2.9, 3.8, 4.4, 4.8, 5.0, 5.3, 5.1, 4.4, 3.4, 2.2, 1.7];
export const PV8V = [1.1, 1.8, 2.9, 3.9, 4.7, 5.1, 5.3, 4.8, 3.6, 2.4, 1.3, 0.9];
export const HDD = [600, 500, 400, 200, 60, 0, 0, 0, 50, 230, 400, 560];
export const COP = [2.6, 2.8, 3.2, 3.6, 4.0, 0, 0, 0, 4.0, 3.6, 3.0, 2.6];
export const DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export const SEASONS: [number, string, string, number][] = [
  [355, 'Iarnă', '21 dec', 0x2a5fb0],
  [80, 'Primăvară', '20 mar', 0x3a8a3a],
  [172, 'Vară', '21 iun', 0xd98c00],
  [266, 'Toamnă', '23 sep', 0xb5651d],
];

export const DOY = (m: number, d: number) => [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334][m - 1] + d;
export const fromDOY = (n: number): [number, number] => {
  let m = 12;
  while (m > 1 && DOY(m, 1) > n) m--;
  return [m, n - DOY(m, 1) + 1];
};
export const decl = (n: number) => 23.44 * RAD * Math.sin((2 * Math.PI * (284 + n)) / 365);
export const eot = (n: number) => {
  const B = (2 * Math.PI * (n - 81)) / 364;
  return 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B);
};
export const isDST = (n: number) => n >= 87 && n < 302;
export const toLocal = (n: number, h: number) => h + (4 * (30 - C.lon) - eot(n)) / 60 + (isDST(n) ? 1 : 0);

export function sunPos(n: number, hour: number) {
  const d = decl(n);
  const H = (hour - 12) * 15 * RAD;
  const phi = C.lat * RAD;
  const alt = Math.asin(Math.sin(phi) * Math.sin(d) + Math.cos(phi) * Math.cos(d) * Math.cos(H));
  const az = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(d) * Math.cos(phi)) + Math.PI;
  const vx = Math.cos(alt) * Math.sin(az);
  const vy = Math.sin(alt);
  const vz = -Math.cos(alt) * Math.cos(az);
  return { alt, az, vx, vy, vz };
}

export function halfDay(n: number) {
  const phi = C.lat * RAD;
  const d = decl(n);
  const c = (Math.sin(-0.833 * RAD) - Math.sin(phi) * Math.sin(d)) / (Math.cos(phi) * Math.cos(d));
  return Math.acos(Math.max(-1, Math.min(1, c))) / RAD / 15;
}

export function hm(h: number) {
  h = ((h % 24) + 24) % 24;
  let H = Math.floor(h);
  let m = Math.round((h - H) * 60);
  if (m === 60) {
    H++;
    m = 0;
  }
  return `${H}:${String(m).padStart(2, '0')}`;
}

export function clearSky(altRad: number) {
  if (altRad <= 0) return 0;
  const ad = altRad / RAD;
  const AM = 1 / (Math.sin(altRad) + 0.50572 * Math.pow(ad + 6.07995, -1.6364));
  return 1353 * Math.pow(0.7, Math.pow(AM, 0.678));
}

export const nf = (x: number, d = 1) =>
  x.toLocaleString('ro-RO', { minimumFractionDigits: d, maximumFractionDigits: d });

export const wp = (wl: { axis: 'x' | 'z'; c: number; dir: number }, u: number, w: number): [number, number] =>
  wl.axis === 'x' ? [u, wl.c + wl.dir * w] : [wl.c + wl.dir * w, u];

export interface Rect2D {
  u0: number;
  u1: number;
  v0: number;
  v1: number;
}

export function subtractRects(rects: Rect2D[], obstacles: Rect2D[]): Rect2D[] {
  for (const o of obstacles) {
    const out: Rect2D[] = [];
    for (const r of rects) {
      if (o.u1 <= r.u0 || o.u0 >= r.u1 || o.v1 <= r.v0 || o.v0 >= r.v1) {
        out.push(r);
        continue;
      }
      if (r.u0 < o.u0) out.push({ u0: r.u0, u1: o.u0, v0: r.v0, v1: r.v1 });
      if (r.u1 > o.u1) out.push({ u0: o.u1, u1: r.u1, v0: r.v0, v1: r.v1 });
      const a = Math.max(r.u0, o.u0);
      const b = Math.min(r.u1, o.u1);
      if (r.v0 < o.v0) out.push({ u0: a, u1: b, v0: r.v0, v1: o.v0 });
      if (r.v1 > o.v1) out.push({ u0: a, u1: b, v0: o.v1, v1: r.v1 });
    }
    rects = out;
  }
  return rects.filter((r) => r.u1 - r.u0 > 0.08 && r.v1 - r.v0 > 0.05);
}

export function floorAt(x: number, z: number): number {
  const TZ1 = L + PL + 0.015 + C.terrace.depth;
  const SA1 = W + PL + 0.015 + C.terrace.sideDepth;
  const SC0 = C.terrace.sideZ0;
  const SC1 = L + PL + 0.015 + C.terrace.sideDepth + 0.1;
  if (x >= -0.05 && x <= W + 0.05 && z >= -0.05 && z <= L + 0.05) return F;
  const yT = F - 0.03;
  if (x >= 0 && x <= W && z > L && z <= TZ1) return yT;
  if (x > W && x <= SA1 && z >= SC0 && z <= SC1) return yT;
  if (x > W && x <= SA1 && z < SC0 && z >= SC0 - RAMP.total) {
    return RAMP.lo + (RAMP.yT - RAMP.lo) * (1 - (SC0 - z) / RAMP.total);
  }
  return 0;
}

export function roomAt(x: number, z: number): string {
  const TZ1 = L + PL + 0.015 + C.terrace.depth;
  const SA1 = W + PL + 0.015 + C.terrace.sideDepth;
  const SC0 = C.terrace.sideZ0;
  const SC1 = L + PL + 0.015 + C.terrace.sideDepth + 0.1;
  for (const r of ROOMS) {
    if (r.r.some(([x0, x1, z0, z1]) => x >= x0 && x <= x1 && z >= z0 && z <= z1)) return r.n;
  }
  if (x >= 0 && x <= W && z >= 0 && z <= L) return 'În prag';
  if (z > L && z <= TZ1 && x <= W) return 'Terasa de sud';
  if (x > W && x <= SA1 && z >= SC0 - RAMP.total && z <= SC1) {
    return z < SC0 ? 'Rampa de acces' : 'Terasa de est';
  }
  return 'Afară (curte / grădină)';
}

export interface CalcRow {
  el: string;
  sec: string;
  sch: string;
  chk: string;
  u: number;
}

export function calcStructuralRows(walls: WallDef[], plExt: number, nPV: number) {
  const kmod = 0.8;
  const gM = 1.3;
  const fmd = (24 * kmod) / gM;
  const ft0d = (14.5 * kmod) / gM;
  const fc0d = (21 * kmod) / gM;
  const fvd = (4.0 * kmod) / gM;
  const E = 11000;
  const fmW = (24 * 0.9) / gM;
  const { qd, qk, cc, lr, s } = LD;
  const gF = 1.4;
  const qF = 2.0;
  const qFd = 1.35 * gF + 1.5 * qF;
  const gWall = 1.75;
  const Ach = 45 * 95;
  const zc = 305;
  const Ilad = 2 * ((45 * 95 ** 3) / 12 + Ach * (zc / 2) ** 2) * 0.7;
  const rows: CalcRow[] = [];
  const add = (el: string, sec: string, sch: string, chk: string, u: number) => rows.push({ el, sec, sch, chk, u });
  const f1 = (x: number) => x.toFixed(1);
  const f2 = (x: number) => x.toFixed(2);

  {
    const q = qd * cc;
    const Md = (q * lr * lr) / 8;
    const N = Md / (zc / 1000);
    const sig = (N * 1000) / Ach;
    const w = ((5 * (qk * cc) * ((lr / COS) * 1000) ** 4) / (384 * E * Ilad)) * COS;
    add(
      'Căprior-scară (cosoroabă N/S → pana de coamă)',
      'tălpi 2 × 4,5×9,5, h = 40 cm, la ' + f2(cc) + ' m',
      `q = ${f2(q)} kN/m (proiecție) · l = ${f2(lr)} m · M = ${f2(Md)} kNm`,
      `σ talpă = ${f1(sig)} ≤ ${f1(ft0d)} N/mm² · săgeată ≈ ${f1(w)} mm (l/${Math.round(((lr / COS) * 1000) / w)})`,
      sig / ft0d,
    );
  }
  const R = RIDGE;
  const fvg = (3.5 * kmod) / 1.25;
  {
    const tau = (1.5 * ((R.q * R.lB) / 2 + R.q * (XR - W + 0.2)) * 1000) / (0.67 * R.b * 1000 * R.h * 1000);
    add(
      'Pană de coamă',
      `${Math.round(R.b * 100)}×${Math.round(R.h * 100)} GL24h, L = ${f2(XR - XL)} m`,
      `q = ${f1(R.q)} kN/m (fâșie ${f2(lr)} m) · l = ${f2(R.lB)} m · M = ${f1(R.M)} kNm`,
      `σ = ${f1(R.sig)} ≤ ${f1(R.fm)} · τ = ${f2(tau)} ≤ ${f2(fvg)} N/mm² · săgeată ${f1(R.w)} mm (l/${Math.round((R.lB * 1000) / R.w)})`,
      Math.max(R.sig / R.fm, tau / fvg),
    );
  }
  const Npost = R.q * (R.lB / 2 + (XR - W + 0.2));
  {
    const h = yRBb - FS - 0.10;
    const k = kc(h * 1000, 200, 24, 9600, 0.1);
    const fcg = (24 * kmod) / 1.25;
    const NR = (k * fcg * 200 * 200) / 1000;
    const Mw = (1.5 * C.qp * 1.3 * h * h) / 8;
    const sm = (Mw * 1e6) / (200 ** 3 / 6);
    add(
      'Stâlp de coamă (în fronton)',
      '20×20 GL24h',
      `N = ${f1(Npost)} kN · h = ${f2(h)} m · vânt M = ${f1(Mw)} kNm`,
      `kc = ${f2(k)} · N_Rd = ${f1(NR)} kN · σm = ${f1(sm)} N/mm²`,
      Npost / NR + sm / ((24 * 0.9) / 1.25),
    );
  }
  const qE = qd * (lr / 2 + C.ovE + 0.2) + 0.25;
  {
    const lo = Math.max(...[walls[0], walls[1]].flatMap((w) => w.openings.map((o) => o.u1 - o.u0))) + 0.12;
    const Md = (qE * lo * lo) / 8;
    const sig = (Md * 1e6) / ((120 * 200 ** 2) / 6);
    add(
      'Cosoroaba N/S peste golul cel mai mare (lucrează ca buiandrug)',
      '12×20 C24',
      `q = ${f1(qE)} kN/m · l = ${f2(lo)} m · M = ${f2(Md)} kNm`,
      `σ = ${f1(sig)} ≤ ${f1(fmd)} N/mm²`,
      sig / fmd,
    );
  }
  {
    const h = yPB - FS - 0.10;
    const k = kc(h * 1000, 120);
    const NR = (k * fc0d * 120 * 120) / 1000;
    const N = qE * C.maxPost;
    add('Stâlp perete N/S', '12×12 C24 la max. 1,80 m', `N = ${f1(N)} kN · h = ${f2(h)} m`, `kc = ${f2(k)} · N_Rd = ${f1(NR)} kN`, N / NR);
  }
  {
    let worst = { u: 0, trib: 0, h: 0, M: 0, sg: 0 };
    for (const wl of [walls[2], walls[3]]) {
      const ps = (wl.posts || []).slice().sort((a, b) => a.u - b.u);
      ps.forEach((p, i) => {
        if (p.kind === 'ridge') return;
        const trib = ((ps[i + 1] ? ps[i + 1].u - p.u : 0.3) + (i ? p.u - ps[i - 1].u : 0.3)) / 2;
        const h = (wl.limB ? wl.limB(p.u) : yPB) - FS - 0.10;
        const M = (1.5 * C.qp * trib * h * h) / 8;
        const sg = (M * 1e6) / ((120 * 200 ** 2) / 6);
        if (sg / fmW > worst.u) worst = { u: sg / fmW, trib, h, M, sg };
      });
    }
    add(
      'Stâlp fronton – vânt perpendicular pe perete',
      '12×20 C24 (20 pe grosimea peretelui)',
      `qp = ${C.qp} kPa · fâșie ${f2(worst.trib)} m · h = ${f2(worst.h)} m · M = ${f2(worst.M)} kNm`,
      `σ = ${f1(worst.sg)} ≤ ${f1(fmW)} N/mm²`,
      worst.u,
    );
  }
  const qS = qE + 1.35 * gWall * (yPB - FS) + qFd * 0.27 + 0.27;
  {
    const l = 1.7;
    const Md = (qS * l * l) / 8;
    const sig = (Md * 1e6) / ((150 * 240 ** 2) / 6);
    const tau = (1.5 * (0.6 * qS * l) * 1000) / (0.67 * 150 * 240);
    add(
      'Grindă fundație sub peretele N/S (poartă acoperișul)',
      '15×24 C24',
      `q = ${f1(qS)} kN/m · l = ${f2(l)} m · M = ${f1(Md)} kNm`,
      `σ = ${f1(sig)} ≤ ${f1(fmd)} · τ = ${f2(tau)} ≤ ${f2(fvd)} N/mm²`,
      Math.max(sig / fmd, tau / fvd),
    );
  }
  const hGav = (yPB + yApex) / 2 - FS;
  const qSE = (qFd * (W / 2 - 0.2)) / 2 + 1.35 * gWall * hGav * 0.9 + 0.27;
  {
    const l = SIDE_PSP;
    const Md = (qSE * l * l) / 8;
    const sig = (Md * 1e6) / ((150 * 240 ** 2) / 6);
    add('Grindă fundație sub fronton (E/V)', '15×24 C24', `q = ${f1(qSE)} kN/m · l = ${f2(l)} m · M = ${f1(Md)} kNm`, `σ = ${f1(sig)} ≤ ${f1(fmd)} N/mm²`, sig / fmd);
  }
  {
    // Steel flitch transfer plate (10×220 S235) bolted onto 15×24 beam across the 1.00 m ridge-pile pair
    const lR = 2 * RIDGE_PILE_OFFSET;
    const VRd = (2200 * (235 / Math.sqrt(3))) / 1000;
    const MRd = (10 * 220 ** 2 * 235) / 4 / 1e6;
    const VEd = Npost / 2;
    const MEd = (Npost * (lR - 0.24)) / 4;
    add(
      'Eclisă metalică transfer stâlp coamă (peste perechea de piloni)',
      'platbandă S235 10×220, L = 1,40 m + buloane M12',
      `V_Ed = ${f1(VEd)} kN · l = ${f2(lR)} m · M_Ed = ${f1(MEd)} kNm`,
      `V_Rd = ${f1(VRd)} kN · M_Rd = ${f1(MRd)} kNm`,
      Math.max(VEd / VRd, MEd / MRd),
    );
  }
  const qMBase = qFd * 1.25 * (W / 2 - 0.2) + 0.2;
  const qMLoft = 3.96; // pereți interiori + pod depozitare (zona Baie / Tehnică)
  const qM = qMBase + qMLoft;
  const lM = PSP;
  {
    const Md = (qM * lM * lM) / 8;
    const sig = (Md * 1e6) / ((150 * 240 ** 2) / 6);
    add('Grindă fundație mediană (podea + pereți interiori + pod)', '15×24 C24', `q = ${f1(qM)} kN/m · l = ${f2(lM)} m · M = ${f1(Md)} kNm`, `σ = ${f1(sig)} ≤ ${f1(fmd)} N/mm²`, sig / fmd);
  }
  {
    const sp = W / 2 - 0.2;
    const q = qFd * cc;
    const Md = (q * sp ** 2) / 8;
    const N = Md / (zc / 1000);
    const sig = (N * 1000) / Ach;
    const w = (5 * ((gF + qF) * cc) * (sp * 1000) ** 4) / (384 * E * Ilad);
    add(
      'Grindă-scară podea',
      'tălpi 2 × 4,5×9,5, h = 40 cm, la ' + f2(spJ) + ' m',
      `q = ${f2(q)} kN/m · l = ${f2(sp)} m · M = ${f2(Md)} kNm`,
      `σ talpă = ${f1(sig)} ≤ ${f1(ft0d)} N/mm² · săgeată ≈ ${f1(w)} mm (l/${Math.round((sp * 1000) / w)})`,
      sig / ft0d,
    );
  }
  {
    const A = PT.A;
    const B = PT.B;
    const Ns = qS * 1.7;
    const Nme = Ns + (qMBase * lM) / 2;
    const tribR = RIDGE_PILE_OFFSET + SIDE_PSP / 2;
    const hGavR = yRBb - FS - tribR * 0.25 * TAN;
    const Nr = Npost / 2 + 1.35 * gWall * hGavR * (tribR - 0.10) + qFd * (W / 2 - 0.2) * 0.375 * tribR;
    const Nm = qM * lM;
    const Ng = qSE * SIDE_PSP;
    const Nt = (1.35 * 0.5 + 1.5 * 3.0) * 1.25 * 1.8 * 1.65;
    add('Pilon tip B – sub pereții N/S (colțuri și intermediari, la 1,70 m)', B.name, `N_Ed = ${f1(Ns)} kN`, `R_d = ${B.Rd} kN (cuplu final ≥ ${B.T} kN·m)`, Ns / B.Rd);
    add('Pilon tip B – capătul șirului median (peretele N/S + podea)', B.name, `N_Ed = ${f1(Ns)} + ${f1((qMBase * lM) / 2)} = ${f1(Nme)} kN`, `R_d = ${B.Rd} kN`, Nme / B.Rd);
    add('Pilon tip B – pereche sub stâlpul de coamă (interax 1,00 m = 2,5D)', '2 × ' + B.name, `N_Ed = ${f1(Nr)} kN pe pilon`, `R_d = ${B.Rd} kN · cei mai încărcați piloni`, Nr / B.Rd);
    add('Pilon tip A – șirul median (podea + pereți interiori + pod)', A.name + `, la ${f2(lM)} m`, `N_Ed = ${f1(Nm)} kN`, `R_d = ${A.Rd} kN (cuplu final ≥ ${A.T} kN·m)`, Nm / A.Rd);
    add('Pilon tip A – sub frontoanele E/V', A.name + `, la ${f2(SIDE_PSP)} m`, `N_Ed = ${f1(Ng)} kN`, `R_d = ${A.Rd} kN`, Ng / A.Rd);
    add('Pilon tip A – terase și rampă', A.name, `N_Ed = ${f1(Nt)} kN`, `R_d = ${A.Rd} kN`, Nt / A.Rd);
  }
  const planA = (XR - XL) * (L + 2 * C.ovE);
  const Gr = LD.gR * roofArea + LD.gPV * nPV * 2.0;
  const Gs = 0.4 * s * planA;
  const Gw = 0.5 * gWall * plExt;
  const Wt = Gr + Gs + Gw;
  const qS9 = 2.0;
  const Fb = ((1.0 * C.ag * 2.5) / qS9) * 0.85 * Wt;
  const TRd = (0.9 * 245 * 490) / 1.25 / 1000;
  const HDRd = 75;
  const seis = [];
  for (const wl of walls) {
    const xb = wl.xb || [];
    const c1 = xb.reduce((a, x) => a + Math.cos(x.th1), 0);
    const c2 = xb.reduce((a, x) => a + Math.cos(x.th2), 0);
    const H = Fb / 2;
    const Hc = TRd * Math.min(c1, c2);
    const Tup = xb.length ? Math.max(...xb.map((x) => Math.max((H / c1) * Math.sin(x.th1), (H / c2) * Math.sin(x.th2)))) : 0;
    seis.push({ wl, H, Hc, Tup });
    add(
      `Contravântuire perete ${wl.name}`,
      `${xb.length} ${xb.length === 1 ? 'cruce' : 'cruci'} din tiranți Ø20 (M20) cu întinzător`,
      `H = ${f1(H)} kN (jumătate din F_b, pe direcția ${wl.axis === 'x' ? 'E–V' : 'N–S'}) · unghiuri ${xb.map((x) => Math.round(Math.max(x.th1, x.th2) / RAD) + '°').join(', ')}`,
      `capacitatea tiranților întinși ${f1(Hc)} kN (T_Rd = ${f1(TRd)} kN/tirant) · ridicare la ancoră ≈ ${f1(Tup)} kN ≤ ${HDRd} kN`,
      Math.max(H / Hc, Tup / HDRd),
    );
  }
  {
    const kT = 0.7;
    const fT = (24 * kT) / gM;
    const qd2 = 1.35 * 0.5 + 1.5 * 3.0;
    const q = qd2 * 0.5;
    const l = 1.8;
    const Md = (q * l * l) / 8;
    const sig = (Md * 1e6) / ((50 * 150 ** 2) / 6);
    add('Grinzișoară terasă', '5×15 C24 la 50 cm', `q = ${f2(q)} kN/m · l = ${f2(l)} m`, `σ = ${f1(sig)} ≤ ${f1(fT)} N/mm² (clasa 3 de exploatare)`, sig / fT);
    const qb = qd2 * 1.25 * 1.8;
    const lb = 1.65;
    const Mb = (qb * lb * lb) / 8;
    const sb = (Mb * 1e6) / ((100 * 200 ** 2) / 6);
    add('Grindă terasă', '10×20 C24', `q = ${f1(qb)} kN/m · l = ${f2(lb)} m`, `σ = ${f1(sb)} ≤ ${f1(fT)} N/mm²`, sb / fT);
  }
  return { rows, gF, qF, qFd, gWall, Fb, Wt, Gr, Gs, Gw, seis, qS9 };
}
