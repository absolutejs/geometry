export {
  projectAlphaCoverage,
  type AlphaProjectionInput,
  type AlphaProjection,
} from "./projection.js";
export { alphaFromRgba, alphaFromImageBitmap } from './alpha.js';

export { closedComponents } from './closedComponents.js';
export { solidPointMembership } from './solidPointMembership.js';
export { solidComponents } from './solidComponents.js';
export { auditSolidOverlaps, type OverlapMesh, type OverlapSolid, type SolidOverlapAudit } from './overlap.js';
export { partitionSolidMaterials, type MaterialPartitionKernel, type SolidMaterialPartition } from './materialPartition.js';

export { triangleWeights } from './triangleWeights.js';
export { auditSurfaceOrigins, type SurfaceOrigins } from './surfaceOrigins.js';
export { mergeIndexedMesh, type IndexedMergeMesh } from './mergeIndexedMesh.js';
export { principalInertiaFrame } from './principalInertia.js';
export { axialOrientationTensor, type WeightedAxis } from './axialOrientation.js';
