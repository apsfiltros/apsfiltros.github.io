#!/usr/bin/env node
// Re-encodes product photos into web-optimized JPEG+WebP pairs at two
// sizes — gallery thumbnail and lightbox — and archives the untouched
// originals under img/original/. Only downscales, never enlarges.
//
// Run after adding or replacing a source photo in img/:
//   npm install   (first time only — installs sharp, a dev-only tool)
//   node optimize-images.mjs

import sharp from "sharp";
import { mkdirSync, copyFileSync, existsSync } from "node:fs";
import { join, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const ROOT = dirname(fileURLToPath(import.meta.url));
const IMG_DIR = join(ROOT, "img");
const ORIGINAL_DIR = join(IMG_DIR, "original");

const SOURCES = [
  "foto01.jpg",
  "foto02.jpg",
  "foto03.jpg",
  "foto04.jpg",
  "foto05.jpg",
  "foto06.jpg",
  "foto07.jpg",
  "fita_dupla_face1.jpg",
  "fita_dupla_face2.jpg",
  "fita_dupla_face3.jpg",
];

const SIZES = [
  { suffix: "_small", maxWidth: 560, jpegQuality: 78, webpQuality: 80 },
  { suffix: "", maxWidth: 1600, jpegQuality: 82, webpQuality: 82 },
];

mkdirSync(ORIGINAL_DIR, { recursive: true });

for (const file of SOURCES) {
  const srcPath = join(IMG_DIR, file);
  const archivePath = join(ORIGINAL_DIR, file);

  if (!existsSync(archivePath)) {
    if (!existsSync(srcPath)) {
      console.warn(`! missing source: ${file}`);
      continue;
    }
    // First run: archive the untouched original before anything
    // overwrites it. Later runs read from the archive, so re-running
    // this script never re-compresses an already-optimized file.
    copyFileSync(srcPath, archivePath);
  }

  const name = basename(file, ".jpg");

  for (const size of SIZES) {
    const outJpeg = join(IMG_DIR, `${name}${size.suffix}.jpg`);
    const outWebp = join(IMG_DIR, `${name}${size.suffix}.webp`);

    const info = await sharp(archivePath)
      .resize({ width: size.maxWidth, withoutEnlargement: true })
      .jpeg({ quality: size.jpegQuality, progressive: true, mozjpeg: true })
      .toFile(outJpeg);

    await sharp(archivePath)
      .resize({ width: size.maxWidth, withoutEnlargement: true })
      .webp({ quality: size.webpQuality, effort: 6 })
      .toFile(outWebp);

    console.log(`  ${name}${size.suffix}: ${info.width}x${info.height}px`);
  }
}

console.log("\nDone. Untouched originals are in img/original/.");
