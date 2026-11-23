import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import pg from "pg";
import { PGlite } from "@electric-sql/pglite";

export type Queryable = {
  query<T = Record<string, unknown>>(
    sql: string,
    params?: readonly unknown[],
  ): Promise<{ rows: T[]; rowCount?: number | null }>;
};

export type AppDatabase = {
  withUser<T>(userId: string | null, fn: (db: Queryable) => Promise<T>): Promise<T>;
  withService<T>(fn: (db: Queryable) => Promise<T>): Promise<T>;
  close(): Promise<void>;
};

const globalForDb = globalThis as unknown as { albaDb?: Promise<AppDatabase> };

export function getDatabase(): Promise<AppDatabase> {
  if (!globalForDb.albaDb) {
    globalForDb.albaDb = openDatabase().catch((error: unknown) => {
      globalForDb.albaDb = undefined;
      throw error;
    });
  }
  return globalForDb.albaDb;
}

async function openDatabase(): Promise<AppDatabase> {
  const databaseUrl = process.env.DATABASE_URL?.trim() ?? "";
  if (databaseUrl !== "") {
    const pool = new pg.Pool({ connectionString: databaseUrl, max: 5 });
    await migratePg(pool);
    return wrapPg(pool);
  }
  const db = new PGlite();
  await migratePglite(db);
  return wrapPglite(db);
}

export async function createMemoryDatabase(): Promise<AppDatabase> {
  const db = new PGlite();
  await migratePglite(db);
  return wrapPglite(db);
}

async function migrationFiles(): Promise<string[]> {
  const dir = path.join(process.cwd(), "migrations");
  return (await readdir(dir)).filter((file) => file.endsWith(".sql")).sort();
}

async function migratePglite(db: PGlite): Promise<void> {
  await db.exec(
    "create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())",
  );
  for (const file of await migrationFiles()) {
    const done = await db.query<{ name: string }>("select name from schema_migrations where name = $1", [file]);
    if (done.rows.length > 0) continue;
    const sql = await readFile(path.join(process.cwd(), "migrations", file), "utf8");
    await db.transaction(async (tx) => {
      await tx.exec(sql);
      await tx.query("insert into schema_migrations (name) values ($1)", [file]);
    });
  }
}

async function migratePg(pool: pg.Pool): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("set lock_timeout = '60s'");
    await client.query("select pg_advisory_lock(7272741)");
    await client.query(
      "create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())",
    );
    for (const file of await migrationFiles()) {
      const done = await client.query("select name from schema_migrations where name = $1", [file]);
      if (done.rows.length > 0) continue;
      const sql = await readFile(path.join(process.cwd(), "migrations", file), "utf8");
      await client.query("begin");
      try {
        await client.query(sql);
        await client.query("insert into schema_migrations (name) values ($1)", [file]);
        await client.query("commit");
      } catch (error) {
        await client.query("rollback");
        throw error;
      }
    }
  } finally {
    await client.query("select pg_advisory_unlock(7272741)");
    client.release();
  }
}

function wrapPglite(db: PGlite): AppDatabase {
  return {
    withUser(userId, fn) {
      return db.transaction(async (tx) => {
        await tx.query("select set_config('app.user_id', $1, true)", [userId ?? ""]);
        await tx.exec("set local role app_rls");
        return fn(tx);
      });
    },
    withService(fn) {
      return db.transaction(async (tx) => {
        await tx.query("select set_config('app.service', 'on', true)");
        return fn(tx);
      });
    },
    close() {
      return db.close();
    },
  };
}

function wrapPg(pool: pg.Pool): AppDatabase {
  const transaction = async <T>(setup: (db: Queryable) => Promise<void>, fn: (db: Queryable) => Promise<T>) => {
    const client = await pool.connect();
    try {
      await client.query("begin");
      await setup(client);
      const result = await fn(client);
      await client.query("commit");
      return result;
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  };

  return {
    withUser(userId, fn) {
      return transaction(async (db) => {
        await db.query("select set_config('app.user_id', $1, true)", [userId ?? ""]);
        await db.query("set local role app_rls");
      }, fn);
    },
    withService(fn) {
      return transaction(async (db) => {
        await db.query("select set_config('app.service', 'on', true)");
      }, fn);
    },
    async close() {
      await pool.end();
    },
  };
}
