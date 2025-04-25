import { addJob, createTask } from "@/utils";
import { z } from "zod";

import { db } from "@senka/db/client";

export const checkInactiveResources = createTask({
  name: "check-inactive-resources",
  schema: z.object({}),
  task: async () => {
    const [users, domains, posts] = await Promise.allSettled([
      addUnparsedUsersToQueue(),
      addUnparsedDomainsToQueue(),
      addUnanalyzedPostsToQueue()
    ]);

    if (users.status === "rejected") {
      console.error(users.reason);
    }

    if (domains.status === "rejected") {
      console.error(domains.reason);
    }

    if (posts.status === "rejected") {
      console.error(posts.reason);
    }
  },
});

const addUnparsedUsersToQueue = async () => {
  console.log("Adding unparsed users to queue");
  const users = await db.query.User.findMany({
    where: (User, { isNull }) => isNull(User.parsedAt),
    limit: 20,
  });

  if (users.length === 0) {
    console.log("No unparsed users found");
    return;
  }

  // eslint-disable-next-line @typescript-eslint/prefer-for-of
  for (let i = 0; i < users.length; i++) {
    const user = users[i];
    if (!user) {
      continue;
    }

    await addJob({
      name: "store-actor-profile",
      payload: { actor: user.did },
      options: {
        jobKey: `store-actor-profile:${user.did}`,
        priority: 20,
        maxAttempts: 5,
        // runAt: new Date(Date.now() + i * 1 * 60 * 1000),
      },
    });
  }
};

const addUnparsedDomainsToQueue = async () => {
  console.log("Adding unparsed domains to queue");
  const domains = await db.query.Domain.findMany({
    where: (Domain, { isNull }) => isNull(Domain.lastCheckedAt),
    limit: 10,
  });

  if (domains.length === 0) {
    console.log("No unparsed domains found");
    return;
  }

  for (const domain of domains) {
    await addJob({
      name: "analyze-domain",
      payload: { domain: domain.url },
      options: {
        jobKey: `analyze-domain:${domain.url}`,
        priority: 5,
        maxAttempts: 5,
      },
    });
  }
};

const addUnanalyzedPostsToQueue = async () => {
  console.log("Adding unanalyzed posts to queue");
  const posts = await db.query.Post.findMany({
    where: (Post, { isNull }) => isNull(Post.lastAnalyzedAt),
    limit: 10,
  });

  for (const post of posts) {
    await addJob({
      name: "analyze-posts",
      payload: {
        id: post.id,
      },
      options: {
        jobKey: `analyze-posts:${post.id}`,
        queueName: "analyze-posts",
        priority: 8, // lower than store-posts
        maxAttempts: 5,
      },
    });
  }
};
