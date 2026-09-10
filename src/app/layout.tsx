import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { RegistrarServiceWorker } from "./registrar-sw";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Catequesis - Gestion de asistencia",
  description:
    "Registro de asistencia y seguimiento de catequizandos, disenado para funcionar sin senal.",
  applicationName: "Catequesis",
  appleWebApp: { capable: true, title: "Catequesis" },
};

export const viewport: Viewport = {
  themeColor: "#1e3a8a",
  // La app se usa a una mano, de pie y en movimiento: mobile-first real.
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es-PE"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <RegistrarServiceWorker />
      </body>
    </html>
  );
}
