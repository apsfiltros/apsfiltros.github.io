#!/usr/bin/env node
// Turns the full-resolution product photos in img/original/ into the
// web-optimized files the site uses, as JPEG + WebP pairs at two sizes:
//
//   img/<name>_small.{jpg,webp}   gallery thumbnail, max 560px wide
//   img/<name>.{jpg,webp}         lightbox, max 1600px wide
//
// img/original/ is the source of truth — never edit or replace the files in
// img/ directly, they're overwritten here. To add or replace a photo:
//   1. put the full-size JPEG in img/original/ (e.g. img/original/foto08.jpg)
//   2. npm install            (first time only — installs sharp, dev-only)
//   3. npm run optimize-images
//   4. list it in src/galleries.json, add its alt text to every lang/*.json
//      under "gallery", then run node build.mjs

import sharp from "sharp";
import { readdirSync } from "node:fs";
import { join, basename, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));
const IMG_DIR = join(ROOT, "img");
const ORIGINAL_DIR = join(IMG_DIR, "original");

const SIZES = [
  { suffix: "_small", maxWidth: 560, jpegQuality: 78, webpQuality: 80 },
  { suffix: "", maxWidth: 1600, jpegQuality: 82, webpQuality: 82 },
];

const sources = readdirSync(ORIGINAL_DIR).filter((f) => /\.jpe?g$/i.test(f)).sort();

for (const file of sources) {
  const name = basename(file).replace(/\.jpe?g$/i, "");

  // .rotate() with no args applies the EXIF Orientation tag before resizing
  // (phone photos are often stored sideways with a tag saying so — the
  // fita_dupla_face photos all are) and then drops it. Output files carry no
  // metadata, so no GPS location or camera details leave img/original/.
  const source = sharp(join(ORIGINAL_DIR, file)).rotate();

  for (const size of SIZES) {
    const resized = source.clone().resize({ width: size.maxWidth, withoutEnlargement: true });
    const [info] = await Promise.all([
      resized
        .clone()
        .jpeg({ quality: size.jpegQuality, progressive: true, mozjpeg: true })
        .toFile(join(IMG_DIR, `${name}${size.suffix}.jpg`)),
      // effort 6 (default 4): smaller files; at 4 some WebPs came out larger
      // than the JPEG they replace
      resized
        .clone()
        .webp({ quality: size.webpQuality, effort: 6 })
        .toFile(join(IMG_DIR, `${name}${size.suffix}.webp`)),
    ]);
    console.log(`  ${name}${size.suffix}: ${info.width}x${info.height}px`);
  }
}

console.log(`\nDone: ${sources.length} photos from img/original/.`);
