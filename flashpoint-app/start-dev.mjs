// Direct launcher that bypasses bin/next binary issues on Node 20/22
process.env.NEXT_PRIVATE_START_TIME = Date.now().toString();
process.env.NEXT_TELEMETRY_DISABLED = '1';

process.on('unhandledRejection', (e) => { console.error('UNHANDLED:', e); process.exit(1); });
process.on('uncaughtException', (e) => { console.error('UNCAUGHT:', e); process.exit(1); });

console.log('Loading Next.js dev module...');
const { nextDev } = await import('./node_modules/next/dist/cli/next-dev.js');
console.log('Starting dev server on port 3000...');
try {
  await nextDev({ port: 3000, hostname: 'localhost', turbopack: false }, 'option', process.cwd());
  console.log('nextDev resolved (server stopped)');
} catch(e) {
  console.error('nextDev threw:', e?.message, e?.stack);
}
