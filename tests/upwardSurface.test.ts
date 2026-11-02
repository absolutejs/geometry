import { test, expect } from "bun:test";
import { prepareUpwardSurface } from "../src/upwardSurface";
const plane = (y: number, sx = 0, sz = 0, offset = 0) => ({
  positions: new Float64Array([
    offset,
    y,
    offset,
    offset,
    y + 4 * sz,
    offset + 4,
    offset + 4,
    y + 4 * sx,
    offset,
    offset + 4,
    y + 4 * sx + 4 * sz,
    offset + 4,
  ]),
  indices: new Uint32Array([0, 1, 2, 2, 1, 3]),
});
test("slopes, negative coordinates, boundaries and translated inputs retain analytic heights", () => {
  for (const offset of [-100000, -4, 0, 4, 100000])
    for (const [sx, sz] of [
      [0, 0],
      [0.3, -0.6],
      [-0.8, 0.4],
    ]) {
      const query = prepareUpwardSurface(plane(7, sx, sz, offset));
      for (const x of [0, 1, 2, 4])
        for (const z of [0, 1, 3, 4]) {
          const y = 7 + sx! * x + sz! * z,
            r = query.query(offset + x, offset + z, y + 0.5, 1);
          expect(r.hit?.height).toBeCloseTo(y, 10);
          expect(r.hit?.slopeX).toBeCloseTo(sx!, 10);
          expect(r.hit?.slopeZ).toBeCloseTo(sz!, 10);
          expect(r.trianglesTested).toBeLessThanOrEqual(2);
        }
    }
});
test("stacked floors choose nearest height, reject ceilings, preserve ties and return missing coverage", () => {
  const a = plane(0),
    b = plane(4),
    positions = new Float64Array([...a.positions, ...b.positions]);
  const q = prepareUpwardSurface({
    positions,
    indices: new Uint16Array([0, 1, 2, 2, 1, 3, 4, 5, 6, 6, 5, 7, 4, 6, 5]),
  });
  expect(q.stats.upwardFaces).toBe(4);
  expect(q.query(1, 1, 3.9, 1).hit?.height).toBe(4);
  expect(q.query(1, 1, 0.2, 1).hit?.height).toBe(0);
  expect(q.query(1, 1, 2, 2).hit?.triangle).toBe(0);
  expect(q.query(1, 1, 2, 1).hit).toBe(null);
  expect(q.query(8, 8, 0, 1)).toEqual({ hit: null, trianglesTested: 0 });
  const ceiling = prepareUpwardSurface({
    positions: a.positions,
    indices: new Uint16Array([0, 2, 1]),
  });
  expect(ceiling.query(1, 1, 0, 1).hit).toBe(null);
});
test("prepared queries own coefficients and permit transferred input buffers", () => {
  const input = plane(3, 0.2, 0.4),
    q = prepareUpwardSurface(input),
    r = q.query(2, 2, 4, 2);
  input.positions.fill(100);
  input.indices.fill(0);
  expect(q.query(2, 2, 4, 2)).toEqual(r);
  structuredClone(input, {
    transfer: [input.positions.buffer, input.indices.buffer],
  });
  expect(q.query(2, 2, 4, 2)).toEqual(r);
  expect(Object.isFrozen(q.stats)).toBe(true);
});
test("grid limits measured query work without scanning distant faces", () => {
  const positions: number[] = [],
    indices: number[] = [];
  for (let i = 0; i < 1024; i++) {
    const x = (i % 32) * 8,
      z = Math.floor(i / 32) * 8,
      n = positions.length / 3;
    positions.push(x, 0, z, x, 0, z + 1, x + 1, 0, z);
    indices.push(n, n + 1, n + 2);
  }
  const q = prepareUpwardSurface({
    positions: new Float32Array(positions),
    indices: new Uint32Array(indices),
  });
  expect(q.stats.triangles).toBe(1024);
  expect(q.stats.references).toBe(1024);
  for (let i = 0; i < 1024; i++)
    expect(
      q.query((i % 32) * 8 + 0.2, Math.floor(i / 32) * 8 + 0.2, 0, 1)
        .trianglesTested,
    ).toBe(1);
});
test("degenerate and vertical faces do not fabricate a floor", () => {
  const q = prepareUpwardSurface({
    positions: new Float64Array([0, 0, 0, 0, 1, 0, 0, 2, 0]),
    indices: new Uint32Array([0, 1, 2]),
  });
  expect(q.stats.upwardFaces).toBe(0);
  expect(q.query(0, 0, 0, 1).hit).toBe(null);
  const empty = prepareUpwardSurface({
    positions: new Float32Array(),
    indices: new Uint16Array(),
  });
  expect(empty.query(0, 0, 0, 0).hit).toBe(null);
});
test("invalid arithmetic, indices, queries and reference budgets fail explicitly", () => {
  expect(() => prepareUpwardSurface({ ...plane(0), cellSize: 0 })).toThrow();
  expect(() => prepareUpwardSurface({ ...plane(0), maxReferences: 1 })).toThrow(
    "budget",
  );
  expect(() =>
    prepareUpwardSurface({ ...plane(0), cellSize: 1e-20 }),
  ).toThrow();
  expect(() =>
    prepareUpwardSurface({
      ...plane(0),
      indices: new Uint32Array([0, 1, 999]),
    }),
  ).toThrow();
  const bad = plane(0);
  bad.positions[0] = NaN;
  expect(() => prepareUpwardSurface(bad)).toThrow();
  const q = prepareUpwardSurface(plane(0));
  for (const args of [
    [NaN, 0, 0, 1],
    [0, 0, 0, -1],
    [0, 0, 0, Infinity],
    [0, 0, 0, 1, 0.01],
  ])
    expect(() =>
      q.query(...(args as [number, number, number, number, number])),
    ).toThrow();
});

test("finite inputs that overflow query arithmetic fail explicitly", () => {
  const input = plane(1e308);
  const q = prepareUpwardSurface(input);
  expect(() => q.query(1, 1, -1e308, 1e308)).toThrow("Nonfinite");
});
