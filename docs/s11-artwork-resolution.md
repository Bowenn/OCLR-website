# S11 artwork resolution investigation (#173)

Checked on 2026-10-24. This investigation does **not** establish that the requested visual improvement has passed.

| Surface                        | Approved source                           | Pixels    | File bytes | Delivery                                                              |
| ------------------------------ | ----------------------------------------- | --------- | ---------- | --------------------------------------------------------------------- |
| Home wide hero                 | `public/oclr-s11-website-background.webp` | 2560×1200 | 255310     | CSS background, `cover` on desktop; mobile composition uses `contain` |
| Tournament overview key visual | `public/oclr-s11-key-visual.webp`         | 1672×941  | 293892     | Next Image with `unoptimized`; delivered at original dimensions       |

The public home page was inspected in a browser and uses the website-background asset, not the directory thumbnail. There is no Next Image `srcset` selection or optimization quality loss in that CSS path. The tournament overview also receives the original file, so changing `sizes` alone cannot restore detail. The existing opacity/scale entrance animation finishes at scale 1; overlays and responsive crop remain unchanged.

At 1920 CSS pixels and DPR 2, a full-width background needs approximately 3840 source pixels horizontally for one source pixel per device pixel. The 2560-pixel source provides only two thirds of that width. The 1672-pixel key visual similarly limits very wide/high-DPI use. Actual source detail and compression quality cannot be recovered from dimensions alone; merely upscaling or re-encoding these exports does not prove a sharper original.

The existing `/Users/emik/Downloads/mainsheet-light/assets/oclr-s11-hero.webp` and `oclr-s11-key-visual.webp` copies have the same dimensions and file sizes as the shipped files. No higher-resolution approved source has been identified. A source path/download link was requested from the organizer. Keep #173 open until that source is available, then export responsive versions and compare 1440/1920 CSS-pixel screenshots at DPR 1 and 2, mobile/tablet crops, transfer sizes and layout stability. Do not substitute a different composition or synthesize artwork details.

Current source SHA-256:

- Website background: `db206ec9782ec991a5492259eeee1bae9257434d69198a93e06e1a135a69d3fd`
- Tournament key visual: `bfd7b6ef12654a7814c064a0bc2014b5250ce3f501991176977c3c9472dfab16`
