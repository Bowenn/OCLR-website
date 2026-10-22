# OCLR identity

Approved minimal **OCLR** wordmark for **osu! Chinese League Rookie**.

- The **O** is a circular pink-to-purple gradient; **CLR** is solid, with dark/light variants. No extra star, slider tail, or outer emblem.
- `oclr-wordmark.svg` / `oclr-wordmark-dark.svg`: transparent wordmark for dark surfaces. `oclr-wordmark-light.svg`: transparent wordmark for light surfaces.
- `src/components/oclr-logo.tsx` renders matching paths in the Header, adapting the letters to the selected site theme without downloading a font.
- `oclr-mark.svg`: just the transparent gradient **O**, used for favicon. `oclr-mark-mono.svg`: no-background single-color outline.
- `oclr-16.png`, `oclr-32.png`, `oclr-48.png`, and `oclr-180.png`: transparent favicon/touch-icon PNGs rendered from the same circular mark.
- Keep clear space around the lettering and do not squeeze the mark. Small icons use the **O only**; don't downscale the entire wordmark.
- This is independent community-event branding, not osu!'s official logo. No copyrighted character art, external imagery, or packaged font files are included.

The brand reference rendering was approved for this simple wordmark direction. The earlier Open Lane implementation and experimental directions in `docs/design/oclr-logo-concepts.svg` are superseded by these assets.
