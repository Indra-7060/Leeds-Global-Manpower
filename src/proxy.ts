import { NextResponse, type NextRequest } from 'next/server';

/**
 * Optimistic gate only: no session cookie → go to /login. It never redirects AWAY from /login, because a stale or forged
 * cookie would then bounce between / and /login forever. Real verification is requireUser() on the server, and the login
 * page itself sends an already-signed-in user to the dashboard.
 */
export function proxy(request: NextRequest) {
  const isLogin = request.nextUrl.pathname === '/login';
  if (!request.cookies.has('lgm_session') && !isLogin) return NextResponse.redirect(new URL('/login', request.url));
  const headers = new Headers(request.headers);
  headers.set('x-pathname', request.nextUrl.pathname); // read by the app layout to enforce level-wise access per screen
  return NextResponse.next({ request: { headers } });
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|svg|ico|css|js)$).*)'] };
