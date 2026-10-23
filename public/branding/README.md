# OCLR identity

Selected official **OCLR** wordmark for **osu! Chinese League Rookie**, replacing the original flat wordmark.

- Artwork follows the organizer-selected pink/lavender geometric italic lettering: **O, C and L** share the same letter gradient and cap height; **R alone** has the more saturated pink-to-violet accent gradient.
- Preserve the four-point star above the R. **No orbital trails, slider arcs, planets, or separate ornaments**. The background stays fully transparent.
- The artwork was traced into self-contained vector outlines from the selected transparent reference image; it uses no text/font fallback or embedded bitmap. Small page header renditions remain crisp.
- `oclr-wordmark.svg` and `oclr-wordmark-dark.svg` are for **dark** surfaces. `oclr-wordmark-light.svg` uses darker OCL lettering for accessible contrast on **light** surfaces, while keeping the same vivid R/star.
- `src/components/oclr-logo.tsx` renders the same outlines in the Header, controlled by CSS theme-specific gradient stops. Display width: 132 px on desktop and 112 px below 400 px; preserve the **1465 × 430** intrinsic viewBox ratio.
- The standalone circular `oclr-mark.svg`, `oclr-mark-mono.svg` and existing PNG favicon/touch icons are retained for now; favicon replacement is a separate decision from the full wordmark.
- This is independent community tournament branding, not osu!'s official logo. Do not add unlicensed osu! brand marks.

Previous wordmark versions are superseded by this design. No database or application behavior changes are needed.
