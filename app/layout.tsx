import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { connection } from "next/server";
import { Toaster } from "sonner";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { isEmailConfigured } from "@/lib/email";
import { getCurrentUser } from "@/lib/session";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: { default: "Alba", template: "%s · Alba" },
  description: "Reservá consultas médicas en consultorios de Uruguay. Horarios reales, sin historia clínica.",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  await connection();
  const user = await getCurrentUser();
  return (
    <html lang="es">
      <body className={`${inter.variable} min-h-screen antialiased`}>
        <a className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-2 focus:rounded-lg focus:bg-white focus:px-3 focus:py-2" href="#contenido">
          Saltar al contenido
        </a>
        <SiteHeader user={user} />
        {isEmailConfigured() ? null : (
          <p className="bg-navy px-4 py-2 text-center text-sm text-white">
            Modo desarrollo: el correo no está configurado. Las reservas se confirman igual y el aviso queda registrado, pero no se envía un email.
          </p>
        )}
        <main id="contenido">{children}</main>
        <SiteFooter />
        <Toaster position="top-center" />
      </body>
    </html>
  );
}
