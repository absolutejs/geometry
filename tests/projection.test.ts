import { expect, test } from "bun:test";
import { projectAlphaCoverage, type AlphaProjectionInput } from "../src/index";
function quad(): AlphaProjectionInput {
  return {
    positions: new Float64Array([0, 0, 0, 1, 0, 0, 0, 0, 1, 1, 0, 1]),
    uv: new Float64Array([0, 0, 1, 0, 0, 1, 1, 1]),
    indices: new Uint16Array([0, 1, 2, 2, 1, 3]),
    alpha: new Uint8Array([255, 0, 255, 0]),
    textureWidth: 2,
    textureHeight: 2,
    cutoff: 0.5,
    resolution: 64,
  };
}
test("bilinear alpha resolves physical holes rather than treating the card as solid", () => {
  for (const [cutoff, covered] of [
    [0.25, 0.625],
    [0.5, 0.5],
    [0.75, 0.375],
  ]) {
    const input = { ...quad(), cutoff: cutoff! };
    const r = projectAlphaCoverage(input);
    expect(r.footprintArea).toBe(1);
    expect(r.coveredArea).toBe(covered!);
    expect(r.gapFraction).toBe(1 - covered!);
    expect(r.coveredCells).toBe(4096 * covered!);
  }
  expect(
    projectAlphaCoverage({ ...quad(), alpha: new Uint8Array(4) }).gapFraction,
  ).toBe(1);
  expect(
    projectAlphaCoverage({ ...quad(), alpha: new Uint8Array(4).fill(255) })
      .gapFraction,
  ).toBe(0);
});
test("coverage is a union and is invariant to winding/order without mutating inputs", () => {
  const q = quad(),
    before = q.positions.slice(),
    a = projectAlphaCoverage(q);
  const r = projectAlphaCoverage({
    ...q,
    indices: new Uint16Array([3, 1, 2, 2, 1, 0, 0, 1, 2, 2, 1, 3]),
  });
  expect(r.cells).toEqual(a.cells);
  expect(r.coveredArea).toBe(a.coveredArea);
  expect(q.positions).toEqual(before);
  const opaque = projectAlphaCoverage({
    ...q,
    alpha: new Uint8Array(4).fill(255),
  });
  expect(opaque.alphaTests).toBe(opaque.coveredCells);
});
test("disconnected leaves preserve open space inside their explicit convex reference hull", () => {
  const q = quad();
  const p = new Float64Array([
    ...q.positions,
    3,
    0,
    0,
    4,
    0,
    0,
    3,
    0,
    1,
    4,
    0,
    1,
  ]);
  const r = projectAlphaCoverage({
    ...q,
    positions: p,
    uv: new Float64Array([...q.uv, ...q.uv]),
    indices: new Uint16Array([0, 1, 2, 2, 1, 3, 4, 5, 6, 6, 5, 7]),
    alpha: new Uint8Array(4).fill(255),
  });
  expect(r.footprintArea).toBe(4);
  expect(r.coveredArea).toBe(2);
  expect(r.gapFraction).toBe(0.5);
});
test("local coordinates preserve coverage at distant origins and tiny or large scales", () => {
  const q = quad(),
    base = projectAlphaCoverage(q);
  for (const scale of [1e-8, 0.25, 10000]) {
    const positions = Float64Array.from(q.positions, (v) => v * scale);
    const r = projectAlphaCoverage({ ...q, positions });
    expect(r.cells).toEqual(base.cells);
    expect(r.footprintArea).toBeCloseTo(scale * scale, 12);
  }
  const far = q.positions.slice();
  for (let i = 0; i < far.length; i += 3) {
    far[i]! += 8e7;
    far[i + 2]! -= 8e7;
  }
  const shifted = projectAlphaCoverage({ ...q, positions: far });
  expect(shifted.cells).toEqual(base.cells);
  expect(shifted.footprintArea).toBe(1);
});
test("sampler wrap modes apply to negative UV coordinates", () => {
  const q = quad(),
    uv = Float64Array.from(q.uv, (v, i) => (i % 2 === 0 ? v - 1 : v));
  const clamp = projectAlphaCoverage({ ...q, uv, wrapS: "clamp" });
  const repeat = projectAlphaCoverage({ ...q, uv, wrapS: "repeat" });
  const mirror = projectAlphaCoverage({ ...q, uv, wrapS: "mirror" });
  expect(clamp.gapFraction).toBe(0);
  expect(repeat.gapFraction).toBe(0.5);
  expect(mirror.gapFraction).toBe(0.5);
  expect(repeat.cells[0]).toBe(2);
  expect(mirror.cells[0]).toBe(1);
});
test("hull area and sampled area remain separately visible and unreferenced vertices do not inflate it", () => {
  const q = quad();
  const triangle = { ...q, indices: new Uint16Array([0, 1, 2]) };
  const r = projectAlphaCoverage({
    ...triangle,
    alpha: new Uint8Array(4).fill(255),
  });
  expect(r.footprintArea).toBe(0.5);
  expect(r.coveredArea).toBe(0.5);
  expect(r.sampledFootprintArea).toBeGreaterThan(0.5);
  const p = new Float64Array([...q.positions, 1e9, 0, 1e9]),
    uv = new Float64Array([...q.uv, 0, 0]);
  expect(projectAlphaCoverage({ ...q, positions: p, uv }).footprintArea).toBe(
    1,
  );
});
test("malformed data, degenerate projections and oversized work are rejected", () => {
  const q = quad();
  expect(() =>
    projectAlphaCoverage({ ...q, indices: new Uint16Array([0, 1, 9]) }),
  ).toThrow();
  expect(() =>
    projectAlphaCoverage({ ...q, positions: new Float64Array(12) }),
  ).toThrow();
  expect(() =>
    projectAlphaCoverage({ ...q, alpha: new Uint8Array(3) }),
  ).toThrow();
  expect(() => projectAlphaCoverage({ ...q, cutoff: NaN })).toThrow();
  expect(() => projectAlphaCoverage({ ...q, maxPixelTests: 1 })).toThrow(
    "budget",
  );
  expect(() => projectAlphaCoverage({ ...q, resolution: 1025 })).toThrow();
  const invalid = q.positions.slice();
  invalid[0] = NaN;
  expect(() => projectAlphaCoverage({ ...q, positions: invalid })).toThrow();
});

