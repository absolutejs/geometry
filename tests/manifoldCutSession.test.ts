import { test, expect } from "bun:test";
import Module from "manifold-3d";
import { createManifoldCutSession, getManifoldMesh64 } from "../src/manifold";
import { mergeIndexedMesh } from "../src/index";
const wasm = await Module();
wasm.setup();
function cube(x = 0) {
  const a = wasm.Manifold.cube([2, 2, 2], true),
    b = a.translate([x, 0, 0]);
  try {
    return mergeIndexedMesh(getManifoldMesh64(b), [0, 0, 0], b.tolerance());
  } finally {
    b.delete();
    a.delete();
  }
}
test("successive native cuts conserve material, retain source ancestry and ignore air strikes", () => {
  const session = createManifoldCutSession(wasm, [cube()], 2);
  try {
    const initial = session.snapshot();
    expect(initial.volume).toBe(8);
    const one = session.cut(cube(1));
    expect(one.changed).toBe(true);
    expect(one.removed.volume).toBe(4);
    expect(one.retained.volume).toBe(4);
    expect(one.sequence).toBe(1);
    expect(
      one.retained.origins.sources.some(
        (v, i) => v === 1 && one.retained.origins.reversed[i] === 1,
      ),
    ).toBe(true);
    const air = session.cut(cube(1));
    expect(air.changed).toBe(false);
    expect(session.cuts).toBe(1);
    expect(air.removed.indices.length).toBe(0);
    const two = session.cut(cube(0.5));
    expect(two.changed).toBe(true);
    expect(two.removed.volume).toBe(2);
    expect(two.retained.volume).toBe(2);
    expect(two.relativeVolumeError).toBe(0);
    expect(two.retained.origins.sources.every((v) => v < 3)).toBe(true);
    expect(session.snapshot().volume).toBe(2);
    expect(() => session.cut(cube())).toThrow("cut budget");
  } finally {
    session.dispose();
    session.dispose();
  }
  expect(() => session.snapshot()).toThrow("disposed");
});
test("input and exported arrays are owned and invalid cuts leave the current material unchanged", () => {
  const input = cube(),
    session = createManifoldCutSession(wasm, [input]);
  try {
    input.positions.fill(99);
    input.indices.fill(0);
    const first = session.snapshot();
    first.positions.fill(99);
    first.indices.fill(0);
    first.origins.sources.fill(63);
    expect(session.snapshot().volume).toBe(8);
    const bad = cube();
    bad.indices = bad.indices.slice(0, -3);
    expect(() => session.cut(bad)).toThrow("Open");
    expect(session.cuts).toBe(0);
    expect(session.snapshot().volume).toBe(8);
  } finally {
    session.dispose();
  }
});
test("failure after native split rolls back and releases both pending solids and cutter", () => {
  const session = createManifoldCutSession(wasm, [cube()]);
  const probe = wasm.Manifold.cube();
  const prototype = Object.getPrototypeOf(probe),
    original = prototype.split;
  probe.delete();
  let removed: any, retained: any, cutter: any;
  prototype.split = function (tool: any) {
    cutter = tool;
    const pair = original.call(this, tool);
    removed = pair[0];
    retained = pair[1].translate([100, 0, 0]);
    pair[1].delete();
    return [removed, retained];
  };
  try {
    expect(() => session.cut(cube(1))).toThrow();
    expect(session.cuts).toBe(0);
    expect(session.snapshot().volume).toBe(8);
    expect(removed.isDeleted()).toBe(true);
    expect(retained.isDeleted()).toBe(true);
    expect(cutter.isDeleted()).toBe(true);
  } finally {
    prototype.split = original;
    session.dispose();
  }
});
test("overlapping initial sources form one physical union and a complete cut has an empty retained snapshot", () => {
  const session = createManifoldCutSession(wasm, [cube(), cube(1)]);
  try {
    expect(session.snapshot().volume).toBe(12);
    const a = wasm.Manifold.cube([10, 10, 10], true);
    try {
      const m = mergeIndexedMesh(
          getManifoldMesh64(a),
          [0, 0, 0],
          a.tolerance(),
        ),
        r = session.cut(m);
      expect(r.retained.indices.length).toBe(0);
      expect(r.removed.volume).toBe(12);
      expect(session.snapshot().volume).toBe(0);
    } finally {
      a.delete();
    }
  } finally {
    session.dispose();
  }
});
test("invalid source/cut budgets fail before creating a session", () => {
  expect(() => createManifoldCutSession(wasm, [])).toThrow("budget");
  expect(() => createManifoldCutSession(wasm, [cube()], 0)).toThrow("budget");
  expect(() => createManifoldCutSession(wasm, [cube()], 33)).toThrow("budget");
  const bad = cube();
  bad.indices = bad.indices.slice(0, -3);
  expect(() => createManifoldCutSession(wasm, [bad])).toThrow("Open");
});

test("far air strikes avoid native cutting, including after the accepted-cut quota is full", () => {
  const session = createManifoldCutSession(wasm, [cube()], 1);
  try {
    const air = session.cut(cube(100));
    expect(air.changed).toBe(false);
    expect(air.broadPhaseSkipped).toBe(true);
    expect(air.removed.stats.nativeEvaluated).toBe(false);
    expect(session.cuts).toBe(0);
    expect(session.cut(cube(1)).changed).toBe(true);
    expect(session.cut(cube(100)).broadPhaseSkipped).toBe(true);
    expect(session.cuts).toBe(1);
    expect(session.snapshot().volume).toBe(4);
  } finally {
    session.dispose();
  }
});
test("an empty retained material remains empty on subsequent tools", () => {
  const session = createManifoldCutSession(wasm, [cube()], 1);
  try {
    session.cut(cube());
    const next = session.cut(cube(100));
    expect(next.changed).toBe(false);
    expect(next.retained.volume).toBe(0);
    expect(next.retained.stats.nativeTolerance).toBe(null);
    expect(session.cuts).toBe(1);
  } finally {
    session.dispose();
  }
});

test('replaying source meshes and commands reproduces snapshots despite new native source IDs',()=>{
 const inputs=[cube(),cube(.25)],tools=[cube(.75),cube(.25)];
 const replay=()=>{const session=createManifoldCutSession(wasm,inputs);try{const snapshots=[session.snapshot()];for(const tool of tools){const cut=session.cut(tool);snapshots.push(cut.removed,cut.retained);}return snapshots;}finally{session.dispose();}};
 expect(replay()).toEqual(replay());
});
