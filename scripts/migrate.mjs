import { readdir, readFile } from "node:fs/promises";
import pg from "pg";

const url = process.env.DATABASE_URL?.trim() ?? "";
const files = (await readdir("migrations").catch(() => [])).filter((file) => file.endsWith(".sql")).sort();

if (url === "" || files.length === 0) {
  console.log("migrate: nothing to do");
  process.exit(0);
}

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL_UNPOOLED?.trim() || url,
});
await client.connect();

function withoutAppRoleGrants(sql) {
  return sql.replace(/grant\b[\s\S]*?\bto\s+app_rls\s*;/gi, "");
}

async function ensureAppRole() {
  const existing = await client.query("select 1 from pg_roles where rolname = 'app_rls'");
  if (existing.rows.length === 0) {
    try {
      await client.query("create role app_rls nologin nosuperuser nobypassrls");
    } catch (error) {
      if (error.code !== "42501") throw error;
      return false;
    }
  }
  try {
    await client.query("grant app_rls to current_user");
  } catch (error) {
    if (error.code !== "42501") throw error;
    return false;
  }
  return true;
}

try {
  await client.query("set lock_timeout = '60s'");
  await client.query("select pg_advisory_lock(7272741)");
  const roleReady = await ensureAppRole();
  await client.query(
    "create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())",
  );
  const done = new Set((await client.query("select name from schema_migrations")).rows.map((row) => row.name));
  for (const file of files.filter((name) => !done.has(name))) {
    await client.query("begin");
    try {
      const raw = await readFile(`migrations/${file}`, "utf8");
      await client.query(roleReady ? raw : withoutAppRoleGrants(raw));
      await client.query("insert into schema_migrations (name) values ($1)", [file]);
      await client.query("commit");
      console.log(`migrate: applied ${file}`);
    } catch (error) {
      await client.query("rollback");
      throw error;
    }
  }
} finally {
  await client.query("select pg_advisory_unlock(7272741)");
  await client.end();
}
