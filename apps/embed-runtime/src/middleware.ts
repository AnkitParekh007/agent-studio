import { NextResponse, type NextRequest } from 'next/server';

const API_BASE =
  process.env.EMBED_API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  'http://localhost:4000';

export const config = { matcher: '/embed/:orgSlug/:appSlug' };

/**
 * Framing is default-deny: only origins allowlisted on the active embed publication
 * may frame the runtime. Publications with no allowed origins get frame-ancestors 'none'.
 */
export async function middleware(req: NextRequest) {
  const [, , orgSlug, appSlug] = req.nextUrl.pathname.split('/');
  let allowedOrigins: string[] = [];

  if (orgSlug && appSlug) {
    try {
      const res = await fetch(
        `${API_BASE}/api/public/apps/${encodeURIComponent(orgSlug)}/${encodeURIComponent(appSlug)}?channel=embed`,
        { headers: { accept: 'application/json' } },
      );
      if (res.ok) {
        const body = (await res.json()) as {
          publication?: { allowedOrigins?: unknown };
        };
        const origins = body.publication?.allowedOrigins;
        if (Array.isArray(origins)) {
          allowedOrigins = origins.filter((o): o is string => typeof o === 'string');
        }
      }
    } catch {
      allowedOrigins = [];
    }
  }

  const frameAncestors = allowedOrigins.length ? allowedOrigins.join(' ') : "'none'";
  const response = NextResponse.next();
  response.headers.set('Content-Security-Policy', `frame-ancestors ${frameAncestors}`);
  return response;
}
