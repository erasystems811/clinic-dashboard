const { spawnSync } = require("child_process");

const raw  = (process.env.RAILWAY_SERVICE_NAME || "").trim();
const name = raw.toLowerCase().replace(/[\s_]+/g, "-");

const COMMANDS = {
  "demo":            "node artifacts/demo/server.cjs",
  "era-demo":        "node artifacts/demo/server.cjs",
  "era-patient":     "node artifacts/era-patient/server.cjs",
  "era-super-admin": "node artifacts/era-super-admin/server.cjs",
  "super-admin":     "node artifacts/era-super-admin/server.cjs",
  "api-server":      "node --enable-source-maps artifacts/api-server/dist/index.mjs",
  "api":             "node --enable-source-maps artifacts/api-server/dist/index.mjs",
  "era-me":          "node artifacts/era-me/server.cjs",
};

// exact match first
let cmd = COMMANDS[name];

// partial match fallback
if (!cmd) {
  for (const [key, val] of Object.entries(COMMANDS)) {
    if (name.includes(key) || key.includes(name)) { cmd = val; break; }
  }
}

// manual override fallback
if (!cmd) cmd = process.env.SERVICE_CMD;

if (!cmd) {
  console.error(`[ERA] Cannot determine service from RAILWAY_SERVICE_NAME="${raw}"`);
  console.error(`[ERA] Set SERVICE_CMD env var in Railway for this service.`);
  console.error(`[ERA] Known names: ${Object.keys(COMMANDS).join(", ")}`);
  process.exit(1);
}

console.log(`[ERA] ${raw || "?"} → ${cmd}`);
const [bin, ...args] = cmd.split(" ");
const r = spawnSync(bin, args, { stdio: "inherit", env: process.env });
process.exit(r.status ?? 1);
