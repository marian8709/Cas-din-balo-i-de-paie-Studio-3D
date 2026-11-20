import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BX,
  C,
  ENDX,
  F,
  FS,
  IWALLS,
  MIDZ,
  RAMP,
  RIDGE,
  RIDGE_PILE_OFFSET,
  RAD,
  SIDEZ,
  T,
  WALK_AT,
  ZR,
  DOY,
  sunPos,
  halfDay,
  clearSky,
  floorAt,
  roomAt,
  subtractRects,
  kc,
  createInitialWalls,
  getInteriorDoorSpecs,
  calcStructuralRows,
} from './config';

test('solar geometry at Clejani (44.32° N) matches solstices', () => {
  const summerNoon = sunPos(DOY(6, 21), 12);
  const winterNoon = sunPos(DOY(12, 21), 12);
  const summerAltDeg = summerNoon.alt / RAD;
  const winterAltDeg = winterNoon.alt / RAD;

  assert.ok(summerAltDeg > 68 && summerAltDeg < 70, `Summer solstice noon alt ${summerAltDeg}`);
  assert.ok(winterAltDeg > 21 && winterAltDeg < 23, `Winter solstice noon alt ${winterAltDeg}`);
  assert.ok(halfDay(DOY(6, 21)) > 7.5, 'Summer half-day > 7.5h');
  assert.ok(halfDay(DOY(12, 21)) < 4.6, 'Winter half-day < 4.6h');
  assert.equal(clearSky(-0.1), 0);
  assert.ok(clearSky(summerNoon.alt) > 850);
});

test('GL24h ridge beam sizing meets bending and deflection limits', () => {
  assert.ok(RIDGE.b >= 0.20 && RIDGE.h >= 0.48);
  assert.ok(RIDGE.sig / RIDGE.fm <= 0.80);
  assert.ok(RIDGE.w <= (RIDGE.lB * 1000) / 300);
});

test('buckling factor kc stays within (0, 1]', () => {
  const k = kc(2400, 120);
  assert.ok(k > 0.2 && k <= 1.0);
});

test('floor elevation and room lookup cover expanded 4.32 m bedrooms, bath, tech room, and terraces', () => {
  assert.equal(floorAt(2.0, 2.0), F);
  assert.ok(FS < F);
  assert.ok(Math.abs(IWALLS[0].c - T - 4.32) < 1e-6, 'Bedrooms must have 4.32 m clear depth (+1.00 m widened)');
  assert.equal(roomAt(2.0, 4.2), 'Dormitor 1');
  assert.equal(roomAt(5.0, 4.2), 'Dormitor matrimonial');
  assert.equal(roomAt(2.5, 6.0), 'Living + loc de masă + bucătărie');
  assert.equal(roomAt(5.5, 5.4), 'Baie');
  assert.equal(roomAt(5.5, 7.2), 'Cameră tehnică');
  assert.equal(roomAt(3.6, C.L + 1.5), 'Terasa de sud');
  assert.equal(roomAt(WALK_AT.tehnica[0], WALK_AT.tehnica[1]), 'Cameră tehnică');
  assert.equal(roomAt(WALK_AT.baie[0], WALK_AT.baie[1]), 'Baie');
  assert.equal(roomAt(WALK_AT.dorm1[0], WALK_AT.dorm1[1]), 'Dormitor 1');
  assert.equal(roomAt(WALK_AT.dorm2[0], WALK_AT.dorm2[1]), 'Dormitor matrimonial');
  assert.ok(Math.abs(floorAt(C.W + 0.5, C.terrace.sideZ0 - RAMP.total) - RAMP.lo) < 0.02);
  assert.equal(floorAt(-2, -2), 0);
});

test('subtractRects removes wall openings cleanly', () => {
  const res = subtractRects(
    [{ u0: 0, u1: 7.2, v0: 0, v1: 2.5 }],
    [{ u0: 1.0, u1: 2.7, v0: 0.4, v1: 2.05 }],
  );
  assert.equal(res.length, 4);
  const totalArea = res.reduce((a, r) => a + (r.u1 - r.u0) * (r.v1 - r.v0), 0);
  assert.ok(Math.abs(totalArea - (7.2 * 2.5 - 1.7 * 1.65)) < 1e-6);
});

