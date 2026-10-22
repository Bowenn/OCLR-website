/** Extract explicit UI calls and service errors; never harvest organizer content. */
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

export function sourceMessages() {
  const messages = new Set<string>();
  for (const name of readdirSync(resolve("src"), {
    recursive: true,
  }) as string[]) {
    if (!/\.tsx?$/.test(name)) continue;
    const file = ts.createSourceFile(
      name,
      readFileSync(resolve("src", name), "utf8"),
      ts.ScriptTarget.Latest,
      true,
      name.endsWith("tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );
    const walk = (node: ts.Node) => {
      let value: ts.Node | undefined;
      if (ts.isCallExpression(node) && node.expression.getText(file) === "tr")
        value = node.arguments[0];
      if (
        ts.isNewExpression(node) &&
        ["HttpError", "ApplicationFieldError"].includes(
          node.expression.getText(file),
        )
      )
        value = node.arguments?.[1];
      if (value && ts.isStringLiteral(value)) messages.add(value.text);
      ts.forEachChild(node, walk);
    };
    walk(file);
  }
  return messages;
}
export function extract() {
  const catalogs = ["en", "zh-Hans", "zh-Hant"].map((locale) => ({
    locale,
    data: JSON.parse(readFileSync(`messages/${locale}.json`, "utf8")) as {
      ui: Record<string, string>;
    },
  }));
  for (const message of sourceMessages()) {
    if (Object.hasOwn(catalogs[0].data.ui, message)) continue;
    const key = `m${createHash("sha256").update(message).digest("hex").slice(0, 12)}`;
    if (catalogs[0].data.ui[key] && catalogs[0].data.ui[key] !== message)
      throw new Error("Translation key collision.");
    catalogs[0].data.ui[key] = message;
  }
  for (const { locale, data } of catalogs) {
    for (const key of Object.keys(catalogs[0].data.ui))
      if (!(key in data.ui)) data.ui[key] = "";
    writeFileSync(
      `messages/${locale}.json`,
      `${JSON.stringify(data, null, 2)}\n`,
    );
  }
  console.log(
    "Catalogs synchronized. Fill new empty translations, then run npm run test:i18n.",
  );
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  extract();
