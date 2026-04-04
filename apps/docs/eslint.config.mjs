import nextPlugin from "@next/eslint-plugin-next";
import sharedConfig from "../../packages/config/eslint.config.mjs";

export default [
  ...sharedConfig,
  {
    ...nextPlugin.flatConfig.coreWebVitals,
    files: ["src/**/*.{js,jsx,ts,tsx}"],
  },
];
