#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";

const PRODUCTION_BASE_URL = "https://students.mylifeos457.com";
const isProduction =
  process.env.VERCEL_ENV === "production" ||
  process.env.DEPLOY_TARGET === "production";

const errors = [];
const warnings = [];

function hasValue(name) {
  return Boolean(process.env[name] && process.env[name].trim());
}

function addError(message) {
  errors.push(message);
}

function addWarning(message) {
  warnings.push(message);
}

if (isProduction) {
  if (process.env.APP_BASE_URL !== PRODUCTION_BASE_URL) {
    addError(`APP_BASE_URL must be ${PRODUCTION_BASE_URL} for production.`);
  }

  if (!hasValue("DATABASE_URL")) {
    addError("DATABASE_URL is required for production persistent classroom data.");
  }

  if (hasValue("DATABASE_PATH")) {
    addError("DATABASE_PATH must not be set in production on Vercel.");
  }

  if (!hasValue("ZHIPU_API_KEY")) {
    addWarning("ZHIPU_API_KEY is not set; AI report generation will be unavailable.");
  }
}

if (existsSync(".env.example")) {
  const envExample = readFileSync(".env.example", "utf8");

  if (/^ZHIPU_API_KEY=.+$/m.test(envExample)) {
    addError(".env.example must not contain a real ZHIPU_API_KEY value.");
  }

  if (/^DATABASE_URL=(postgres|postgresql):\/\//m.test(envExample)) {
    addError(".env.example must not contain a real DATABASE_URL value.");
  }
}

function shouldScanFile(filePath, size) {
  if (size > 2 * 1024 * 1024) return false;
  const extension = extname(filePath).toLowerCase();
  return [
    ".js",
    ".mjs",
    ".cjs",
    ".json",
    ".html",
    ".css",
    ".txt",
    ".map",
    ".rsc",
  ].includes(extension);
}

function scanBuiltAssetsForSecret(secret) {
  if (!secret || secret.length < 8) return [];

  const outputDirs = [".next", ".next-build"];
  const matches = [];

  function walk(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const fullPath = join(directory, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }

      const stats = statSync(fullPath);
      if (!shouldScanFile(fullPath, stats.size)) continue;

      const content = readFileSync(fullPath, "utf8");
      if (content.includes(secret)) {
        matches.push(relative(process.cwd(), fullPath));
      }
    }
  }

  for (const outputDir of outputDirs) {
    if (existsSync(outputDir)) {
      walk(outputDir);
    }
  }

  return matches;
}

const leakedFiles = scanBuiltAssetsForSecret(process.env.ZHIPU_API_KEY || "");
for (const filePath of leakedFiles) {
  addError(`Built asset contains ZHIPU_API_KEY: ${filePath}`);
}

for (const warning of warnings) {
  console.warn(`[deploy:check] warning: ${warning}`);
}

if (errors.length > 0) {
  for (const error of errors) {
    console.error(`[deploy:check] error: ${error}`);
  }
  process.exit(1);
}

console.log("[deploy:check] production readiness checks passed");
