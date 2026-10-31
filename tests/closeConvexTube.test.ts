import { test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import Module from "manifold-3d";
import { closeConvexTube } from "../src/closeConvexTube";
import { closedComponents } from "../src/closedComponents";
import { signedVolume } from "../src/signedVolume";
import { partitionSolidMaterials } from "../src/materialPartition";
import { createManifoldPartitionKernel } from "../src/manifold";
function tube(n = 12, top = 1) {
  const positions: number[] = [],
    indices: number[] = [];
  for (const y of [0, 2])
    for (let i = 0; i < n; i++)
      positions.push(
        (y ? top : 1) * Math.cos((i * 2 * Math.PI) / n),
        y,
        (y ? top : 1) * Math.sin((i * 2 * Math.PI) / n),
      );
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    indices.push(i, i + n, j, j, i + n, j + n);
  }
  return { positions, indices };
}
test("convex closure preserves authored vertices, winding, volume and cap coordinates", () => {
  for (const n of [3, 8, 12, 64])
    for (const top of [1, 0.25]) {
      const input = tube(n, top),
        p = input.positions.slice(),
        idx = input.indices.slice(),
        r = closeConvexTube(p, idx);
      expect(Array.from(r.positions)).toEqual(p);
      expect(input.positions).toEqual(p);
      expect(input.indices).toEqual(idx);
      expect(closedComponents(r.positions, r.indices)).toHaveLength(1);
      const area = (n * Math.sin((2 * Math.PI) / n)) / 2;
      expect(
        Math.abs(
          signedVolume(r.positions, r.indices) /
            ((2 * area * (1 + top + top * top)) / 3) -
            1,
        ),
      ).toBeLessThan(1e-12);
      expect(r.indices.length / 3).toBe(n * 4 - 4);
      expect(r.caps.length / 9).toBe(2 * (n - 2));
      expect(r.capPoints.length).toBe((r.caps.length * 2) / 3);
      for (let i = 0; i < r.caps.length / 3; i++)
        expect(
          Math.abs(
            Math.hypot(r.capPoints[i * 2]!, r.capPoints[i * 2 + 1]!) -
              Math.hypot(r.caps[i * 3]!, r.caps[i * 3 + 2]!),
          ),
        ).toBeLessThan(1e-6);
    }
});
test("invalid topology, winding, warped and star boundaries remain rejected", () => {
  const t = tube();
  expect(() =>
    closeConvexTube(t.positions, [...t.indices, ...t.indices.slice(0, 3)]),
  ).toThrow();
  const reversed = t.indices.slice();
  [reversed[0], reversed[1]] = [reversed[1]!, reversed[0]!];
  expect(() => closeConvexTube(t.positions, reversed)).toThrow();
  const warped = t.positions.slice();
  warped[1] = 0.2;
  expect(() => closeConvexTube(warped, t.indices)).toThrow();
  const star = tube(5);
  const order = [0, 2, 4, 1, 3];
  for (let y = 0; y < 2; y++)
    for (let i = 0; i < 5; i++)
      star.positions.splice(
        (y * 5 + i) * 3,
        3,
        Math.cos((order[i]! * 2 * Math.PI) / 5),
        y * 2,
        Math.sin((order[i]! * 2 * Math.PI) / 5),
      );
  expect(() => closeConvexTube(star.positions, star.indices)).toThrow();
});
test("captured tree cap junctions partition with strict ancestry after boundary-only closure", async () => {
  const wasm = await Module();
  wasm.setup();
  for (const variant of [2, 3]) {
    const captured = JSON.parse(
      readFileSync(
        `artifacts/import-precision/variant-${variant}.json`,
        "utf8",
      ),
    );
    const original = captured.inputs.map((m: any) => ({
      positions: Float64Array.from(m.positions),
      indices: Uint32Array.from(m.indices),
    }));
    expect(() =>
      partitionSolidMaterials(
        original,
        createManifoldPartitionKernel(wasm, original.length),
      ),
    ).toThrow("Surface origin winding mismatch");
    const inputs = original.map((m: any) => {
      const boundaryVertices = m.positions.length / 3 - 2;
      const sideFaces = Array.from(
        { length: m.indices.length / 3 },
        (_, t) => Array.from(m.indices.slice(t * 3, t * 3 + 3)) as number[],
      ).filter((f) => f.every((i) => i < boundaryVertices));
      return closeConvexTube(
        m.positions.slice(0, boundaryVertices * 3),
        Uint32Array.from(sideFaces.flat()),
      );
    });
    for (let i = 0; i < inputs.length; i++)
      expect(
        Math.abs(
          signedVolume(inputs[i].positions, inputs[i].indices) /
            signedVolume(original[i].positions, original[i].indices) -
            1,
        ),
      ).toBeLessThan(1e-5);
    const partition = partitionSolidMaterials(
      inputs,
      createManifoldPartitionKernel(wasm, inputs.length),
    );
    expect(partition.materialVolume).toBeGreaterThan(0);
    expect(partition.maximumVolumeError).toBeLessThan(1e-5);
    expect(partition.exterior.origins!.reversed.every((x) => x === 0)).toBe(
      true,
    );
  }
});
