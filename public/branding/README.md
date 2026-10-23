# OCLR identity

Selected official **OCLR** wordmark for **osu! Chinese League Rookie**, replacing the original flat wordmark.

- Artwork follows the organizer-selected pink/lavender geometric italic lettering: **O, C and L** share the same letter gradient and cap height; **R alone** has the more saturated pink-to-violet accent gradient.
- Preserve the four-point star above the R. **No orbital trails, slider arcs, planets, or separate ornaments**. The background stays fully transparent.
- The artwork was traced into self-contained vector outlines from the selected transparent reference image; it uses no text/font fallback or embedded bitmap. Small page header renditions remain crisp.
- `oclr-wordmark.svg` and `oclr-wordmark-dark.svg` are for **dark** surfaces. `oclr-wordmark-light.svg` uses darker OCL lettering for accessible contrast on **light** surfaces, while keeping the same vivid R/star.
- `src/components/oclr-logo.tsx` renders the same outlines in the Header, controlled by CSS theme-specific gradient stops. Display width: 132 px on desktop and 112 px below 400 px; preserve the **1465 × 430** intrinsic viewBox ratio.
- The favicon is **the signature pink-to-violet R plus four-point star**, cropped and adapted from the exact vector outlines in `oclr-wordmark.svg`, replacing the old standalone O mark.
- `oclr-mark.svg`: scalable transparent R+star favicon. `oclr-mark-mono.svg`: monochrome silhouette for single-color contexts. `oclr-16.png`, `oclr-32.png`, `oclr-48.png`: matching raster browser icons; `oclr-180.png`: matching transparent Apple Touch Icon. All share the same R/star artwork and have no background.
- `src/app/layout.tsx` links SVG and PNG favicon variants and the Apple icon with a shared `v=3` URL cache-buster.
- This is independent community tournament branding, not osu!'s official logo. Do not add unlicensed osu! brand marks.

Previous wordmark versions are superseded by this design. No database or application behavior changes are needed.
