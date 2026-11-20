import {
  BX,
  C,
  CEIL,
  COS,
  DOY,
  ENDX,
  F,
  FS,
  GATE,
  IWALLS,
  JW,
  L,
  LOFT,
  MIDZ,
  NRB,
  PL,
  PR,
  PT,
  RAD,
  RAKE,
  RAMP,
  RIDGE,
  ROOMS,
  RX,
  SIDEZ,
  SITE,
  T,
  TAN,
  W,
  XL,
  XR,
  Y_BEAM,
  Y_DECK,
  Y_JOIST,
  Y_OSB,
  ZR,
  getInteriorDoorSpecs,
  plateTop,
  roofY,
  slY,
  spJ,
  subtractRects,
  sunPos,
  wp,
  yApex,
  yPB,
  yRB,
  yRBb,
  yz,
  type WallDef,
} from './config';
import type { BuiltSceneData } from './buildScene';

const fm = (v: number, d = 2) => (Math.abs(v) < 0.0005 ? 0 : v).toFixed(d).replace('.', ',');
const esc = (s: string) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

class Pen {
  ox: number;
  oy: number;
  s: number;
  up: boolean;
  o: string[] = [];
  lt!: (h: number, v: number, tx: number, ty: number, txt: string) => Pen;
  note!: (tx: number, ty: number, txt: string, cls?: string, anchor?: string) => Pen;
  num!: (h: number, v: number, n: number) => Pen;

  constructor(ox: number, oy: number, s: number, up = false) {
    this.ox = ox;
    this.oy = oy;
    this.s = s;
    this.up = up;
  }
  X(h: number) {
    return +(this.ox + h * this.s).toFixed(2);
  }
  Y(v: number) {
    return +(this.up ? this.oy - v * this.s : this.oy + v * this.s).toFixed(2);
  }
  P(pts: [number, number][]) {
    return pts.map(([h, v]) => this.X(h) + ',' + this.Y(v)).join(' ');
  }
  poly(pts: [number, number][], cls: string) {
    this.o.push(`<polygon points="${this.P(pts)}" class="${cls}"/>`);
    return this;
  }
  pl(pts: [number, number][], cls = 'l') {
    this.o.push(`<polyline points="${this.P(pts)}" class="${cls}"/>`);
    return this;
  }
  rect(h0: number, v0: number, h1: number, v1: number, cls: string) {
    return this.poly(
      [
        [h0, v0],
        [h1, v0],
        [h1, v1],
        [h0, v1],
      ],
      cls,
    );
  }
  line(h0: number, v0: number, h1: number, v1: number, cls = 'l') {
    this.o.push(`<line x1="${this.X(h0)}" y1="${this.Y(v0)}" x2="${this.X(h1)}" y2="${this.Y(v1)}" class="${cls}"/>`);
    return this;
  }
  circ(h: number, v: number, r: number, cls: string) {
    this.o.push(`<circle cx="${this.X(h)}" cy="${this.Y(v)}" r="${Math.max(0.2, r * this.s).toFixed(2)}" class="${cls}"/>`);
    return this;
  }
  text(h: number, v: number, t: string, cls = 't', anchor = 'middle', rot = 0) {
    const x = this.X(h);
    const y = this.Y(v);
    this.o.push(`<text x="${x}" y="${y}" class="${cls}" text-anchor="${anchor}"${rot ? ` transform="rotate(${rot} ${x} ${y})"` : ''}>${esc(t)}</text>`);
    return this;
  }
  raw(s: string) {
    this.o.push(s);
    return this;
  }
  chainH(hs: number[], v: number, cls = 'dim') {
    const y = this.Y(v);
    let s = `<line x1="${this.X(hs[0])}" y1="${y}" x2="${this.X(hs[hs.length - 1])}" y2="${y}" class="${cls}"/>`;
    for (const h of hs) {
      const x = this.X(h);
      s += `<line x1="${x}" y1="${y - 1.4}" x2="${x}" y2="${y + 1.4}" class="${cls}"/><line x1="${x - 0.7}" y1="${y + 0.7}" x2="${x + 0.7}" y2="${y - 0.7}" class="dimk"/>`;
    }
    for (let i = 0; i < hs.length - 1; i++) {
      const d = Math.abs(hs[i + 1] - hs[i]);
      if (d < 0.005) continue;
      const x0 = this.X(hs[i]);
      const x1 = this.X(hs[i + 1]);
      const small = Math.abs(x1 - x0) < 7;
      s += `<text x="${(x0 + x1) / 2}" y="${y - 0.8 - (small && i % 2 ? 2.3 : 0)}" class="dimt" text-anchor="middle">${fm(d)}</text>`;
    }
    this.o.push(s);
    return this;
  }
  chainV(vs: number[], h: number, cls = 'dim') {
    const x = this.X(h);
    let s = `<line x1="${x}" y1="${this.Y(vs[0])}" x2="${x}" y2="${this.Y(vs[vs.length - 1])}" class="${cls}"/>`;
    for (const v of vs) {
      const y = this.Y(v);
      s += `<line x1="${x - 1.4}" y1="${y}" x2="${x + 1.4}" y2="${y}" class="${cls}"/><line x1="${x - 0.7}" y1="${y + 0.7}" x2="${x + 0.7}" y2="${y - 0.7}" class="dimk"/>`;
    }
    for (let i = 0; i < vs.length - 1; i++) {
      const d = Math.abs(vs[i + 1] - vs[i]);
      if (d < 0.005) continue;
      const y0 = this.Y(vs[i]);
      const y1 = this.Y(vs[i + 1]);
      const ym = (y0 + y1) / 2;
      const small = Math.abs(y1 - y0) < 7;
      const xx = x - 0.8 - (small && i % 2 ? 2.3 : 0);
      s += `<text x="${xx}" y="${ym}" class="dimt" text-anchor="middle" transform="rotate(-90 ${xx} ${ym})">${fm(d)}</text>`;
    }
    this.o.push(s);
    return this;
  }
  level(h: number, v: number, txt: string, side = 1) {
    const x = this.X(h);
    const y = this.Y(v);
    this.o.push(
      `<path d="M${x} ${y} l-1.3 -2.2 h2.6 z" class="lvl"/><line x1="${x}" y1="${y}" x2="${x + side * 13}" y2="${y}" class="l"/><text x="${x + side * 1.6}" y="${y - 0.8}" class="ts" text-anchor="${side > 0 ? 'start' : 'end'}">${esc(txt)}</text>`,
    );
    return this;
  }
  leader(h0: number, v0: number, dx: number, dy: number, txt: string, cls = 'ts') {
    const x = this.X(h0);
    const y = this.Y(v0);
    const x1 = x + dx;
    const y1 = y + dy;
    this.o.push(
      `<circle cx="${x}" cy="${y}" r="0.45" class="dot"/><polyline points="${x},${y} ${x1},${y1} ${x1 + (dx >= 0 ? 3 : -3)},${y1}" class="l"/><text x="${x1 + (dx >= 0 ? 3.6 : -3.6)}" y="${y1 + 0.9}" class="${cls}" text-anchor="${dx >= 0 ? 'start' : 'end'}">${esc(txt)}</text>`,
    );
    return this;
  }
  svg() {
    return this.o.join('');
  }
}

const DRW_CSS = `.frame{fill:none;stroke:#222;stroke-width:.6}.tbk{fill:#fff;stroke:#222;stroke-width:.4}
.l{stroke:#222;stroke-width:.25;fill:none}.l1{stroke:#222;stroke-width:.45;fill:none}.l2{stroke:#111;stroke-width:.8;fill:none}.thin{stroke:#555;stroke-width:.15;fill:none}
.dash{stroke:#444;stroke-width:.25;fill:none;stroke-dasharray:1.6 .9}.dd{stroke:#333;stroke-width:.3;fill:none;stroke-dasharray:4 1 .6 1}
.plot{stroke:#c0151b;stroke-width:.55;fill:none;stroke-dasharray:4 1.2 .8 1.2}
.straw{fill:url(#hS);stroke:#222;stroke-width:.3}.strawc{fill:url(#hS);stroke:#222;stroke-width:.2}.plaster{fill:#f6f3ea;stroke:#333;stroke-width:.15}
.wood{fill:#e1bf88;stroke:#333;stroke-width:.25}.woodc{fill:url(#hW);stroke:#222;stroke-width:.3}.wood2{fill:#c99a5b;stroke:#222;stroke-width:.25}
.osb{fill:#ecd29b;stroke:#333;stroke-width:.15}.steel{fill:#9aa1a8;stroke:#222;stroke-width:.2}.blk{fill:#222;stroke:none}
.glass{fill:#d4ecf6;stroke:#2a6f9a;stroke-width:.2}.old{fill:url(#hO);stroke:#333;stroke-width:.35}.nb{fill:rgba(250,250,247,.55);stroke:#666;stroke-width:.3}
.tree{fill:rgba(110,160,80,.28);stroke:#5b8a3c;stroke-width:.25}.grav{fill:#ebe6da;stroke:#c8c0ae;stroke-width:.15}.deck{fill:#e9d3b0;stroke:#8a6a40;stroke-width:.2}
.house{fill:#fff;stroke:#111;stroke-width:.7}.roofo{fill:none;stroke:#333;stroke-width:.3;stroke-dasharray:2.5 1}.pvh{fill:rgba(30,50,110,.25);stroke:#1d2f5a;stroke-width:.25}
.pv{fill:#22346a;stroke:#9fb2d6;stroke-width:.15}.metal{fill:#8d949c;stroke:#333;stroke-width:.2}.roofel{fill:#c9ccd0;stroke:#333;stroke-width:.3}.wallel{fill:#f3eee2;stroke:#222;stroke-width:.4}
.earth{fill:url(#hE);stroke:none}.gnd{stroke:#222;stroke-width:.6;fill:none}.conc{fill:#d0cdc6;stroke:#333;stroke-width:.25}
.sew{stroke:#c9661f;stroke-width:.5;fill:none;stroke-dasharray:2 .8}.wat{stroke:#1b4fbf;stroke-width:.5;fill:none;stroke-dasharray:2 .8}
.furn{fill:none;stroke:#999;stroke-width:.15}.room{font-size:3.1px;font-weight:600;fill:#222}.area{font-size:2.6px;fill:#333}
.t{font-size:2.8px;fill:#222}.ts{font-size:2.3px;fill:#222}.tm{font-size:3.4px;fill:#222}.tb{font-size:4.2px;font-weight:700;fill:#222}.tt{font-size:5.5px;font-weight:700;fill:#222}
.dim{stroke:#333;stroke-width:.16;fill:none}.dimk{stroke:#111;stroke-width:.45}.dimt{font-size:2.3px;fill:#222}.lvl{fill:#222}.dot{fill:#222}
.sun{fill:none;stroke-width:.45}.ramp{fill:#f1e2c6;stroke:#8a6a40;stroke-width:.25;stroke-dasharray:1.2 .6}.vine{fill:rgba(95,150,60,.35);stroke:#4b7d2f;stroke-width:.3;stroke-dasharray:1.5 .8}.rod{stroke:#1d4fa0;stroke-width:.45}.cut{stroke:#c0151b;stroke-width:.5;fill:none;stroke-dasharray:6 1.5 1 1.5}.red{fill:#c0151b}`;

