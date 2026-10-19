// Optional account: email + password, used only to back up progress and carry it to other devices.
//
// Talks to Supabase Auth and the user_progress table over plain HTTPS with the publishable key.
// Row level security makes sure a signed-in learner can only read and write their own row.
import { Platform } from 'react-native';
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '../config';
import { mergeProgress, sameLearning } from '../engine/merge';
import { Progress } from '../engine/types';
import { readJSON, remove, writeJSON } from './storage';

const SESSION_KEY = 'account-session-v1';

export type Session = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;   // ms
  userId: string;
  email: string;
};

export class AccountError extends Error {}

const base = { apikey: SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json' };

/** Supabase's messages, said plainly. */
function friendly(status: number, body: { msg?: string; message?: string; error_description?: string; error?: string; error_code?: string; code?: string }): string {
  const raw = `${body.error_code ?? body.code ?? ''} ${body.msg ?? body.message ?? body.error_description ?? body.error ?? ''}`.toLowerCase();
  if (raw.includes('invalid login') || raw.includes('invalid_credentials')) return 'Email or password is wrong.';
  if (raw.includes('already registered') || raw.includes('user_already_exists') || raw.includes('email_exists'))
    return 'There is already an account with this email. Log in instead.';
  if (raw.includes('not confirmed') || raw.includes('email_not_confirmed'))
    return 'Please confirm your email first: open the link we sent you.';
  if (raw.includes('rate limit') || status === 429) return 'Too many tries right now. Please wait a little and try again.';
  if (raw.includes('weak') || raw.includes('password should')) return 'Please choose a longer password (at least 8 characters).';
  if (raw.includes('invalid') && raw.includes('email')) return 'That email address doesn\'t look right.';
  if (raw.includes('same_password') || raw.includes('should be different')) return 'The new password must be different from the old one.';
  if (status === 404 || raw.includes('relation') || raw.includes('pgrst205'))
    return 'Accounts aren\'t switched on yet. Your progress is still saved on this device.';
  return 'Something went wrong. Please try again.';
}

async function call<T>(path: string, init: RequestInit & { token?: string } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${SUPABASE_URL}${path}`, {
      ...init,
      headers: { ...base, ...(init.token ? { Authorization: `Bearer ${init.token}` } : {}), ...(init.headers ?? {}) },
    });
  } catch {
    throw new AccountError('No internet connection. Your progress is still saved on this device.');
  }
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) throw new AccountError(friendly(res.status, body ?? {}));
  return body as T;
}

type TokenReply = {
  access_token?: string; refresh_token?: string; expires_in?: number; expires_at?: number;
  user?: { id: string; email?: string }; id?: string; email?: string;
};

function toSession(r: TokenReply): Session | null {
  if (!r.access_token || !r.refresh_token || !r.user) return null;
  const expiresAt = r.expires_at ? r.expires_at * 1000 : Date.now() + (r.expires_in ?? 3600) * 1000;
  return { accessToken: r.access_token, refreshToken: r.refresh_token, expiresAt, userId: r.user.id, email: r.user.email ?? '' };
}

/** Where email links (confirm, reset password) should bring the learner back to. */
function appUrl(): string | undefined {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return undefined;
  return `${window.location.origin}${window.location.pathname}`;
}
const redirect = () => (appUrl() ? `?redirect_to=${encodeURIComponent(appUrl()!)}` : '');

export const loadSession = () => readJSON<Session>(SESSION_KEY);
const keep = (s: Session) => writeJSON(SESSION_KEY, s).then(() => s);

/** Create an account. Returns the session, or null when the email has to be confirmed first. */
export async function signUp(email: string, password: string): Promise<Session | null> {
  const r = await call<TokenReply>(`/auth/v1/signup${redirect()}`, {
    method: 'POST', body: JSON.stringify({ email: email.trim(), password }),
  });
  const s = toSession(r);
  if (s) return keep(s);
  // With confirmation on and an already-registered email, Supabase answers like a new sign-up
  // but with no identities. We can't tell those apart without leaking who has an account: say "check your email".
  return null;
}

export async function signIn(email: string, password: string): Promise<Session> {
  const r = await call<TokenReply>('/auth/v1/token?grant_type=password', {
    method: 'POST', body: JSON.stringify({ email: email.trim(), password }),
  });
  const s = toSession(r);
  if (!s) throw new AccountError('Something went wrong. Please try again.');
  return keep(s);
}

export async function sendPasswordReset(email: string): Promise<void> {
  await call(`/auth/v1/recover${redirect()}`, { method: 'POST', body: JSON.stringify({ email: email.trim() }) });
}

/** A fresh access token, refreshing it when it's about to expire. Null = signed out. */
export async function validSession(s: Session | null): Promise<Session | null> {
  if (!s) return null;
  if (s.expiresAt - Date.now() > 60_000) return s;
  try {
    const r = await call<TokenReply>('/auth/v1/token?grant_type=refresh_token', {
      method: 'POST', body: JSON.stringify({ refresh_token: s.refreshToken }),
    });
    const fresh = toSession(r);
    return fresh ? keep(fresh) : s;
  } catch (e) {
    // Offline: keep the old one and try later. Refresh token rejected: the login is gone.
    if (e instanceof AccountError && e.message.startsWith('No internet')) return s;
    await remove(SESSION_KEY);
    return null;
  }
}

export async function setNewPassword(s: Session, password: string): Promise<void> {
  await call('/auth/v1/user', { method: 'PUT', token: s.accessToken, body: JSON.stringify({ password }) });
}

export async function signOut(s: Session | null): Promise<void> {
  await remove(SESSION_KEY);
  if (s) call('/auth/v1/logout', { method: 'POST', token: s.accessToken }).catch(() => {});
}

export async function deleteAccount(s: Session): Promise<void> {
  await call('/rest/v1/rpc/delete_my_account', { method: 'POST', token: s.accessToken, body: '{}' });
  await remove(SESSION_KEY);
}

/**
 * Links from emails land back on the app with the login in the address (#access_token=…&type=recovery).
 * Picks it up, saves it, and cleans the address bar.
 */
export async function sessionFromLink(): Promise<{ session: Session; kind: 'recovery' | 'signup' | 'other' } | null> {
  if (Platform.OS !== 'web' || typeof window === 'undefined' || !window.location.hash.includes('access_token')) return null;
  const h = new URLSearchParams(window.location.hash.slice(1));
  window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
  const token = h.get('access_token'); const refresh = h.get('refresh_token');
  if (!token || !refresh) return null;
  try {
    const user = await call<{ id: string; email?: string }>('/auth/v1/user', { token });
    const session = await keep({
      accessToken: token, refreshToken: refresh, userId: user.id, email: user.email ?? '',
      expiresAt: Number(h.get('expires_at') ?? 0) * 1000 || Date.now() + Number(h.get('expires_in') ?? 3600) * 1000,
    });
    const type = h.get('type');
    return { session, kind: type === 'recovery' ? 'recovery' : type === 'signup' ? 'signup' : 'other' };
  } catch {
    return null;
  }
}

/** Error description in the address after an expired or used email link. */
export function linkError(): string | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  const h = new URLSearchParams(window.location.hash.slice(1));
  const err = h.get('error_description') ?? h.get('error');
  if (!err) return null;
  window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
  return /expired|invalid/i.test(err) ? 'That email link has expired or was already used. Please ask for a new one.' : err;
}

async function pull(s: Session): Promise<Progress | null> {
  const rows = await call<{ progress: Progress }[]>(
    `/rest/v1/user_progress?select=progress&user_id=eq.${s.userId}`, { token: s.accessToken });
  return rows[0]?.progress ?? null;
}

async function push(s: Session, p: Progress): Promise<void> {
  await call('/rest/v1/user_progress?on_conflict=user_id', {
    method: 'POST', token: s.accessToken,
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ user_id: s.userId, progress: p, updated_at: new Date().toISOString() }),
  });
}

/**
 * Two-way sync: download the backup, merge it with this device, upload the result if it changed.
 * Returns the merged progress (save it locally) and whether anything new came from the account.
 */
export async function syncProgress(s: Session, local: Progress): Promise<{ progress: Progress; gotNew: boolean }> {
  const remote = await pull(s);
  const merged = mergeProgress(local, remote);
  if (!remote || !sameLearning(merged, remote) || (merged.updatedAt ?? 0) !== (remote.updatedAt ?? 0)
      || (merged.resetAt ?? 0) !== (remote.resetAt ?? 0)) {
    await push(s, merged);
  }
  return { progress: merged, gotNew: !sameLearning(merged, local) };
}
