import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
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

test("every <img> has explicit width and height (no layout shift)", () => {
  const imgs = [...html.matchAll(/<img\b[^>]*>/gi)].map((m) => m[0]);
  assert.ok(imgs.length > 0, "expected the page to contain images");
  for (const [i, tag] of imgs.entries()) {
    const alt = tag.match(/\balt=["']([^"']*)["']/i)?.[1] ?? `#${i + 1}`;
    const w = tag.match(/\bwidth=["'](\d+)["']/i);
    const h = tag.match(/\bheight=["'](\d+)["']/i);
    assert.ok(w, `img "${alt}" has no width attribute: ${tag.slice(0, 60)}...`);
    assert.ok(h, `img "${alt}" has no height attribute: ${tag.slice(0, 60)}...`);
    assert.ok(Number(w[1]) > 0 && Number(h[1]) > 0, `img "${alt}" has a zero width/height`);
  }
});

test("info-box images are lazy-loaded and the hero image is not (LCP)", () => {
  const lazy = [...html.matchAll(/<img\b[^>]*\bloading=["']lazy["'][^>]*>/gi)].map((m) => m[0]);
  assert.equal(lazy.length, 4, `expected the four info-box images to use loading="lazy", found ${lazy.length}`);
  const hero = html.match(/<img\b[^>]*class=["']hero-img["'][^>]*>/i) ?? html.match(/<img\b[^>]*hero[^>]*>/i);
  assert.ok(hero, "hero image not found");
  assert.doesNotMatch(hero[0], /loading=["']lazy["']/i, "the hero is the LCP element — it must not be lazy-loaded");
});

test("every local image referenced in the HTML exists in the repo", () => {
  const srcs = [...html.matchAll(/<img\b[^>]*\bsrc=["']([^"']+)["']/gi)].map((m) => m[1]);
  const local = srcs.filter((s) => !/^(?:https?:)?\/\//i.test(s) && !s.startsWith("data:"));
  assert.ok(local.length > 0, "expected at least one self-hosted (local) image");
  const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
  for (const src of local) {
    assert.ok(
      existsSync(path.join(root, src)),
      `index.html references local image "${src}" but the file does not exist`
    );
  }
});

test("exactly one <h1> on the page (heading order stays sane for screen readers)", () => {
  const h1s = html.match(/<h1\b/gi) ?? [];
  assert.equal(h1s.length, 1, `expected exactly one <h1>, found ${h1s.length} — everything after the hero is a sub-section and should be <h2>`);
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
