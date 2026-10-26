# Published alpha preparation upgrade

Adds dependency-free RGBA8 and worker-side ImageBitmap alpha extraction. The game
measured cold main-thread leaf readback at10–16ms; this package supplies the
reusable off-thread readback operation without introducing a renderer dependency.

10tests /12,341assertions passed on Bun1.4.4+absolute.1; build and Node ESM worker
consumer passed. GPU-disabled Chromium confirmed exact alpha255/0/64/128 and
that closing the worker's structured-cloned bitmap leaves the source width intact.
Evidence is adjacent. No native GPU benchmark or continuous readback was run.
Published @absolutejs/geometry@0.1.1 on 2026-10-26 from commit
1c53775295e2ca43991e1445e145b6ef0abe7dfc. Registry SHA1 verified:
`bfd13dddc6c836c74f86613940b93302ce3f00b5`.
Hello World installed this exact registry release with Bun 1.4.4+absolute.1.
Its GPU-disabled browser exercised real ImageBitmap capture through the game
worker, cancellation/retry, and retained renderer-source ownership. No local
package patch or file dependency was used. npm accepted the existing authenticated
publish session; no additional user confirmation was needed for this release.
