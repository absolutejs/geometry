import { test, expect } from "bun:test";
import { tetrahedronPlaneMoments } from "../src/tetrahedronPlaneMoments";
import fixture from "./fixtures/cut-body-plane.json";
type V = readonly [number, number, number];
test("nearly full real cut-body tetrahedron preserves the signed volume invariant", () => {
  const vertices = fixture.vertices as unknown as readonly V[];
  // Independent Python Fraction oracle over the exact binary64 inputs.
  const expectedFull = -1.3837630998374684e-5;
  const expectedWet = -1.3837630998210337e-5;
  const r = tetrahedronPlaneMoments(vertices, [0, 0, 0], [0, 1, 0]);
  expect(Math.abs(r.fullSignedVolume / expectedFull - 1)).toBeLessThan(2e-13);
  expect(Math.abs(r.signedVolume / expectedWet - 1)).toBeLessThan(2e-13);
  expect(r.fraction).toBeLessThanOrEqual(1);
});

import oracle from "./fixtures/plane-conditioning-oracle.json";
test("exact-input oracle across permutations, units, translations and distant apexes", () => {
  for (const row of oracle) {
    const result = tetrahedronPlaneMoments(
      row.vertices as unknown as readonly V[],
      row.point as unknown as V,
      [0, 1, 0],
    );
    expect(Math.abs(result.fullSignedVolume / row.full - 1)).toBeLessThan(
      2e-11,
    );
    expect(Math.abs(result.signedVolume / row.wet - 1)).toBeLessThan(2e-11);
    expect(result.fraction).toBeGreaterThan(0);
    expect(result.fraction).toBeLessThanOrEqual(1 + 1e-12);
    for (let k = 0; k < 3; k++)
      expect(
        Math.abs(result.centroid![k]! - row.centroid[k]!) /
          (row.scale * row.reach),
      ).toBeLessThan(2e-10);
  }
});

import { prepareTetrahedronPlaneMoments } from "../src/tetrahedronPlaneMoments";
test("prepared plane queries own their input and do not share mutable query results", () => {
  const vertices: [number, number, number][] = [
    [0, 0, 0],
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ];
  const query = prepareTetrahedronPlaneMoments(vertices);
  vertices[1]![0] = 100;
  for (let i = 1; i < 20; i++) {
    const cut = i / 20,
      r = query([cut, 0, 0], [1, 1, 1]);
    expect(Math.abs(r.signedVolume - cut ** 3 / 6)).toBeLessThan(1e-14);
    expect(r.centroid).not.toBeNull();
    for (const x of r.centroid!)
      expect(Math.abs(x - cut / 4)).toBeLessThan(1e-14);
    r.reference[0] = 1e10;
    r.centroid![0] = 1e10;
    r.firstMoment[0] = 1e10;
  }
  expect(() => query([0, 0, 0], [0, 0, 0])).toThrow("Zero clipping normal");
  expect(query([2, 0, 0], [1, 1, 1]).signedVolume).toBe(1 / 6);
});
test("prepared queries reproduce the independent exact-input conditioning oracle", () => {
  for (const row of oracle) {
    const query = prepareTetrahedronPlaneMoments(
      row.vertices as unknown as readonly V[],
    );
    const r = query(row.point as unknown as V, [0, 1, 0]);
    expect(Math.abs(r.signedVolume / row.wet - 1)).toBeLessThan(2e-11);
    const reverse = query(row.point as unknown as V, [0, -1, 0]);
    expect(
      Math.abs((r.signedVolume + reverse.signedVolume) / row.full - 1),
    ).toBeLessThan(2e-11);
  }
});

import oblique from "./fixtures/cut-body-oblique-plane.json";
test("small excluded oblique corner does not reconstruct a nearly full thin tetrahedron", () => {
  const r = tetrahedronPlaneMoments(
    oblique.vertices as unknown as readonly V[],
    oblique.planePoint as unknown as V,
    oblique.planeNormal as unknown as V,
  );
  expect(Math.abs(r.fullSignedVolume / -2.772957275776894e-8 - 1)).toBeLessThan(
    2e-12,
  );
  expect(Math.abs(r.signedVolume/oblique.oracle.wet-1)).toBeLessThan(2e-12);
  for(let k=0;k<3;k++) expect(Math.abs(r.centroid![k]!-oblique.oracle.centroid[k]!)).toBeLessThan(2e-12);
  expect(r.fraction).toBeGreaterThan(0.999999);
  expect(r.fraction).toBeLessThan(1);
  const q = prepareTetrahedronPlaneMoments(
    oblique.vertices as unknown as readonly V[],
  );
  const dry = q(
    oblique.planePoint as unknown as V,
    oblique.planeNormal.map((x) => -x) as V,
  );
  expect(
    Math.abs((r.signedVolume + dry.signedVolume) / r.fullSignedVolume - 1),
  ).toBeLessThan(2e-14);
});

test('an underflowed nonempty corner is rejected instead of reported dry',()=>{
 const q=prepareTetrahedronPlaneMoments([[0,0,0],[1,0,0],[0,1,0],[0,0,1]]);
 expect(()=>q([1e-120,0,0],[1,1,1])).toThrow('Unrepresentable nonempty corner volume');
});
