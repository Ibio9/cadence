/**
 * Boot migration.
 *
 * WHY THIS EXISTS
 *
 * The live database was built by `prisma db push`. That creates the tables but
 * writes no migration history, so the database has a schema and an empty
 * `_prisma_migrations`. `prisma migrate deploy` then refuses to run at all:
 *
 *     Error: P3005
 *     The database schema is not empty.
 *
 * It is not that `0_init` failed. Deploy aborts before touching anything,
 * because it cannot tell whether the tables already there match what `0_init`
 * would have created. That is why `0_init` was never recorded as applied, and
 * why the boot fell back to `db push --accept-data-loss` — which will silently
 * drop a column, and the data in it, the moment the schema drifts.
 *
 * THE FIX
 *
 * Baselining: record a migration as applied without running its SQL, for the
 * case where its effect is already in the database. That is exactly what
 * `prisma migrate resolve --applied` does. Doing it by hand once against
 * production would work, but it would not be in the repo and the next fresh
 * environment would hit the same wall. So it happens here, on boot, and it is
 * safe to run every time.
 *
 * WHAT IT WILL AND WILL NOT DO
 *
 * A migration is only ever baselined if it is named in CHECKS below and its
 * check confirms the change is genuinely already in the database. Anything
 * else is left to `migrate deploy` to apply for real.
 *
 * So: do not add new migrations to CHECKS. The table exists to adopt one
 * database that predates the migration history, and it is finished. A
 * migration written from here on must actually run.
 */

import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MIGRATIONS = join(ROOT, 'prisma', 'migrations');

// The CLI is run as a script on this same node binary rather than through npx:
// no shell, no PATH lookup, no npm download path, and it behaves the same on
// the deploy host as it does on a laptop.
//
// This is also why `prisma` is a dependency rather than a devDependency. It is
// needed at boot, not only at build, and a host that prunes dev dependencies
// for production would otherwise leave the server unable to migrate.
const PRISMA_CLI = createRequire(import.meta.url).resolve('prisma/build/index.js');

const prisma = new PrismaClient();

const exists = async (sql, ...args) => (await prisma.$queryRawUnsafe(sql, ...args)).length > 0;

const tableExists = (table) =>
  exists(
    `SELECT 1 FROM information_schema.tables
      WHERE table_schema = current_schema() AND table_name = $1`,
    table,
  );

const columnExists = (table, column) =>
  exists(
    `SELECT 1 FROM information_schema.columns
      WHERE table_schema = current_schema() AND table_name = $1 AND column_name = $2`,
    table,
    column,
  );

/**
 * The migrations that predate the migration history on the live database, and
 * how to tell that each one's change is already there. Closed set — see above.
 */
const CHECKS = {
  '0_init': () => tableExists('Block'),
  '20260811100000_block_objective_brief': () => columnExists('Block', 'objective'),
  '20260811120000_block_session': () => columnExists('Block', 'elapsedSec'),
};

const prismaCli = (...args) =>
  execFileSync(process.execPath, [PRISMA_CLI, ...args], { cwd: ROOT, stdio: 'inherit' });

/** Migrations already recorded as successfully applied. */
async function appliedNames() {
  if (!(await tableExists('_prisma_migrations'))) return new Set();
  const rows = await prisma.$queryRawUnsafe(
    `SELECT migration_name FROM _prisma_migrations
      WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`,
  );
  return new Set(rows.map((r) => r.migration_name));
}

async function main() {
  const onDisk = readdirSync(MIGRATIONS, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();

  const applied = await appliedNames();

  for (const name of onDisk) {
    if (applied.has(name)) continue;
    const check = CHECKS[name];
    if (!check) continue; // Not a baseline candidate: deploy must run it for real.
    if (!(await check())) continue; // Its change is not in the database yet, so let it run.

    console.log(`[migrate] ${name} is already in the database. Recording it as applied.`);
    prismaCli('migrate', 'resolve', '--applied', name);
  }

  prismaCli('migrate', 'deploy');
}

try {
  await main();
} catch (e) {
  // Boot loudly rather than starting a server against a schema nobody checked.
  console.error('[migrate] Migrations did not complete. The server is not starting.');
  console.error(e?.message || e);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