const DRW_DEFS = `<defs><style>${DRW_CSS}</style>
<pattern id="hS" width="2.2" height="2.2" patternUnits="userSpaceOnUse" patternTransform="rotate(35)"><rect width="2.2" height="2.2" fill="#f4e3a6"/><line x1="0" y1="0" x2="0" y2="2.2" stroke="#c9a54a" stroke-width=".35"/></pattern>
<pattern id="hW" width="1.6" height="1.6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="1.6" height="1.6" fill="#e6c48e"/><line x1="0" y1="0" x2="0" y2="1.6" stroke="#8a5a2a" stroke-width=".25"/></pattern>
<pattern id="hO" width="1.8" height="1.8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="1.8" height="1.8" fill="#e4e1db"/><line x1="0" y1="0" x2="0" y2="1.8" stroke="#888" stroke-width=".3"/></pattern>
<pattern id="hE" width="3" height="3" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="3" stroke="#8a7a60" stroke-width=".3"/></pattern></defs>`;

export interface DrawingSheet {
  title: string;
  scale: string;
  body: string;
}

const northArrow = (x: number, y: number, r = 6) =>
  `<g><circle cx="${x}" cy="${y}" r="${r}" class="l"/><path d="M${x} ${y - r - 1.5} L${x + r * 0.45} ${y + r * 0.6} L${x} ${y + r * 0.25} L${x - r * 0.45} ${y + r * 0.6} Z" class="red"/><text x="${x}" y="${y - r - 2.6}" class="tb" text-anchor="middle">N</text></g>`;

export function sheetSVG(i: number, n: number, sh: DrawingSheet): string {
  const x = 296;
  const y = 255;
  const tb = `<rect x="${x}" y="${y}" width="118" height="36" class="tbk"/><line x1="${x}" y1="${y + 8}" x2="${x + 118}" y2="${y + 8}" class="l"/><line x1="${x}" y1="${y + 22}" x2="${x + 118}" y2="${y + 22}" class="l"/><line x1="${x + 80}" y1="${y + 22}" x2="${x + 80}" y2="${y + 36}" class="l"/>
    <text x="${x + 2}" y="${y + 5.6}" class="t">Casă din baloți de paie · Clejani, jud. Giurgiu</text>
    <text x="${x + 2}" y="${y + 13.5}" class="tb">${esc(sh.title)}</text><text x="${x + 2}" y="${y + 19}" class="ts">Scara ${esc(sh.scale)} · cote în metri · ±0,00 = pardoseala finită</text>
    <text x="${x + 2}" y="${y + 27}" class="ts">Schiță de lucru generată din modelul 3D – nu înlocuiește</text><text x="${x + 2}" y="${y + 30.5}" class="ts">proiectul de arhitectură și rezistență autorizat.</text>
    <text x="${x + 2}" y="${y + 34}" class="ts">noiembrie 2026</text><text x="${x + 99}" y="${y + 31}" class="tb" text-anchor="middle">${i + 1}/${n}</text>`;
  return `<svg class="drw" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 297" font-family="Segoe UI, Arial, sans-serif">${DRW_DEFS}<rect width="420" height="297" fill="#fff"/><rect x="6" y="6" width="408" height="285" class="frame"/>${sh.body}${tb}</svg>`;
}

const slPoly = (side: 'N' | 'S', z0: number, z1: number, n0: number, n1: number): [number, number][] =>
  [
    [z0, n0],
    [z1, n0],
    [z1, n1],
    [z0, n1],
  ].map(([zz, n]) => [side === 'N' ? zz : L - zz, slY(zz, n)]);

function groundAndPlatform(p: Pen, h0: number, h1: number, cutBeams: [number, number][]) {
  p.rect(h0, -0.55, h1, 0, 'earth');
  p.line(h0, 0, h1, 0, 'gnd');
  for (const [a, b] of cutBeams) p.rect(a, Y_BEAM, b, Y_OSB, 'woodc');
}

function wallCut(p: Pen, wl: WallDef, u: number, H: (w: number) => number) {
  const o = wl.openings.find((q) => u > q.u0 && u < q.u1);
  const rake = wl.plate === 'rake';
  const post = (wl.posts || []).find((q) => Math.abs(q.u - u) < q.h);
  const R = (w0: number, w1: number, v0: number, v1: number, cls: string) => p.rect(H(w0), v0, H(w1), v1, cls);
  if (!o || o.type !== 'door') {
    R(0, 0.1, FS, FS + 0.1, 'woodc');
    R(0.3, 0.4, FS, FS + 0.1, 'woodc');
    if (post) R(0.1, 0.3, FS, FS + 0.1, 'woodc');
  }
  const top = wl.limB ? wl.limB(u) : yPB;
  const wA = wl.wA ?? 0.14;
  const wB = wl.wB ?? 0.26;
  if (post) {
    R(0, post.w0, FS + 0.1, top, 'strawc');
    R(post.w1, T, FS + 0.1, top, 'strawc');
    R(post.w0, post.w1, FS + 0.1, top, 'woodc');
  } else if (o) {
    const v0 = o.v0 ?? F;
    const v1 = o.v1 ?? F + 2.05;
    const lh = o.lh ?? 0.15;
    if (o.type === 'win') {
      R(0, T, FS + 0.1, v0 - 0.12, 'strawc');
      R(0, wA, v0 - 0.12, v0, 'strawc');
      R(wB, T, v0 - 0.12, v0, 'strawc');
      R(wA, wB, v0 - 0.12, v0, 'woodc');
      R(0, T, v0, v0 + 0.022, 'osb');
      R(0.08, 0.15, v0 + 0.022, v1 - 0.022, 'glass');
      R(-0.09, 0.08, v0 + 0.01, v0 + 0.022, 'metal');
    } else {
      R(0.08, 0.15, F, v1 - 0.022, 'glass');
    }
    R(0, T, v1 - 0.022, v1, 'osb');
    R(wA, wB, v1, v1 + lh, 'woodc');
    R(0, wA, v1, v1 + lh, 'strawc');
    R(wB, T, v1, v1 + lh, 'strawc');
    if (top > v1 + lh + 0.01) R(0, T, v1 + lh, top, 'strawc');
  } else {
    R(0, T, FS + 0.1, top, 'strawc');
  }
  const pA = 0.14;
  const pB = 0.26;
  if (!rake) {
    p.poly(
      [
        [H(pA), yPB],
        [H(pB), yPB],
        [H(pB), plateTop(pB)],
        [H(pA), plateTop(pA)],
      ],
      'woodc',
    );
    p.poly(
      [
        [H(0), yPB],
        [H(pA), yPB],
        [H(pA), plateTop(pA)],
        [H(0), plateTop(0)],
      ],
      'strawc',
    );
    p.poly(
      [
        [H(pB), yPB],
        [H(T), yPB],
        [H(T), plateTop(T)],
        [H(pB), plateTop(pB)],
      ],
      'strawc',
    );
  } else {
    const limU = wl.lim ? wl.lim(u) : roofY(u);
    R(pA, pB, top, limU, 'woodc');
    R(0, pA, top, limU, 'strawc');
    R(pB, T, top, limU, 'strawc');
  }
  const extTop = rake ? (wl.lim ? wl.lim(u) : roofY(u)) : F + C.hE - 0.02;
  const intTop = (rake ? roofY(u) : roofY(T)) - CEIL;
  if (!o || o.type === 'win') {
    R(-PL, 0, FS - 0.25, o ? o.v0! : extTop, 'plaster');
    R(T, T + PL, F, o ? o.v0! : intTop, 'plaster');
  }
  if (o) {
    R(-PL, 0, o.v1!, extTop, 'plaster');
    R(T, T + PL, o.v1!, intTop, 'plaster');
  }
}

