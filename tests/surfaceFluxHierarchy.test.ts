import { test, expect } from "bun:test";
import { prepareSurfaceFluxHierarchy } from "../src/surfaceFluxHierarchy";
import { prepareTriangleFirstPlaneMomentsForSolid } from "../src/trianglePlaneMoments";
type V = [number, number, number];
test("oriented surface hierarchy matches individual face flux for nonclosed patches and crossing planes", () => {
  let seed = 1234567;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
  const triangles: V[][] = Array.from({ length: 384 }, () => {
    const a: V = [random() * 8 - 4, random() * 8 - 4, random() * 8 - 4];
    return [
      a,
      [a[0] + random(), a[1] + random(), a[2] + random()],
      [a[0] + random(), a[1] + random(), a[2] + random()],
    ];
  });
  const hierarchy = prepareSurfaceFluxHierarchy(triangles),
    queries = triangles.map((t) => prepareTriangleFirstPlaneMomentsForSolid(t));
  let saved = 0;
  for (let i = 0; i < 200; i++) {
    const point: V = [random() * 12 - 6, random() * 12 - 6, random() * 12 - 6];
    const raw = [random() - 0.5, random() - 0.5, random() - 0.5],
      maximum = Math.max(...raw.map(Math.abs));
    const normal = raw.map((v) => v / maximum) as V;
    // origin=point lies exactly on the plane, independent of the hierarchy.
    const actual = hierarchy(point, normal, point);
    let volume = 0;
    const first: V = [0, 0, 0];
    for (const query of queries) {
      const r = query(point, normal),
        d = r.reference.map((v, k) => v - point[k]!) as V;
      const distance = d.reduce(
          (sum, v, k) => sum + v * r.surfaceNormal[k]!,
          0,
        ),
        v = (distance * r.area) / 3;
      volume += v;
      for (let k = 0; k < 3; k++)
        first[k]! +=
          point[k]! * v + (distance * (r.firstMoment[k]! + d[k]! * r.area)) / 4;
    }
    expect(Math.abs(actual.volume - volume)).toBeLessThan(1e-11);
    for (let k = 0; k < 3; k++)
      expect(Math.abs(actual.firstMoment[k]! - first[k]!)).toBeLessThan(1e-10);
    saved += 384 - actual.evaluatedSurfaceTriangles;
  }
  expect(saved).toBeGreaterThan(384 * 200 * 0.35);
});
