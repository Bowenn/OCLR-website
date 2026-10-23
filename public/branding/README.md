# OCLR identity

Minimal **OCLR** wordmark for **osu! Chinese League Rookie**.

- **CLR keeps its original custom vector letterforms** without reshaping, scaling or changing the paths. The gradient **O** is drawn to complement those existing glyphs, matching their 18–75 cap-height span, heavyweight strokes and gently squared curves. Do not replace CLR with a different font merely to match O.
- Only the **O** uses the existing pink-to-purple gradient; **CLR** is solid and theme-aware. No stars, slider tails, backgrounds or extra emblems.
- `oclr-wordmark.svg` / `oclr-wordmark-dark.svg`: transparent wordmark with light CLR for dark surfaces. `oclr-wordmark-light.svg`: transparent wordmark with dark CLR for light surfaces.
- `src/components/oclr-logo.tsx` renders the same paths directly in the Header; CLR uses the site's foreground color.
- `oclr-mark.svg`: original standalone pink-to-purple circular **O** for the favicon (unchanged); `oclr-mark-mono.svg`: single-color mark.
- `oclr-16.png`, `oclr-32.png`, `oclr-48.png` and `oclr-180.png`: existing favicon/touch-icon PNGs (unchanged).
- Keep the original **260 × 92** viewBox and aspect ratio. Header display width is 106 px (94 px on very narrow screens). Small icons use the standalone mark, not the full wordmark.
- The logo is entirely vector paths, with no font fallback, external imagery or font download. This is independent community-event branding, not an official osu! logo.

Experimental directions in `docs/design/oclr-logo-concepts.svg` are superseded by these assets.
