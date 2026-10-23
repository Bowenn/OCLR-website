# S11 artwork resolution investigation (#173)

Checked on 2026-10-24. This investigation does **not** establish that the requested visual improvement has passed.

| Surface                        | Approved source                           | Pixels    | File bytes | Delivery                                                              |
| ------------------------------ | ----------------------------------------- | --------- | ---------- | --------------------------------------------------------------------- |
| Home wide hero                 | `public/oclr-s11-website-background.webp` | 2560×1200 | 255310     | CSS background, `cover` on desktop; mobile composition uses `contain` |
| Tournament overview key visual | `public/oclr-s11-key-visual.webp`         | 1672×941  | 293892     | Next Image with `unoptimized`; delivered at original dimensions       |

The public home page was inspected in a browser and uses the website-background asset, not the directory thumbnail. There is no Next Image `srcset` selection or optimization quality loss in that CSS path. The tournament overview also receives the original file, so changing `sizes` alone cannot restore detail. The existing opacity/scale entrance animation finishes at scale 1; overlays and responsive crop remain unchanged.

At 1920 CSS pixels and DPR 2, a full-width background needs approximately 3840 source pixels horizontally for one source pixel per device pixel. The 2560-pixel source provides only two thirds of that width. The 1672-pixel key visual similarly limits very wide/high-DPI use. Actual source detail and compression quality cannot be recovered from dimensions alone; merely upscaling or re-encoding these exports does not prove a sharper original.

The existing `/Users/emik/Downloads/mainsheet-light/assets/oclr-s11-hero.webp` and `oclr-s11-key-visual.webp` copies have the same dimensions and file sizes as the shipped files. No higher-resolution approved source has been identified. The organizer subsequently supplied `oclr-s11-key-visual-1.webp`; see the byte comparison below. Keep #173 open until a higher-resolution source is available, then export responsive versions and compare 1440/1920 CSS-pixel screenshots at DPR 1 and 2, mobile/tablet crops, transfer sizes and layout stability. Do not substitute a different composition or synthesize artwork details.

Current source SHA-256:

- Website background: `db206ec9782ec991a5492259eeee1bae9257434d69198a93e06e1a135a69d3fd`
- Tournament key visual: `bfd7b6ef12654a7814c064a0bc2014b5250ce3f501991176977c3c9472dfab16`

## Organizer-supplied file check

On 2026-10-24 the organizer supplied `/Users/emik/Downloads/oclr-s11-key-visual-1.webp`. It measures **1672×941**, is **293892 bytes**, and has SHA-256 `bfd7b6ef12654a7814c064a0bc2014b5250ce3f501991176977c3c9472dfab16`. A direct byte comparison (`cmp`) confirms it is identical to `public/oclr-s11-key-visual.webp`. It is therefore already the shipped tournament artwork, not a higher-resolution replacement. Nearby `oclr-s11*` files contain only the previously checked exports.

No image was replaced, recompressed, upscaled or generated on this follow-up. #173 still requires a higher-resolution approved original to establish the requested sharpness improvement while preserving the artwork. The supplied key visual also has a different composition/aspect ratio from the text-free home background, so substituting it there would not preserve the current hero composition.

## Organizer-authorized enhancement export

On 2026-10-24 the organizer explicitly requested “進行超解析度處理製作一個更大的主視覺圖”. This authorizes a new enhancement candidate; the original artwork remains intact. The built-in `image_gen` editor produced two restoration candidates. Both actually returned **1672×941** PNGs despite requests for 3840×2160, including the attempt using an interpolated 4K input. The second candidate was visually checked for the existing composition, face, bow, logo and exact subtitle, and selected.

The selected AI-restored result was then enlarged with Lanczos3 to **3840×2161**, preserving its aspect ratio without cropping, and exported as:

| Artifact                                                |    Bytes | Purpose                                     |
| ------------------------------------------------------- | -------: | ------------------------------------------- |
| `output/imagegen/oclr-s11-key-visual-enhanced-3840.png` | 15907291 | Lossless master/export                      |
| `public/oclr-s11-key-visual-enhanced-3840.webp`         |  1142224 | Smaller WebP delivery candidate, quality 95 |

The exact prompts and observed output limits are recorded in `output/imagegen/oclr-s11-key-visual-enhancement-prompts.txt`. This is **AI detail restoration followed by interpolation**, not a native-4K super-resolution result or recovery of verifiable original detail. AI-estimated texture may differ from the original. Visual checks retain the composition, character, palette, “OCLR S11” and “OSU! CHINESE LEAGUE ROOKIE”; pixel identity is not claimed. Both exports decode at the stated dimensions. The original source hash remains unchanged.

This follow-up delivers the requested larger image as sibling artifacts. It does not change the selected website artwork, the text-free homepage background, branding configuration, responsive layout or production service. The application's #173 visual/performance acceptance remains open; this artifact-generation step does not establish that the deployed hero is sharper. No application code or dependency changed, so the application suite was not repeated for these exports.
