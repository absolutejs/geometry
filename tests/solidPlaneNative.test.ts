import { test, expect } from "bun:test";
import Module from "manifold-3d";
import { getManifoldMesh64 } from "../src/manifold";
import { mergeIndexedMesh } from "../src/mergeIndexedMesh";
import { prepareSolidPlaneMoments } from "../src/solidPlaneMoments";
const wasm = await Module();
wasm.setup();
test("prepared closed-solid moments match independent native cuts of a cavity-bearing solid", () => {
  const outer = wasm.Manifold.cube([2, 2, 2]),
    innerBase = wasm.Manifold.cube([1, 1, 1]),
    inner = innerBase.translate([0.5, 0.5, 0.5]),
    solid = outer.subtract(inner);
  try {
    const mesh = mergeIndexedMesh(
      getManifoldMesh64(solid),
      [0, 0, 0],
      solid.tolerance(),
    );
    const query = prepareSolidPlaneMoments({
      ...mesh,
      owners: new Uint16Array(mesh.indices.length / 3),
    });
    for (let i = 0; i < 160; i++) {
      const normal = [
        Math.cos(i * 0.713),
        Math.sin(i * 0.371),
        Math.cos(i * 0.291),
      ] as [number, number, number];
      const len = Math.hypot(...normal);
      for (let k = 0; k < 3; k++) normal[k]! /= len;
      const point: [number, number, number] = [
        1 + 0.8 * Math.sin(i * 0.331),
        1,
        0.7,
      ];
      const offset = normal.reduce((s, n, k) => s + n * point[k]!, 0);
      const cut = solid.trimByPlane(
        normal.map((x) => -x) as [number, number, number],
        -offset,
      );
      try {
        const actual = query(point, normal);
        expect(Math.abs(actual.volume - cut.volume())).toBeLessThan(1e-11);
        // Independent capped native boundary; divergence integration about world zero.
        const m = getManifoldMesh64(cut),
          moment = [0, 0, 0];
        for (let t = 0; t < m.triVerts.length; t += 3) {
          const [a, b, c] = [0, 1, 2].map((k) => {
            const j = m.triVerts[t + k]! * m.numProp;
            return [
              m.vertProperties[j]!,
              m.vertProperties[j + 1]!,
              m.vertProperties[j + 2]!,
            ] as [number, number, number];
          }) as [
            [number, number, number],
            [number, number, number],
            [number, number, number],
          ];
          const det =
            a[0] * (b[1] * c[2] - b[2] * c[1]) +
            a[1] * (b[2] * c[0] - b[0] * c[2]) +
            a[2] * (b[0] * c[1] - b[1] * c[0]);
          for (let k = 0; k < 3; k++)
            moment[k]! += (det * (a[k]! + b[k]! + c[k]!)) / 24;
        }
        for (let k = 0; k < 3; k++)
          expect(
            Math.abs(
              actual.firstMoment[k]! +
                actual.volume * actual.reference[k]! -
                moment[k]!,
            ),
          ).toBeLessThan(2e-11);
      } finally {
        cut.delete();
      }
    }
  } finally {
    solid.delete();
    inner.delete();
    innerBase.delete();
    outer.delete();
  }
});
