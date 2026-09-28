import type { CookieOptions } from 'express';

export const SESSION_COOKIE = 'inkquests_session';

export const sessionCookieOptions = (
  frontendOrigin: string,
): CookieOptions => ({
  httpOnly: true,
  // Lax still sends the cookie on the frontend's fetches: localhost:5173 and
  // localhost:3000 (or app. and api. subdomains in prod) are the same site.
  sameSite: 'lax',
  secure: new URL(frontendOrigin).protocol === 'https:',
  path: '/',
});
