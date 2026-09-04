/**
 * دخول أوفلاين للوحة المتجر.
 *
 * الفكرة: أول مرة الموظف يدخل بنجاح وهو أونلاين، بنخزّن على الجهاز بصمة
 * (PBKDF2 + salt) لكلمة المرور مع اسم المستخدم ودوره. لما النت يفصل، بنتحقق
 * من نفس البصمة محليًا ونفتح «جلسة أوفلاين» مؤقتة عشان الكاشير يقدر يكمل بيع
 * من اللقطة المحلية ويرفع الفواتير لما النت يرجع.
 *
 * الأمان: مفيش كلمة مرور مخزّنة، بصمة فقط (100 ألف تكرار SHA-256). الجلسة
 * الأوفلاين صالحة لمدة محدودة، وأي عملية حقيقية على السيرفر لازم برضو تعدّي
 * من RLS بعد ما الجهاز يرجع أونلاين ويعمل sign in عادي.
 */

const CRED_PREFIX = "tikka-offline-cred";
const SESSION_PREFIX = "tikka-offline-session";
const CRED_MAX_AGE_MS = 60 * 24 * 60 * 60 * 1000; // 60 يوم
const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 أيام

export type OfflineCredential = {
  storeSlug: string;
  username: string;
  email: string;
  role: string | null;
  salt: string;
  hash: string;
  savedAt: number;
};

export type OfflineSession = {
  storeSlug: string;
  username: string;
  email: string;
  role: string | null;
  startedAt: number;
};

function hasStorage(): boolean {
  return typeof window !== "undefined" && !!window.localStorage;
}

function credKey(storeSlug: string, username: string): string {
  return `${CRED_PREFIX}-${storeSlug}-${username.trim().toLowerCase()}`;
}

function sessionKey(storeSlug: string): string {
  return `${SESSION_PREFIX}-${storeSlug}`;
}

function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function derive(password: string, saltHex: string): Promise<string> {
  const salt = new Uint8Array((saltHex.match(/.{2}/g) ?? []).map((pair) => parseInt(pair, 16)));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: 100_000, hash: "SHA-256" },
    key,
    256,
  );
  return toHex(bits);
}

/** يخزّن بصمة الدخول بعد نجاح دخول أونلاين. */
export async function rememberOfflineLogin(input: {
  storeSlug: string;
  username: string;
  email: string;
  password: string;
  role?: string | null;
}): Promise<void> {
  if (!hasStorage() || !crypto?.subtle) return;
  const username = input.username.trim().toLowerCase();
  const salt = toHex(crypto.getRandomValues(new Uint8Array(16)).buffer);
  const hash = await derive(input.password, salt);
  const record: OfflineCredential = {
    storeSlug: input.storeSlug,
    username,
    email: input.email,
    role: input.role ?? null,
    salt,
    hash,
    savedAt: Date.now(),
  };
  window.localStorage.setItem(credKey(input.storeSlug, username), JSON.stringify(record));
}

function readCredential(storeSlug: string, username: string): OfflineCredential | null {
  if (!hasStorage()) return null;
  const raw = window.localStorage.getItem(credKey(storeSlug, username));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as OfflineCredential;
    if (Date.now() - parsed.savedAt > CRED_MAX_AGE_MS) {
      window.localStorage.removeItem(credKey(storeSlug, username));
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/** هل الجهاز ده يقدر يدخل أوفلاين للمتجر ده أصلًا؟ */
export function hasOfflineCredentials(storeSlug: string): boolean {
  if (!hasStorage()) return false;
  const prefix = `${CRED_PREFIX}-${storeSlug}-`;
  for (let i = 0; i < window.localStorage.length; i += 1) {
    const key = window.localStorage.key(i);
    if (key?.startsWith(prefix)) return true;
  }
  return false;
}

/** يتحقق من اسم المستخدم وكلمة المرور محليًا ويفتح جلسة أوفلاين. */
export async function offlineLogin(input: {
  storeSlug: string;
  username: string;
  password: string;
}): Promise<{ ok: true; session: OfflineSession } | { ok: false; reason: "no-credential" | "bad-password" }> {
  const record = readCredential(input.storeSlug, input.username);
  if (!record) return { ok: false, reason: "no-credential" };
  const hash = await derive(input.password, record.salt);
  if (hash !== record.hash) return { ok: false, reason: "bad-password" };

  const session: OfflineSession = {
    storeSlug: record.storeSlug,
    username: record.username,
    email: record.email,
    role: record.role,
    startedAt: Date.now(),
  };
  window.localStorage.setItem(sessionKey(input.storeSlug), JSON.stringify(session));
  return { ok: true, session };
}

/** جلسة أوفلاين صالحة (إن وُجدت). */
export function getOfflineSession(storeSlug: string): OfflineSession | null {
  if (!hasStorage()) return null;
  const raw = window.localStorage.getItem(sessionKey(storeSlug));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as OfflineSession;
    if (Date.now() - parsed.startedAt > SESSION_MAX_AGE_MS) {
      window.localStorage.removeItem(sessionKey(storeSlug));
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearOfflineSession(storeSlug: string): void {
  if (!hasStorage()) return;
  window.localStorage.removeItem(sessionKey(storeSlug));
}
