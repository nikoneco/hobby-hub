# Grey tabby cat archive

Preserved on 2026-10-04 before switching the overnight display to a single-colour
silhouette: sleeping / walking / sleeping.

- `sleeping.png`: original sleeping frame at 64x64.
- `walking.png`: original walking frame at 64x64.
- `night-cat.gif`: original 36-frame animation at 64x64, 650 ms per frame.
- `gray_tabby_sprite.js`: original palette and sprite functions. These require
  the shared rendering helpers from the original display script.

The complete working renderer is retained in commit `cade2ab`:
`LifeBoard/pixoo_display/pixoo_lifeboard.js`. The archive is never imported by
the live renderer. Restore from that revision to revisit this design.
