import { Pool, type QueryResult, type QueryResultRow } from "pg";

declare global {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  var __pgPool: Pool | undefined;
}

let pool: Pool | undefined;

function normalizeConnectionString(connectionString: string) {
  let normalized = connectionString.trim();
  if ((normalized.startsWith("\"") && normalized.endsWith("\"")) || (normalized.startsWith("'") && normalized.endsWith("'"))) {
    normalized = normalized.slice(1, -1);
  }

  if (!normalized.includes("@")) return normalized;

  const protocolEnd = normalized.indexOf("//") + 2;
  if (protocolEnd <= 1) return normalized;

  const rest = normalized.slice(protocolEnd);
  const authSeparator = rest.lastIndexOf("@");
  if (authSeparator === -1) return normalized;

  const userInfo = rest.slice(0, authSeparator);
  const hostAndPath = rest.slice(authSeparator + 1);
  const [username, ...passwordParts] = userInfo.split(":");
  if (passwordParts.length === 0) return normalized;

  const password = passwordParts.join(":");
  return `${normalized.slice(0, protocolEnd)}${encodeURIComponent(username)}:${encodeURIComponent(password)}@${hostAndPath}`;
}

function getPool() {
  if (pool) return pool;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("Missing DATABASE_URL environment variable");
  }

  const normalized = normalizeConnectionString(connectionString);
  pool = global.__pgPool ?? new Pool({ connectionString: normalized });
  if (process.env.NODE_ENV === "development") global.__pgPool = pool;
  return pool;
}

export async function query<T extends QueryResultRow = any>(text: string, params?: any[]): Promise<QueryResult<T>> {
  const res = await getPool().query(text, params);
  return res as QueryResult<T>;
}

export default getPool();
