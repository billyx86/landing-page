import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const html = readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "index.html"),
  "utf8"
);

test("has a responsive viewport meta tag", () => {
  const m = html.match(/<meta[^>]*name=["']viewport["'][^>]*>/i);
  assert.ok(m, "no viewport meta tag found");
  assert.match(m[0], /width=device-width/i, "viewport is not width=device-width");
});

test("every <img> has a non-empty alt attribute", () => {
  const imgs = [...html.matchAll(/<img\b[^>]*>/gi)].map((m) => m[0]);
  assert.ok(imgs.length > 0, "expected the page to contain images");
  for (const [i, tag] of imgs.entries()) {
    const alt = tag.match(/\balt=["']([^"']*)["']/i);
    assert.ok(alt, `img #${i + 1} has no alt attribute: ${tag.slice(0, 60)}...`);
    assert.ok(
      alt[1].trim().length > 0,
      `img #${i + 1} has an empty alt: ${tag.slice(0, 60)}...`
    );
  }
});
