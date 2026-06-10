import { Pool, type PoolConfig } from "pg";
import { getDatabase } from "./client";
import { createPostgresRepositories } from "./postgres";
import { createRepositories, type RepositorySet } from "./repositories";

export type DatabaseProvider = "postgres" | "sqlite";

let postgresPool: Pool | null = null;
let postgresRepositories: Promise<RepositorySet> | null = null;

export function getDatabaseProvider(): DatabaseProvider {
  return process.env.DATABASE_URL?.trim() ? "postgres" : "sqlite";
}

function usesSsl(databaseUrl: string) {
  try {
    const hostname = new URL(databaseUrl).hostname;
    return !["localhost", "127.0.0.1", "::1"].includes(hostname);
  } catch {
    return true;
  }
}

function postgresPoolConfig(databaseUrl: string): PoolConfig {
  const max = Number.parseInt(process.env.DATABASE_POOL_MAX ?? "5", 10);

  return {
    connectionString: databaseUrl,
    max: Number.isFinite(max) && max > 0 ? max : 5,
    ssl: usesSsl(databaseUrl) ? { rejectUnauthorized: false } : false,
  };
}

export async function getRepositories(): Promise<RepositorySet> {
  const databaseUrl = process.env.DATABASE_URL?.trim();

  if (!databaseUrl) {
    return createRepositories(getDatabase());
  }

  if (!postgresPool) {
    postgresPool = new Pool(postgresPoolConfig(databaseUrl));
  }

  postgresRepositories ??= createPostgresRepositories(postgresPool);
  return postgresRepositories;
}
