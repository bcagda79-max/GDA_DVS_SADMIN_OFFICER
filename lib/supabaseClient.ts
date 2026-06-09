// Lightweight shim to provide the minimal Supabase client auth surface used
// across the app. Implements `auth.getUser`, `auth.signUp`, `auth.signInWithPassword`,
// and `auth.signOut` by proxying to internal API routes that handle JWT cookies.

let instance: any = null;

export const getSupabaseClient = () => {
  if (instance) return instance;

  const make = () => ({
    auth: {
      async getUser() {
        try {
          const res = await fetch("/api/auth/user", { credentials: "include" });
          if (!res.ok) return { data: { user: null }, error: { message: 'failed' } };
          const payload = await res.json();
          return { data: { user: payload?.user ?? null }, error: null };
        } catch (err: any) {
          return { data: { user: null }, error: { message: err?.message ?? String(err) } };
        }
      },
      async getSession() {
        try {
          const res = await fetch("/api/auth/user", { credentials: "include" });
          if (!res.ok) return { data: { session: null }, error: { message: 'no_session' } };
          const payload = await res.json();
          return { data: { session: { user: payload?.user ?? null } }, error: null };
        } catch (err: any) {
          return { data: { session: null }, error: { message: err?.message ?? String(err) } };
        }
      },
      onAuthStateChange(fn: (event: any, session: any) => void) {
        // Immediately invoke callback with current session and return a simple unsubscribe
        (async () => {
          const res = await fetch("/api/auth/user", { credentials: "include" }).catch(() => null);
          const payload = res ? await res.json().catch(() => null) : null;
          fn("INITIAL", { user: payload?.user ?? null });
        })();
        return { data: { subscription: { unsubscribe: () => {} } } };
      },
      async exchangeCodeForSession(_code: string) {
        // OAuth is not supported in the local JWT shim. Return success so
        // callers can continue to call getUser which will reflect the current cookie.
        return { data: null, error: null };
      },
      async signUp(payload: { email: string; password: string }) {
        const res = await fetch("/api/auth/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          credentials: "include",
        });
        const json = await res.json().catch(() => null);
        if (!res.ok) return { data: null, error: { message: json?.error ?? 'signup_failed' } };
        return { data: { user: json?.user ?? null }, error: null };
      },
      async signInWithPassword(payload: { email: string; password: string }) {
        const res = await fetch("/api/auth/signin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          credentials: "include",
        });
        const json = await res.json().catch(() => null);
        if (!res.ok) return { data: null, error: { message: json?.error ?? 'invalid_credentials' } };
        return { data: { user: json?.user ?? null }, error: null };
      },
      async signOut() {
        const res = await fetch("/api/auth/signout", { method: "POST", credentials: "include" });
        const json = await res.json().catch(() => null);
        if (!res.ok) return { data: null, error: { message: json?.error ?? 'signout_failed' } };
        return { data: null, error: null };
      },
    },
  });

  instance = make();
  return instance;
};