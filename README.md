# OCLR — osu! Chinese League Rookie

Official community tournament website. OCLR is not affiliated with or endorsed by osu!.

## Local development

Use Node.js 24 LTS (minimum 22.13) and npm. Run `npm ci`, then `npm run dev` and open http://localhost:3000. Copy `.env.example` to `.env.local` when configuration is needed; never commit secrets.

One Next.js App Router application uses strict TypeScript, React and Tailwind CSS. Shared tokens and responsive patterns live in `src/app/globals.css`. Public content requires no external services. Unimplemented destinations explicitly report availability and expose no private data.

## Checks and hosting

`npm run check` runs ESLint, generated route types and TypeScript. `npm run build` creates the production build; `npm start` serves it on a conventional Node.js host. CI runs the same checks. No Vercel services are required.

## Design and content

The committed `docs/design/oclr-website-concept.webp` is a visual reference only. Its dates, statistics, format, identities and expanded tournament name are placeholders. The correct name is **osu! Chinese League Rookie**. Registration is individual; teams are formed through the staff-appointed captain draft.
