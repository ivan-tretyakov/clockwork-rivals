import { mkdir, cp, readdir, writeFile, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import sharp from "sharp";
const target = "apps/web/public/assets";
await mkdir("apps/web/src", { recursive: true });
await mkdir(`${target}/clockwork-rivals`, { recursive: true });
await cp("assets/ui", `${target}/ui`, { recursive: true });
for (const file of await readdir("assets/clockwork-rivals")) {
  if (file.endsWith(".png"))
    await sharp(`assets/clockwork-rivals/${file}`)
      .resize(640, 640, { fit: "inside" })
      .webp({ quality: 84 })
      .toFile(`${target}/clockwork-rivals/${file.replace(".png", ".webp")}`);
  else if (file.endsWith(".svg"))
    await cp(
      `assets/clockwork-rivals/${file}`,
      `${target}/clockwork-rivals/${file}`,
    );
}
const files = await readdir(`${target}/clockwork-rivals`);
await writeFile(
  "apps/web/src/art-manifest.json",
  JSON.stringify(
    files.filter((f) => f.endsWith(".webp")).map((f) => f.replace(".webp", "")),
    null,
    2,
  ),
);
const manifest = JSON.parse(await readFile("assets/manifest.json", "utf8"));
for (const file of await readdir("assets/clockwork-rivals")) {
  if (!file.endsWith(".png")) continue;
  const path = `assets/clockwork-rivals/${file}`;
  if (manifest.assets.some((a) => a.path === path)) continue;
  const bytes = await readFile(path);
  const meta = await sharp(bytes).metadata();
  manifest.assets.push({
    id: `clockwork-rivals/${file.replace(".png", "")}`,
    path,
    bytes: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    width: meta.width,
    height: meta.height,
    kind: "generated-illustration",
    alpha: "opaque",
    usage:
      "Clockwork prototype machine illustration; preserve source, render text separately",
  });
}
await writeFile(
  "assets/manifest.json",
  JSON.stringify(manifest, null, 2) + "\n",
);
console.log("Prepared optimized local artwork. Source images preserved.");