test("triangle-local rasterization agrees with independent point-in-triangle queries", () => {
  let state = 123456789;
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
  for (let scene = 0; scene < 12; scene++) {
    const positions = Float64Array.from({ length: 90 }, (_, i) => i % 3 === 1 ? 0 : random() * 20 - 10);
    const input: AlphaProjectionInput = {
      positions, uv: new Float32Array(60),
      indices: Uint16Array.from({ length: 30 }, (_, i) => i),
      alpha: new Uint8Array([255]), textureWidth: 1, textureHeight: 1,
      cutoff: 0.4, resolution: 32,
    };
    const result = projectAlphaCoverage(input);
    const [minX,minZ,maxX,maxZ] = result.bounds;
    for (let row = 0; row < 32; row++) for (let col = 0; col < 32; col++) {
      const x = minX + (col + 0.5) * (maxX-minX)/32;
      const z = minZ + (row + 0.5) * (maxZ-minZ)/32;
      let covered = false;
      for (let t = 0; t < 30; t += 3) {
        const signs: number[] = [];
        for (let e = 0; e < 3; e++) {
          const a = (t+e)*3, b = (t+(e+1)%3)*3;
          signs.push((x-positions[a]!) * (positions[b+2]!-positions[a+2]!) -
            (z-positions[a+2]!) * (positions[b]!-positions[a]!));
        }
        if (signs.every(v => v >= 0) || signs.every(v => v <= 0)) covered = true;
      }
      expect(result.cells[row*32+col] === 2).toBe(covered);
    }
  }
});
