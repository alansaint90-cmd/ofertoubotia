import type { Metadata } from "next";
import "./globals.css";
import "./feature-pages.css";

export const metadata: Metadata = {
  title: "Ofertou — Ofertas que trabalham por você",
  description: "Encontre produtos, crie ofertas e organize suas publicações em um só lugar.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
