import { test, expect } from "bun:test";
import Module from "manifold-3d";
import {
  auditManifoldCoverage,
  getManifoldMesh64,
  createManifoldCutSession,
} from "../src/manifold.js";
import { mergeIndexedMesh } from "../src/mergeIndexedMesh.js";
const wasm = await Module();
wasm.setup();
function box(
  size: [number, number, number],
  at: [number, number, number] = [0, 0, 0],
) {
  const seed = wasm.Manifold.cube(size);
  try {
    return seed.translate(at);
  } finally {
    seed.delete();
  }
}
function input(solid: ReturnType<typeof box>) {
  try {
    return mergeIndexedMesh(
      getManifoldMesh64(solid),
      [0, 0, 0],
      solid.tolerance(),
    );
  } finally {
    solid.delete();
  }
}
test("native coverage measures disjoint cell union without adding overlap mass", () => {
  const target = box([1, 1, 1]);
  try {
    const r = auditManifoldCoverage(wasm, target, [
      input(box([0.75, 1, 1])),
      input(box([0.75, 1, 1], [0.25, 0, 0])),
    ]);
    expect(r.components).toHaveLength(1);
    expect(r.components[0]!.missingVolume).toBe(0);
    expect(r.components[0]!.excessVolume).toBe(0);
    expect(r.components[0]!.volume).toBeCloseTo(1, 12);
    expect(r.cells.reduce((n, c) => n + c.volume, 0)).toBeCloseTo(1.5, 12);
    expect(target.volume()).toBe(1);
    expect(target.isDeleted()).toBe(false);
  } finally {
    target.delete();
  }
});
test("equal-volume misplaced cells report both missing and excess material", () => {
  const target = box([1, 1, 1]);
  try {
    const r = auditManifoldCoverage(wasm, target, [
      input(box([1, 1, 1], [0.5, 0, 0])),
    ]);
    expect(r.components[0]!.missingVolume).toBeCloseTo(0.5, 12);
    expect(r.components[0]!.excessVolume).toBeCloseTo(0.5, 12);
    expect(r.cells[0]!.outsideAssignedVolume).toBeCloseTo(0.5, 12);
  } finally {
    target.delete();
  }
});
test("a bridging cell reports cross-body volume rather than nearest-center assignment", () => {
  const a = box([1, 1, 1]),
    b = box([1, 1, 1], [3, 0, 0]),
    target = a.add(b);
  try {
    const r = auditManifoldCoverage(wasm, target, [input(box([4, 1, 1]))]);
    expect(r.components).toHaveLength(2);
    expect(r.cells[0]!.intersections).toEqual([1, 1]);
    expect(r.cells[0]!.crossComponentVolume).toBe(1);
    expect(r.components.reduce((n, c) => n + c.missingVolume, 0)).toBe(1);
  } finally {
    target.delete();
    a.delete();
    b.delete();
  }
});
test("native cavity walls remain grouped with their enclosing body and empty cavities stay empty", () => {
  const outer = box([2, 2, 2]),
    hole = box([1, 1, 1], [0.5, 0.5, 0.5]),
    target = outer.subtract(hole);
  try {
    const r = auditManifoldCoverage(wasm, target, [
      input(box([2, 2, 2])),
      input(box([0.5, 0.5, 0.5], [0.75, 0.75, 0.75])),
    ]);
    expect(r.cavities).toBe(1);
    expect(r.components).toHaveLength(1);
    expect(r.components[0]!.volume).toBeCloseTo(7, 12);
    expect(r.components[0]!.nativeVolume).toBeCloseTo(7, 12);
    expect(r.components[0]!.missingVolume).toBe(0);
    expect(r.components[0]!.excessVolume).toBe(1);
    expect(r.cells[1]!.owner).toBe(-1);
    expect(r.cells[1]!.intersections).toEqual([0]);
  } finally {
    target.delete();
    outer.delete();
    hole.delete();
  }
});
test("coverage audits are read-only session operations and failed requests do not poison later cuts", () => {
  const cube = input(box([1, 1, 1])),
    session = createManifoldCutSession(wasm, [cube]);
  try {
    const before = session.snapshot();
    const r = session.auditCoverage([cube]);
    expect(r.components[0]!.relativeMissing).toBe(0);
    expect(session.snapshot().positions).toEqual(before.positions);
    expect(session.cuts).toBe(0);
    expect(() =>
      session.auditCoverage([
        {
          positions: new Float64Array([NaN, 0, 0]),
          indices: new Uint32Array(),
        },
      ]),
    ).toThrow();
    expect(session.cut(input(box([0.5, 1, 1]))).changed).toBe(true);
    expect(session.auditCoverage([]).components[0]!.relativeMissing).toBe(1);
  } finally {
    session.dispose();
  }
  expect(() => session.auditCoverage([])).toThrow("disposed");
});
test("native shell handles are all released if component copying fails", () => {
  const target = box([1, 1, 1]),
    decompose = target.decompose,
    proto = Object.getPrototypeOf(target),
    translate = proto.translate;
  let shells: ReturnType<typeof target.decompose> = [];
  target.decompose = function () {
    shells = decompose.call(target);
    return shells;
  };
  proto.translate = () => {
    throw Error("Injected component copy failure");
  };
  try {
    expect(() => auditManifoldCoverage(wasm, target, [])).toThrow("Injected");
    expect(shells.length).toBeGreaterThan(0);
    expect(shells.every((s) => s.isDeleted())).toBe(true);
    expect(target.isDeleted()).toBe(false);
  } finally {
    target.decompose = decompose;
    proto.translate = translate;
    target.delete();
  }
});
test("empty target and invalid/shared candidate storage remain explicit", () => {
  const seed = box([1, 1, 1]),
    empty = seed.subtract(seed);
  try {
    expect(auditManifoldCoverage(wasm, empty, []).components).toHaveLength(0);
    const r = auditManifoldCoverage(wasm, empty, [input(box([1, 1, 1]))]);
    expect(r.cells[0]!.owner).toBe(-1);
    expect(r.cells[0]!.outsideAssignedVolume).toBe(1);
    const bad = input(box([1, 1, 1]));
    bad.positions = new Float64Array(
      new SharedArrayBuffer(bad.positions.byteLength),
    );
    expect(() => auditManifoldCoverage(wasm, seed, [bad])).toThrow("budget");
  } finally {
    empty.delete();
    seed.delete();
  }
});

test("nested positive islands keep their own cavity and are not counted in the enclosing body", () => {
  const a = box([5, 5, 5]),
    b = box([3, 3, 3], [1, 1, 1]),
    c = box([2, 2, 2], [1.5, 1.5, 1.5]),
    d = box([1, 1, 1], [2, 2, 2]),
    outer = a.subtract(b),
    inner = c.subtract(d),
    target = outer.add(inner);
  try {
    const r = auditManifoldCoverage(wasm, target, []);
    expect(r.cavities).toBe(2);
    expect(r.components).toHaveLength(2);
    const volumes = r.components
      .map((c) => c.nativeVolume)
      .sort((a, b) => a - b);
    expect(volumes[0]).toBeCloseTo(7, 11);
    expect(volumes[1]).toBeCloseTo(98, 11);
    expect(
      r.components.every((c) => Math.abs(c.relativeMissing - 1) < 1e-12),
    ).toBe(true);
    expect(target.volume()).toBeCloseTo(105, 11);
  } finally {
    for (const m of [target, inner, outer, d, c, b, a]) m.delete();
  }
});
