import { test, expect } from "bun:test";
import Module from "manifold-3d";
import { readFileSync } from "node:fs";
import {
  createManifoldMesh64,
  createManifoldPartitionKernel,
  getManifoldMesh64,
} from "../src/manifold";
import { partitionSolidMaterials } from "../src/materialPartition";
const wasm = await Module();
wasm.setup();
const cube = () => {
  const s = wasm.Manifold.cube([1, 1, 1], true);
  try {
    return s.getMesh();
  } finally {
    s.delete();
  }
};
test("double import retains exact original vertices and face/source identity", () => {
  const mesh = cube(),
    positions = Float64Array.from(
      mesh.vertProperties,
      (v, i) => v * (1.123456789 + (i % 3) * 0.1) + 0.123456789012345,
    );
  const faceID = Uint32Array.from(
      { length: mesh.triVerts.length / 3 },
      (_, i) => 100 + i,
    ),
    id = wasm.Manifold.reserveIDs(1);
  const before = positions.slice(),
    solid = createManifoldMesh64(wasm, {
      numProp: 3,
      vertProperties: positions,
      triVerts: mesh.triVerts,
      faceID,
      runOriginalID: new Uint32Array([id]),
      runIndex: new Uint32Array([0, mesh.triVerts.length]),
    });
  try {
    const out = getManifoldMesh64(solid),
      points = new Set<string>();
    for (let i = 0; i < positions.length; i += 3)
      points.add(Array.from(positions.slice(i, i + 3)).join(","));
    for (let i = 0; i < out.vertProperties.length; i += 3)
      expect(
        points.has(Array.from(out.vertProperties.slice(i, i + 3)).join(",")),
      ).toBe(true);
    expect([...out.faceID].sort((a, b) => a - b)).toEqual([...faceID]);
    expect(out.runOriginalID).toEqual(new Uint32Array([id]));
    expect(positions).toEqual(before);
  } finally {
    solid.delete();
  }
});
test("ambiguous rounding, nonfinite and invalid indices fail before native allocation", () => {
  const mesh = cube(),
    input = {
      numProp: 3 as const,
      vertProperties: Float64Array.from(mesh.vertProperties),
      triVerts: mesh.triVerts,
    };
  const unavailable = {} as any;
  expect(() =>
    createManifoldMesh64(unavailable, {
      ...input,
      vertProperties: input.vertProperties.map((v) => 1 + v * 1e-9),
    }),
  ).toThrow("collapsed");
  for (const value of [NaN, Infinity, 1e300]) {
    const p = input.vertProperties.slice();
    p[0] = value;
    expect(() =>
      createManifoldMesh64(unavailable, { ...input, vertProperties: p }),
    ).toThrow("Nonfinite");
  }
  const indices = input.triVerts.slice();
  indices[0] = 999;
  expect(() =>
    createManifoldMesh64(unavailable, { ...input, triVerts: indices }),
  ).toThrow("index");
});
test("native handles are released on warp failure and restored status failure", () => {
  for (const failure of ["warp", "status", "topology"]) {
    const m = cube();
    let seedDeleted = 0,
      restoredDeleted = 0;
    const seed = {
      status: () => "NoError",
      numTri: () => m.triVerts.length / 3,
      numVert: () => m.numVert,
      delete: () => seedDeleted++,
      warp: () => {
        if (failure === "warp") throw Error("injected");
        return {
          status: () => (failure === "status" ? "Invalid" : "NoError"),
          numTri: () => 0,
          numVert: () => m.numVert,
          delete: () => restoredDeleted++,
        };
      },
    };
    const fake = {
      Mesh: class {},
      Manifold: class {
        constructor() {
          return seed;
        }
      },
    } as any;
    expect(() =>
      createManifoldMesh64(fake, {
        numProp: 3,
        vertProperties: Float64Array.from(m.vertProperties),
        triVerts: m.triVerts,
      }),
    ).toThrow();
    expect(seedDeleted).toBe(1);
    expect(restoredDeleted).toBe(failure === "warp" ? 0 : 1);
  }
});
test("captured deformed limbs retain strict partition ancestry with restored doubles", () => {
  for (const name of ["0-broad", "1-slender", "1-broad", "2-slender"]) {
    const raw = JSON.parse(
      readFileSync(`artifacts/deformed-tree-precision/${name}.json`, "utf8"),
    );
    const inputs = raw.inputs.map((m: any) => ({
      positions: Float64Array.from(m.positions),
      indices: Uint32Array.from(m.indices),
    }));
    const r = partitionSolidMaterials(
      inputs,
      createManifoldPartitionKernel(wasm, inputs.length),
    );
    expect(r.materialVolume).toBeGreaterThan(0);
    expect(r.exterior.origins!.reversed.every((v) => v === 0)).toBe(true);
  }
});

test("omitted face IDs preserve later cut geometry, not just import volume", () => {
  const raw = JSON.parse(
    readFileSync(
      "artifacts/deformed-tree-precision/roundtrip-next-cut.json",
      "utf8",
    ),
  );
  const positions = Float64Array.from(raw.positions),
    indices = Uint32Array.from(raw.indices),
    t = raw.tool,
    [x, y, z] = t.halfExtents;
  const seed = wasm.Manifold.hull(
      [-z, z].flatMap((z) => [
        [-x, -y, z],
        [-x, y, z],
        [x, 0, z],
      ]) as any,
    ),
    cutter = seed.transform([
      ...t.axes[0],
      0,
      ...t.axes[1],
      0,
      ...t.axes[2],
      0,
      ...t.center,
      1,
    ] as any);
  const exact = createManifoldMesh64(wasm, {
    numProp: 3,
    vertProperties: positions,
    triVerts: indices,
  });
  let removed: any, retained: any;
  try {
    [removed, retained] = exact.split(cutter);
    expect(Math.abs(removed.volume() / raw.removedVolume - 1)).toBeLessThan(
      1e-12,
    );
    expect(Math.abs(retained.volume() / raw.retainedVolume - 1)).toBeLessThan(
      1e-12,
    );
  } finally {
    retained?.delete();
    removed?.delete();
    exact.delete();
    cutter.delete();
    seed.delete();
  }
});
