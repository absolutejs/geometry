# Alpha preparation release candidate

Adds dependency-free RGBA8 and worker-side ImageBitmap alpha extraction. The game
measured cold main-thread leaf readback at10–16ms; this package supplies the
reusable off-thread readback operation without introducing a renderer dependency.

10tests /12,341assertions passed on Bun1.4.4+absolute.1; build and Node ESM worker
consumer passed. GPU-disabled Chromium confirmed exact alpha255/0/64/128 and
that closing the worker's structured-cloned bitmap leaves the source width intact.
Evidence is adjacent. No native GPU benchmark or continuous readback was run.
Publication and consumer adoption are still to be verified after this candidate.
