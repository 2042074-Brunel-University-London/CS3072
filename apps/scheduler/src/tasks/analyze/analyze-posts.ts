import { modelsAPIClient } from "@/lib/api/models";
import { createTask } from "@/utils";
import { z } from "zod";

import { db } from "@senka/db/client";

export type AnalyzePostsPayload = z.infer<typeof AnalyzePostsPayload>;
export const AnalyzePostsPayload = z.object({
  id: z.string(),
});

export const analyzePosts = createTask({
  name: "analyze-posts",
  schema: AnalyzePostsPayload,
  task: async ({ id }) => {
    console.log(`Analyzing post: ${id}`);
    const findPost = await db.query.Post.findFirst({
      where: (Post, { eq }) => eq(Post.id, id),
    });

    if (!findPost) {
      console.error(`Post ${id} not found`);
      return;
    }

    if (!findPost.indexedAt) {
      console.error(`Post ${id} not indexed`);
      return;
    }

    // Skip if the domain was checked in the last 7 days
    if (
      findPost.lastAnalyzedAt &&
      findPost.lastAnalyzedAt > new Date(Date.now() - 1000 * 60 * 60 * 24 * 7)
    ) {
      console.log(`Post ${id} was checked in the last 7 days, skipping`);
      return;
    }

    const { data } = await modelsAPIClient.post("/posts/analyze", {
      id,
    });
  },
});
