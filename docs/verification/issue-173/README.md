# Applied S11 enhancement (#173)

The organizer requested applying the enhanced poster on 2026-10-24. Existing editions keep the same whitelisted `/oclr-s11-key-visual.webp` branding value; `EventArtwork` now renders the approved enhancement through a native responsive picture. No database migration or operator settings change is needed. Source files remain intact. The separate text-free homepage background and directory thumbnail are unchanged.

The 3840×2161 master is the previously documented **AI restoration followed by interpolation**, not recovered native-4K original detail. This application step does not change that limitation.

| Width | Height |   Bytes | Encoding                 |
| ----: | -----: | ------: | ------------------------ |
|   640 |    360 |   76454 | WebP q90                 |
|   960 |    540 |  149372 | WebP q90                 |
|  1280 |    720 |  224838 | WebP q90                 |
|  1920 |   1081 |  375458 | WebP q90                 |
|  2560 |   1441 |  504320 | WebP q90                 |
|  3840 |   2161 | 1142224 | Existing WebP q95 master |

The browser chooses a static derivative using the existing stacked/55%-column geometry and DPR; no runtime image proxy, new dependency or image-quality configuration is required. `responsive-delivery.json` records measured request sizes at DPR 1/2/3. At 390px/DPR 3 it selected 1280px/224838 bytes (the original always delivered 293892 bytes). At 1280px/DPR 2 it selected 2560px/504320 bytes. At 1920px/DPR 2 it selected 1920px/375458 bytes. Browsers can reuse a larger already-cached candidate; the records include sequential viewport changes within each DPR context. Transfer bytes are file body lengths, not a network-performance score.

Screenshots use isolated synthetic edition data. The 1920px/DPR 2 before image routes the artwork requests to the original file while holding the tested layout constant; the after image loads the enhanced derivative. They compare artwork in the same layout and do not claim production deployment. The mobile capture uses Traditional Chinese/dark at 390px/DPR 3.

Validation: lint/types and production build passed; 96 unit/integration files passed (710 tests, 1 skipped); production dependency audit reports zero vulnerabilities. Artwork/MainSheet/season-overview browser checks passed 19 cases, with one intentionally skipped duplicate DPR-context case on the mobile project; the DPR 1/2/3 delivery case was additionally rerun to persist the measurement record. Coverage includes all three locales, light/dark, mobile/tablet/desktop widths, landmarks/crop, alt text, fallback, delayed loading/layout stability, and existing registration/publication boundaries. These local checks do not establish that a production release has been deployed.
