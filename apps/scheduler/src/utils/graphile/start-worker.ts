import type { Runner } from "graphile-worker";
import { env } from "@/env";
import { run } from "graphile-worker";

export let runner: Runner | null = null;

export const startWorker: typeof run = async (options) => {
  if (runner) {
    return runner;
  }

  runner = await run({
    connectionString: env.POSTGRES_URL,
    ...options,
  });

  return runner;
};
