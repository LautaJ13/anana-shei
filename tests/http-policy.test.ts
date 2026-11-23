import assert from "node:assert/strict";
import test from "node:test";
import { configuredOrigin, safeNext } from "../lib/http-policy.ts";

test("una redirección con tabulador no sale del sitio", () => {
  assert.equal(safeNext("/\t/evil.example"), "/cuenta");
  assert.equal(safeNext("/cuenta"), "/cuenta");
  assert.equal(safeNext("//evil.example"), "/cuenta");
  assert.equal(safeNext("/cuenta\n"), "/cuenta");
});

test("el origen público no sale de una variable controlada", () => {
  assert.equal(configuredOrigin(""), null);
  assert.equal(configuredOrigin("https://evil.example/restablecer"), null);
  assert.equal(configuredOrigin("javascript:alert(1)"), null);
  assert.equal(configuredOrigin("https://alba.example"), "https://alba.example");
});
