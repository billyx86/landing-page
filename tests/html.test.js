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

test("the two Sign up controls are real links with real destinations (no dead buttons)", () => {
  const deadButtons = [...html.matchAll(/<button\b[^>]*>\s*Sign up\s*<\/button>/gi)].length;
  assert.equal(deadButtons, 0, `expected no dead <button>Sign up</button> elements, found ${deadButtons}`);

  // Scope to the hero and CTA sections — the two places that used to
  // contain the dead <button>Sign up</button> elements. (The header nav
  // may legitimately carry its own Sign up link; the nav test covers it.)
  const hero = html.match(/<main\b[^>]*>[\s\S]*?<\/main>/i)?.[0] ?? "";
  const cta = html.match(/<div class="cta"[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/i)?.[0] ?? html.match(/id="cta"[\s\S]*?Sign up[\s\S]*?<\/a>/i)?.[0] ?? "";
  const signupAnchors = [...hero.matchAll(/<a\b[^>]*>\s*Sign up\s*<\/a>/gi)]
    .concat([...cta.matchAll(/<a\b[^>]*>\s*Sign up\s*<\/a>/gi)])
    .map((m) => m[0]);
  assert.equal(signupAnchors.length, 2, `expected exactly two Sign up anchors in the hero and CTA, found ${signupAnchors.length}`);

  for (const [i, tag] of signupAnchors.entries()) {
    const href = tag.match(/\bhref=["']([^"']+)["']/i);
    assert.ok(href, `sign-up anchor #${i + 1} has no href: ${tag.slice(0, 60)}...`);
    assert.notEqual(href[1], "#", `sign-up anchor #${i + 1} is still a placeholder href="#"`);
    // In-page anchors must point at a real id; external links must be safe.
    if (href[1].startsWith("#")) {
      const id = href[1].slice(1);
      assert.ok(new RegExp(`\\bid=["']${id}["']`).test(html), `sign-up anchor #${i + 1} points at missing id "${id}"`);
    } else if (href[1].startsWith("http")) {
      assert.match(tag, /\btarget=["']_blank["']/i, `external sign-up anchor #${i + 1} lacks target="_blank"`);
      assert.match(tag, /\brel=["'][^"']*\bnoopener\b[^"']*["']/i, `external sign-up anchor #${i + 1} lacks rel="noopener"`);
    }
  }
});

test("header nav links are not placeholders and resolve to real destinations", () => {
  const header = html.match(/<header\b[^>]*>[\s\S]*?<\/header>/i);
  assert.ok(header, "no <header> element found");
  const links = [...header[0].matchAll(/<a\b[^>]*>[^<]*<\/a>/gi)].map((m) => m[0]);
  assert.ok(links.length > 0, "expected nav links inside <header>");
  for (const [i, tag] of links.entries()) {
    const text = tag.replace(/<[^>]+>/g, "").trim();
    assert.ok(
      !/^header link/i.test(text),
      `nav link #${i + 1} still has placeholder text: "${text}"`
    );
    const href = tag.match(/\bhref=["']([^"']+)["']/i);
    assert.ok(href, `nav link #${i + 1} has no href: ${tag.slice(0, 60)}...`);
    if (href[1] === "#" || href[1] === "") {
      assert.fail(`nav link #${i + 1} ("${text}") is still a placeholder href="#"`);
    }
    if (href[1].startsWith("#")) {
      const id = href[1].slice(1);
      assert.ok(
        new RegExp(`\\bid=["']${id}["']`).test(html),
        `nav link #${i + 1} ("${text}") points at missing id "${id}"`
      );
    } else if (href[1].startsWith("http")) {
      assert.match(tag, /\btarget=["']_blank["']/i, `external nav link #${i + 1} lacks target="_blank"`);
      assert.match(tag, /\brel=["'][^"']*\bnoopener\b[^"']*["']/i, `external nav link #${i + 1} lacks rel="noopener"`);
    }
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