export function generateAllSheets(data: BuiltSceneData): DrawingSheet[] {
  const { WALLS, PILES, JOIST, Q, FURN, NEIGH, TREES, PVP, septicVol, nPV } = data;
  const [WA, WB, WLw, WRw] = WALLS;

  const drawSituatie = (): DrawingSheet => {
    const s = 4.3;
    const xm = -22;
    const zm = -37.5;
    const p = new Pen(10 - xm * s, 14 - zm * s, s);
    let b = `<defs><clipPath id="cpS"><rect x="10" y="14" width="258" height="236"/></clipPath></defs><g clip-path="url(#cpS)">`;
    p.rect(SITE.x0, SITE.z0 - 6.0, SITE.x1, SITE.z0 - 0.4, 'conc');
    p.rect(GATE.x0 + 0.1, SITE.z0, GATE.x1, yz(-5.4), 'grav');
    p.rect(-0.3, yz(-5.4), SITE.x1 - 0.2, -0.6, 'grav');
    p.rect(W + 0.25, -0.6, SITE.x1 - 0.25, C.terrace.sideZ0 - 1.15, 'grav');
    for (const n of NEIGH) {
      p.rect(n.x0, n.z0, n.x1, n.z1, n.vine ? 'vine' : 'old');
      if (n.name !== 'geamlâc') p.text((n.x0 + n.x1) / 2, (n.z0 + n.z1) / 2 + 0.3, n.name, 'ts');
    }
    for (const t of TREES) p.circ(t.x, t.z, t.r, 'tree');
    p.rect(SITE.x0, SITE.z0, SITE.x1, SITE.z1, 'plot');
    const tz0 = L + PL + 0.015;
    p.rect(0, tz0, W, tz0 + C.terrace.depth, 'deck');
    p.rect(W + PL + 0.015, C.terrace.sideZ0, W + PL + 0.015 + C.terrace.sideDepth, tz0 + C.terrace.sideDepth + 0.1, 'deck');
    p.rect(W + PL + 0.015, C.terrace.sideZ0 - RAMP.total, W + PL + 0.015 + C.terrace.sideDepth, C.terrace.sideZ0, 'ramp');
    p.text(W + PL + 0.015 + C.terrace.sideDepth + 0.3, C.terrace.sideZ0 - RAMP.total / 2, `rampă ${Math.round(RAMP.slope * 100)} %, ${fm(RAMP.total, 1)} m`, 'ts', 'start');
    p.rect(XL, -C.ovE, XR, L + C.ovE, 'roofo');
    p.rect(0, 0, W, L, 'house');
    p.line(XL, ZR, XR, ZR, 'dd');
    p.text(W / 2, ZR - 0.5, 'coama', 'ts');
    const pz0 = Math.min(...PVP.map((q) => L - q.zb));
    const pz1 = Math.max(...PVP.map((q) => L - q.za));
    const px0 = Math.min(...PVP.map((q) => q.x0));
    const px1 = Math.max(...PVP.map((q) => q.x1));
    p.rect(px0, pz0, px1, pz1, 'pvh');
    p.text(W / 2, (pz0 + pz1) / 2 + 0.5, `panouri ${nPV} × 450 W`, 'ts');
    p.text(W / 2, 2.6, 'CASĂ NOUĂ P', 'tm');
    p.text(W / 2, 4.0, '7,20 × 11,73 m', 'ts');
    const S = C.septic;
    p.rect(S.x0, S.z0, S.x1, S.z1, 'conc');
    p.line(S.x0, S.z0, S.x1, S.z1, 'thin');
    p.line(S.x0, S.z1, S.x1, S.z0, 'thin');
    p.text((S.x0 + S.x1) / 2, S.z0 - 0.4, `hazna ≈ ${fm(septicVol, 0)} m³`, 'ts');
    p.circ(C.well.x, C.well.z, 0.65, 'conc');
    p.text(C.well.x + 1.0, C.well.z + 0.3, 'puț', 'ts', 'start');
    p.pl([[6.1, 11.0], [5.6, 11.0], [5.6, -1.2], [2.0, -1.2], [2.0, S.z1]], 'sew');
    p.pl([[C.well.x, C.well.z], [4.2, C.well.z], [4.2, yz(-5.2)], [6.55, yz(-5.2)], [6.55, 7.98]], 'wat');
    p.line(GATE.x0, SITE.z0, GATE.x1, SITE.z0, 'l2');
    p.text((GATE.x0 + GATE.x1) / 2, SITE.z0 + 1.5, 'poartă', 'ts');
    p.chainH([SITE.x0, GATE.x0, GATE.x1, 3.55, 9.0, SITE.x1], SITE.z0 - 6.2);
    p.chainH([SITE.x0, 0, W, SITE.x1], -1.8);
    p.chainV([SITE.z0, yz(-21.0), yz(-12.4), yz(-11.0), yz(-6.2), 0, L], SITE.x0 - 2.2);
    p.text(W / 2, SITE.z0 - 2.6, 'Str. Blocului', 'tm');
    b += p.svg() + '</g>' + northArrow(256, 30);

    const cx = 344;
    const cy = 78;
    const Rr = 36;
    let sd = `<text x="${cx}" y="${cy - Rr - 9}" class="tb" text-anchor="middle">Drumul soarelui (44,3° N)</text><circle cx="${cx}" cy="${cy}" r="${Rr}" class="l1"/><circle cx="${cx}" cy="${cy}" r="${(Rr * 2) / 3}" class="thin"/><circle cx="${cx}" cy="${cy}" r="${Rr / 3}" class="thin"/>`;
    for (const [a, t] of [
      [0, 'N'],
      [90, 'E'],
      [180, 'S'],
      [270, 'V'],
    ] as const) {
      const r = a * RAD;
      sd += `<line x1="${cx}" y1="${cy}" x2="${cx + Rr * Math.sin(r)}" y2="${cy - Rr * Math.cos(r)}" class="thin"/><text x="${cx + (Rr + 3) * Math.sin(r)}" y="${cy - (Rr + 3) * Math.cos(r) + 1}" class="t" text-anchor="middle">${t}</text>`;
    }
    for (const [m, col, nm] of [
      [6, '#d98c00', '21 iun'],
      [3, '#3a8a3a', '21 mar / sep'],
      [12, '#2a5fb0', '21 dec'],
    ] as const) {
      const pts: string[] = [];
      let noon = sunPos(DOY(m, 21), 12);
      for (let hr = 4; hr <= 20; hr += 0.25) {
        const q = sunPos(DOY(m, 21), hr);
        if (q.alt <= 0) continue;
        const r = Rr * (1 - q.alt / (Math.PI / 2));
        pts.push(`${(cx + r * Math.sin(q.az)).toFixed(2)},${(cy - r * Math.cos(q.az)).toFixed(2)}`);
        if (hr === 12) noon = q;
      }
      sd += `<polyline points="${pts.join(' ')}" class="sun" stroke="${col}"/><text x="${cx + Rr + 6}" y="${cy + Rr - 10 + [6, 3, 12].indexOf(m) * 4}" class="ts" fill="${col}">${nm}: la prânz ${Math.round(noon.alt / RAD)}°</text>`;
    }
    sd += `<rect x="${cx - 2.2}" y="${cy - 3.1}" width="4.4" height="6.2" class="house"/><text x="${cx}" y="${cy + Rr + 6}" class="ts" text-anchor="middle">cercurile: înălțimea soarelui 30° / 60° · casa în centru</text>`;
    const notes = [
      'Legendă:',
      '— — roșu: limita terenului (10 × 100 m; grădina continuă spre sud)',
      'hașurat gri: casa veche, geamlâcul și anexa (se păstrează) · verde: bolta cu viță',
      'albastru: panouri pe versantul sud (30°)',
      'portocaliu: canalizare Ø110 spre hazna · albastru: apă din puț',
      '',
      'Observații:',
      `• casa nouă la ${fm(C.site.front)} m de stradă, ${fm(C.site.west)} m de limita de vest, ${fm(C.site.width - C.site.west - W)} m de cea de est`,
      '• intrarea: poarta roșie existentă, la vest de casa veche, pe sub bolta cu viță',
      '• casa veche (cu geamlâc) și anexa pe latura de est, după Street View',
      '• limita de vest e la 0,8 m: pe peretele de vest doar fereastră de lumină (fixă, geam mat)',
      '  (Codul civil cere 2 m pentru vederi directe, inclusiv terase)',
      '• hazna lângă alee: vidanja intră pe poartă',
      `• puț ↔ hazna: ${fm(C.septic.z0 - C.well.z, 1)} m (≥ 10 m) · hazna ↔ casă: ${fm(-C.septic.z1, 1)} m`,
      '• cotele curții existente sunt estimate – verifică-le cu ruleta',
    ];
    sd += notes.map((t, i) => `<text x="274" y="${150 + i * 4.6}" class="${i === 0 || i === 6 ? 'tm' : 'ts'}">${esc(t)}</text>`).join('');
    return { title: 'Plan de situație', scale: '1:230', body: b + sd + `<text x="12" y="11" class="tt">Plan de situație</text>` };
  };

  const drawPlan = (): DrawingSheet => {
    const s = 18;
    const p = new Pen(58, 44, s);
    for (const n of FURN) {
      if (n.r && n.cx !== undefined && n.cz !== undefined) p.circ(n.cx, n.cz, n.r, 'furn');
      else if (n.x0 !== undefined && n.z0 !== undefined && n.x1 !== undefined && n.z1 !== undefined) p.rect(n.x0, n.z0, n.x1, n.z1, 'furn');
    }
    const tz0 = L + PL + 0.015;
    p.rect(0, tz0, W, tz0 + 0.95, 'deck');
    p.text(W / 2, tz0 + 1.0, 'terasă (lemn, pe piloni)', 'ts');
    p.rect(W + PL + 0.015, C.terrace.sideZ0, W + PL + 0.015 + C.terrace.sideDepth, tz0 + 0.95, 'deck');
    p.rect(W + PL + 0.015, -1.0, W + PL + 0.015 + C.terrace.sideDepth, C.terrace.sideZ0, 'ramp');
    p.text(W + 0.35, 2.5, `rampă ${Math.round(RAMP.slope * 100)} % spre N (${fm(RAMP.total, 1)} m)`, 'ts', 'start', 90);
    for (const wl of WALLS) {
      const solid = subtractRects([{ u0: wl.u0, u1: wl.u1, v0: 0, v1: 1 }], wl.openings.map((o) => ({ u0: o.u0, u1: o.u1, v0: -1, v1: 2 })));
      const ext = wl.corners ? PL : T;
      const iu0 = wl.corners ? wl.u0 + T : wl.u0;
      const iu1 = wl.corners ? wl.u1 - T : wl.u1;
      const band = (a: number, b: number, w0: number, w1: number, cls: string) =>
        p.poly([wp(wl, a, w0), wp(wl, b, w0), wp(wl, b, w1), wp(wl, a, w1)], cls);
      for (const r of solid) {
        band(r.u0, r.u1, 0, T, 'straw');
        band(Math.max(r.u0 - (r.u0 <= wl.u0 + 1e-6 ? ext : 0), wl.u0 - ext), r.u1 + (r.u1 >= wl.u1 - 1e-6 ? ext : 0), -PL, 0, 'plaster');
        const a = Math.max(r.u0, iu0);
        const b2 = Math.min(r.u1, iu1);
        if (b2 > a) band(a, b2, T, T + PL, 'plaster');
      }
      for (const q of wl.posts || []) band(q.u - q.h, q.u + q.h, q.w0, q.w1, 'blk');
      for (const o of wl.openings) {
        band(o.u0, o.u1, 0, 0.0001, 'l');
        if (o.type === 'win') {
          band(o.u0, o.u1, 0.08, 0.15, 'wood');
          p.line(...wp(wl, o.u0, 0.115), ...wp(wl, o.u1, 0.115), 'l');
          p.line(...wp(wl, o.u0, 0), ...wp(wl, o.u1, 0), 'thin');
          p.line(...wp(wl, o.u0, T), ...wp(wl, o.u1, T), 'thin');
        } else {
          band(o.u0, o.u1, 0.08, 0.15, 'wood');
          const leaves: [number, number][] = o.double ? [[o.u0, 1], [o.u1, -1]] : [[o.u0, 1]];
          const lw = (o.u1 - o.u0) / leaves.length;
          for (const [h, sg] of leaves) {
            const pts: [number, number][] = [];
            for (let i = 0; i <= 14; i++) {
              const a = (i / 14) * (Math.PI / 2);
              pts.push(wp(wl, h + sg * lw * Math.cos(a), T + lw * Math.sin(a)));
            }
            p.pl(pts, 'thin');
            p.line(...wp(wl, h, T), ...wp(wl, h, T + lw), 'l1');
          }
        }
      }
    }
    for (const iw of IWALLS) {
      const wl = { axis: iw.axis, c: iw.c, dir: 1 };
      for (const r of subtractRects([{ u0: iw.u0, u1: iw.u1, v0: 0, v1: 1 }], iw.doors.map((d) => ({ u0: d[0], u1: d[1], v0: -1, v1: 2 })))) {
        p.poly([wp(wl, r.u0, 0), wp(wl, r.u1, 0), wp(wl, r.u1, 0.1), wp(wl, r.u0, 0.1)], 'wood2');
      }
      // Pocket-door architectural CAD symbols (recessed wall slot + sliding leaf + retraction arrow)
      for (const s of getInteriorDoorSpecs(iw)) {
        for (const pk of s.pockets) {
          p.poly([wp(wl, pk.p0, 0.024), wp(wl, pk.p1, 0.024), wp(wl, pk.p1, 0.076), wp(wl, pk.p0, 0.076)], 'thin');
          p.poly([wp(wl, pk.leafU0, 0.036), wp(wl, pk.leafU1, 0.036), wp(wl, pk.leafU1, 0.064), wp(wl, pk.leafU0, 0.064)], 'l1');
          const midU = (pk.leafU0 + pk.leafU1) / 2;
          const tipU = midU + pk.slideDir * 0.14;
          p.line(...wp(wl, midU, 0.05), ...wp(wl, tipU, 0.05), 'thin');
          p.line(...wp(wl, tipU, 0.05), ...wp(wl, tipU - pk.slideDir * 0.045, 0.025), 'thin');
          p.line(...wp(wl, tipU, 0.05), ...wp(wl, tipU - pk.slideDir * 0.045, 0.075), 'thin');
        }
      }
    }
    p.rect(LOFT.x0, LOFT.z0, LOFT.x1, LOFT.z1, 'dash');
    let tot = 0;
    let tab = '';
    ROOMS.forEach((r, i) => {
      const a = r.r.reduce((s2, [x0, x1, z0, z1]) => s2 + (x1 - x0) * (z1 - z0), 0);
      tot += a;
      const [x0, x1, z0, z1] = r.r[0];
      const cxr = (x0 + x1) / 2 + (i === 2 ? -0.2 : 0);
      const czr = (z0 + z1) / 2 + (i === 2 ? 1.2 : 0);
      p.text(cxr, czr - 0.12, `${i + 1}. ${r.n}`, 'room');
      p.text(cxr, czr + 0.22, `S = ${fm(a)} m² · ${r.fin}`, 'area');
      tab += `<text x="268" y="${78 + i * 5}" class="t">${i + 1}. ${esc(r.n)}</text><text x="352" y="${78 + i * 5}" class="t" text-anchor="end">${fm(a)} m²</text><text x="356" y="${78 + i * 5}" class="ts">${r.fin}</text>`;
    });
    p.chainH([0, ...WA.openings.flatMap((o) => [o.u0, o.u1]), W], -0.75);
    p.chainH([0, W], -1.3);
    p.chainH([0, ...WB.openings.flatMap((o) => [o.u0, o.u1]), W], L + 0.62);
    p.chainV([0, ...WLw.openings.flatMap((o) => [o.u0, o.u1]), L], -0.75);
    p.chainV([0, L], -1.3);
    p.chainV([0, ...WRw.openings.flatMap((o) => [o.u0, o.u1]), L], W + 2.1);
    p.chainH([0, T, 3.33, 3.43, W - T, W], 0.8);
    p.chainV([0, T, 4.72, 4.82, 8.25, L - T, L], 4.2);
    p.line(-1.6, 9.0, W + 2.4, 9.0, 'cut');
    p.text(-1.7, 8.9, 'A', 'tb', 'end');
    p.text(W + 2.5, 8.9, 'A', 'tb', 'start');
    p.line(2.0, -1.6, 2.0, L + 1.25, 'cut');
    p.text(2.0, -1.7, 'B', 'tb');
    p.text(2.0, L + 1.5, 'B', 'tb');
    p.text(1.6, 6.6, '±0,00', 'ts');
    const tot0 = W * L;
    tab = `<text x="268" y="70" class="tb">Suprafețe</text>${tab}<line x1="268" y1="${78 + ROOMS.length * 5 - 3}" x2="372" y2="${78 + ROOMS.length * 5 - 3}" class="l"/>
      <text x="268" y="${80 + ROOMS.length * 5}" class="t">Suprafață utilă</text><text x="352" y="${80 + ROOMS.length * 5}" class="t" text-anchor="end">${fm(tot)} m²</text>
      <text x="268" y="${85 + ROOMS.length * 5}" class="t">Suprafață construită</text><text x="352" y="${85 + ROOMS.length * 5}" class="t" text-anchor="end">${fm(tot0)} m²</text>
      <text x="268" y="${90 + ROOMS.length * 5}" class="t">Terase</text><text x="352" y="${90 + ROOMS.length * 5}" class="t" text-anchor="end">${fm(C.terrace.depth * W + C.terrace.sideDepth * (tz0 + C.terrace.sideDepth + 0.1 - C.terrace.sideZ0))} m²</text>`;
    const leg = [
      'Legendă',
      'perete din baloți 40 cm, tencuit (var afară, argilă înăuntru)',
      'stâlp de lemn (12×12 / 12×20 / 20×20 la coamă)',
      'perete interior 10 cm (schelet 5×10 + plăci)',
      'contur punctat (baie + c. tehnică): tavan drept la 2,50 m și',
      '  pod de depozitare deasupra, cu chepeng',
      'linie roșie: secțiunile A–A și B–B',
      '',
      'Pardoseală: parchet stratificat 14 mm peste folie',
      'încălzitoare 70 W/m²; în baie gresie peste covor 150 W/m²',
      `Tavan la vedere: ${fm(roofY(T) - CEIL - F)} m la pereții N/S → ${fm(yRBb - F)} m sub pană`,
      'Ferestrele: parapet 0,40 m, buiandrug la 2,05 m',
      'Peretele de vest (0,8 m de vecin): fereastră de lumină',
      'fixă, geam mat, 2,40 × 1,45 m, parapet 0,60 m',
    ];
    const lg =
      leg.map((t, i) => `<text x="268" y="${130 + i * 4.6}" class="${i === 0 ? 'tm' : 'ts'}">${esc(t)}</text>`).join('') +
      `<rect x="261" y="${130 + 4.6 - 2.6}" width="5" height="3" class="straw"/><rect x="262.5" y="${130 + 9.2 - 2.6}" width="2" height="3" class="blk"/><rect x="261" y="${130 + 13.8 - 2}" width="5" height="1.8" class="wood2"/>`;
    return { title: 'Plan parter', scale: '1:55', body: p.svg() + northArrow(250, 30) + tab + lg + `<text x="12" y="11" class="tt">Plan parter</text>` };
  };

  const drawSectBB = (): DrawingSheet => {
    const s = 20;
    const p = new Pen(32 + 1.2 * s, 212, s, true);
    const xc = 2.0;
    const tz0 = L + PL + 0.015;
    const tz1 = tz0 + C.terrace.depth;
    groundAndPlatform(p, -1.2, tz1 + 1.6, [
      [0.125, 0.275],
      [L - 0.275, L - 0.125],
    ]);
    for (const z of MIDZ) {
      const P = PT[z < 0.3 || z > L - 0.3 ? 'B' : 'A'];
      p.rect(z - P.d / 2, -0.55, z + P.d / 2, C.pileH - 0.012, 'thin');
      p.rect(z - 0.11, C.pileH - 0.012, z + 0.11, C.pileH, 'steel');
    }
    p.rect(0, Y_BEAM, L, Y_OSB, 'thin');
    p.rect(0, Y_OSB, L, Y_JOIST, 'osb');
    p.rect(0.018, Y_JOIST, L - 0.018, Y_DECK, 'strawc');
    for (const j of JOIST) {
      p.rect(j.z, Y_JOIST, j.z + 0.012, Y_DECK, 'osb');
      p.rect(j.z + 0.012, Y_JOIST, j.z + JW, Y_JOIST + 0.095, 'woodc');
      p.rect(j.z + 0.012, Y_DECK - 0.095, j.z + JW, Y_DECK, 'woodc');
    }
    p.rect(0, Y_DECK, L, FS, 'osb');
    p.rect(T, FS, L - T, F, 'wood');
    wallCut(p, WA, xc, (w) => w);
    wallCut(p, WB, xc, (w) => L - w);
    const iw = IWALLS[0];
    p.rect(iw.c, F, iw.c + 0.1, Math.min(roofY(iw.c), roofY(iw.c + 0.1)) - CEIL, 'wood2');
    for (const side of ['N', 'S'] as const) {
      p.poly(slPoly(side, 0, ZR, 0, 0.4), 'strawc');
      p.poly(slPoly(side, -0.018, 0, 0, 0.4), 'osb');
      p.poly(slPoly(side, -C.ovE, ZR, 0.4, 0.412), 'osb');
      p.poly(slPoly(side, -C.ovE, ZR, 0.462, 0.486), 'wood');
      p.poly(slPoly(side, -C.ovE - 0.04, ZR, 0.486, 0.495), 'metal');
      p.poly(slPoly(side, -C.ovE, 0, -0.02, 0), 'wood');
      p.poly(slPoly(side, T, ZR - RIDGE.b / 2, -CEIL, -CEIL + 0.02), 'wood');
      const outline = slPoly(side, -C.ovE, ZR, 0, 0.4);
      p.pl(outline.concat([outline[0]]), 'thin');
      p.poly(slPoly(side, -C.ovE - 0.024, -C.ovE, -0.01, 0.49), 'wood2');
      const zg = side === 'N' ? -C.ovE - 0.1 : L + C.ovE + 0.1;
      p.circ(zg, slY(-C.ovE, 0.4) - 0.03, 0.075, 'l1');
    }
    p.poly(
      [
        [ZR - RIDGE.b / 2, yRBb],
        [ZR + RIDGE.b / 2, yRBb],
        [ZR + RIDGE.b / 2, yRB],
        [ZR, yApex],
        [ZR - RIDGE.b / 2, yRB],
      ],
      'woodc',
    );
    p.poly(
      [
        [ZR - 0.22, slY(ZR - 0.22, 0.53)],
        [ZR, slY(ZR, 0.55)],
        [ZR + 0.22, slY(ZR - 0.22, 0.53)],
      ],
      'metal',
    );
    const yT = F - 0.03;
    p.rect(tz0, yT - 0.028, tz1, yT, 'deck');
    for (const z of [tz0 + 0.65, (tz0 + 0.65 + tz1 - 0.2) / 2, tz1 - 0.2]) {
      p.rect(z - 0.05, yT - 0.378, z + 0.05, yT - 0.178, 'woodc');
      p.rect(z - 0.054, -0.55, z + 0.054, yT - 0.378, 'thin');
    }
    p.rect(tz1 - 0.09, yT, tz1, yT + 1.0, 'wood');
    p.line(tz0, yT + 1.0, tz1, yT + 1.0, 'l1');
    const rel = (y: number) => (y - F >= 0 ? '+' : '') + fm(y - F);
    p.level(-1.0, F, '±0,00 pardoseală finită', -1);
    p.level(-1.0, 0, `${rel(0)} teren (CTN)`, -1);
    p.level(-1.0, F + C.hE, `${rel(F + C.hE)} intrados streașină`, -1);
    p.level(ZR + 0.6, yApex + 0.62, `${rel(yApex + 0.62)} coamă`, 1);
    p.level(ZR + 0.35, yRBb, `${rel(yRBb)} sub pană`, 1);
    p.chainV([F, roofY(T) - CEIL], 0.75);
    p.chainV([F, yRBb], ZR - 0.6);
    p.leader(2.0, slY(2.0, 0.47), -26, -34, 'tablă fălțuită · astereală 24 · contra-șipci 5×5 (strat ventilat)');
    p.leader(2.6, slY(2.6, 0.2), -30, -27, 'membrană de difuzie · OSB 12 · baloți 40 între căpriori-scară');
    p.leader(3.2, slY(3.2, -0.05), -34, -20, 'frână de vapori · lăți de instalații 4 cm · lambriu 2 cm');
    p.leader(ZR + 0.05, yRBb + 0.25, 22, -18, `pană de coamă GL24h ${Math.round(RIDGE.b * 100)}×${Math.round(RIDGE.h * 100)}, teșită 2×30°`);
    p.leader(0.2, yPB + 0.08, -18, 10, 'cosoroabă N 12×20 teșită');
    p.leader(6.0, F - 0.005, 18, 16, 'parchet 14 · folie PE · folie încălzitoare 70 W/m² · suport 6 · OSB 22');
    p.leader(6.4, (Y_JOIST + Y_DECK) / 2, 22, 18, 'grinzi-scară 40 cm + baloți culcați · OSB 18');
    p.leader(L - 0.2, (Y_BEAM + Y_OSB) / 2, 14, 18, 'grindă fundație 15×24 pe pilon șurub Ø108, L 2,5 m');
    p.leader(L - 0.2, FS + 1.9, 26, -4, 'perete: baloți 40 pe cant, var 3,5 cm afară, argilă 3,5 cm înăuntru');
    p.text(-1.2, -0.95, 'N', 'tb', 'start');
    p.text(tz1 + 1.6, -0.95, 'S', 'tb', 'end');
    return { title: 'Secțiunea B–B (N–S, spre est)', scale: '1:50', body: p.svg() + `<text x="12" y="11" class="tt">Secțiunea B–B</text>` };
  };

  const drawSectAA = (): DrawingSheet => {
    const s = 20;
    const zc = 9.0;
    const zz = L - zc;
    const p = new Pen(70 + 1.0 * s, 212, s, true);
    const a0 = W + PL + 0.015;
    const a1 = a0 + C.terrace.sideDepth;
    groundAndPlatform(
      p,
      -1.2,
      a1 + 1.2,
      BX.map((x) => [x - 0.075, x + 0.075]),
    );
    p.rect(0, Y_OSB, W, Y_JOIST, 'osb');
    p.rect(0.018, Y_JOIST, W - 0.018, Y_DECK, 'strawc');
    p.rect(0.018, Y_JOIST, W - 0.018, Y_JOIST + 0.095, 'thin');
    p.rect(0.018, Y_DECK - 0.095, W - 0.018, Y_DECK, 'thin');
    for (const x of BX) p.rect(x - 0.054, -0.55, x + 0.054, C.pileH - 0.012, 'thin');
    p.rect(0, Y_DECK, W, FS, 'osb');
    p.rect(T, FS, W - T, F, 'wood');
    wallCut(p, WLw, zc, (w) => w);
    wallCut(p, WRw, zc, (w) => W - w);
    const y0 = slY(zz, 0);
    for (let i = 0; i < RX.length; i++) p.rect(RX[i] - JW / 2, y0, RX[i] + JW / 2, y0 + 0.4 / COS, 'woodc');
    for (let i = 1; i <= NRB; i++) p.rect(RX[i] + JW / 2, y0, RX[i + 1] - JW / 2, y0 + 0.4 / COS, 'strawc');
    p.rect(XL, slY(zz, 0.4), XR, slY(zz, 0.412), 'osb');
    for (const x of RX) p.rect(x - 0.025, slY(zz, 0.412), x + 0.025, slY(zz, 0.462), 'wood');
    p.rect(XL, slY(zz, 0.462), XR, slY(zz, 0.486), 'wood');
    p.rect(XL - 0.04, slY(zz, 0.486), XR + 0.04, slY(zz, 0.495), 'metal');
    p.rect(XL - 0.024, slY(zz, -0.01), XL, slY(zz, 0.49), 'wood2');
    p.rect(XR, slY(zz, -0.01), XR + 0.024, slY(zz, 0.49), 'wood2');
    p.rect(T, slY(zz, -CEIL), W - T, slY(zz, -CEIL + 0.02), 'wood');
    p.rect(RX[0] - JW / 2, slY(zz, -0.02), RX[1] - JW / 2, slY(zz, 0), 'wood');
    p.rect(RX[NRB + 1] + JW / 2, slY(zz, -0.02), RX[NRB + 2] + JW / 2, slY(zz, 0), 'wood');
    const yc = slY(zz, 0.495);
    p.rect(XL, yc, XR, yApex + 0.568, 'roofel');
    for (const q of PVP) {
      const zb = q.zb;
      const za = Math.max(q.za, zz);
      if (zb > zz) p.rect(q.x0, Math.max(slY(za, 0.56), yc), q.x1, slY(zb, 0.595), 'pv');
    }
    p.rect(C.chim.x - 0.11, yApex + 0.5, C.chim.x + 0.11, yApex + 0.568 + 0.6, 'steel');
    const iw = IWALLS[4];
    p.rect(LOFT.x0, F, LOFT.x1, roofY(iw.c + 0.1) - CEIL, 'thin');
    p.text((LOFT.x0 + LOFT.x1) / 2, F + 1.3, 'peretele camerei tehnice (dincolo)', 'ts');
    const yT = F - 0.03;
    p.rect(W + PL + 0.015, yT - 0.028, a1, yT, 'deck');
    for (const x of [a0 + 0.55, a1 - 0.15]) {
      p.rect(x - 0.05, yT - 0.378, x + 0.05, yT - 0.178, 'woodc');
      p.rect(x - 0.054, -0.55, x + 0.054, yT - 0.378, 'thin');
    }
    p.rect(a1 - 0.09, yT, a1, yT + 1.0, 'wood');
    const rel = (y: number) => (y - F >= 0 ? '+' : '') + fm(y - F);
    p.level(-1.0, F, '±0,00', -1);
    p.level(-1.0, 0, rel(0) + ' CTN', -1);
    p.level(XR + 0.1, yApex + 0.62, rel(yApex + 0.62) + ' coamă (dincolo)', 1);
    p.chainV([F, slY(zz, -CEIL)], 1.0);
    p.chainH([0, T, W - T, W], -0.9);
    p.chainH(RX.slice(0, 5), yApex + 0.95);
    p.leader(RX[3], y0 + 0.1, -24, 30, 'căpriori-scară 4,5×9,5 + inimă OSB 12, h 40, la ' + fm(PR, 3) + ' m');
    p.leader(RX[3] + 0.28, y0 + 0.3, -12, 38, 'baloți 50×40 culcați între căpriori');
    p.leader(0.2, slY(zz, 0) - 0.05, -14, 8, 'cosoroabă înclinată 12×15 pe stâlpi 12×20');
    p.leader(W - 0.2, F + 1.0, 14, 6, 'peretele de est (secționat)');
    p.text(-1.2, -0.95, 'V', 'tb', 'start');
    p.text(a1 + 1.2, -0.95, 'E', 'tb', 'end');
    return { title: 'Secțiunea A–A (E–V, spre nord)', scale: '1:50', body: p.svg() + `<text x="12" y="11" class="tt">Secțiunea A–A</text>` };
  };

  const drawFatade = (): DrawingSheet => {
    const s = 10;
    const out: string[] = [];
    const rel = (y: number) => (y - F >= 0 ? '+' : '') + fm(y - F);
    const eaveFacade = (wl: WallDef, ox: number, oy: number, name: string) => {
      const mir = wl.dir > 0;
      const p = new Pen(ox, oy, s, true);
      const H = (x: number) => (mir ? XR + 0.03 - x : x - XL + 0.03);
      const R = (x0: number, y0: number, x1: number, y1: number, cls: string) => p.rect(H(x0), y0, H(x1), y1, cls);
      p.line(H(XR + 2), 0, H(XL - 2), 0, 'gnd');
      R(0, 0.25, W, FS, 'conc');
      R(0, FS, W, F + C.hE - 0.02, 'wallel');
      const ye = slY(-C.ovE, -0.01);
      const yt = slY(-C.ovE, 0.49);
      R(XL, yt, XR, yApex + 0.568, 'roofel');
      for (let x = XL; x <= XR; x += 0.52) p.line(H(x), yt, H(x), yApex + 0.568, 'thin');
      R(XL - 0.024, ye, XR + 0.024, yt, 'wood2');
      R(XL - 0.04, yApex + 0.53, XR + 0.04, yApex + 0.62, 'metal');
      for (const x of [XL + 0.25, XR - 0.25]) R(x - 0.05, 0.1, x + 0.05, ye, 'metal');
      R(C.chim.x - 0.11, yApex + 0.4, C.chim.x + 0.11, yApex + 0.568 + 0.6, 'steel');
      if (wl === WB) for (const q of PVP) R(q.x0, slY(q.za, 0.56), q.x1, slY(q.zb, 0.595), 'pv');
      for (const o of wl.openings) {
        R(o.u0, o.v0!, o.u1, o.v1!, 'glass');
        R(o.u0 + 0.022, o.v0! + 0.022, o.u1 - 0.022, o.v1! - 0.022, 'l');
        if (o.double) p.line(H((o.u0 + o.u1) / 2), o.v0!, H((o.u0 + o.u1) / 2), o.v1!, 'l');
        if (o.type === 'win') R(o.u0 - 0.03, o.v0! - 0.02, o.u1 + 0.03, o.v0!, 'metal');
      }
      if (wl === WB) {
        const yT = F - 0.03;
        R(0, yT - 0.2, W, yT, 'deck');
        for (const x of [0, 1.55, 3.11 - 0.09, 5.11, 6.15, W - 0.09]) R(x, yT, x + 0.09, yT + 1.0, 'wood');
        R(0, yT + 0.95, 3.11, yT + 1.04, 'wood');
        R(5.11, yT + 0.95, W, yT + 1.04, 'wood');
      }
      const lx = Math.min(H(XL), H(XR)) - 0.3;
      p.level(lx, F, '±0,00', -1);
      p.level(lx, F + C.hE, rel(F + C.hE), -1);
      p.level(lx, yApex + 0.62, rel(yApex + 0.62), -1);
      p.chainH([H(0), H(W)].sort((a, b) => a - b), -0.7);
      out.push(p.svg(), `<text x="${ox + 41}" y="${oy + 12}" class="tm" text-anchor="middle">${name}</text>`);
    };
    const gableFacade = (wl: WallDef, ox: number, oy: number, name: string) => {
      const mir = wl.dir < 0;
      const z0 = -C.ovE - 0.1;
      const z1 = L + C.terrace.depth + 1.6;
      const p = new Pen(ox, oy, s, true);
      const H = (z: number) => (mir ? z1 - z : z - z0);
      const R = (a: number, y0: number, b: number, y1: number, cls: string) => p.rect(H(a), y0, H(b), y1, cls);
      p.line(H(z0 - 1), 0, H(z1), 0, 'gnd');
      R(0, 0.25, L, FS, 'conc');
      p.poly(
        [
          [H(0), FS],
          [H(L), FS],
          [H(L), F + C.hE],
          [H(ZR), yApex],
          [H(0), F + C.hE],
        ],
        'wallel',
      );
      for (const side of ['N', 'S'] as const) {
        const P = slPoly(side, -C.ovE, ZR, -0.01, 0.49).map(([z, y]): [number, number] => [H(z), y]);
        p.poly(P, 'roofel');
        p.poly(
          slPoly(side, -C.ovE - 0.04, ZR, 0.49, 0.53).map(([z, y]): [number, number] => [H(z), y]),
          'metal',
        );
      }
      for (const q of PVP.filter((_, i) => i % 6 === 0)) {
        p.poly(
          slPoly('S', q.za, q.zb, 0.56, 0.595).map(([z, y]): [number, number] => [H(z), y]),
          'pv',
        );
      }
      p.rect(H(C.chim.z - 0.11), roofY(C.chim.z) + 0.4, H(C.chim.z + 0.11), yApex + 0.568 + 0.6, 'steel');
      for (const o of wl.openings) {
        R(o.u0, o.v0!, o.u1, o.v1!, 'glass');
        R(o.u0 + 0.022, o.v0! + 0.022, o.u1 - 0.022, o.v1! - 0.022, 'l');
        if (o.double) p.line(H((o.u0 + o.u1) / 2), o.v0!, H((o.u0 + o.u1) / 2), o.v1!, 'l');
      }
      const yT = F - 0.03;
      const tz0 = L + PL + 0.015;
      const tz1 = tz0 + C.terrace.depth;
      R(tz0, yT - 0.2, tz1, yT, 'deck');
      for (const z of [tz0, tz0 + C.terrace.depth / 2, tz1 - 0.09]) R(z, yT, z + 0.09, yT + 1.0, 'wood');
      R(tz0, yT + 0.95, tz1, yT + 1.04, 'wood');
      if (wl === WRw) {
        const c0 = C.terrace.sideZ0;
        const c1 = tz0 + C.terrace.sideDepth + 0.1;
        R(c0, yT - 0.2, c1, yT, 'deck');
        for (let k = 0; k < 5; k++) {
          const z = c0 + (k * (c1 - c0 - 0.09)) / 4;
          R(z, yT, z + 0.09, yT + 1.0, 'wood');
        }
        R(c0, yT + 0.95, c1, yT + 1.04, 'wood');
      }
      const lx = Math.min(H(z0), H(z1)) + 0.2;
      p.level(lx, F, '±0,00', -1);
      p.level(lx, yApex + 0.62, rel(yApex + 0.62), -1);
      p.chainH([H(0), H(ZR), H(L)].sort((a, b) => a - b), -0.7);
      p.text(H(-0.6), -1.6, 'N', 'tb');
      p.text(H(L + 0.6), -1.6, 'S', 'tb');
      out.push(p.svg(), `<text x="${ox + 80}" y="${oy + 12}" class="tm" text-anchor="middle">${name}</text>`);
    };
    eaveFacade(WA, 36, 108, 'Fațada Nord (spre casa veche)');
    eaveFacade(WB, 170, 108, 'Fațada Sud (spre grădină) – panouri pe versant');
    gableFacade(WLw, 36, 226, 'Fațada Vest (fronton, spre vecin)');
    gableFacade(WRw, 222, 226, 'Fațada Est (fronton, spre rampă)');
    return { title: 'Fațade', scale: '1:100', body: out.join('') + `<text x="12" y="11" class="tt">Fațade</text>` };
  };

  const drawStructPlans = (): DrawingSheet => {
    const s = 1000 / 70;
    const pf = new Pen(28 + 0.9 * s, 30 + 1.0 * s, s);
    const pr = new Pen(212 + 1.0 * s, 30 + 1.0 * s, s);
    pf.rect(0, 0, W, L, 'thin');
    for (const x of BX) pf.rect(x - 0.075, 0, x + 0.075, L, 'woodc');
    for (const z of [0.2, L - 0.2]) {
      for (const [a, b] of [
        [BX[0] + 0.075, BX[1] - 0.075],
        [BX[1] + 0.075, BX[2] - 0.075],
      ]) {
        pf.rect(a, z - 0.075, b, z + 0.075, 'woodc');
      }
    }
    PILES.forEach((q, i) => {
      pf.circ(q.x, q.z, q.type === 'B' ? 0.17 : 0.12, q.type === 'B' ? 'blk' : 'steel');
      pf.text(q.x + 0.2, q.z - 0.12, 'P' + (i + 1), 'ts', 'start');
    });
    pf.rect(0.2 - 0.25, ZR - 0.72, 0.2 + 0.25, ZR + 0.72, 'dash');
    pf.rect(W - 0.45, ZR - 0.72, W + 0.05, ZR + 0.72, 'dash');
    pf.chainV([0, ...SIDEZ, L], -0.6);
    pf.chainH([0, ...ENDX, W], -0.6);
    pf.text(W / 2, L + 0.9, `Plan fundație: ${Q.pilesHouse} piloni șurub + grinzi 15×24 C24`, 't');
    pf.text(W / 2, L + 1.35, `● tip B (${Q.pileTH.B}): ${PT.B.name} – pereții N/S și perechile de sub stâlpii de coamă`, 'ts');
    pf.text(W / 2, L + 1.75, `○ tip A (${Q.pileTH.A}): ${PT.A.name} – șirul median și frontoanele`, 'ts');

    pr.rect(0, 0, W, L, 'thin');
    for (const wl of [WA, WB]) pr.poly([wp(wl, XL, 0.14), wp(wl, XR, 0.14), wp(wl, XR, 0.26), wp(wl, XL, 0.26)], 'woodc');
    for (const wl of [WLw, WRw]) {
      for (const [a, b] of [
        [0.26, ZR - RIDGE.b / 2],
        [ZR + RIDGE.b / 2, L - 0.26],
      ]) {
        pr.poly([wp(wl, a, 0.14), wp(wl, b, 0.14), wp(wl, b, 0.26), wp(wl, a, 0.26)], 'wood2');
      }
    }
    for (const x of RX) {
      pr.rect(x - JW / 2, -C.ovE, x + JW / 2, ZR - 0.02, 'wood');
      pr.rect(x - JW / 2, ZR + 0.02, x + JW / 2, L + C.ovE, 'wood');
    }
    pr.rect(XL, ZR - RIDGE.b / 2, XR, ZR + RIDGE.b / 2, 'woodc');
    for (const x of [0.2, W - 0.2]) pr.rect(x - 0.1, ZR - 0.1, x + 0.1, ZR + 0.1, 'blk');
    pr.rect(XL, -C.ovE, XR, L + C.ovE, 'roofo');
    const pz0 = Math.min(...PVP.map((q) => L - q.zb));
    const pz1 = Math.max(...PVP.map((q) => L - q.za));
    pr.rect(Math.min(...PVP.map((q) => q.x0)), pz0, Math.max(...PVP.map((q) => q.x1)), pz1, 'pvh');
    pr.circ(C.chim.x, C.chim.z, 0.11, 'steel');
    pr.circ(6.70, 4.95, 0.06, 'l1');
    pr.chainH(RX, -C.ovE - 0.35);
    pr.chainV([-C.ovE, 0, ZR, L, L + C.ovE], XR + 0.35);
    pr.leader(3.6, ZR, 0, -60, `pană de coamă GL24h ${Math.round(RIDGE.b * 100)}×${Math.round(RIDGE.h * 100)}, L ${fm(XR - XL)} m (o bucată)`);
    pr.leader(0.2, ZR, -10, 30, 'stâlp de coamă 20×20 (în fronton)');
    pr.leader(3.0, 0.2, 0, -12, 'cosoroabă N 12×20 teșită, cu console 0,42 m');
    pr.leader(RX[1], 2.6, 10, 8, 'căprior de fronton pe cosoroaba înclinată');
    pr.leader(RX[0], 8.0, -8, 10, 'căprior de margine pe console');
    pr.text(W / 2, L + C.ovE + 0.8, `Plan șarpantă: ${RX.length} căpriori-scară h 40 cm pe fiecare versant, la ${fm(PR, 3)} m`, 't');
    pr.text(W / 2, L + C.ovE + 1.25, 'albastru: panouri (versantul sud) · cerc: coș de fum, aerisire', 'ts');
    return {
      title: 'Structură: plan fundație și plan șarpantă',
      scale: '1:70',
      body: pf.svg() + pr.svg() + northArrow(196, 26) + `<text x="12" y="11" class="tt">Structură – fundație și șarpantă</text>`,
    };
  };

  const drawFrames = (): DrawingSheet => {
    const s = 1000 / 75;
    const out: string[] = [];
    const frame = (wl: WallDef, ox: number, oy: number, name: string) => {
      const mir = (wl.axis === 'x' && wl.dir > 0) || (wl.axis === 'z' && wl.dir < 0);
      const umin = wl.plate === 'level' ? XL : 0;
      const umax = wl.plate === 'level' ? XR : L;
      const p = new Pen(ox, oy, s, true);
      const H = (u: number) => (mir ? umax - u : u - umin);
      p.line(H(umin - 0.3), FS, H(umax + 0.3), FS, 'gnd');
      for (const o of wl.openings) p.rect(H(o.u0), o.v0!, H(o.u1), o.v1!, 'dash');
      const cls: Record<string, string> = { sill: 'woodc', post: 'wood', ridge: 'woodc', plate: 'wood2', lintel: 'wood2', parapet: 'wood2' };
      const frs = wl.frame || [];
      for (const k of ['sill', 'post', 'ridge', 'lintel', 'parapet', 'plate']) {
        for (const fr of frs.filter((f) => f.k === k)) p.poly(fr.pts.map(([u, v]) => [H(u), v]), cls[k]);
      }
      for (const fr of frs.filter((f) => f.k === 'rod')) p.line(H(fr.pts[0][0]), fr.pts[0][1], H(fr.pts[1][0]), fr.pts[1][1], 'rod');
      if (wl.plate === 'rake') {
        p.poly(
          [
            [H(ZR - RIDGE.b / 2), yRBb],
            [H(ZR + RIDGE.b / 2), yRBb],
            [H(ZR + RIDGE.b / 2), yRB],
            [H(ZR), yApex],
            [H(ZR - RIDGE.b / 2), yRB],
          ],
          'woodc',
        );
      }
      for (const x of wl.xb || []) {
        for (const [u, sg] of [
          [x.a, 1],
          [x.b, -1],
        ]) {
          p.poly(
            [
              [H(u), FS + 0.1],
              [H(u) + (mir ? -1 : 1) * sg * 0.18, FS + 0.1],
              [H(u), FS + 0.35],
            ],
            'red',
          );
        }
      }
      const ps = (wl.posts || []).map((q) => q.u).sort((a, b) => a - b);
      p.chainH([wl.u0, ...ps, wl.u1].map(H).sort((a, b) => a - b), FS - 0.45);
      p.chainV([FS, wl.plate === 'level' ? yPB : wl.limB!(ZR)], H(mir ? umin : umax) + 0.4);
      out.push(p.svg(), `<text x="${ox}" y="${oy - (wl.plate === 'level' ? plateTop(0.26) : yApex) * s - 5}" class="tm">${name}</text>`);
    };
    frame(WA, 22, 112, 'Perete Nord (A) – văzut din exterior: cosoroabă 12×20 cu console, stâlpi 12×12');
    frame(WB, 22, 222, 'Perete Sud (B) – văzut din exterior');
    frame(WLw, 178, 112, 'Perete Vest (fronton) – stâlpi 12×20, stâlp de coamă 20×20');
    frame(WRw, 178, 222, 'Perete Est (fronton) – văzut din exterior');
    const leg = `<text x="22" y="246" class="ts">Legendă: maro închis – tălpi, stâlpul de coamă și pana (secționate) · maro – stâlpi · maro mediu – cosoroabe, buiandrugi, rigle de parapet · linii albastre – cruci din tiranți Ø20 cu întinzător ·</text>
      <text x="22" y="250" class="ts">triunghi roșu – ancoră de ridicare (hold-down) cu tijă M20 până sub grinda de fundație · punctat – goluri. Cotele de jos: axele stâlpilor (m). Baloții nu sunt desenați.</text>`;
    return { title: 'Structură: desfășurata cadrelor de lemn ale pereților', scale: '1:75', body: out.join('') + leg + `<text x="12" y="11" class="tt">Cadrele pereților</text>` };
  };

  const drawDetails = (): DrawingSheet => {
    const out: string[] = [];
    const D = (col: number, row: number, title: string, sc: number, ox: number, oy: number, fn: (p: Pen) => void) => {
      const bx = 8 + col * 102;
      const by = 12 + row * 122;
      const id = `cpD${row}${col}`;
      const p = new Pen(bx + ox, by + oy, sc, true);
      p.lt = (h, v, tx, ty, txt) => {
        const x = p.X(h);
        const y = p.Y(v);
        const X = bx + tx;
        const Y = by + ty;
        const right = tx >= 49;
        p.o.push(
          `<circle cx="${x}" cy="${y}" r="0.45" class="dot"/><line x1="${x}" y1="${y}" x2="${X + (right ? -0.6 : 0.6)}" y2="${Y - 0.8}" class="l"/><text x="${X}" y="${Y}" class="ts" text-anchor="${right ? 'start' : 'end'}">${esc(txt)}</text>`,
        );
        return p;
      };
      p.note = (tx, ty, txt, cls = 'ts', anchor = 'start') => {
        p.o.push(`<text x="${bx + tx}" y="${by + ty}" class="${cls}" text-anchor="${anchor}">${esc(txt)}</text>`);
        return p;
      };
      p.num = (h, v, n) => {
        const x = p.X(h);
        const y = p.Y(v);
        p.o.push(`<circle cx="${x}" cy="${y}" r="1.6" fill="#fff" stroke="#222" stroke-width=".25"/><text x="${x}" y="${y + 0.8}" class="ts" text-anchor="middle">${n}</text>`);
        return p;
      };
      fn(p);
      out.push(
        `<defs><clipPath id="${id}"><rect x="${bx}" y="${by}" width="98" height="116"/></clipPath></defs><rect x="${bx}" y="${by}" width="98" height="116" class="l"/>`,
        `<text x="${bx + 2}" y="${by + 5}" class="tm"><tspan font-weight="700">D${row * 4 + col + 1}</tspan> ${esc(title)}</text>`,
        `<g clip-path="url(#${id})">${p.svg()}</g>`,
      );
    };
    const b = RIDGE.b * 100;
    const h = RIDGE.h * 100;
    const sb = `${Math.round(b)}×${Math.round(h)}`;

    D(0, 0, 'Pilon șurub – grindă de fundație', 0.8, 49, 60, (p) => {
      p.rect(-60, -40, 60, 0, 'earth');
      p.line(-60, 0, 60, 0, 'gnd');
      p.rect(-5.4, -40, 5.4, 23.8, 'steel');
      p.rect(-11, 23.8, 11, 25, 'steel');
      p.rect(-8.2, 25, -7.6, 45, 'steel');
      p.rect(7.6, 25, 8.2, 45, 'steel');
      p.rect(-7.5, 25.4, 7.5, 49.4, 'woodc');
      p.rect(-7.5, 25, 7.5, 25.4, 'blk');
      for (const y of [32, 42]) {
        p.line(-11, y, 11, y, 'l1');
        p.rect(-12.5, y - 1, -11, y + 1, 'steel');
        p.rect(11, y - 1, 12.5, y + 1, 'steel');
      }
      p.rect(-40, 49.4, 40, 51.2, 'osb');
      p.lt(0, 37, 64, 22, 'grindă 15×24 C24 (secțiune)')
        .lt(11.5, 42, 64, 28, '2 buloane M12 + șaibe late')
        .lt(-30, 50.3, 32, 14, 'OSB 18 – fundul platformei')
        .lt(-7.9, 30, 32, 36, 'cap în U reglabil')
        .lt(-7.5, 25.2, 32, 44, 'bandă bituminoasă')
        .lt(0, -18, 64, 80, 'pilon A: Ø108×4, L 2,5 m, elice Ø300')
        .note(64, 83.5, 'pilon B: Ø133×5, L 3,0 m, 2 elice Ø400')
        .note(64, 87, 'elicele sub adâncimea de îngheț')
        .note(4, 64, 'teren');
    });

    D(1, 0, 'Grindă-scară de podea pe grinda de fundație', 0.75, 49, 60, (p) => {
      p.rect(-48, -24, 48, 0, 'wood2');
      p.rect(-48, 0, 48, 1.8, 'osb');
      for (const x of [-27.35, 27.35]) {
        p.rect(x - 2.85, 1.8, x - 1.65, 41.8, 'osb');
        p.rect(x - 1.65, 1.8, x + 2.85, 11.3, 'woodc');
        p.rect(x - 1.65, 32.3, x + 2.85, 41.8, 'woodc');
        p.pl([[x + 2.85, 8.3], [x + 3.5, 8.3], [x + 3.5, 1.8], [x + 10, 1.8]], 'l2');
      }
      p.rect(-24.5, 1.8, 24.5, 41.8, 'strawc');
      p.rect(-48, 41.8, 48, 44, 'osb');
      p.rect(-48, 44, 48, 46.1, 'wood');
      p.lt(-40, 45, 30, 16, 'OSB 22 + parchet')
        .lt(28.5, 37, 66, 24, 'talpă 4,5×9,5 C24')
        .lt(24.9, 22, 66, 86, 'inimă OSB 12 mm, h 40')
        .lt(32, 2.5, 66, 92, 'colțar 90×90 (2 pe reazem)')
        .lt(0, 22, 36, 86, 'balot culcat 40 cm')
        .lt(-40, 0.9, 36, 92, 'OSB 18')
        .lt(-30, -12, 36, 98, 'grinda 15×24 (în lungul ei)')
        .note(49, 108, `interax grinzi-scară ${fm(spJ * 100, 1)} cm · lumină 49 cm`, 'ts', 'middle');
    });

    D(2, 0, 'Bază de perete: talpă, stâlp, ancoră', 0.5, 39, 66, (p) => {
      p.rect(-14, -68, 54, -44, 'thin');
      p.rect(12.5, -68, 27.5, -44, 'woodc');
      p.rect(-14, -44, 54, -42.2, 'osb');
      p.rect(-14, -42.2, 54, -2.2, 'strawc');
      p.rect(-14, -2.2, 54, 0, 'osb');
      p.rect(40, 0, 54, 2.1, 'wood');
      p.rect(0, 0, 10, 10, 'woodc');
      p.rect(30, 0, 40, 10, 'woodc');
      p.rect(10, 0, 30, 10, 'woodc');
      p.rect(14, 10, 26, 105, 'woodc');
      p.rect(0.4, 10, 14, 105, 'strawc');
      p.rect(26, 10, 39.6, 105, 'strawc');
      p.rect(-3.5, -20, 0, 105, 'plaster');
      p.rect(40, 2.1, 43.5, 105, 'plaster');
      p.rect(26, 12, 26.6, 42, 'steel');
      p.rect(26, 10, 33, 11.2, 'steel');
      p.line(29.5, 11, 29.5, -70, 'l2');
      p.rect(25, -70.2, 34, -68, 'steel');
      p.rect(-4, -20, -3.5, 10, 'steel');
      p.lt(8, 60, 26, 30, 'baloți 40 pe cant')
        .lt(5, 5, 26, 62, 'talpă dublă 10×10')
        .lt(-10, -1, 26, 68, 'OSB 22')
        .lt(-3.7, -10, 26, 76, 'plasă anti-rozătoare')
        .lt(20, -56, 26, 100, 'grinda de fundație')
        .lt(20, 80, 70, 22, 'stâlp 12×12 / 12×20')
        .lt(26.3, 30, 70, 44, 'ancoră de ridicare')
        .note(70, 47.5, '≥ 75 kN (tip WHT 740)')
        .lt(20, 5, 70, 60, 'traversă 10×10')
        .lt(48, 1, 70, 66, 'parchet între pereți')
        .lt(29.5, -30, 70, 86, 'tijă M20 prin platformă')
        .note(70, 89.5, 'și grindă, placă dedesubt');
    });

    D(3, 0, 'Streașină: căprior-scară pe cosoroabă', 0.42, 58, 50, (p) => {
      const y = (z: number, n: number) => z * TAN + n / COS;
      const Pz = (z0: number, z1: number, n0: number, n1: number, cls: string) =>
        p.poly(
          [
            [z0, y(z0, n0)],
            [z1, y(z1, n0)],
            [z1, y(z1, n1)],
            [z0, y(z0, n1)],
          ],
          cls,
        );
      p.rect(0, -70, 40, 14 * TAN - 20, 'strawc');
      p.rect(14, -70, 26, 14 * TAN - 20, 'woodc');
      p.poly([[14, 14 * TAN - 20], [26, 14 * TAN - 20], [26, 26 * TAN], [14, 14 * TAN]], 'woodc');
      p.poly([[0, 14 * TAN - 20], [14, 14 * TAN - 20], [14, 14 * TAN], [0, 0]], 'strawc');
      p.poly([[26, 14 * TAN - 20], [40, 14 * TAN - 20], [40, 40 * TAN], [26, 26 * TAN]], 'strawc');
      p.rect(-3.5, -70, 0, -2, 'plaster');
      p.rect(40, -70, 43.5, 40 * TAN - 6, 'plaster');
      Pz(0, 70, 0, 40, 'strawc');
      Pz(-1.8, 0, 0, 40, 'osb');
      for (const n of [0, 9.5, 30.5, 40]) p.pl([[-80, y(-80, n)], [70, y(70, n)]], 'thin');
      Pz(-80, 70, 40, 41.2, 'osb');
      Pz(-80, 70, 46.2, 48.6, 'wood');
      Pz(-84, 70, 48.6, 49.4, 'metal');
      Pz(-80, 0, -2, 0, 'wood');
      Pz(40, 70, -6, -4, 'wood');
      Pz(-82.4, -80, -1, 49, 'wood2');
      p.circ(-90, y(-80, 40) - 3, 7.5, 'l1');
      p.line(26, 26 * TAN + 3, 14, 14 * TAN - 12, 'dash');
      p.pl([[26, 26 * TAN - 6], [27.5, 26 * TAN - 6], [27.5, 26 * TAN + 4]], 'l2');
      p.pl([[-60, y(-60, 43.7)], [40, y(40, 43.7)]], 'thin');
      p.lt(-50, y(-50, 47), 50, 12, 'tablă · astereală · contra-șipci · OSB 12')
        .lt(-0.9, y(0, 20), 58, 22, 'dop OSB peste perete')
        .lt(55, y(55, 20), 74, 30, 'baloți 40')
        .lt(-20, y(-20, 43.7), 17, 22, 'aer ventilat')
        .lt(-90, y(-80, 40) - 3, 17, 38, 'jgheab Ø150')
        .lt(-40, y(-40, -1), 40, 92, 'sofit + grilă anti-insecte')
        .lt(27.5, 26 * TAN, 58, 88, 'ancoră căprior + holzșurub 8×240')
        .lt(20, 14 * TAN - 8, 58, 93, 'cosoroabă 12×20 teșită 30°')
        .lt(20, -40, 58, 98, 'stâlp + baloți 40')
        .lt(55, y(55, -5), 58, 103, 'lambriu pe lăți 4 cm (instalații)');
    });

    D(0, 1, 'Coamă: căpriorii pe pana teșită', 0.42, 49, 46, (p) => {
      const y = (z: number, n: number) => -Math.abs(z) * TAN + n / COS;
      const yb = -(b / 2) * TAN;
      p.poly([[-b / 2, yb - h], [b / 2, yb - h], [b / 2, yb], [0, 0], [-b / 2, yb]], 'woodc');
      for (const sg of [-1, 1]) {
        const P = (z0: number, z1: number, n0: number, n1: number, cls: string) =>
          p.poly(
            [
              [sg * z0, y(z0, n0)],
              [sg * z1, y(z1, n0)],
              [sg * z1, y(z1, n1)],
              [sg * z0, y(z0, n1)],
            ],
            cls,
          );
        P(0, 80, 0, 40, 'osb');
        P(0, 80, 0, 9.5, 'woodc');
        P(0, 80, 30.5, 40, 'woodc');
        P(0, 80, 40, 41.2, 'osb');
        P(0, 80, 46.2, 48.6, 'wood');
        P(0, 80, 48.6, 49.4, 'metal');
        P(b / 2, 80, -6, -4, 'wood');
        P(4, 36, 4, 36, 'dash');
        P(0, 24, 53, 55, 'metal');
        p.line(sg * 12, y(12, 40), sg * 6, y(6, 0) - 22, 'l2');
      }
      p.note(49, 12, '↑ aer (coamă ventilată)', 'ts', 'middle');
      p.lt(0, yb - h / 2, 62, 86, `pană GL24h ${sb}, teșită 2×30°`)
        .lt(-20, y(20, 20), 36, 86, 'eclise OSB 18, ambele fețe')
        .lt(9, y(9, 22), 62, 92, '2 holzșuruburi 8×300 în pană')
        .lt(-60, y(60, 5), 36, 92, 'căprior-scară h 40')
        .lt(0, 3, 36, 98, 'capete tăiate vertical')
        .lt(40, y(40, -5), 62, 98, 'lambriu până în pană')
        .note(49, 108, 'cuie 3,1×80 la 7 cm prin eclise; câte un balot pe fiecare versant', 'ts', 'middle');
    });

    D(1, 1, 'Pana de coamă pe stâlpul din fronton', 0.4, 49, 56, (p) => {
      p.rect(-10, -100, 10, 0, 'woodc');
      p.poly([[-b / 2, 0], [b / 2, 0], [b / 2, h], [0, h + (b / 2) * TAN], [-b / 2, h]], 'woodc');
      for (const sg of [-1, 1]) {
        p.rect(sg * 10, -22, sg * 10.6, 25, 'steel');
        const P = (z0: number, z1: number, n0: number, n1: number, cls: string) =>
          p.poly(
            [
              [sg * z0, h - (z0 - 10) * TAN + n0 / COS],
              [sg * z1, h - (z1 - 10) * TAN + n0 / COS],
              [sg * z1, h - (z1 - 10) * TAN + n1 / COS],
              [sg * z0, h - (z0 - 10) * TAN + n1 / COS],
            ],
            cls,
          );
        P(10, 100, -15, 0, 'wood2');
        P(10, 100, 0, 40, 'strawc');
        p.rect(sg * 10, -100, sg * 100, -30, 'strawc');
        p.pl([[sg * 10, h - 20], [sg * 14, h - 20], [sg * 14, h - 6]], 'l2');
      }
      for (const yy of [-14, -4, 9, 18]) p.line(-12, yy, 12, yy, 'l1');
      p.lt(0, -60, 62, 92, 'stâlp de coamă 20×20 GL24h')
        .lt(10.3, 2, 62, 74, 'eclise metalice 6 mm')
        .lt(-11, 9, 36, 74, '4 buloane M16')
        .lt(0, h / 2, 62, 14, `pană GL24h ${sb} (secțiune)`)
        .lt(-45, h - 35 * TAN - 6, 26, 40, 'cosoroabă înclinată')
        .lt(14, h - 14, 62, 20, 'papuc de grindă')
        .lt(-70, h - 60 * TAN + 20, 26, 26, 'căprior de fronton')
        .note(49, 108, 'vedere în planul frontonului; pana iese 0,62 m în consolă', 'ts', 'middle');
    });

    D(2, 1, 'Colț nord-vest văzut de sus', 0.38, 34, 42, (p) => {
      const Yz = (z: number) => -z;
      p.rect(0, Yz(0), 125, Yz(40), 'strawc');
      p.rect(0, Yz(40), 40, Yz(150), 'strawc');
      p.rect(-42.5, Yz(14), 125, Yz(26), 'wood2');
      p.rect(14, Yz(26), 26, Yz(150), 'wood');
      p.rect(14, Yz(14), 26, Yz(26), 'blk');
      for (const x of [-36.7, 20, 76.7]) p.rect(x - 2.85, Yz(-80), x + 2.85, Yz(150), 'dash');
      p.poly([[10, Yz(20)], [30, Yz(36)], [30.8, Yz(35)], [10.8, Yz(19)]], 'steel');
      p.lt(-30, Yz(20), 20, 22, 'consolă 42 cm')
        .lt(100, Yz(20), 66, 30, 'cosoroabă N 12×20 continuă')
        .lt(20, Yz(20), 66, 52, 'stâlp de colț 12×12')
        .lt(28, Yz(33), 66, 58, 'colțar + bandă perforată')
        .lt(20, Yz(100), 66, 82, 'cosoroabă înclinată')
        .lt(20, Yz(135), 60, 96, 'căprior pe axul peretelui')
        .lt(-36.7, Yz(110), 24, 96, 'căprior de margine')
        .note(4, 12, 'N ↑');
    });

    D(3, 1, 'Pardoseală: parchet peste încălzire', 1.2, 49, 52, (p) => {
      p.rect(-35, -14, 22, -2.2, 'strawc');
      p.rect(-35, -2.2, 22, 0, 'osb');
      p.rect(-35, 0, 21, 0.6, 'thin');
      p.rect(-35, 0.6, 21, 0.72, 'red');
      p.rect(-35, 0.72, 21, 2.12, 'wood');
      p.rect(22, 0, 32, 10, 'woodc');
      p.rect(22, 10, 36, 18, 'strawc');
      p.rect(18.5, 0.72, 22, 18, 'plaster');
      p.rect(16.8, 2.12, 18.5, 8.12, 'wood2');
      (
        [
          [-30, 1.4, 1],
          [-22, 0.72, 2],
          [-14, 0.65, 3],
          [-6, 0.3, 4],
          [2, -1.1, 5],
          [8, -8, 6],
          [17.6, 5, 7],
          [27, 5, 8],
        ] as [number, number, number][]
      ).forEach(([x, yv, n]) => p.num(x, yv + (n <= 4 ? 4 + n * 1.6 : 0), n).line(x, yv, x, yv + (n <= 4 ? 4 + n * 1.6 - 1.4 : 0), 'thin'));
      [
        '1  parchet stratificat stejar 14 mm, montaj flotant (R ≤ 0,15 m²K/W)',
        '2  folie PE 0,2 mm (barieră de vapori)',
        '3  folie încălzitoare de carbon 70 W/m², max. 27 °C la suprafață',
        '4  suport izolant-reflectorizant 6 mm',
        '5  OSB 22 mm (podea brută)',
        '6  grinzi-scară h 40 + baloți culcați',
        '7  plintă; rost de dilatare 10 mm la perete',
        '8  talpa peretelui stă direct pe OSB 22',
      ].forEach((t, i) => p.note(4, 76 + i * 4.2, t));
      p.note(4, 112, 'Baie: covor 150 W/m² în adeziv sub gresie, pe placă cimentoasă 12 mm.');
    });

    return { title: 'Detalii de îmbinare', scale: '1:10 … 1:25 (orientativ)', body: out.join('') + `<text x="12" y="9.5" class="tt" style="font-size:4.5px">Detalii de îmbinare</text>` };
  };

  return [drawSituatie, drawPlan, drawSectBB, drawSectAA, drawFatade, drawStructPlans, drawFrames, drawDetails].map((fn) => fn());
}
