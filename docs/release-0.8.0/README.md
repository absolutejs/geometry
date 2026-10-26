# Geometry 0.8.0: axial orientation mixtures

Reusable second-moment accumulation for unoriented fibre axes. Root entry only;
no Three/Rapier/Manifold runtime dependency. Bounded 4096 sample workload, immutable
inputs, owned transferable Float64 output. Scaled inputs and compensated sums
handle finite extreme vector and weight magnitudes without overflow.

Q = sum(w u u^T) / sum(w), with normalized axes u. The symmetric positive
semidefinite tensor has trace one and is unchanged by negating any input axis.
No arbitrary principal direction is returned for ambiguous/isotropic mixtures.
This discards higher-order distribution information and is not a biological growth
or material strength model. In particular it does not fix junction ring phase,
fracture behavior, collision penetration, or surface ownership by itself.

Evidence: build and 45 tests / 18644 assertions pass; analytic aligned, planar,
isotropic, weighted and extreme-scale cases; 160 rotation covariance fixtures,
positive response, input preservation and malformed/budget rejection. Built Node
ESM import and transferable worker consumer pass. GPU-disabled browser module
worker computes and transfers the new tensor, in addition to existing exports.
The game candidate sweeps parent/child authored axes for all eight tree variants;
maximum sign error is zero and the mixture is continuous in its analytic weights.
The candidate explicitly imports the built package in a docs-only probe; the
application remains on published 0.7.0 until registry adoption.

Research checked 2026-10-26: Tucker's fibre orientation descriptor lecture
references Advani and Tucker (1987), the second-moment tensor representation.
https://ecm-academics.plymouth.ac.uk/jsummerscales/FPCM/FPCM15/FPCM15_keynote_Tucker_fibre_orientation_descriptors.pdf
The package implements the discrete weighted second moment, not the paper's
suspension flow evolution model. Game biological context is documented separately
in material-provenance-2026-10-26/grain-field-design.md.
