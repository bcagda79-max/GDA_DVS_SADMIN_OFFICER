import { Pool, type QueryResult, type QueryResultRow } from "pg";

declare global {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  var __pgPool: Pool | undefined;
}

let pool: Pool | undefined;

function getPool() {
  if (pool) return pool;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("Missing DATABASE_URL environment variable");
  }

  pool = global.__pgPool ?? new Pool({ connectionString });
  if (process.env.NODE_ENV === "development") global.__pgPool = pool;
  return pool;
}

export async function query<T extends QueryResultRow = any>(text: string, params?: any[]): Promise<QueryResult<T>> {
  const res = await getPool().query(text, params);
  return res as QueryResult<T>;
}

export default getPool();
