import sharp from "sharp"
import { promises as fs } from "node:fs"
import path from "node:path"

const src = path.resolve("public/images/logo-aran.png")
const out = path.resolve("public")

const sizes = [
  { name: "favicon-16x16.png", size: 16 },
  { name: "favicon-32x32.png", size: 32 },
  { name: "favicon-96x96.png", size: 96 },
  { name: "apple-touch-icon.png", size: 180 },
  { name: "web-app-manifest-192x192.png", size: 192 },
  { name: "web-app-manifest-512x512.png", size: 512 },
]

const input = await fs.readFile(src)
const { width, height } = await sharp(input).metadata()
console.log(`source: ${width}x${height}`)

for (const { name, size } of sizes) {
  const dest = path.join(out, name)
  await sharp(input)
    .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(dest)
  console.log(`wrote ${name}`)
}

// favicon.ico (multi-size)
const icoBuffers = await Promise.all(
  [16, 32, 48].map((s) =>
    sharp(input)
      .resize(s, s, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer(),
  ),
)
// sharp no soporta ico nativamente; usamos solo png 32x32 como favicon.ico
await fs.writeFile(path.join(out, "favicon.ico"), icoBuffers[1])
console.log("wrote favicon.ico (32x32 png)")

// favicon.svg: embebemos el png base64 en un svg simple
const png512 = await sharp(input)
  .resize(512, 512, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toBuffer()
const b64 = png512.toString("base64")
const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <image href="data:image/png;base64,${b64}" width="512" height="512"/>
</svg>
`
await fs.writeFile(path.join(out, "favicon.svg"), svg)
console.log("wrote favicon.svg")

console.log("done")
