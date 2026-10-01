import { readFileSync, writeFileSync } from "node:fs";
import { TTFLoader } from "three-stdlib";

// The source TTF and OFL license are vendored; rebuilding never needs a CDN.
const source = readFileSync("public/assets/fonts/GreatVibes-Regular.ttf");
const font = new TTFLoader().parse(
  source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength),
);
for (const [character, glyph] of Object.entries(font.glyphs)) {
  if (character.codePointAt(0)! > 383) {
    delete font.glyphs[character];
    continue;
  }
  if (!Number.isFinite(glyph.x_min)) glyph.x_min = 0;
  if (!Number.isFinite(glyph.x_max)) glyph.x_max = 0;
  if (!Number.isFinite(glyph.ha)) glyph.ha = 0;
}
// TTFLoader returns translated metadata; FontLoader expects plain strings.
font.original_font_information = Object.fromEntries(
  Object.entries(font.original_font_information).map(([key, value]) => [
    key,
    typeof value === "object" && value !== null
      ? ((value as { en?: string }).en ?? JSON.stringify(value))
      : String(value),
  ]),
);
writeFileSync(
  "src/studio/assets/great-vibes.typeface.json",
  JSON.stringify(font),
);
console.log(
  "Built the local Great Vibes 3D typeface (Latin character subset).",
);
