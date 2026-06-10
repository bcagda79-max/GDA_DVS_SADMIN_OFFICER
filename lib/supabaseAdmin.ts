import fs from "fs";
import path from "path";
import { query } from "./db";

// Minimal shim that implements a subset of the Supabase Admin client used
// throughout the app. It exposes `from(table)` for simple chained queries
// and a `storage` object with `from(bucket).upload` and `createSignedUrl`.

function buildWhere(clauses: { text: string[]; params: any[] }) {
  if (clauses.text.length === 0) return { sql: "", params: [] };
  return { sql: `WHERE ${clauses.text.join(" AND ")}`, params: clauses.params };
}

function parseOrString(orStr: string, clauses: { text: string[]; params: any[] }) {
  // basic parser for patterns: "col.eq.value,col2.eq.value"
  const parts = orStr.split(",");
  const orParts: string[] = [];
  for (const p of parts) {
    const m = p.match(/^(\w+)\.eq\.(.*)$/);
    if (m) {
      const col = m[1];
      let val: any = m[2];
      if (val === "true") val = true;
      else if (val === "false") val = false;
      // numeric check
      else if (!Number.isNaN(Number(val))) val = Number(val);
      orParts.push(`${col} = $${clauses.params.length + 1}`);
      clauses.params.push(val);
    }
  }
  if (orParts.length) clauses.text.push(`(${orParts.join(" OR ")})`);
}

