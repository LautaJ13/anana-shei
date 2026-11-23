import { getDatabase } from "@/lib/db";

export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const database = await getDatabase();
  const rows = await database.withUser(null, (query) =>
    query.query<{ logo_bytes: Buffer | Uint8Array | null; logo_mime: string | null }>(
      `select logo_bytes, logo_mime from organizations where slug = $1 and status = 'active'`,
      [slug],
    ),
  );
  const logo = rows.rows[0];
  if (!logo?.logo_bytes || !logo.logo_mime) return new Response(null, { status: 404 });
  const bytes = Buffer.from(logo.logo_bytes);
  return new Response(bytes, {
    headers: {
      "Content-Type": logo.logo_mime,
      "Cache-Control": "public, max-age=300",
    },
  });
}
