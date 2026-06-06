/**
 * Install Playwright browsers for the project.
 * This script is called during postinstall to ensure
 * chromium-headless-shell is available for FB Ads scraping.
 */
const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");

// Find playwright-core in the pnpm store
const pnpmDir = path.join(__dirname, "..", "node_modules", ".pnpm");
const coreDirs = fs.readdirSync(pnpmDir).filter((f) => f.startsWith("playwright-core@"));

if (coreDirs.length === 0) {
  console.error("[playwright-install] Could not find playwright-core in pnpm store");
  process.exit(1);
}

// Use the first (and should be only) playwright-core directory
const coreDir = path.join(pnpmDir, coreDirs[0], "node_modules", "playwright-core");
const cliPath = path.join(coreDir, "cli.js");

if (!fs.existsSync(cliPath)) {
  console.error(`[playwright-install] CLI not found at ${cliPath}`);
  process.exit(1);
}

console.log(`[playwright-install] Installing chromium-headless-shell using ${cliPath}...`);
execSync(`node "${cliPath}" install chromium-headless-shell`, {
  stdio: "inherit",
  cwd: path.join(__dirname, ".."),
});
console.log("[playwright-install] Done!");
