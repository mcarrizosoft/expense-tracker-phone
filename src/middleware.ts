import { NextResponse, type NextRequest } from "next/server"
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth"

export async function middleware(req: NextRequest) {
  const ok = await verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value)
  if (ok) return NextResponse.next()

  const url = req.nextUrl.clone()
  const next = req.nextUrl.pathname === "/" ? "" : req.nextUrl.pathname + req.nextUrl.search
  url.pathname = "/login"
  url.search = next ? `?next=${encodeURIComponent(next)}` : ""
  return NextResponse.redirect(url)
}

export const config = {
  matcher: [
    "/((?!login|api/ingest|api/dolar|_next/static|_next/image|favicon.ico|icon|apple-icon|manifest.webmanifest).*)",
  ],
}
