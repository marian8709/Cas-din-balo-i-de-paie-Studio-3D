import * as THREE from 'three';

function makeCanvas(size: number, draw: (g: CanvasRenderingContext2D, s: number) => void, isColor = true, anisotropy = 8) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const g = cv.getContext('2d')!;
  draw(g, size);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = anisotropy;
  return t;
}

// Deterministic pseudo-random helper for consistent textures across renders
function mulberry32(seed: number) {
  let a = seed;
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createMaterialLibrary(clipPlane: THREE.Plane, isSoftwareGl: boolean, maxAniso: number) {
  const aniso = isSoftwareGl ? 1 : Math.min(maxAniso || 8, 8);

  const strawTex = makeCanvas(
    512,
    (g, S) => {
      const rnd = mulberry32(101);
      g.fillStyle = '#d3b25a';
      g.fillRect(0, 0, S, S);
      const cols = ['#edd888', '#c49d42', '#ad8734', '#f4e4a3', '#9d792d', '#dbbe68'];
      for (let i = 0; i < 6500; i++) {
        g.strokeStyle = cols[i % cols.length];
        g.lineWidth = 0.7 + rnd() * 1.6;
        const x = rnd() * S;
        const y = rnd() * S;
        const l = 12 + rnd() * 44;
        const a = (rnd() - 0.5) * 0.65;
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
        g.stroke();
      }
    },
    true,
    aniso,
  );

  const strawBump = makeCanvas(
    256,
    (g, S) => {
      const rnd = mulberry32(102);
      g.fillStyle = '#808080';
      g.fillRect(0, 0, S, S);
      for (let i = 0; i < 3200; i++) {
        const v = Math.floor(85 + rnd() * 130);
        g.strokeStyle = `rgb(${v},${v},${v})`;
        g.lineWidth = 1 + rnd() * 1.4;
        const x = rnd() * S;
        const y = rnd() * S;
        const l = 8 + rnd() * 26;
        const a = (rnd() - 0.5) * 0.65;
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
        g.stroke();
      }
    },
    false,
    aniso,
  );

  const parquetTex = makeCanvas(
    512,
    (g, S) => {
      const rnd = mulberry32(201);
      const n = 8;
      const w = S / n;
      const tones = ['#c8985c', '#d1a468', '#be8d53', '#d7ab72', '#c39358', '#ce9f63'];
      for (let i = 0; i < n; i++) {
        let y = -rnd() * S;
        while (y < S) {
          const len = S * (0.45 + rnd() * 0.5);
          g.fillStyle = tones[Math.floor(rnd() * tones.length)];
          g.fillRect(i * w, y, w, len);
          g.strokeStyle = 'rgba(85,55,26,0.2)';
          g.lineWidth = 1;
          for (let k = 0; k < 7; k++) {
            const xx = i * w + 3 + rnd() * (w - 6);
            g.beginPath();
            g.moveTo(xx, y);
            g.bezierCurveTo(xx + 3, y + len * 0.3, xx - 3, y + len * 0.6, xx + 1, y + len);
            g.stroke();
          }
          g.strokeStyle = '#75502d';
          g.lineWidth = 1.5;
          g.strokeRect(i * w, y, w, len);
          y += len;
        }
      }
    },
    true,
    aniso,
  );

  const tileTex = makeCanvas(
    512,
    (g, S) => {
      const rnd = mulberry32(301);
      g.fillStyle = '#dad6cd';
      g.fillRect(0, 0, S, S);
      for (let i = 0; i < 1800; i++) {
        const v = 205 + Math.floor(rnd() * 24);
        g.fillStyle = `rgba(${v},${v - 2},${v - 7},0.28)`;
        g.fillRect(rnd() * S, rnd() * S, 3 + rnd() * 8, 2 + rnd() * 5);
      }
      g.strokeStyle = '#9b968c';
      g.lineWidth = 3;
      for (let i = 0; i <= 2; i++) {
        g.beginPath();
        g.moveTo((i * S) / 2, 0);
        g.lineTo((i * S) / 2, S);
        g.moveTo(0, (i * S) / 2);
        g.lineTo(S, (i * S) / 2);
        g.stroke();
      }
    },
    true,
    aniso,
  );

  const plasterTex = makeCanvas(
    512,
    (g, S) => {
      const rnd = mulberry32(401);
      g.fillStyle = '#ede5d2';
      g.fillRect(0, 0, S, S);
      for (let i = 0; i < 4500; i++) {
        const shade = Math.floor(218 + rnd() * 30);
        g.fillStyle = `rgba(${shade}, ${shade - 8}, ${shade - 22}, 0.25)`;
        g.beginPath();
        g.arc(rnd() * S, rnd() * S, 1.5 + rnd() * 5.5, 0, Math.PI * 2);
        g.fill();
      }
      for (let i = 0; i < 1800; i++) {
        const c = 175 + Math.floor(rnd() * 65);
        g.fillStyle = `rgba(${c}, ${c - 10}, ${c - 22}, 0.35)`;
        g.fillRect(rnd() * S, rnd() * S, 1.2, 1.2);
      }
    },
    true,
    aniso,
  );

  const plasterBump = makeCanvas(
    256,
    (g, S) => {
      const rnd = mulberry32(402);
      g.fillStyle = '#808080';
      g.fillRect(0, 0, S, S);
      for (let i = 0; i < 2800; i++) {
        const v = Math.floor(105 + rnd() * 50);
        g.fillStyle = `rgba(${v},${v},${v},0.4)`;
        g.beginPath();
        g.arc(rnd() * S, rnd() * S, 1 + rnd() * 4, 0, Math.PI * 2);
        g.fill();
      }
    },
    false,
    aniso,
  );

  const woodGrainTex = makeCanvas(
    256,
    (g, S) => {
      const rnd = mulberry32(501);
      g.fillStyle = '#d3a96f';
      g.fillRect(0, 0, S, S);
      for (let i = 0; i < 140; i++) {
        const x = rnd() * S;
        g.strokeStyle = i % 2 === 0 ? 'rgba(130, 82, 34, 0.16)' : 'rgba(240, 212, 165, 0.14)';
        g.lineWidth = 0.8 + rnd() * 2.2;
        g.beginPath();
        g.moveTo(x, 0);
        g.bezierCurveTo(x + (rnd() - 0.5) * 14, S * 0.35, x + (rnd() - 0.5) * 14, S * 0.7, x, S);
        g.stroke();
      }
    },
    true,
    aniso,
  );

  const woodBump = makeCanvas(
    256,
    (g, S) => {
      const rnd = mulberry32(502);
      g.fillStyle = '#808080';
      g.fillRect(0, 0, S, S);
      for (let i = 0; i < 160; i++) {
        const x = rnd() * S;
        const v = Math.floor(100 + rnd() * 60);
        g.strokeStyle = `rgba(${v},${v},${v},0.45)`;
        g.lineWidth = 1 + rnd() * 1.8;
        g.beginPath();
        g.moveTo(x, 0);
        g.lineTo(x + (rnd() - 0.5) * 6, S);
        g.stroke();
      }
    },
    false,
    aniso,
  );

  const grassTex = makeCanvas(
    512,
    (g, S) => {
      const rnd = mulberry32(601);
      g.fillStyle = '#6f874b';
      g.fillRect(0, 0, S, S);
      // Soft meadow patches
      for (let i = 0; i < 160; i++) {
        g.fillStyle = i % 3 === 0 ? 'rgba(128, 152, 82, 0.25)' : i % 3 === 1 ? 'rgba(84, 108, 52, 0.22)' : 'rgba(148, 160, 96, 0.18)';
        g.beginPath();
        g.arc(rnd() * S, rnd() * S, 12 + rnd() * 40, 0, Math.PI * 2);
        g.fill();
      }
      // Fine grass blades
      const bladeCols = ['#7e9a54', '#637a3e', '#8eab61', '#566b36', '#98b068'];
      for (let i = 0; i < 9000; i++) {
        g.strokeStyle = bladeCols[i % bladeCols.length];
        g.lineWidth = 0.8 + rnd() * 1.1;
        const x = rnd() * S;
        const y = rnd() * S;
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x + (rnd() - 0.5) * 5, y - 4 - rnd() * 8);
        g.stroke();
      }
    },
    true,
    aniso,
  );

  const gravelTex = makeCanvas(
    256,
    (g, S) => {
      const rnd = mulberry32(701);
      g.fillStyle = '#bab2a1';
      g.fillRect(0, 0, S, S);
      const cols = ['#cfc8b8', '#a59d8d', '#938b7c', '#dcd6c8', '#867e71'];
      for (let i = 0; i < 2600; i++) {
        g.fillStyle = cols[i % cols.length];
        const rx = 1.2 + rnd() * 3.2;
        const ry = 1.0 + rnd() * 2.4;
        g.save();
        g.translate(rnd() * S, rnd() * S);
        g.rotate(rnd() * Math.PI);
        g.beginPath();
        g.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
        g.fill();
        g.restore();
      }
    },
    true,
    aniso,
  );

  const pvTex = makeCanvas(
    256,
    (g, S) => {
      g.fillStyle = '#13203d';
      g.fillRect(0, 0, S, S);
      // Cell grid
      g.strokeStyle = '#334d7a';
      g.lineWidth = 1.5;
      const cols = 6;
      const rows = 10;
      for (let c = 0; c <= cols; c++) {
        const x = (c * S) / cols;
        g.beginPath();
        g.moveTo(x, 0);
        g.lineTo(x, S);
        g.stroke();
      }
      for (let r = 0; r <= rows; r++) {
        const y = (r * S) / rows;
        g.beginPath();
        g.moveTo(0, y);
        g.lineTo(S, y);
        g.stroke();
      }
      // Thin silver busbars
      g.strokeStyle = 'rgba(180, 200, 230, 0.35)';
      g.lineWidth = 0.7;
      for (let c = 0; c < cols; c++) {
        const x1 = ((c + 0.33) * S) / cols;
        const x2 = ((c + 0.66) * S) / cols;
        g.beginPath();
        g.moveTo(x1, 0);
        g.lineTo(x1, S);
        g.moveTo(x2, 0);
        g.lineTo(x2, S);
        g.stroke();
      }
      // Outer aluminum border
      g.strokeStyle = '#c8ced6';
      g.lineWidth = 6;
      g.strokeRect(0, 0, S, S);
    },
    true,
    aniso,
  );

  const M = (color: number, o: THREE.MeshStandardMaterialParameters = {}) =>
    new THREE.MeshStandardMaterial({
      color,
      roughness: 0.88,
      metalness: 0,
      side: THREE.DoubleSide,
      clippingPlanes: [clipPlane],
      clipShadows: true,
      ...o,
    });

  const texMat = (tex: THREE.Texture, rx: number, rz: number, o: THREE.MeshStandardMaterialParameters = {}) => {
    const t = tex.clone();
    t.needsUpdate = true;
    t.repeat.set(rx, rz);
    return M(0xffffff, { map: t, roughness: 0.55, ...o });
  };

  const makeWood = (tint: number, rough = 0.65) => {
    const t = woodGrainTex.clone();
    t.needsUpdate = true;
    t.repeat.set(1, 2);
    const b = woodBump.clone();
    b.needsUpdate = true;
    b.repeat.set(1, 2);
    return M(tint, { map: t, bumpMap: b, bumpScale: 0.008, roughness: rough });
  };

  const makePlaster = (tint: number) => {
    const t = plasterTex.clone();
    t.needsUpdate = true;
    t.repeat.set(3, 2);
    const b = plasterBump.clone();
    b.needsUpdate = true;
    b.repeat.set(4, 3);
    return M(tint, { map: t, bumpMap: b, bumpScale: 0.012, roughness: 0.92 });
  };

  const STRAW = [0xffffff, 0xf3ead2, 0xe8dcb8, 0xfff5d8].map((c) =>
    M(c, { map: strawTex, bumpMap: strawBump, bumpScale: 0.018, roughness: 0.96 }),
  );

  const lawnTex = grassTex.clone();
  lawnTex.needsUpdate = true;
  lawnTex.repeat.set(4, 40);

  const gravelRepeat = gravelTex.clone();
  gravelRepeat.needsUpdate = true;
  gravelRepeat.repeat.set(3, 8);

  const farGroundTex = grassTex.clone();
  farGroundTex.needsUpdate = true;
  farGroundTex.repeat.set(60, 60);

  const MAT = {
    wood: makeWood(0xf2e4cc, 0.68),
    woodDark: makeWood(0xc89a64, 0.64),
    woodLight: makeWood(0xfaeed7, 0.66),
    brace: M(0x8a5a2a, { roughness: 0.7 }),
    glulam: makeWood(0xf5dfba, 0.55),
    osb: M(0xcca86f, { bumpMap: strawBump, bumpScale: 0.005, roughness: 0.85 }),
    plaster: makePlaster(0xfaf6ec),       // Warm natural breathable lime plaster
    plasterInt: makePlaster(0xefe1c8),    // Warm clay interior plaster
    iwall: makePlaster(0xf5f1e8),
    ceiling: makeWood(0xf9edd2, 0.60),
    frame: makeWood(0x8a603a, 0.45),      // Treated architectural oak/larch joinery
    glass: isSoftwareGl
      ? M(0xb6e0ef, { transparent: true, opacity: 0.36, roughness: 0.08, metalness: 0.15 })
      : new THREE.MeshPhysicalMaterial({
          color: 0xdff2fa,
          transparent: true,
          opacity: 0.42,
          roughness: 0.05,
          metalness: 0.1,
          reflectivity: 0.9,
          clearcoat: 1.0,
          clearcoatRoughness: 0.06,
          side: THREE.DoubleSide,
          clippingPlanes: [clipPlane],
          clipShadows: true,
        }),
    frost: M(0xeef3f5, { transparent: true, opacity: 0.82, roughness: 0.55 }),
    metal: M(0x3a4046, { metalness: 0.68, roughness: 0.34 }), // Modern anthracite standing seam metal
    steel: M(0xa6aeb5, { metalness: 0.80, roughness: 0.32 }),
    stake: M(0x6b4a2b, { roughness: 0.88 }),
    stuff: M(0xd8c37f, { map: strawTex, bumpMap: strawBump, bumpScale: 0.015, roughness: 0.96 }),
    stove: M(0x222427, { metalness: 0.45, roughness: 0.50 }),
    deck: makeWood(0xdcb486, 0.72), // Natural larch/thermo-wood terrace decking
    mwool: M(0x9c9a8e, { roughness: 1 }),
    ceramic: M(0x6a5a50, { roughness: 0.7 }),
    lawn: M(0xffffff, { map: lawnTex, roughness: 0.95 }),
    farGround: M(0xdbe2cf, { map: farGroundTex, roughness: 0.98 }),
    gravel: M(0xffffff, { map: gravelRepeat, bumpMap: gravelRepeat, bumpScale: 0.015, roughness: 0.92 }),
    pv: M(0xffffff, { map: pvTex, metalness: 0.25, roughness: 0.18 }),
  };

  return {
    MAT,
    STRAW,
    parquetTex,
    tileTex,
    texMat,
    dispose: () => {
      [strawTex, strawBump, parquetTex, tileTex, plasterTex, plasterBump, woodGrainTex, woodBump, grassTex, gravelTex, pvTex].forEach((t) =>
        t.dispose(),
      );
    },
  };
}
