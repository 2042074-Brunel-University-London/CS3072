import { fetchPosts } from "@/lib/bsky/store-posts";
import { addJob, createTask } from "@/utils";
import { z } from "zod";

export type StorePostsPayload = z.infer<typeof StorePostsPayload>;
export const StorePostsPayload = z.object({
  actor: z.string(),
});

export const storePosts = createTask({
  name: "store-posts",
  schema: z.object({
    actor: z.string(),
  }),
  task: async ({ actor }) => {
    const { postIds } = await fetchPosts(actor);

    for (const postId of postIds) {
      await addJob({
        name: "analyze-posts",
        payload: {
          id: postId,
        },
        options: {
          jobKey: `analyze-posts:${postId}`,
          queueName: "analyze-posts",
          priority: 8, // lower than store-posts
          maxAttempts: 5,
        }
      });
    }

    return;
  },
});
