import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Self-contained server bundle for the Docker image (see Dockerfile).
  output: "standalone",
  images: {
    // Images are small brand PNGs, SVG garment art and user uploads (data URLs). Serving them
    // as-is avoids the native image optimizer, which produced broken WebP files on Windows.
    unoptimized: true,
  },
};

export default nextConfig;
