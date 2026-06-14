import "./globals.css";
import type { Metadata } from "next";
import { Nav } from "@/components/Nav";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const metadata: Metadata = {
  title: "Hunch — group prediction market",
  description: "A play-money prediction market for your group.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const unread = user
    ? await prisma.notification.count({ where: { userId: user.id, read: false } })
    : 0;

  return (
    <html lang="en">
      <body>
        <Nav user={user} unread={unread} />
        <main className="container">{children}</main>
      </body>
    </html>
  );
}
