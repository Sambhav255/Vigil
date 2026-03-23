#!/usr/bin/env node
/**
 * Next.js 16 + current toolchain misbehaves on Node 25+ (require(...) is not a function in .next/server chunks).
 * Keep in sync with package.json "engines".
 */
const major = Number.parseInt(process.versions.node.split(".")[0] ?? "0", 10);
if (Number.isNaN(major) || major < 20 || major >= 25) {
  console.error(
    `\n[vigil-app] Unsupported Node.js ${process.version}. Use Node 20.x or 22.x (LTS).\n` +
      `  nvm install 22 && nvm use 22\n` +
      `  rm -rf .next\n` +
      `  npm run dev\n`
  );
  process.exit(1);
}
