/** جلسة مجهولة للعميل — من غير أي حساب أو تسجيل دخول. */

const SESSION_KEY = "tikka.session-id";

export function getAnonymousSessionId(): string {
  if (typeof window === "undefined") return "ssr";
  try {
    const existing = window.localStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    const id = `anon_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
    window.localStorage.setItem(SESSION_KEY, id);
    return id;
  } catch {
    return "anon_temp";
  }
}

export function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeJson(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* تجاهل */
  }
}
