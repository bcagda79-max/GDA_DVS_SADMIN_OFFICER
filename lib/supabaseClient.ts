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
    from(table: string) {
      const state: any = { selectCols: "*", orderCol: "", orderAsc: true, where: [] as any[] };
      const b: any = {
        select(cols?: string) {
          if (typeof cols === "string" && cols.trim()) state.selectCols = cols;
          return b;
        },
        order(col: string, opts?: { ascending?: boolean }) {
          state.orderCol = col;
          state.orderAsc = opts?.ascending !== false;
          return b;
        },
        eq(col: string, val: any) {
          state.where.push({ col, op: "=", val });
          return b;
        },
        maybeSingle() {
          state.single = true;
          return b;
        },
        async insert(payload: any) {
          const res = await fetch(`/api/admin/${encodeURIComponent(table)}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(Array.isArray(payload) ? payload : [payload]),
            credentials: "include",
          });
          const json = await res.json().catch(() => null);
          if (!res.ok) return { data: null, error: json?.error ?? { message: "insert_failed" } };
          return { data: json?.data ?? null, error: null };
        },
        then(resolve: any, reject: any) {
          // perform a GET with query params
          const params = new URLSearchParams();
          params.set("select", state.selectCols || "*");
          if (state.orderCol) {
            params.set("order", state.orderCol);
            params.set("orderDir", state.orderAsc ? "asc" : "desc");
          }
          for (const w of state.where || []) {
            params.append(`eq_${w.col}`, String(w.val));
          }
          const url = `/api/admin/${encodeURIComponent(table)}?${params.toString()}`;
          return fetch(url, { credentials: "include" })
            .then((r) => r.json())
            .then((j) => {
              if (j?.error) return reject(j.error);
              // Supabase client expects { data, error }
              const out = { data: j?.data ?? null, error: null };
              return resolve(out);
            })
            .catch(reject);
        },
      };

      return b;
    },
    storage: {
      from(bucket: string) {
        return {
          async upload(filePath: string, file: File | Blob | Buffer) {
            const form = new FormData();
            if (file instanceof File || file instanceof Blob) form.append("file", file as File | Blob);
            else form.append("buffer", new Blob([file as Buffer]));
            form.append("path", filePath);
            const res = await fetch(`/api/uploads/upload?bucket=${encodeURIComponent(bucket)}&path=${encodeURIComponent(filePath)}`, {
              method: "POST",
              body: form,
              credentials: "include",
            });
            const j = await res.json().catch(() => null);
            if (!res.ok) return { data: null, error: j?.error ?? { message: "upload_failed" } };
            return { data: j?.data ?? null, error: null };
          },
          getPublicUrl(filePath: string) {
            const publicUrl = `/api/uploads/${encodeURIComponent(bucket)}/${encodeURIComponent(filePath)}`;
            return { data: { publicUrl }, error: null };
          },
        };
      },
    },
  });

  instance = make();
  return instance;
};