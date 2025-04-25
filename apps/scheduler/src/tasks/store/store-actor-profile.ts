import { storeProfileAndFollowers } from "@/lib/bsky";
import { addJob, createTask } from "@/utils";
import { z } from "zod";

export type StoreActorProfilePayload = z.infer<typeof StoreActorProfilePayload>;
export const StoreActorProfilePayload = z.object({
  actor: z.string(),
});

export const storeActorProfile = createTask({
  name: "store-actor-profile",
  schema: z.object({
    actor: z.string(),
    forceStore: z.boolean().optional(),
  }),
  task: async ({ actor, forceStore }) => {
    const profile = await storeProfileAndFollowers(actor, forceStore);

    if (!profile) {
      console.log(`Skipping ${actor} because it did not match the criteria`);
      return;
    }

    const { followers, following } = profile;

    console.log(`Added store-posts job for ${actor}`);
    await addJob({
      name: "store-posts",
      payload: {
        actor: actor,
      },
      options: {
        priority: 10,
        maxAttempts: 5,
      },
    });

    // Dids of profiles that need to be parsed. parsedAt must be null or more than 1 month old

    const shouldParse = (parsedAt: Date | null) => {
      return (
        !parsedAt || parsedAt < new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      );
    };
    const follows = [...followers, ...following];

    // eslint-disable-next-line @typescript-eslint/prefer-for-of
    for (let i = 0; i < follows.length; i++) {
      const follow = follows[i];
      if (!follow) {
        continue;
      }

      if (!shouldParse(follow.parsedAt)) {
        console.log(
          `Skipping ${follow.did} because it was parsed less than 30 days ago`,
        );
        continue;
      }

      console.log(`Added store-actor-profile job for ${follow.did}`);
      await addJob({
        name: "store-actor-profile",
        payload: { actor: follow.did },
        options: {
          jobKey: `store-actor-profile:${follow.did}`,
          priority: 20,
          maxAttempts: 5,
          // runAt: new Date(Date.now() + i * 60 * 1000),
        },
      });
    }

    return;
  },
});
