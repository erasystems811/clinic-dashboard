const { spawnSync } = require("child_process");
const path = require("path");
const fs   = require("fs");

const ROOT = __dirname;
const raw  = (process.env.RAILWAY_SERVICE_NAME || "").trim();
const name = raw.toLowerCase().replace(/[\s_]+/g, "-");

// Print environment so we can diagnose any path issues
console.log("[ERA] __dirname   :", ROOT);
console.log("[ERA] CWD         :", process.cwd());
console.log("[ERA] SERVICE_NAME:", raw, "→", name);

const MAP = {
  "demo":            path.join(ROOT, "artifacts/demo/server.cjs"),
  "era-demo":        path.join(ROOT, "artifacts/demo/server.cjs"),
  "era-patient":     path.join(ROOT, "artifacts/era-patient/server.cjs"),
  "era-super-admin": path.join(ROOT, "artifacts/era-super-admin/server.cjs"),
  "super-admin":     path.join(ROOT, "artifacts/era-super-admin/server.cjs"),
  "api-server":      path.join(ROOT, "artifacts/api-server/dist/index.mjs"),
  "api":             path.join(ROOT, "artifacts/api-server/dist/index.mjs"),
  "era-me":          path.join(ROOT, "artifacts/era-me/server.cjs"),
};

let target = MAP[name];

if (!target) {
  for (const [key, val] of Object.entries(MAP)) {
    if (name.includes(key) || key.includes(name)) { target = val; break; }
  }
}

if (!target && process.env.SERVICE_CMD) {
  const parts = process.env.SERVICE_CMD.split(" ");
  target = parts.length > 1 ? path.join(ROOT, parts[parts.length - 1]) : parts[0];
}

if (!target) {
  console.error("[ERA] ERROR: Unknown service name:", JSON.stringify(raw));
  console.error("[ERA] Known names:", Object.keys(MAP).join(", "));
  console.error("[ERA] Set SERVICE_CMD env var in Railway to override.");
  process.exit(1);
}

console.log("[ERA] Target file :", target);
console.log("[ERA] File exists :", fs.existsSync(target));

if (!fs.existsSync(target)) {
  console.error("[ERA] ERROR: File not found:", target);
  console.error("[ERA] Directory contents:", fs.readdirSync(path.dirname(target)).join(", "));
  process.exit(1);
}

// Choose the right launcher
const isEsm = target.endsWith(".mjs");
const bin  = "node";
const args = isEsm ? ["--enable-source-maps", target] : [target];

console.log("[ERA] Running:", bin, args.join(" "));
const r = spawnSync(bin, args, { stdio: "inherit", env: process.env });
process.exit(r.status ?? 1);
