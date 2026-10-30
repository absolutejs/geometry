import { test, expect } from "bun:test";
import Module from "manifold-3d";
import { tetrahedronPlaneMoments } from "../src/tetrahedronPlaneMoments";
import { getManifoldMesh64 } from "../src/manifold";
type V = readonly [number, number, number];
const wasm = await Module();
wasm.setup();
const vertices: readonly V[] = [
  [0, 0, 0],
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1],
];
// Independent closed-mesh divergence integration, including native-generated caps.
function divergence(mesh: ReturnType<typeof getManifoldMesh64>) {
  const p = mesh.vertProperties,
    index = mesh.triVerts,
    stride = mesh.numProp;
  let volume = 0;
  const moment = [0, 0, 0];
  for (let t = 0; t < index.length; t += 3) {
    const [a, b, c] = [index[t]!, index[t + 1]!, index[t + 2]!].map(
      (i) => [p[i * stride]!, p[i * stride + 1]!, p[i * stride + 2]!] as V,
    ) as [V, V, V];
    const u = b.map((v, k) => v - a[k]!),
      v = c.map((v, k) => v - a[k]!);
    const cross = [
      u[1]! * v[2]! - u[2]! * v[1]!,
      u[2]! * v[0]! - u[0]! * v[2]!,
      u[0]! * v[1]! - u[1]! * v[0]!,
    ];
    volume += (cross[0]! * (a[0] + b[0] + c[0])) / 6;
    for (let k = 0; k < 3; k++)
      moment[k]! +=
        (cross[k]! *
          (a[k]! ** 2 +
            b[k]! ** 2 +
            c[k]! ** 2 +
            a[k]! * b[k]! +
            a[k]! * c[k]! +
            b[k]! * c[k]!)) /
        24;
  }
  return { volume, centroid: moment.map((v) => v / volume) };
}
test("plane moments agree with native cuts and independent capped-surface integrals", () => {
  const mesh = new wasm.Mesh({
    numProp: 3,
    vertProperties: Float32Array.from(vertices.flat()),
    triVerts: new Uint32Array([1, 2, 3, 0, 3, 2, 0, 1, 3, 0, 2, 1]),
  });
  const source = new wasm.Manifold(mesh);
  try {
    expect(source.volume()).toBeCloseTo(1 / 6, 14);
    for (let i = 1; i <= 240; i++) {
      const raw = [Math.sin(i * 1.3), Math.cos(i * 0.71), Math.sin(i * 0.43)],
        len = Math.hypot(...raw),
        normal = raw.map((x) => x / len) as unknown as V,
        point: V = [0.4 * Math.sin(i * 0.37) + 0.2, 0.3, 0.2];
      const result = tetrahedronPlaneMoments(vertices, point, normal),
        offset = normal.reduce((s, v, k) => s + v * point[k]!, 0);
      const cut = source.trimByPlane(
        normal.map((v) => -v) as [number, number, number],
        -offset,
      );
      try {
        expect(Math.abs(result.signedVolume - cut.volume())).toBeLessThan(
          2e-12,
        );
        if (result.signedVolume > 1e-8) {
          const reference = divergence(getManifoldMesh64(cut));
          expect(Math.abs(result.signedVolume - reference.volume)).toBeLessThan(
            2e-12,
          );
          for (let k = 0; k < 3; k++)
            expect(
              Math.abs(result.centroid![k]! - reference.centroid[k]!),
            ).toBeLessThan(2e-9);
        }
      } finally {
        cut.delete();
      }
    }
  } finally {
    source.delete();
  }
});
