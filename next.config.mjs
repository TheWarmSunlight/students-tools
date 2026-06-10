import { PHASE_DEVELOPMENT_SERVER } from "next/constants.js";

/**
 * Keep dev and production build outputs separate. Running `next build` while
 * `next dev` is active otherwise rewrites the same cache directory and can
 * leave the dev server serving missing chunks.
 *
 * @param {string} phase
 * @returns {import('next').NextConfig}
 */
export default function nextConfig(phase) {
  return {
    distDir: phase === PHASE_DEVELOPMENT_SERVER ? ".next-dev" : ".next-build",
  };
}
