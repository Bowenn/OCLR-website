# Original S9 and S8 thumbnails (#168)

Both organizer-selected Landing banners retain their entire 1920×1080 composition. No spreadsheet UI, selection outline, cropping, stretching or generated artwork is included. The existing directory thumbnail container centers the complete landscape image inside its square area; S10 and S11 remain square.

## S9

- [Organizer's workbook, Landing](https://docs.google.com/spreadsheets/d/11PwNlEsUFb6f3VCY2-sdGlPysP0ukihN8_lE4DGuzfA/edit?gid=164099060).
- Extracted unchanged from the previously captured public XLSX: Landing's C3 anchor → `xl/drawings/drawing1.xml` → `rId1` → `xl/media/image17.png`.
- Asset: `public/archive/s9/thumbnail.png`, 1920×1080, 2,571,904 bytes.
- SHA-256: `302d9c35de6f112b4a2c335dfc3fdccb408ea5fc7e7110f3769a057ff84dabc4`.

## S8

- [Organizer's workbook, Landing](https://docs.google.com/spreadsheets/d/16ASDCD95p3TgfjgSHCjXmRN3KJuuAD4KS0fImpcTiiM/edit?gid=164099060).
- Landing!C3 uses `IMAGE("https://i.imgur.com/Ni9DVcW.jpg")`, which is not embedded in the XLSX. Direct retrieval returned HTTP 429. The public Google Sheets PDF export of this Landing tab includes the full banner as its first image, `Image4.jpg`.
- Extracted the JPEG image stream from the PDF without rendering, cropping or re-encoding. Visually matched the organizer's screenshot, including the complete border, title and `2023 spring` caption.
- Asset: `public/archive/s8/thumbnail.jpg`, 1920×1080, 443,916 bytes. This is the Google export's embedded image; byte identity with the unavailable Imgur response is not asserted.
- Asset SHA-256: `d9cb5112ed5a859c2151b1aca014e5ef1166c072481008b7c9bc5cce48bf5cb5`.
- PDF export SHA-256, captured 2026-10-24: `42be8d8466a70fdb6b7d957852beafeae4623cf699d09fd123eed74d8aa4c97a`.

Source workbooks/PDF are intermediate extraction evidence and are not shipped. Their other application and unrelated content is not imported.

## Deployment and application

Deploy the new fixed branding-path allowlist before selecting the assets. No migration or automatic production configuration update is performed. After organizer deployment confirmation, use computer use in each edition's General settings to select its corresponding **OCLR Season 9 / 8 — Square logo**, save, reload and check the public directory at desktop/mobile sizes and in light/dark themes. Background and key visual selections remain unchanged. Clearing the logo continues to use the existing fallback.

Rollback must keep support for the stored asset path, or clear these choices through the Admin UI before reverting to a build whose schema cannot parse them. Preserve archive content, revision checks, transactional audit and publication state.
