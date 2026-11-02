import { test, expect } from "bun:test";
import Module from "manifold-3d";
import { partitionStarShapedMesh } from "../src/starPartition";
import { createManifoldMesh64 } from "../src/createManifoldMesh64";
import { signedVolume } from "../src/signedVolume";
const cube = () => ({
  positions: new Float64Array([
    -1, -1, -1, 1, -1, -1, 1, 1, -1, -1, 1, -1, -1, -1, 1, 1, -1, 1, 1, 1, 1,
    -1, 1, 1,
  ]),
  indices: new Uint32Array([
    0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 4, 7, 0, 7, 3, 1, 2, 6, 1, 6, 5, 0,
    1, 5, 0, 5, 4, 3, 7, 6, 3, 6, 2,
  ]),
});
test("positive kernel-local tetrahedra retain source-face identity and total volume", () => {
  const mesh = cube(),
    partition = partitionStarShapedMesh(mesh, [0, 0, 0]);
  expect(partition.pieces.length).toBe(12);
  expect(partition.volume).toBeCloseTo(8, 12);
  expect(partition.minimumKernelClearance).toBe(1);
  partition.pieces.forEach((p, i) => {
    expect(p.sourceTriangle).toBe(i);
    expect(signedVolume(p.positions, p.indices)).toBeCloseTo(p.volume, 12);
    expect(p.volume).toBeGreaterThan(0);
  });
  const before = partition.pieces[0]!.positions.slice();
  mesh.positions.fill(999);
  expect(partition.pieces[0]!.positions).toEqual(before);
  partition.pieces[0]!.indices[0] = 0;
  expect(partition.pieces[1]!.indices[0]).toBe(1);
});
test("signed translations and uniform scaling preserve local coordinates and cubic volume", () => {
  for (const scale of [0.125, 1, 16])
    for (const offset of [-(2 ** 30), 0, 2 ** 30]) {
      const mesh = cube();
      mesh.positions = Float64Array.from(
        mesh.positions,
        (v) => v * scale + offset,
      );
      const p = partitionStarShapedMesh(mesh, [offset, offset, offset]);
      expect(p.origin).toEqual([offset, offset, offset]);
      expect(p.volume).toBeCloseTo(8 * scale ** 3, 10);
      expect(p.minimumKernelClearance).toBe(scale);
      expect(
        Math.max(
          ...p.pieces.flatMap((p) => Array.from(p.positions).map(Math.abs)),
        ),
      ).toBe(scale);
    }
});
test("native independent union audit preserves a genuinely concave star-shaped boundary", async () => {
  const mesh = cube();
  mesh.positions.set([0.2, 0.2, 0.2], 18);
  const pieces = partitionStarShapedMesh(mesh, [0, 0, 0]).pieces;
  const wasm = await Module();
  wasm.setup();
  const handles: ReturnType<typeof createManifoldMesh64>[] = [];
  try {
    const target = createManifoldMesh64(wasm, {
      numProp: 3,
      vertProperties: mesh.positions,
      triVerts: mesh.indices,
    });
    handles.push(target);
    const hull = target.hull();
    handles.push(hull);
    expect(hull.volume() - target.volume()).toBeGreaterThan(0.01);
    const cells = pieces.map((p) => {
      const s = createManifoldMesh64(wasm, {
        numProp: 3,
        vertProperties: p.positions,
        triVerts: p.indices,
      });
      handles.push(s);
      return s;
    });
    const union = wasm.Manifold.union(cells),
      missing = target.subtract(union),
      excess = union.subtract(target);
    handles.push(union, missing, excess);
    expect(Math.abs(missing.volume())).toBeLessThan(1e-9);
    expect(Math.abs(excess.volume())).toBeLessThan(1e-9);
    expect(
      Math.abs(cells.reduce((v, c) => v + c.volume(), 0) - union.volume()),
    ).toBeLessThan(1e-9);
  } finally {
    for (const h of handles.reverse()) h.delete();
  }
});
test("outside, boundary and numerically precarious kernels are rejected without hull fallback", () => {
  for (const kernel of [
    [3, 0, 0],
    [1, 0, 0],
    [1 - 1e-12, 0, 0],
  ] as [number, number, number][])
    expect(() => partitionStarShapedMesh(cube(), kernel)).toThrow();
  const mesh = cube();
  mesh.positions.set([0.2, 0.2, 0.2], 18);
  expect(() => partitionStarShapedMesh(mesh, [0.9, 0.9, 0.9])).toThrow();
});
test("open, reversed, disconnected and degenerate topology cannot silently produce a partition", () => {
  const open = cube();
  open.indices = open.indices.slice(3);
  expect(() => partitionStarShapedMesh(open, [0, 0, 0])).toThrow();
  const reversed = cube();
  for (let i = 0; i < reversed.indices.length; i += 3)
    [reversed.indices[i + 1], reversed.indices[i + 2]] = [
      reversed.indices[i + 2]!,
      reversed.indices[i + 1]!,
    ];
  expect(() => partitionStarShapedMesh(reversed, [0, 0, 0])).toThrow();
  const first = cube(),
    second = cube();
  const joined = {
    positions: new Float64Array([
      ...first.positions,
      ...Array.from(second.positions, (v) => v + 4),
    ]),
    indices: new Uint32Array([
      ...first.indices,
      ...Array.from(second.indices, (i) => i + 8),
    ]),
  };
  expect(() => partitionStarShapedMesh(joined, [0, 0, 0])).toThrow();
  const collapsed = cube();
  collapsed.positions[0] = collapsed.positions[3]!;
  collapsed.positions[1] = collapsed.positions[4]!;
  collapsed.positions[2] = collapsed.positions[5]!;
  expect(() => partitionStarShapedMesh(collapsed, [0, 0, 0])).toThrow();
});
test("invalid budgets, types, indices and nonfinite input fail before unbounded work", () => {
  for (const maximumTriangles of [0, 3, 4, 1025, Infinity])
    expect(() =>
      partitionStarShapedMesh(cube(), [0, 0, 0], { maximumTriangles }),
    ).toThrow();
  for (const minimumRelativeClearance of [0, NaN, 1e-15, 1])
    expect(() =>
      partitionStarShapedMesh(cube(), [0, 0, 0], { minimumRelativeClearance }),
    ).toThrow();
  const mesh = cube();
  mesh.indices[0] = 999;
  expect(() => partitionStarShapedMesh(mesh, [0, 0, 0])).toThrow();
  expect(() => partitionStarShapedMesh(cube(), [NaN, 0, 0])).toThrow();
  const nonfinite = cube();
  nonfinite.positions[0] = Infinity;
  expect(() => partitionStarShapedMesh(nonfinite, [0, 0, 0])).toThrow();
});

test("unreferenced vertices do not change geometric clearance or volume", () => {
  const mesh = cube();
  mesh.positions = new Float64Array([...mesh.positions, 1e100, 1e100, 1e100]);
  const partition = partitionStarShapedMesh(mesh, [0, 0, 0]);
  expect(partition.volume).toBe(8);
  expect(partition.minimumKernelClearance).toBe(1);
});
test("shared mutable mesh buffers are rejected before topology checks", () => {
  const mesh = cube(),
    positions = new Float64Array(
      new SharedArrayBuffer(mesh.positions.byteLength),
    );
  positions.set(mesh.positions);
  expect(() =>
    partitionStarShapedMesh({ ...mesh, positions }, [0, 0, 0]),
  ).toThrow();
});
