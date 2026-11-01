import { prepareTriangleFirstPlaneMomentsForSolid } from "./trianglePlaneMoments.js";
type V = readonly [number, number, number];
type M = [number, number, number];
type Face = {
  vertices: V[];
  query: ReturnType<typeof prepareTriangleFirstPlaneMomentsForSolid>;
};
type Node = {
  low: M;
  high: M;
  reference: M;
  extent: number;
  normal: M;
  flux: number;
  first: number[];
  weighted: M;
  children: Node[];
  faces: Face[];
};
/** Internal boundary-flux hierarchy. Full nodes store oriented surface integrals,
 * never an invented volume for an open patch. The caller supplies a validated
 * normalized clipping plane and a flux origin lying in that plane. */
export function prepareSurfaceFluxHierarchy(input: readonly (readonly V[])[]) {
  const faces: Face[] = input.map((vertices) => ({
    vertices: vertices.map((v) => [...v] as M),
    query: prepareTriangleFirstPlaneMomentsForSolid(vertices),
  }));
  function build(faces: Face[]): Node {
    const low: M = [Infinity, Infinity, Infinity],
      high: M = [-Infinity, -Infinity, -Infinity];
    for (const f of faces)
      for (const p of f.vertices)
        for (let k = 0; k < 3; k++) {
          low[k] = Math.min(low[k]!, p[k]!);
          high[k] = Math.max(high[k]!, p[k]!);
        }
    const reference = low.map((v, k) => v + (high[k]! - v) * 0.5) as M;
    const extent = Math.max(...high.map((v, k) => v - low[k]!));
    const node: Node = {
      low,
      high,
      reference,
      extent,
      normal: [0, 0, 0],
      flux: 0,
      first: Array(9).fill(0),
      weighted: [0, 0, 0],
      children: [],
      faces,
    };
    for (const f of faces) {
      // The node upper Y bound retains every face, including coplanar faces.
      const p = f.vertices[0]!,
        q = f.query(high, [0, 1, 0]);
      const r = p.map((v, k) => v - reference[k]!) as M;
      const distance =
        r[0] * q.surfaceNormal[0] +
        r[1] * q.surfaceNormal[1] +
        r[2] * q.surfaceNormal[2];
      const moment = q.firstMoment.map((v, k) => v + r[k]! * q.area);
      node.flux += distance * q.area;
      for (let i = 0; i < 3; i++) {
        node.normal[i]! += q.surfaceNormal[i]! * q.area;
        node.weighted[i]! += distance * moment[i]!;
        for (let j = 0; j < 3; j++)
          node.first[i * 3 + j]! += moment[i]! * q.surfaceNormal[j]!;
      }
    }
    if (
      ![
        ...node.normal,
        node.flux,
        ...node.first,
        ...node.weighted,
        ...reference,
        extent,
      ].every(Number.isFinite)
    )
      throw Error("Unrepresentable surface flux hierarchy");
    if (faces.length > 16) {
      const axis = high.map((v, k) => v - low[k]!).indexOf(extent);
      const sorted = faces
        .slice()
        .sort(
          (a, b) =>
            a.vertices.reduce((s, v) => s + v[axis]!, 0) -
            b.vertices.reduce((s, v) => s + v[axis]!, 0),
        );
      const middle = Math.floor(sorted.length / 2);
      node.children = [
        build(sorted.slice(0, middle)),
        build(sorted.slice(middle)),
      ];
      node.faces = [];
    }
    return node;
  }
  const root = build(faces);
  return (point: V, normal: V, origin: V) => {
    let volume = 0,
      evaluatedSurfaceTriangles = 0,
      fullSurfaceNodes = 0,
      drySurfaceNodes = 0;
    const firstMoment: M = [0, 0, 0];
    const addFull = (node: Node) => {
      const d = node.reference.map((v, k) => v - origin[k]!) as M;
      const flux =
          node.flux +
          d[0] * node.normal[0] +
          d[1] * node.normal[1] +
          d[2] * node.normal[2],
        v = flux / 3;
      volume += v;
      for (let i = 0; i < 3; i++)
        firstMoment[i]! +=
          origin[i]! * v +
          (node.weighted[i]! +
            node.first[i * 3]! * d[0] +
            node.first[i * 3 + 1]! * d[1] +
            node.first[i * 3 + 2]! * d[2] +
            d[i]! * flux) /
            4;
    };
    const visit = (node: Node) => {
      let near = 0,
        far = 0,
        scale = 0;
      for (let k = 0; k < 3; k++) {
        const a = (node.low[k]! - point[k]!) * normal[k]!,
          b = (node.high[k]! - point[k]!) * normal[k]!;
        near += Math.min(a, b);
        far += Math.max(a, b);
        scale +=
          (Math.abs(node.low[k]!) +
            Math.abs(node.high[k]!) +
            2 * Math.abs(point[k]!)) *
          Math.abs(normal[k]!);
      }
      if (![near, far, scale].every(Number.isFinite))
        throw Error("Unrepresentable surface plane interval");
      const margin = 64 * Number.EPSILON * Math.max(scale, node.extent);
      if (near > margin) {
        drySurfaceNodes++;
        return;
      }
      if (far < -margin) {
        fullSurfaceNodes++;
        addFull(node);
        return;
      }
      if (node.children.length) {
        for (const c of node.children) visit(c);
        return;
      }
      for (const face of node.faces) {
        const r = face.query(point, normal);
        evaluatedSurfaceTriangles++;
        const dx = r.reference[0] - origin[0],
          dy = r.reference[1] - origin[1],
          dz = r.reference[2] - origin[2];
        const distance =
            dx * r.surfaceNormal[0] +
            dy * r.surfaceNormal[1] +
            dz * r.surfaceNormal[2],
          v = (distance * r.area) / 3;
        volume += v;
        firstMoment[0] +=
          origin[0] * v + (distance * (r.firstMoment[0] + dx * r.area)) / 4;
        firstMoment[1] +=
          origin[1] * v + (distance * (r.firstMoment[1] + dy * r.area)) / 4;
        firstMoment[2] +=
          origin[2] * v + (distance * (r.firstMoment[2] + dz * r.area)) / 4;
      }
    };
    visit(root);
    if (![volume, ...firstMoment].every(Number.isFinite))
      throw Error("Unrepresentable surface flux result");
    return {
      volume,
      firstMoment,
      evaluatedSurfaceTriangles,
      fullSurfaceNodes,
      drySurfaceNodes,
    };
  };
}
