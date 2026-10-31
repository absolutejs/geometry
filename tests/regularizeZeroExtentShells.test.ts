import { test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { regularizeZeroExtentShells, solidComponents } from "../src/index";
const indices = new Uint32Array([0, 2, 1, 0, 1, 3, 0, 3, 2, 1, 2, 3]);
const tetra = (z: number) =>
  new Float64Array([0, 0, 0, 1, 0, 0, 0, 1, 0, 0.2, 0.3, z]);
test("only exact coordinate collapse is removed, including subnormal thickness retention", () => {
  for (const z of [0, Number.MIN_VALUE, 1e-200, 1e-12, 1]) {
    const p = tetra(z),
      before = p.slice(),
      r = regularizeZeroExtentShells(p, indices);
    expect(p).toEqual(before);
    expect(r.removed.length).toBe(z === 0 ? 1 : 0);
    expect(r.indices.length).toBe(z === 0 ? 0 : 12);
    if (z === 0) {
      expect(r.removed[0]!.axis).toBe(2);
      expect(r.removed[0]!.coordinate).toBe(0);
      expect([...r.removed[0]!.sourceTriangles]).toEqual([0, 1, 2, 3]);
    }
  }
});
test("mixed material retains exact face ancestry, owns arrays and removes only complete collapsed shells", () => {
  const a = tetra(1),
    b = tetra(0),
    p = new Float64Array([...a, ...b]),
    i = new Uint32Array([...indices, ...indices.map((v) => v + 4)]);
  const r = regularizeZeroExtentShells(p, i);
  expect(r.retainedShells).toBe(1);
  expect(r.removed.length).toBe(1);
  expect([...r.sourceTriangles]).toEqual([0, 1, 2, 3]);
  expect([...r.removed[0]!.sourceTriangles]).toEqual([4, 5, 6, 7]);
  r.positions[0] = 99;
  r.sourceTriangles[0] = 99;
  r.removed[0]!.sourceTriangles[0] = 99;
  expect(p[0]).toBe(0);
  expect(i[0]).toBe(0);
});
test("a rotated flat shell without an exactly collapsed coordinate is deliberately retained", () => {
  const p = tetra(0);
  for (let i = 0; i < p.length; i += 3) p[i + 2] = p[i]! + p[i + 1]!;
  const r = regularizeZeroExtentShells(p, indices);
  expect(r.removed.length).toBe(0);
  expect(r.indices.length).toBe(12);
});
test("all axes, empty input and invalid topology retain explicit semantics", () => {
  for (let axis = 0; axis < 3; axis++) {
    const p = tetra(0);
    for (let i = 0; i < p.length; i += 3) {
      const x = p[i]!,
        y = p[i + 1]!;
      for (let k = 0; k < 3; k++)
        p[i + k] = k === axis ? 17 : k === (axis + 1) % 3 ? x : y;
    }
    const r = regularizeZeroExtentShells(p, indices);
    expect(r.removed[0]!.axis).toBe(axis);
    expect(r.removed[0]!.coordinate).toBe(17);
  }
  expect(
    regularizeZeroExtentShells(new Float64Array(), new Uint32Array())
      .retainedShells,
  ).toBe(0);
  expect(() =>
    regularizeZeroExtentShells(tetra(0), indices.slice(0, 9)),
  ).toThrow("Open");
});
test("captured repeated cut removes two exact sheets and retains valid physical components", () => {
  const raw = JSON.parse(
    readFileSync(
      "artifacts/deformed-tree-precision/axis-collapsed-cut.json",
      "utf8",
    ),
  );
  const p = Float64Array.from(raw.positions),
    i = Uint32Array.from(raw.indices),
    r = regularizeZeroExtentShells(p, i);
  expect(r.removed.length).toBe(2);
  expect(
    r.removed.every((s) => s.axis === 1 && Math.abs(s.coordinate) === 0.003),
  ).toBe(true);
  const physical = solidComponents(
    r.positions,
    r.indices,
    new Uint16Array(r.indices.length / 3),
  );
  expect(physical.components.length).toBeGreaterThan(0);
  expect(
    r.sourceTriangles.length +
      r.removed.reduce((n, s) => n + s.sourceTriangles.length, 0),
  ).toBe(i.length / 3);
});
