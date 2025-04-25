import baseConfig, { restrictEnvAccess } from "@senka/eslint-config/base";
import nextjsConfig from "@senka/eslint-config/nextjs";
import reactConfig from "@senka/eslint-config/react";

/** @type {import('typescript-eslint').Config} */
export default [
  {
    ignores: [".next/**"],
  },
  ...baseConfig,
  ...reactConfig,
  ...nextjsConfig,
  ...restrictEnvAccess,
];
