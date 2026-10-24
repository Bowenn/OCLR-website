// Offline CSS specimen/provenance checks. No application server or database.
import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import sharp from "sharp";
import postcss from "postcss";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { resolve, extname, join } from "node:path";
const root = fileURLToPath(new URL(".", import.meta.url));
const manifest = JSON.parse(
  await readFile(join(root, "manifest.json"), "utf8"),
);
const hash = (value) => createHash("sha256").update(value).digest("hex");
const evidence = [];
for (const [batch, source] of Object.entries(manifest.sources)) {
  const input = await readFile(join(root, `sources/batch-${batch}.html`));
  if (input.length !== source.bytes || hash(input) !== source.sha256)
    throw new Error("Source snapshot mismatch");
}
for (const style of manifest.styles) {
  const input = await readFile(
    join(root, `sources/batch-${style.batch}.html`),
    "utf8",
  );
  const css = input.match(/<style>([\s\S]*?)<\/style>/)[1];
  const prefix = new RegExp("^\\." + style.code + "(?=[\\s.{:#])");
  const expected = css
    .split(/(?<=\n)/)
    .filter((line) => prefix.test(line))
    .join("");
  const extracted = await readFile(
    join(root, style.slug, "source.css"),
    "utf8",
  );
  if (expected !== extracted || hash(extracted) !== style.sourceSha256)
    throw new Error(`${style.slug}: extraction changed`);
  postcss.parse(extracted);
  const candidate = await readFile(
    join(root, style.slug, "mainsheet.example.css"),
    "utf8",
  );
  postcss.parse(candidate);
  if (/@import|@font-face|https?:\/\//.test(candidate))
    throw new Error("Unexpected external asset in candidate CSS");
  evidence.push({
    style: style.slug,
    sourceHash: hash(extracted),
    exactExtraction: true,
    candidateCssParsed: true,
  });
}
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(
      new URL(request.url, "http://localhost").pathname,
    );
    const file = resolve(root, "." + pathname);
    if (!file.startsWith(root)) {
      response.writeHead(404).end();
      return;
    }
    const body = await readFile(file);
    const type =
      {
        ".html": "text/html",
        ".js": "text/javascript",
        ".css": "text/css",
        ".webp": "image/webp",
      }[extname(file)] || "application/octet-stream";
    response.writeHead(200, { "Content-Type": type });
    response.end(body);
  } catch {
    response.writeHead(404).end();
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}/`;
let browser;
const errors = [];
const cases = [];
const fallbacks = [];
try {
  browser = await chromium.launch({ channel: "chrome", headless: true });
  for (const style of manifest.styles) {
    const context = await browser.newContext({ reducedMotion: "reduce" });
    const page = await context.newPage();
    page.on("pageerror", (error) =>
      errors.push(`${style.slug}: ${error.message}`),
    );
    page.on("requestfailed", (request) =>
      errors.push(`${style.slug}: request failed ${request.url()}`),
    );
    page.on("request", (request) => {
      if (!request.url().startsWith(base))
        errors.push(`${style.slug}: unexpected network ${request.url()}`);
    });
    for (const mode of ["light", "dark"]) {
      for (const width of [320, 390, 768, 1440]) {
        await page.setViewportSize({ width, height: width < 800 ? 844 : 1000 });
        await page.goto(`${base}${style.slug}/preview.html?theme=${mode}`);
        await page
          .getByRole("button", {
            name: mode === "light" ? "Dark" : "Light",
            exact: true,
          })
          .click();
        await page
          .getByRole("button", {
            name: mode === "light" ? "Light" : "Dark",
            exact: true,
          })
          .click();
        const state = await page.evaluate(() => ({
          overflow: document.documentElement.scrollWidth > innerWidth,
          theme: document.documentElement.dataset.theme,
          cookies: document.cookie,
          local: localStorage.length,
          session: sessionStorage.length,
        }));
        if (
          state.overflow ||
          state.theme !== mode ||
          state.cookies ||
          state.local ||
          state.session
        )
          throw new Error(
            `${style.slug}/${mode}/${width}: ${JSON.stringify(state)}`,
          );
        await page.getByRole("button", { name: "HR", exact: true }).click();
        if ((await page.locator(".map-slot-badge").textContent()) !== "HR2")
          throw new Error("Mod control failed");
        await page
          .getByRole("button", { name: "Preview primary", exact: true })
          .click();
        if (
          !(await page.locator("output").textContent()).includes(
            "Nothing was saved",
          )
        )
          throw new Error("Local-only action failed");
        const field = page.getByRole("textbox", {
          name: "Sample name",
          exact: true,
        });
        await field.fill("Long sample label / 範例文字");
        await page
          .getByRole("button", { name: "Preview form", exact: true })
          .click();
        await page.getByRole("button", { name: "Reset", exact: true }).click();
        if ((await field.inputValue()) !== "OCLR component specimen")
          throw new Error("Form reset failed");
        await page.getByRole("button", { name: "Light", exact: true }).focus();
        await page.keyboard.press("Tab");
        const focus = await page.evaluate(() => ({
          visible: document.activeElement.matches(":focus-visible"),
          outline: getComputedStyle(document.activeElement).outlineWidth,
        }));
        if (!focus.visible || parseFloat(focus.outline) < 3)
          throw new Error(`Invisible keyboard focus ${JSON.stringify(focus)}`);
        const axe = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze();
        if (axe.violations.length)
          errors.push(
            `${style.slug}/${mode}/${width}: ${JSON.stringify(axe.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })))}`,
          );
        if (width === 1440 || width === 390) {
          const shot = await page.screenshot({ fullPage: true });
          await sharp(shot)
            .webp({ quality: 88 })
            .toFile(
              join(
                root,
                style.slug,
                `${width === 1440 ? "desktop" : "mobile"}-${mode}.webp`,
              ),
            );
        }
        cases.push({
          style: style.slug,
          mode,
          width,
          overflow: false,
          localControls: "passed",
          keyboardFocus: "passed",
          axeViolations: axe.violations.length,
        });
      }
    }
    await page.setViewportSize({ width: 320, height: 844 });
    await page.emulateMedia({ forcedColors: "active" });
    const forced = await page.evaluate(() => ({
      enabled: matchMedia("(forced-colors: active)").matches,
      overflow: document.documentElement.scrollWidth > innerWidth,
      shadow: getComputedStyle(document.querySelector(".season-overview-hero"))
        .boxShadow,
    }));
    if (!forced.enabled || forced.overflow || forced.shadow !== "none")
      throw new Error("Forced colors fallback failed");
    fallbacks.push({ style: style.slug, forcedColors: "passed" });
    if (style.slug === "glassmorphism") {
      await page.emulateMedia({ forcedColors: "none" });
      const cdp = await context.newCDPSession(page);
      await cdp.send("Emulation.setEmulatedMedia", {
        features: [{ name: "prefers-reduced-transparency", value: "reduce" }],
      });
      const glass = await page.evaluate(() => ({
        reduced: matchMedia("(prefers-reduced-transparency: reduce)").matches,
        blur: getComputedStyle(document.querySelector(".season-overview-hero"))
          .backdropFilter,
        background: getComputedStyle(
          document.querySelector(".season-overview-hero"),
        ).backgroundColor,
      }));
      if (
        !glass.reduced ||
        glass.blur !== "none" ||
        glass.background !== "rgb(48, 41, 60)"
      )
        throw new Error(`Glass fallback failed ${JSON.stringify(glass)}`);
      fallbacks.push({
        style: style.slug,
        reducedTransparency: "passed",
        ...glass,
      });
    }
    await context.close();
  }
} finally {
  if (browser) await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
const result = {
  date: "2026-10-24",
  scope:
    "Offline CSS specimens/provenance only; not production appearance integration",
  browser: "Headless Google Chrome",
  evidence,
  cases,
  fallbacks,
  errors,
};
await writeFile(
  join(root, "verification.json"),
  JSON.stringify(result, null, 2) + "\n",
);
for (const style of manifest.styles) {
  await writeFile(
    join(root, style.slug, "verification.json"),
    JSON.stringify(
      {
        ...result,
        evidence: evidence.filter((e) => e.style === style.slug),
        cases: cases.filter((c) => c.style === style.slug),
        fallbacks: fallbacks.filter((f) => f.style === style.slug),
        errors: errors.filter(
          (e) =>
            e.startsWith(style.slug + ":") || e.startsWith(style.slug + "/"),
        ),
      },
      null,
      2,
    ) + "\n",
  );
}
console.log(
  JSON.stringify(
    {
      sourceExtractions: evidence.length,
      cases: cases.length,
      axeScans: cases.length,
      fallbacks: fallbacks.length,
      errors,
    },
    null,
    2,
  ),
);
if (errors.length) process.exitCode = 1;
