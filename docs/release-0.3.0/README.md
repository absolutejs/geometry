# Geometry 0.3.0 — initial solid-overlap audit

Added a bounded, injected-kernel solid-intersection audit for preflight material
integrity. The motivating game case has overlapping authored branch volumes that
become separate chips after a cut, independently of a native contact-reporting
problem. A settling solver is not proof that those inputs are valid material.

Analytic native tests cover duplicate/partially overlapping cubes, exact-touch
bounds rejection, separated solids, hollow-shell containment with zero overlap,
large translated coordinates, ownership of borrowed buffers, and disposal on
success and every kernel/precision failure path. Prior alpha and component tests
remain required. See package README for preconditions and budget semantics.
