export const API = process.env.API_BASE_URL ?? 'http://localhost:4000';

export function getSetCookies(res) {
  if (typeof res.headers.getSetCookie === 'function') return res.headers.getSetCookie();
  const single = res.headers.get('set-cookie');
  return single ? [single] : [];
}

export function cookieHeader(cookies) {
  return cookies.map((c) => c.split(';')[0]).join('; ');
}

export async function json(res) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${res.status} ${text}`);
  }
}

export async function signIn(email, password = 'Password123!') {
  const res = await fetch(`${API}/api/auth/sign-in/email`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: 'http://localhost:3000',
    },
    body: JSON.stringify({ email, password }),
  });
  const cookies = getSetCookies(res);
  if (!res.ok) throw new Error(`sign-in failed for ${email}: ${await res.text()}`);
  return cookies;
}

export async function orgHeaders(cookies) {
  const me = await fetch(`${API}/api/orgs/for-me`, {
    headers: { cookie: cookieHeader(cookies) },
  });
  const meBody = await json(me);
  const orgId = meBody.organizations?.[0]?.organizationId;
  if (!orgId) throw new Error('no organization');
  return {
    'content-type': 'application/json',
    cookie: cookieHeader(cookies),
    'x-organization-id': orgId,
  };
}

/** Owner submits; dedicated approver decides (SoD). */
export async function approveAsApprover(requestId) {
  const cookies = await signIn('approver@example.com');
  const headers = await orgHeaders(cookies);
  const decide = await fetch(`${API}/api/approvals/${requestId}/decide`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ decision: 'approved' }),
  });
  if (!decide.ok) throw new Error(`approve failed: ${await decide.text()}`);
  return json(decide);
}
