import { configuredOrigin, safeNext } from "./http-policy";

export { safeNext };

export async function appOrigin(): Promise<string | null> {
  return configuredOrigin();
}

export function one(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}
