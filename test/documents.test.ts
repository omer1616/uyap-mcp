import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, mkdir, symlink, rm, realpath } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, sep } from "node:path";

import { sanitizeComponent, isRealDocument, extensionFor, containedPath } from "../src/services/documents.js";

function bytes(signature: number[], rest = "rest"): Uint8Array {
  return Uint8Array.from([...signature, ...Buffer.from(rest, "ascii")]);
}

test("sanitizeComponent yol bileşenlerini engeller", () => {
  assert.equal(sanitizeComponent("2025/90 Bursa:18"), "2025.90 Bursa_18");
  assert.equal(sanitizeComponent(".."), "x");
  assert.equal(sanitizeComponent(""), "x");
});

test("belge imzaları tanınır", () => {
  const cases: [number[], string][] = [
    [[0x25, 0x50, 0x44, 0x46], ".pdf"],
    [[0x49, 0x49, 0x2a, 0x00], ".tif"],
    [[0x4d, 0x4d, 0x00, 0x2a], ".tif"],
    [[0xff, 0xd8, 0xff], ".jpg"],
    [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], ".png"],
  ];
  for (const [signature, extension] of cases) {
    const data = bytes(signature);
    assert.equal(isRealDocument(data), true);
    assert.equal(extensionFor(data), extension);
  }
});

test("html ve bozuk tiff yakın eşleşmeleri belge sayılmaz", () => {
  const samples = [
    Buffer.from("<html>oturum hatasi</html>", "ascii"),
    Buffer.from("II-invalid", "ascii"),
    Buffer.from("MM-invalid", "ascii"),
  ];
  for (const data of samples) {
    assert.equal(isRealDocument(data), false);
    assert.throws(() => extensionFor(data));
  }
});

test("sanitizeComponent Windows'un ayırdığı adları işler", () => {
  assert.equal(sanitizeComponent("CON"), "_CON");
  assert.equal(sanitizeComponent("aux.txt"), "_aux.txt");
  assert.equal(sanitizeComponent("ad. "), "ad");
  assert.equal(sanitizeComponent("a\x00b"), "a_b");
});

test("containedPath kök dizinin altında kalır", async () => {
  const root = await mkdtemp(join(tmpdir(), "uyap-contained-"));
  try {
    const target = containedPath(root, "2025/90", "belge.pdf");
    const realRoot = await realpath(root);
    assert.ok(target.startsWith(realRoot + sep));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("containedPath symlink ile kaçışı reddeder", async () => {
  const base = await mkdtemp(join(tmpdir(), "uyap-symlink-"));
  try {
    const root = join(base, "root");
    const outside = join(base, "outside");
    await mkdir(root);
    await mkdir(outside);
    await symlink(outside, join(root, "baglanti"), "dir");

    assert.throws(() => containedPath(root, "baglanti", "belge.pdf"));
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});
