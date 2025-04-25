import type { AnalyzePostsPayload } from "@/tasks/analyze/analyze-posts";
import type { StorePostsPayload } from "@/tasks/store/store-posts-by-actor";
import { analyzePosts } from "@/tasks/analyze/analyze-posts";
import { checkInactiveResources } from "@/tasks/check-inactive-resources";
import { storePosts } from "@/tasks/store/store-posts-by-actor";

import type { AnalyzeDomainPayload } from "./analyze/analyze-domain";
import type { StoreActorProfilePayload } from "./store/store-actor-profile";
import { analyzeDomain } from "./analyze/analyze-domain";
import { storeActorProfile } from "./store/store-actor-profile";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace GraphileWorker {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface Tasks extends TaskNameToPayloadMap {}
  }
}

// TODO: fix inference
interface TaskNameToPayloadMap {
  "store-actor-profile": StoreActorProfilePayload;
  "store-posts": StorePostsPayload;
  "analyze-domain": AnalyzeDomainPayload;
  "analyze-posts": AnalyzePostsPayload;
}

export const tasks = [
  storeActorProfile,
  storePosts,
  checkInactiveResources,
  analyzeDomain,
  analyzePosts,
] as const;

type TasksList<T extends typeof tasks = typeof tasks> = Record<
  T[number]["name"],
  T[number]["task"]
>;

export const taskList = tasks.reduce<TasksList>(
  (acc, task) => Object.assign(acc, { [task.name]: task.task }),
  {} as TasksList,
);
