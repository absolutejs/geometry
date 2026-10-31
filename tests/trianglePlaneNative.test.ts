import { test, expect } from "bun:test";
import Module from "manifold-3d";
import { getManifoldMesh64 } from "../src/manifold";
import { trianglePlaneMoments } from "../src/trianglePlaneMoments";
type V = [number, number, number];
const wasm = await Module();
wasm.setup();
test("triangle moments match native prism clipping and degree-two surface quadrature", () => {
  const vertices: V[] = [
    [0, 0, 0],
    [1, 0, 0],
    [0, 1, 0],
  ];
  const solid = new wasm.Manifold(
    new wasm.Mesh({
      numProp: 3,
      vertProperties: new Float32Array([
        0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 1, 0, 1, 0, 1, 1,
      ]),
      triVerts: new Uint32Array([
        0, 2, 1, 3, 4, 5, 0, 1, 4, 0, 4, 3, 1, 2, 5, 1, 5, 4, 2, 0, 3, 2, 3, 5,
      ]),
    }),
  );
  try {
    for (let i = 0; i < 180; i++) {
      const n: V = [Math.cos(i * 0.713), Math.sin(i * 0.713), 0],
        point: V = [0.3 + 0.5 * Math.sin(i * 0.331), 0.2, 0];
      const result = trianglePlaneMoments(vertices, point, n);
      const cut = solid.trimByPlane(
        n.map((x) => -x) as V,
        -n[0] * point[0] - n[1] * point[1],
      );
      try {
        const mesh = getManifoldMesh64(cut);
        let area = 0;
        const first = [0, 0, 0],
          second = Array(9).fill(0);
        for (let t = 0; t < mesh.triVerts.length; t += 3) {
          const p = [0, 1, 2].map((k) => {
            const j = mesh.triVerts[t + k]! * mesh.numProp;
            return [
              mesh.vertProperties[j]!,
              mesh.vertProperties[j + 1]!,
              mesh.vertProperties[j + 2]!,
            ] as V;
          });
          if (!p.every((v) => Math.abs(v[2]) < 1e-14)) continue;
          const a =
            Math.abs(
              (p[1]![0] - p[0]![0]) * (p[2]![1] - p[0]![1]) -
                (p[1]![1] - p[0]![1]) * (p[2]![0] - p[0]![0]),
            ) / 2;
          area += a;
          for (let q = 0; q < 3; q++) {
            const x = [0, 1, 2].map((k) =>
              p.reduce((s, v, j) => s + v[k]! * (j === q ? 2 / 3 : 1 / 6), 0),
            );
            for (let r = 0; r < 3; r++) {
              first[r]! += (a * x[r]!) / 3;
              for (let c = 0; c < 3; c++)
                second[r * 3 + c] += (a * x[r]! * x[c]!) / 3;
            }
          }
        }
        expect(Math.abs(result.area - area)).toBeLessThan(2e-12);
        for (let r = 0; r < 3; r++) {
          expect(
            Math.abs(
              result.firstMoment[r]! +
                result.reference[r]! * result.area -
                first[r]!,
            ),
          ).toBeLessThan(2e-12);
          for (let c = 0; c < 3; c++)
            expect(
              Math.abs(
                result.secondMoment[r * 3 + c]! +
                  result.reference[r]! * result.firstMoment[c]! +
                  result.reference[c]! * result.firstMoment[r]! +
                  result.reference[r]! * result.reference[c]! * result.area -
                  second[r * 3 + c],
              ),
            ).toBeLessThan(2e-12);
        }
      } finally {
        cut.delete();
      }
    }
  } finally {
    solid.delete();
  }
});
