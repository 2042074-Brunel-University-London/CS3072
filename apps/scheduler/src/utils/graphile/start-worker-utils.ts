import type { WorkerUtils, WorkerUtilsOptions } from "graphile-worker";
import { env } from "@/env";
import { makeWorkerUtils } from "graphile-worker";

export let workerUtils: WorkerUtils | null = null;

export const startWorkerUtils = async (
  opts: WorkerUtilsOptions = {},
): Promise<WorkerUtils> => {
  if (workerUtils) {
    return workerUtils;
  }

  workerUtils = await makeWorkerUtils({
    connectionString: env.POSTGRES_URL,
    ...opts,
  });

  return workerUtils;
};
