# Geometry 0.4.0 qualification

BVM Bun 1.4.4+absolute.1. Build and 28 tests / 12,459 assertions pass.
Built ESM/Node native Boolean integration passes on Node v22.14.0.
Built module import and transferable worker round trip pass; GPU-disabled browser
module worker passes. The browser smoke test covers package imports/projection,
not native material partition execution; native partition is tested in Bun/Node.

Partition fixtures cover overlapping, fully covered, disjoint, face/edge/point
touching, hollow, large translated inputs, sequential cuts, invalid/budget inputs,
copy isolation, incorrect operations, alias rejection, allocation failure cleanup,
and constant native handle count. Native allocations internal to a backend are
outside the handle counter; cancellation still requires terminating its worker.

The game tree-fixture experiment is tracked separately in hello-world's
docs/exclusive-material-2026-10-26. Runtime body migration has not been qualified.
