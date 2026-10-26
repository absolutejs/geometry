import { test, expect } from "bun:test";
import Module from "manifold-3d";
import { getManifoldMesh64 } from "../src/manifold";
import { mergeIndexedMesh } from "../src/index";
import { signedVolume } from "../src/signedVolume";
const wasm = await Module();
wasm.setup();
test("sidecar retains a native solid whose Float32 export collapses every position", () => {
  const seed = wasm.Manifold.cube([1e-8, 2e-8, 3e-8], true),
    solid = seed.translate([3, 2, 1]);
  try {
    const raw = solid.getMesh(),
      before = raw.vertProperties.slice(),
      mesh = getManifoldMesh64(solid),
      closed = mergeIndexedMesh(mesh, [0, 0, 0], solid.tolerance());
    const range = (p: ArrayLike<number>, k: number) => {
      let lo = Infinity,
        hi = -Infinity;
      for (let i = k; i < p.length; i += 3) {
        lo = Math.min(lo, p[i]!);
        hi = Math.max(hi, p[i]!);
      }
      return hi - lo;
    };
    expect(range(raw.vertProperties, 0)).toBe(0);
    expect(range(closed.positions, 0)).toBe(
      solid.boundingBox().max[0] - solid.boundingBox().min[0],
    );
    expect(
      Math.abs(
        signedVolume(closed.positions, closed.indices) / solid.volume() - 1,
      ),
    ).toBeLessThan(1e-7);
    expect(solid.getMesh().vertProperties).toEqual(before);
    expect(mesh.runOriginalID).toEqual(raw.runOriginalID);
    expect(mesh.faceID).toEqual(raw.faceID);
  } finally {
    solid.delete();
    seed.delete();
  }
});
test("double export retains custom properties and original Boolean face identities", () => {
  const a = wasm.Manifold.cube([1, 1, 1], true),
    b = wasm.Manifold.cube([0.5, 0.5, 0.5], true),
    shell = a.subtract(b),
    colored = shell.setProperties(1, (p) => {
      p[0] = 17;
    });
  try {
    const raw = colored.getMesh(),
      mesh = getManifoldMesh64(colored);
    expect(mesh.numProp).toBe(4);
    expect(mesh.triVerts).toEqual(raw.triVerts);
    expect(mesh.runOriginalID).toEqual(raw.runOriginalID);
    expect(mesh.faceID).toEqual(raw.faceID);
    for (let i = 3; i < mesh.vertProperties.length; i += 4)
      expect(mesh.vertProperties[i]).toBe(17);
    expect(mesh.reversed.some((v) => v === 1)).toBe(true);
  } finally {
    colored.delete();
    shell.delete();
    b.delete();
    a.delete();
  }
});
test("empty export stays empty and temporary handles are released on read failure", () => {
  const a = wasm.Manifold.cube(),
    empty = a.subtract(a);
  try {
    expect(getManifoldMesh64(empty).triVerts.length).toBe(0);
  } finally {
    empty.delete();
    a.delete();
  }
  let deleted = 0;
  const fake = {
    numTri: () => 1,
    numVert: () => 3,
    numProp: () => 0,
    setProperties: () => ({
      status: () => "NoError",
      getMesh: () => {
        throw Error("read failed");
      },
      delete: () => deleted++,
    }),
  };
  expect(() => getManifoldMesh64(fake as any)).toThrow("read failed");
  expect(deleted).toBe(1);
  expect(() =>
    getManifoldMesh64({ ...fake, numTri: () => 200001 } as any),
  ).toThrow("budget");
  expect(deleted).toBe(1);
});
test("normal property channels keep native transformed export values", () => {
  const seed = wasm.Manifold.cube([1, 2, 3], true),
    normal = seed.calculateNormals(0, 0),
    rotated = normal.rotate([23, 41, 17]);
  try {
    const raw = rotated.getMesh(),
      mesh = getManifoldMesh64(rotated);
    expect(mesh.numProp).toBe(raw.numProp);
    expect(mesh.vertProperties.length).toBe(raw.vertProperties.length);
    for (let v = 0; v < raw.numVert; v++)
      for (let p = 3; p < raw.numProp; p++)
        expect(mesh.vertProperties[v * mesh.numProp + p]).toBe(
          raw.vertProperties[v * raw.numProp + p],
        );
    expect(mesh.triVerts).toEqual(raw.triVerts);
  } finally {
    rotated.delete();
    normal.delete();
    seed.delete();
  }
});
