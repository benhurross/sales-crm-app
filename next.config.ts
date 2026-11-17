import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.0.*", "192.168.8.*"],
};

export default createNextIntlPlugin("./src/i18n/request.ts")(nextConfig);
