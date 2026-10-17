import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import process from "node:process";

const require = createRequire(import.meta.url);
const cacache = require("C:/Program Files/nodejs/node_modules/npm/node_modules/cacache");
const tar = require("C:/Program Files/nodejs/node_modules/npm/node_modules/tar");
const prefix = "make-fetch-happen:request-cache:";
const source = `${process.env.LOCALAPPDATA}/npm-cache/_cacache`;
const target = `${process.cwd()}/.npm-cache/_cacache`;

const packageName = (raw) => {
  const path = decodeURIComponent(new URL(raw).pathname.slice(1));
  return path.startsWith("@") ? path.split("/").slice(0, 2).join("/") : path.split("/")[0];
};

const belongs = (key, name) => {
  if (!key.startsWith(prefix)) return false;
  const path = decodeURIComponent(new URL(key.slice(prefix.length)).pathname.slice(1));
  return path === name || path.startsWith(`${name}/-/`);
};

const manifestFromTar = (data) => new Promise((resolve, reject) => {
  let json = "";
  const parser = new tar.Parser({ onReadEntry(entry) {
    if (entry.path === "package/package.json" || entry.path.endsWith("/package.json")) entry.on("data", (chunk) => { json += chunk; });
    else entry.resume();
  }});
  parser.on("error", reject);
  parser.on("end", () => { try { resolve(JSON.parse(json)); } catch (error) { reject(error); } });
  parser.end(data);
});

async function copy(name, requestedUrl) {
  const tarballs = [];
  let metadataFound = false;
  let count = 0;
  for await (const entry of cacache.ls.stream(source)) {
    if (!belongs(entry.key, name)) continue;
    const item = await cacache.get(source, entry.key);
    const isTarball = entry.key.includes("/-/");
    if (isTarball) tarballs.push({ url: entry.key.slice(prefix.length), data: item.data, integrity: entry.integrity });
    else metadataFound = true;
    const metadata = { ...item.metadata, time: Date.now(), reqHeaders: isTarball ? {} : { accept: "application/json" }, resHeaders: { ...item.metadata?.resHeaders, "cache-control": "public,max-age=31557600", ...(isTarball ? {} : { "content-type": "application/json" }) } };
    await cacache.rm.entry(target, entry.key);
    await cacache.put(target, entry.key, item.data, { metadata });
    count += 1;
  }
  if (tarballs.length) {
    const versions = {};
    for (const item of tarballs) {
      const manifest = await manifestFromTar(item.data);
      versions[manifest.version] = { ...manifest, dist: { ...(manifest.dist || {}), tarball: item.url, integrity: item.integrity } };
    }
    const url = requestedUrl.includes("/-/") ? `https://registry.npmjs.org/${name.replace("/", "%2f")}` : requestedUrl;
    const versionsList = Object.keys(versions);
    await cacache.put(target, `${prefix}${url}`, JSON.stringify({ name, "dist-tags": { latest: versionsList.at(-1) }, versions }), { metadata: { time: Date.now(), url, reqHeaders: { accept: "application/json" }, resHeaders: { "cache-control": "public,max-age=31557600", "content-type": "application/json" } } });
    count += 1;
  }
  return count;
}

for (let attempt = 1; attempt <= 200; attempt += 1) {
  const result = spawnSync("npm.cmd", ["install", "--offline", "--cache", ".npm-cache", "--no-audit", "--no-fund"], { encoding: "utf8", shell: true });
  if (result.status === 0) { process.stdout.write(result.stdout); console.log("Instalación completa."); process.exit(0); }
  const output = `${result.stdout}\n${result.stderr}`;
  const match = output.match(/request to (https:\/\/registry\.npmjs\.org\/[^ ]+) failed/);
  if (!match) { process.stderr.write(output); process.exit(result.status || 1); }
  const name = packageName(match[1]);
  const count = await copy(name, match[1]);
  console.log(`[${attempt}] ${name}: ${count}`);
  if (!count) { console.error(`No disponible en caché: ${name}`); process.exit(1); }
}
