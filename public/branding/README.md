# OCLR identity

Approved minimal **OCLR** wordmark for **osu! Chinese League Rookie**.

- All four letterforms (**O**, **C**, **L**, **R**) are outlined from the **same Inter Display Black** typeface at the same scale and baseline, retaining the font's intentional optical overshoot. The shapes are SVG paths, so rendering requires no downloaded or locally installed font.
- Only the **O** uses the existing pink-to-purple gradient; **CLR** is solid and theme-aware. No extra star, slider tail, background, or outer emblem.
- `oclr-wordmark.svg` / `oclr-wordmark-dark.svg`: transparent wordmark with light CLR lettering for dark surfaces. `oclr-wordmark-light.svg`: transparent wordmark with dark CLR lettering for light surfaces.
- `src/components/oclr-logo.tsx` uses those same four paths in the website Header, with CLR inheriting the site's current foreground color.
- `oclr-mark.svg`: existing transparent gradient circular **O** favicon mark (intentionally unchanged). `oclr-mark-mono.svg`: monochrome favicon mark.
- `oclr-16.png`, `oclr-32.png`, `oclr-48.png`, and `oclr-180.png`: existing transparent favicon/touch-icon PNGs (unchanged).
- The wordmark uses a **238 × 74** viewBox. Keep its aspect ratio and clear space; the Header normally renders it at 106 px wide, or 94 px on narrow screens. Small icons use the standalone favicon mark, not a downscaled full wordmark.
- The outlines derive from **Inter** (SIL Open Font License 1.1), with no font binaries bundled. This is independent community-event branding, not osu!'s official logo.

The previous hand-drawn CLR and circular O combination, the earlier Open Lane implementation, and experimental directions in `docs/design/oclr-logo-concepts.svg` are superseded by this wordmark.
