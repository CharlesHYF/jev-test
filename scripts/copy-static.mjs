import { copyFile, cp, mkdir } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const publicDir = new URL("dist/public/", root);
await mkdir(publicDir, { recursive: true });
await copyFile(new URL("apps/web/index.html", root), new URL("index.html", publicDir));
await copyFile(new URL("apps/web/styles.css", root), new URL("styles.css", publicDir));

await cp(new URL("apps/web/assets/", root), new URL("assets/", publicDir), { recursive: true });