const getSupabaseAdmin = () => {
  const from = (table: string) => {
    const state: {
      where: { text: string[]; params: any[] };
      order: string;
      limit: string;
      selectCols: string;
      single: boolean;
      head?: boolean;
      count?: string | null;
      op?: "select" | "update" | "delete";
      payload?: any;
    } = {
      where: { text: [] as string[], params: [] as any[] },
      order: "",
      limit: "",
      selectCols: "*",
      single: false,
      head: false,
      count: null,
      op: "select",
      payload: null,
    };

    const builder: any = {
      select(cols?: string, opts?: any) {
        if (typeof cols === "string" && cols.trim()) state.selectCols = cols;
        // handle head/count: mark flags on state and allow chaining
        if (opts && opts.head) {
          state.head = true;
          state.count = opts.count ?? null;
        }
        return builder;
      },
      maybeSingle() {
        state.single = true;
        return builder;
      },
      eq(col: string, val: any) {
        state.where.text.push(`${col} = $${state.where.params.length + 1}`);
        state.where.params.push(val);
        return builder;
      },
      or(cond: string) {
        parseOrString(cond, state.where);
        return builder;
      },
      gte(col: string, val: any) {
        state.where.text.push(`${col} >= $${state.where.params.length + 1}`);
        state.where.params.push(val);
        return builder;
      },
      lt(col: string, val: any) {
        state.where.text.push(`${col} < $${state.where.params.length + 1}`);
        state.where.params.push(val);
        return builder;
      },
      in(col: string, vals: any[]) {
        // Use Postgres ANY to compare against an array parameter
        state.where.text.push(`${col} = ANY($${state.where.params.length + 1})`);
        state.where.params.push(vals);
        return builder;
      },
      order(col: string, opts?: { ascending?: boolean }) {
        const dir = opts?.ascending === false ? "DESC" : "ASC";
        state.order = `ORDER BY ${col} ${dir}`;
        return builder;
      },
      limit(n: number) {
        state.limit = `LIMIT ${n}`;
        return builder;
      },
      async insert(payload: any) {
        const rows = Array.isArray(payload) ? payload : [payload];
        if (rows.length === 0) return { data: [], error: null };
        const cols = Object.keys(rows[0]);
        const valuesSql = rows
          .map((r, i) => `(${cols.map((_, j) => `$${i * cols.length + j + 1}`).join(", ")})`)
          .join(", ");
        const params = rows.flatMap((r) => cols.map((c) => r[c]));
        const q = `INSERT INTO ${table} (${cols.join(", ")}) VALUES ${valuesSql} RETURNING *`;
        const r = await query(q, params);
        return { data: r.rows, error: null };
      },
      async upsert(payload: any, opts?: any) {
        const row = payload;
        const cols = Object.keys(row);
        const params = cols.map((c) => row[c]);
        if (opts && opts.onConflict && opts.ignoreDuplicates) {
          // INSERT ... ON CONFLICT (<col>) DO NOTHING
          const q = `INSERT INTO ${table} (${cols.join(", ")}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(", ")}) ON CONFLICT (${opts.onConflict}) DO NOTHING RETURNING *`;
          const r = await query(q, params);
          return { data: r.rows, error: null };
        }
        // fallback to simple insert
        return builder.insert(row as any);
      },
      update(payload: any) {
        state.op = "update";
        state.payload = payload;
        return builder;
      },
      delete() {
        state.op = "delete";
        return builder;
      },
      // allow awaiting the builder directly
      async execute() {
        try {
          const where = buildWhere(state.where);
          if (state.head) {
            // Return count for head queries
            const q = `SELECT COUNT(*)::int AS count FROM ${table} ${where.sql}`;
            const r = await query(q, where.params);
            return { count: r.rows?.[0]?.count ?? 0, error: null };
          }

          if (state.op === "update") {
            const payload = state.payload ?? {};
            const setCols = Object.keys(payload);
            const setSql = setCols.map((c, i) => `${c} = $${i + 1}`).join(", ");
            const params = setCols.map((c) => payload[c]);
            
            let shiftedWhereSql = where.sql;
            if (setCols.length > 0) {
              shiftedWhereSql = where.sql.replace(/\$(\d+)/g, (match, num) => `$${parseInt(num, 10) + setCols.length}`);
            }

            const q = `UPDATE ${table} SET ${setSql} ${shiftedWhereSql} RETURNING *`;
            const r = await query(q, params.concat(where.params));
            return { data: r.rows, error: null };
          }

          if (state.op === "delete") {
            const q = `DELETE FROM ${table} ${where.sql} RETURNING *`;
            const r = await query(q, where.params);
            return { data: r.rows, error: null };
          }

          const q = `SELECT ${state.selectCols} FROM ${table} ${where.sql} ${state.order} ${state.limit}`;
          const r = await query(q, where.params);
          const rows = r.rows;
          if (state.single) return { data: rows?.[0] ?? null, error: null };
          return { data: rows, error: null };
        } catch (err: any) {
          console.error(`SupabaseAdmin shim error on table ${table}:`, err);
          return { data: null, error: err };
        }
      },
      then(resolve: any, reject: any) {
        return builder.execute().then(resolve, reject);
      },
    };

    return builder;
  };

  const storage = {
    from(bucket: string) {
      const base = path.join(process.cwd(), "uploads", bucket);
      return {
        async upload(filePath: string, buffer: Buffer, opts?: any) {
          const dest = path.join(base, filePath);
          await fs.promises.mkdir(path.dirname(dest), { recursive: true });
          await fs.promises.writeFile(dest, buffer);
          return { data: { path: filePath }, error: null };
        },
        async update(filePath: string, buffer: Buffer, opts?: any) {
          const dest = path.join(base, filePath);
          await fs.promises.mkdir(path.dirname(dest), { recursive: true });
          await fs.promises.writeFile(dest, buffer);
          return { data: { path: filePath }, error: null };
        },
        async createSignedUrl(filePath: string) {
          // For local storage we simply return a URL to the API route that serves files.
          const url = `/api/uploads/${encodeURIComponent(bucket)}/${encodeURIComponent(filePath)}`;
          return { data: { signedUrl: url }, error: null };
        },
        async remove(filePath: string) {
          const dest = path.join(base, filePath);
          try {
            await fs.promises.unlink(dest);
            return { data: null, error: null };
          } catch (e) {
            return { data: null, error: e };
          }
        },
      };
    },
  };

  return { from, storage } as any;
};

export { getSupabaseAdmin };
export default getSupabaseAdmin;