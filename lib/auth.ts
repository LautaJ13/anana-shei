import type { AppDatabase } from "./db";
import { hashPassword, newToken, sha256, verifyPassword } from "./password";

export type Membership = {
  organizationId: string;
  organizationName: string;
  slug: string;
  organizationStatus: string;
  role: "org_admin" | "professional" | "receptionist";
  professionalId: string | null;
  canManageAvailability: boolean;
};

export type SessionUser = {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  birthDate: string | null;
  platformRole: "user" | "superadmin";
  isDemo: boolean;
  memberships: Membership[];
};

type ProfileRow = {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  birth_date: string | null;
  platform_role: "user" | "superadmin";
  is_demo: boolean;
  password_hash?: string;
};

const demoLoginsDisabled = () => process.env.DISABLE_DEMO_LOGINS === "true";

export async function registerAccount(
  database: AppDatabase,
  input: { email: string; password: string; fullName: string; phone?: string | null },
): Promise<string> {
  const passwordHash = await hashPassword(input.password);
  return database.withService(async (db) => {
    const rows = await db.query<{ register_user: string }>(
      `select register_user($1, $2, $3, $4) as register_user`,
      [input.email, passwordHash, input.fullName, input.phone ?? null],
    );
    return rows.rows[0].register_user;
  });
}

export async function authenticate(
  database: AppDatabase,
  input: { email: string; password: string; ip: string },
): Promise<SessionUser> {
  const email = input.email.trim().toLowerCase();
  await database.withService((db) =>
    db.query(`select consume_rate_limit($1, 20, interval '15 minutes')`, [`login-ip:${input.ip}`]),
  );
  await database.withService((db) =>
    db.query(`select consume_rate_limit($1, 10, interval '15 minutes')`, [`login-email:${email}`]),
  );
  const found = await database.withService((db) =>
    db.query<ProfileRow>(
      `select id, email, full_name, phone, birth_date::text as birth_date, platform_role, is_demo, password_hash
       from profiles
       where lower(email) = $1 and status = 'active' and deleted_at is null`,
      [email],
    ),
  );
  const profile = found.rows[0];
  if (!profile?.password_hash || !(await verifyPassword(input.password, profile.password_hash))) {
    throw new Error("invalid_credentials");
  }
  if (demoLoginsDisabled() && profile.is_demo) throw new Error("demo_disabled");
  const user = await readUser(database, profile.id);
  if (!user) throw new Error("invalid_credentials");
  return user;
}

export async function createSession(database: AppDatabase, userId: string): Promise<string> {
  const token = newToken();
  await database.withService((db) =>
    db.query(
      `insert into sessions (user_id, token_hash, expires_at) values ($1, $2, now() + interval '14 days')`,
      [userId, sha256(token)],
    ),
  );
  return token;
}

export async function destroySession(database: AppDatabase, token: string): Promise<void> {
  await database.withService((db) => db.query(`delete from sessions where token_hash = $1`, [sha256(token)]));
}

export async function readSession(database: AppDatabase, token: string | undefined): Promise<SessionUser | null> {
  if (!token) return null;
  const found = await database.withService((db) =>
    db.query<{ id: string; is_demo: boolean }>(
      `select p.id, p.is_demo
       from sessions s
       join profiles p on p.id = s.user_id
       where s.token_hash = $1 and s.expires_at > now() and p.status = 'active' and p.deleted_at is null`,
      [sha256(token)],
    ),
  );
  const row = found.rows[0];
  if (!row || (demoLoginsDisabled() && row.is_demo)) return null;
  return readUser(database, row.id);
}

export async function readUser(database: AppDatabase, userId: string): Promise<SessionUser | null> {
  const profile = await database.withUser(userId, (db) =>
    db.query<ProfileRow>(
      `select id, email, full_name, phone, birth_date::text as birth_date, platform_role, is_demo
       from profiles where id = $1`,
      [userId],
    ),
  );
  const row = profile.rows[0];
  if (!row) return null;
  const memberships = await database.withUser(userId, (db) =>
    db.query<{
      organization_id: string;
      name: string;
      slug: string;
      status: string;
      role: Membership["role"];
      professional_id: string | null;
      can_manage_availability: boolean | null;
    }>(
      `select m.organization_id, o.name, o.slug, o.status, m.role, m.professional_id, pr.can_manage_availability
       from organization_members m
       join organizations o on o.id = m.organization_id
       left join professionals pr on pr.id = m.professional_id
       where m.user_id = $1 and m.status = 'active'
       order by o.name`,
      [userId],
    ),
  );
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    phone: row.phone,
    birthDate: row.birth_date,
    platformRole: row.platform_role,
    isDemo: row.is_demo,
    memberships: memberships.rows.map((item) => ({
      organizationId: item.organization_id,
      organizationName: item.name,
      slug: item.slug,
      organizationStatus: item.status,
      role: item.role,
      professionalId: item.professional_id,
      canManageAvailability: Boolean(item.can_manage_availability),
    })),
  };
}

export async function issuePasswordReset(database: AppDatabase, email: string): Promise<string | null> {
  const token = newToken();
  const created = await database.withService((db) =>
    db.query<{ issue_password_reset: boolean }>(
      `select issue_password_reset($1, $2) as issue_password_reset`,
      [email, sha256(token)],
    ),
  );
  return created.rows[0]?.issue_password_reset ? token : null;
}

export async function consumePasswordReset(database: AppDatabase, token: string, password: string): Promise<boolean> {
  const passwordHash = await hashPassword(password);
  const result = await database.withService((db) =>
    db.query<{ consume_password_reset: boolean }>(
      `select consume_password_reset($1, $2) as consume_password_reset`,
      [sha256(token), passwordHash],
    ),
  );
  return Boolean(result.rows[0]?.consume_password_reset);
}