test('foundation pile grid obeys 2.5D ridge-pair spacing and structural utilization < 1.0', () => {
  const ridgePairIdx = SIDEZ.findIndex((z) => Math.abs(z - (ZR - RIDGE_PILE_OFFSET)) < 1e-6);
  assert.ok(ridgePairIdx > 0);
  const ridgePairSpacing = SIDEZ[ridgePairIdx + 1] - SIDEZ[ridgePairIdx];
  assert.ok(ridgePairSpacing >= 1.0 - 1e-6, `Expected >= 1.0m (2.5*Ø400), got ${ridgePairSpacing}`);
  assert.ok(Math.abs((SIDEZ[ridgePairIdx] + SIDEZ[ridgePairIdx + 1]) / 2 - ZR) < 1e-6);

  const housePilesCount = 2 * ENDX.length + 2 * (SIDEZ.length - 2) + (MIDZ.length - 2);
  assert.equal(BX.length, 3);
  assert.equal(housePilesCount, 35);

  const walls = createInitialWalls();
  for (const wl of walls) {
    if (wl.ridge !== undefined) {
      for (const o of wl.openings) {
        const overlap = Math.min(o.u1, wl.ridge + 0.10) - Math.max(o.u0, wl.ridge - 0.10);
        assert.ok(overlap <= 0, `Opening [${o.u0}, ${o.u1}] on gable ${wl.name} overlaps ridge post at ${wl.ridge}`);
      }
    }
  }
  const { rows } = calcStructuralRows(walls, 120, 18);
  const foundationRows = rows.filter((r) => r.el.startsWith('Pilon') || r.el.startsWith('Grindă fundație') || r.el.startsWith('Eclisă'));
  assert.ok(foundationRows.length >= 9);
  for (const row of foundationRows) {
    assert.ok(row.u > 0 && row.u < 1.0, `Expected utilization < 1.0 for "${row.el}", got ${row.u}`);
  }
});

test('all interior doors are retractable pocket doors fitting within their wall bays', () => {
  const allSpecs = IWALLS.flatMap((iw) => getInteriorDoorSpecs(iw).map((spec) => ({ iw, spec })));
  assert.equal(allSpecs.length, 4, 'Expected 4 interior doors (Dormitor 1, Dormitor matrimonial, Baie, Cameră tehnică)');

  for (const { iw, spec } of allSpecs) {
    assert.ok(spec.type.startsWith('pocket-'), `Door "${spec.label}" must be retractable pocket type`);
    assert.ok(spec.spanU0 >= iw.u0 - 1e-6 && spec.spanU1 <= iw.u1 + 1e-6, `Pocket span for "${spec.label}" must stay within wall bounds [${iw.u0}, ${iw.u1}]`);
    for (const pk of spec.pockets) {
      assert.ok(pk.p1 > pk.p0);
      assert.ok(pk.leafU1 > pk.leafU0);
      assert.ok(pk.leafU0 >= pk.p0 - 1e-6 || pk.leafU1 <= pk.p1 + 1e-6, `Pocket leaf for "${spec.label}" must retract into its pocket`);
    }
  }

  // Verify bath/tech pocket cassettes on IWALLS[2] do not cross perpendicular wall IWALLS[3] (z = 6.55..6.65) or IWALLS[4] (z = 8.15..8.25)
  const bathTechSpecs = getInteriorDoorSpecs(IWALLS[2]);
  assert.equal(bathTechSpecs.length, 2);
  const [bath, tech] = bathTechSpecs;
  assert.ok(bath.spanU0 >= 4.82 && bath.spanU1 <= 6.55, `Bath pocket [${bath.spanU0}, ${bath.spanU1}] must fit in [4.82, 6.55]`);
  assert.ok(tech.spanU0 >= 6.65 && tech.spanU1 <= 8.15, `Tech pocket [${tech.spanU0}, ${tech.spanU1}] must fit in [6.65, 8.15]`);
});

test('swapped South window/door, SW fireside nook, and low 40cm window seats align cleanly', () => {
  const walls = createInitialWalls();
  const wb = walls.find((w) => w.id === 'B')!;
  const wlw = walls.find((w) => w.id === 'Lw')!;
  const wrw = walls.find((w) => w.id === 'Rw')!;
  const southWin = wb.openings.find((o) => o.type === 'win')!;
  const southDoor = wb.openings.find((o) => o.type === 'door')!;
  const westWin = wlw.openings[0];

  assert.equal(wrw.openings.filter((o) => o.type === 'door').length, 0, 'East exterior door removed for enlarged kitchen');
  // South window sits SW next to the fireplace; South door sits to its East
  assert.ok(southWin && southDoor && southWin.u1 < southDoor.u0, 'South window sits West of South terrace door');
  assert.ok(southDoor.u0 >= 3.30 && southDoor.u1 <= 5.00, `Expected South terrace door at [3.35, 4.87], got [${southDoor.u0}, ${southDoor.u1}]`);
  assert.ok(Math.abs(WALK_AT.terasa[0] - (southDoor.u0 + southDoor.u1) / 2) < 0.05);
  assert.ok(Math.abs(WALK_AT.intrare[0] - (southDoor.u0 + southDoor.u1) / 2) < 0.05);

  // West window beside living seating lowered to 0.40 m for window seating, south of ridge post
  assert.ok(westWin.u0 >= ZR + 0.15 && westWin.u1 <= 8.6);
  assert.equal(westWin.sill, 0.40, 'West window lowered to 0.40 m seat height');

  // Stove / chimney in SW corner
  assert.ok(C.chim.x >= 0.85 && C.chim.x <= 1.15 && C.chim.z >= 10.7 && C.chim.z <= C.L - T - 0.15);
});
