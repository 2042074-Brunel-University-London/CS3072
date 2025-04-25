import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    POSTGRES_URL: z.string(),

    BSKY_ID: z.string(),
    BSKY_PASSWORD: z.string(),
  },

  runtimeEnv: process.env,
});
