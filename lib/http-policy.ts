export function configuredOrigin(value = process.env.APP_ORIGIN): string | null {
  const raw = value?.trim() ?? "";
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (url.username || url.password) return null;
  if (url.pathname !== "/" && url.pathname !== "") return null;
  if (url.search || url.hash) return null;
  return url.origin;
}

export function safeNext(value: string | undefined | null, fallback = "/cuenta"): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return fallback;
  if (/[\u0000-\u001F\u007F\s\\]/.test(value)) return fallback;
  if (value.includes("://") || value.includes("@")) return fallback;
  return value;
}
