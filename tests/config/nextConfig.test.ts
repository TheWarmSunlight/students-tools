import { PHASE_DEVELOPMENT_SERVER, PHASE_PRODUCTION_BUILD } from "next/constants";
import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config.mjs";

function resolveConfig(phase: string) {
  return typeof nextConfig === "function" ? nextConfig(phase) : nextConfig;
}

describe("next config", () => {
  it("uses separate output directories for dev and production build caches", () => {
    const devConfig = resolveConfig(PHASE_DEVELOPMENT_SERVER);
    const buildConfig = resolveConfig(PHASE_PRODUCTION_BUILD);

    expect(devConfig.distDir).toBe(".next-dev");
    expect(buildConfig.distDir).toBe(".next");
    expect(devConfig.distDir).not.toBe(buildConfig.distDir);
  });

  it("can be imported by Node without Vite resolver aliases", () => {
    const output = execFileSync(
      process.execPath,
      ["--input-type=module", "-e", "await import('./next.config.mjs'); console.log('node import ok')"],
      { cwd: process.cwd(), encoding: "utf8" },
    );

    expect(output).toContain("node import ok");
  });
});
