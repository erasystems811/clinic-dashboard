const { spawnSync } = require("child_process");
const path = require("path");

// __dirname is always the repo root (where this file lives),
// regardless of which directory Railway sets as CWD for the service.
const ROOT = __dirname;

const raw  = (process.env.RAILWAY_SERVICE_NAME || "").trim();
const name = raw.toLowerCase().replace(/[\s_]+/g, "-");

const COMMANDS = {
  "demo":            ["node", path.join(ROOT, "artifacts/demo/server.cjs")],
  "era-demo":        ["node", path.join(ROOT, "artifacts/demo/server.cjs")],
  "era-patient":     ["node", path.join(ROOT, "artifacts/era-patient/server.cjs")],
  "era-super-admin": ["node", path.join(ROOT, "artifacts/era-super-admin/server.cjs")],
  "super-admin":     ["node", path.join(ROOT, "artifacts/era-super-admin/server.cjs")],
  "api-server":      ["node", "--enable-source-maps", path.join(ROOT, "artifacts/api-server/dist/index.mjs")],
  "api":             ["node", "--enable-source-maps", path.join(ROOT, "artifacts/api-server/dist/index.mjs")],
  "era-me":          ["node", path.join(ROOT, "artifacts/era-me/server.cjs")],
};

let args = COMMANDS[name];

if (!args) {
  for (const [key, val] of Object.entries(COMMANDS)) {
    if (name.includes(key) || key.includes(name)) { args = val; break; }
  }
}

if (!args && process.env.SERVICE_CMD) {
  args = process.env.SERVICE_CMD.split(" ");
}

if (!args) {
  console.error(`[ERA] Unknown service: "${raw}" (normalized: "${name}")`);
  console.error(`[ERA] Known: ${Object.keys(COMMANDS).join(", ")}`);
  console.error(`[ERA] Set SERVICE_CMD env var to override.`);
  process.exit(1);
}

console.log(`[ERA] ${raw} → ${args.join(" ")}`);
const r = spawnSync(args[0], args.slice(1), { stdio: "inherit", env: process.env });
process.exit(r.status ?? 1);
