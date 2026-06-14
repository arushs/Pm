import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { signSession } from "@/lib/session";
import { SESSION_COOKIE, SESSION_MAX_AGE, appUrl } from "@/lib/config";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.redirect(`${appUrl()}/login?error=invalid`);

  const record = await prisma.loginToken.findUnique({ where: { token } });
  if (!record || record.usedAt || record.expiresAt.getTime() < Date.now()) {
    return NextResponse.redirect(`${appUrl()}/login?error=expired`);
  }

  const user = await prisma.user.findUnique({ where: { email: record.email } });
  if (!user) return NextResponse.redirect(`${appUrl()}/login?error=notfound`);

  await prisma.loginToken.update({ where: { token }, data: { usedAt: new Date() } });
  const jwt = await signSession(user.id);

  const res = NextResponse.redirect(`${appUrl()}/`);
  res.cookies.set(SESSION_COOKIE, jwt, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });
  return res;
}
