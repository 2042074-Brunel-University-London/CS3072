import type { TRPCRouterRecord } from "@trpc/server";

import { desc, sql } from "@senka/db";

import { publicProcedure } from "../trpc";

export const userRouter = {
  graph: publicProcedure.query(async ({ ctx }) => {
    const USERS_LIMIT = 100;

    console.log("Fetching user ids");
    const userIds = await ctx.db.query.User.findMany({
      limit: USERS_LIMIT,
      where: (users, { isNotNull }) => isNotNull(users.parsedAt),
      orderBy: (users) => [
        desc(sql`${users.followersCount} + ${users.followsCount}`),
        desc(users.followersCount),
      ],
      columns: {
        did: true,
      },
    });

    console.log("User ids fetched", userIds.length);

    const users = await ctx.db.query.User.findMany({
      where: (users, { inArray }) =>
        inArray(
          users.did,
          userIds.map((u) => u.did),
        ),
      columns: {
        did: true,
        handle: true,
        displayName: true,
        avatar: true,
        followersCount: true,
        followsCount: true,
      },
      with: {
        followers: {
          columns: {
            followerDid: true,
            userDid: true,
          },
        },
        following: {
          columns: {
            followerDid: true,
            userDid: true,
          },
        },
        posts: {
          columns: {
            id: true,
            content: true,
            likesCount: true,
            replyCount: true,
            repostCount: true,
            createdAt: true,
          },
          with: {
            media: true,
            links: {
              with: {
                domain: true,
              },
            },
          },
        },
      },
    });

    console.log("Users fetched", users.length);

    // Filter to only include relationships between the 100 users we fetched
    const userDids = new Set(users.map((u) => u.did));

    const VAL_SCALE = 0.5;

    const nodes = [
      // User nodes
      ...users.map((user) => ({
        id: user.did,
        name: user.handle,
        displayName: user.displayName,
        avatar: user.avatar,
        type: "user",
        // val:
        //   Math.sqrt((user.followersCount ?? 0) + (user.followsCount ?? 0)) *
        //   VAL_SCALE, // Node size based on connections
      })),
      // Post nodes
      ...users.flatMap((user) =>
        user.posts.map((post) => ({
          id: post.id,
          name: post.content.substring(0, 30) + "...",
          type: "post",
          val: Math.sqrt(
            (post.likesCount ?? 0) +
              (post.replyCount ?? 0) +
              (post.repostCount ?? 0),
          ),
          media: post.media,
        })),
      ),
      // Domain nodes
      ...users
        .flatMap((user) =>
          user.posts.flatMap((post) =>
            post.links.map((link) => ({
              id: link.domain.url,
              name: link.domain.url,
              type: "domain",
              // val: link.domain.trustScore * VAL_SCALE,
            })),
          ),
        )
        .filter(
          (domain, index, self) =>
            // Remove duplicate domains
            index === self.findIndex((d) => d.id === domain.id),
        ),
    ];

    const links = [
      // User follows
      ...users.flatMap((user) => {
        const relationships: {
          source: string;
          target: string;
          type: string;
        }[] = [];

        // Follows relationships
        user.followers
          .filter((follower) => userDids.has(follower.followerDid))
          .forEach((follower) => {
            relationships.push({
              source: follower.followerDid,
              target: user.did,
              type: "follows",
            });
          });

        // Posts relationships
        user.posts.forEach((post) => {
          relationships.push({
            source: user.did,
            target: post.id,
            type: "posted",
          });
        });

        return relationships;
      }),
      // Post to domain links
      ...users.flatMap((user) =>
        user.posts.flatMap((post) =>
          post.links.map((link) => ({
            source: post.id,
            target: link.domain.url,
            type: "links_to",
          })),
        ),
      ),
    ];

    return {
      nodes,
      links,
    };
  }),
} satisfies TRPCRouterRecord;
