import { afterEach, describe, expect, it, vi } from "vitest";

const originalDatabaseUrl = process.env.DATABASE_URL;

afterEach(() => {
  vi.resetModules();
  if (originalDatabaseUrl === undefined) {
    delete process.env.DATABASE_URL;
  } else {
    process.env.DATABASE_URL = originalDatabaseUrl;
  }
});

async function loadRuntime() {
  return import("@/lib/db/runtime");
}

describe("database runtime selection", () => {
  it("uses Postgres when DATABASE_URL is configured", async () => {
    process.env.DATABASE_URL = "postgres://user:password@example.test/app";

    const { getDatabaseProvider } = await loadRuntime();

    expect(getDatabaseProvider()).toBe("postgres");
  });

  it("uses SQLite when DATABASE_URL is not configured", async () => {
    delete process.env.DATABASE_URL;

    const { getDatabaseProvider } = await loadRuntime();

    expect(getDatabaseProvider()).toBe("sqlite");
  });
});
