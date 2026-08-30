import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";

import { AppHeader } from "@/components/app-header";
import { ScopeSwitcher } from "@/components/scope-switcher";
import { getScopeState } from "@/lib/scope/server";
import "./globals.css";

export const metadata: Metadata = {
  title: "Boopervisor",
  description: "Read and edit Claude Code's on-disk configuration.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const { selected, projects } = await getScopeState();

  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col font-sans">
        <AppHeader
          scopeSwitcher={
            <ScopeSwitcher selected={selected} projects={projects} />
          }
        />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
          {children}
        </main>
      </body>
    </html>
  );
}
