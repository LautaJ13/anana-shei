import { expect, test } from "@playwright/test";

test("la búsqueda de psicología muestra Mente Clara", async ({ page }) => {
  await page.goto("/?especialidad=psicologia");
  await expect(page.getByRole("heading", { name: "Mente Clara" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Clínica del Prado" })).toHaveCount(0);
});

test("un paciente reserva un horario libre, lo ocupa y la cancelación lo libera", async ({ page }) => {
  await page.goto("/consultorios/mente-clara");
  const sofia = page.getByRole("listitem").filter({ has: page.getByRole("heading", { name: "Lic. Sofía Pereira" }) });
  const bookingHref = await sofia.getByRole("link", { name: "Ver horarios en Pocitos" }).first().getAttribute("href");
  await page.goto(bookingHref ?? "/");
  const dayHrefs = await page.locator('a[href*="fecha="]:not([href*="hora="])').evaluateAll((elements) =>
    elements.map((element) => element.getAttribute("href") ?? ""),
  );
  let dayHref = "";
  let slotLabel = "";
  for (const href of dayHrefs) {
    const fecha = new URL(href, "http://127.0.0.1:3847").searchParams.get("fecha") ?? "";
    if (new Date(`${fecha}T12:00:00Z`).getTime() - Date.now() < 3 * 24 * 60 * 60 * 1000) continue;
    await page.goto(href);
    const free = page.locator('a[href*="hora="]');
    if (await free.count()) {
      slotLabel = (await free.first().innerText()).trim();
      dayHref = href;
      await page.goto((await free.first().getAttribute("href")) ?? "/");
      break;
    }
  }
  expect(dayHref).not.toBe("");
  await page.getByRole("main").getByRole("link", { name: "Crear cuenta" }).click();
  const email = `paciente.${Date.now()}@example.com`;
  await page.getByLabel("Nombre y apellido").fill("Paciente de prueba");
  await page.getByLabel("Correo").fill(email);
  await page.getByLabel("Contraseña").fill("clave-segura-1");
  await page.getByRole("button", { name: "Crear cuenta" }).click();
  await page.getByRole("button", { name: "Confirmar reserva" }).click();
  await expect(page.getByRole("heading", { name: "Tu consulta fue reservada correctamente" })).toBeVisible();
  await expect(page.getByText("proveedor de email no está configurado")).toBeVisible();

  await page.goto(dayHref);
  await expect(page.getByText(`${slotLabel} ocupado`)).toBeVisible();

  await page.goto("/cuenta");
  await page.getByRole("checkbox", { name: /Confirmo que quiero cancelar/ }).check();
  await page.getByRole("button", { name: "Cancelar consulta" }).click();
  await expect(page.getByText("Cancelada")).toBeVisible();

  await page.goto(dayHref);
  await expect(page.getByRole("link", { name: slotLabel, exact: true })).toBeVisible();
});

test("un administrador no entra al panel de otro consultorio", async ({ page }) => {
  await page.goto("/ingresar");
  await page.getByLabel("Correo").fill("martin.pereyra@demo.alba.uy");
  await page.getByLabel("Contraseña").fill("Alba-Demo-2026");
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page.getByRole("link", { name: "Panel" })).toBeVisible();
  await page.goto("/c/mente-clara/panel");
  await expect(page.getByRole("heading", { name: "No encontramos esta página" })).toBeVisible();
});

test("una paciente no ve las reservas de otra persona", async ({ page }) => {
  await page.goto("/ingresar?next=/cuenta");
  await page.getByLabel("Correo").fill("camila.rodriguez@demo.alba.uy");
  await page.getByLabel("Contraseña").fill("Alba-Demo-2026");
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page.getByRole("heading", { name: /Hola/ })).toBeVisible();
  await expect(page.getByText("lucas.silva@demo.alba.uy")).toHaveCount(0);
  await expect(page.getByText("Lic. Sofía Pereira").first()).toBeVisible();
});

test.describe("celular", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("la búsqueda y el consultorio se leen en una pantalla chica", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Encontrá un turno con claridad." })).toBeVisible();
    await page.getByRole("combobox", { name: "Especialidad" }).selectOption("psicologia");
    await page.getByRole("button", { name: "Buscar" }).click();
    await expect(page.getByRole("heading", { name: "Mente Clara" })).toBeVisible();
    await page.getByRole("link", { name: "Ver consultorio" }).click();
    await expect(page.getByRole("heading", { name: "Lic. Sofía Pereira" })).toBeVisible();
  });
});
