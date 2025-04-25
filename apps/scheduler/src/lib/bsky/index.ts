import type {
  ProfileView,
  ProfileViewBasic,
  ProfileViewDetailed,
} from "@atproto/api/dist/client/types/app/bsky/actor/defs";
import { agent } from "@/lib/bsky/agent";

import { eq } from "@senka/db";
import { db } from "@senka/db/client";
import { User, UserFollower } from "@senka/db/schema";

/**
 * Saves the profile and followers of a user to the database.
 */
export async function storeProfileAndFollowers(actor: string, forceStore = false) {
  const { data: profile } = await agent.getProfile({
    actor: actor,
  });

  if (!forceStore && isEmptyProfile(profile)) {
    console.log(`Deleting empty profile ${profile.did}`);
    await db.delete(User).where(eq(User.did, profile.did));
    return null;
  }
  // console.log(
  //   "known",
  //   JSON.stringify(profile.viewer?.knownFollowers?.followers, null, 2),
  // );
  // console.log("followers", JSON.stringify(followers, null, 2));

  // console.log(`Saving profile for ${profile.did}`);
  await db
    .insert(User)
    .values({
      did: profile.did,
      handle: profile.handle,
      displayName: profile.displayName,
      avatar: profile.avatar,
      followersCount: profile.followersCount,
      followsCount: profile.followsCount,
      parsedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: User.did,
      set: {
        displayName: profile.displayName,
        avatar: profile.avatar,
        followersCount: profile.followersCount,
        followsCount: profile.followsCount,
        handle: profile.handle,
        parsedAt: new Date(),
      },
    });
  // console.log(`Saved profile for ${profile.did}`);

  const {
    data: { followers },
  } = await agent.getFollowers({
    actor: actor,
  });

  const {
    data: { follows },
  } = await agent.getFollows({
    actor: actor,
  });

  const _followers = [];
  const _follows = [];

  for (const follower of followers) {
    _followers.push(await upsertFollower(profile.did, follower));
  }

  for (const follow of follows) {
    _follows.push(await upsertFollows(profile.did, follow));
  }

  return {
    profileDid: profile.did,
    followers: _followers,
    following: _follows,
  };
}

const upsertFollower = async (
  userDid: string,
  followerProfile: ProfileView,
) => {
  // console.log(`Saving follower ${followerProfile.did} of ${userDid}`);
  const follower = await db.query.User.findFirst({
    where: (User, { eq }) => eq(User.did, followerProfile.did),
    columns: {
      did: true,
      parsedAt: true,
    },
  });

  if (!follower) {
    // console.log(`Saving follower ${followerProfile.did}`);
    await db
      .insert(User)
      .values({
        did: followerProfile.did,
        handle: followerProfile.handle,
        displayName: followerProfile.displayName,
        avatar: followerProfile.avatar,
        followersCount: 0,
        // parsedAt: null, // Must not be set, since we want to parse the posts and etc
      })
      .onConflictDoNothing();

    // New user needs to be parsed
    return {
      did: followerProfile.did,
      parsedAt: null,
    };
  }

  await db
    .insert(UserFollower)
    .values({
      userDid,
      followerDid: follower.did,
    })
    .onConflictDoNothing();

  return {
    did: follower.did,
    parsedAt: follower.parsedAt,
  };
};

const upsertFollows = async (
  userDid: string,
  followingProfile: ProfileViewBasic,
) => {
  // console.log(`Saving ${userDid} following ${followingProfile.did}`);

  const following = await db.query.User.findFirst({
    where: (User, { eq }) => eq(User.did, followingProfile.did),
    columns: {
      did: true,
      parsedAt: true,
    },
  });

  if (!following) {
    // console.log(`Saving following ${followingProfile.did}`);
    await db
      .insert(User)
      .values({
        did: followingProfile.did,
        handle: followingProfile.handle,
        displayName: followingProfile.displayName,
        avatar: followingProfile.avatar,
        followersCount: 0,
        // parsedAt: null, // Must not be set, since we want to parse the posts and etc
      })
      .onConflictDoNothing();

    // New user needs to be parsed
    return {
      did: followingProfile.did,
      parsedAt: null,
    };
  }

  await db
    .insert(UserFollower)
    .values({
      userDid: following.did,
      followerDid: userDid,
    })
    .onConflictDoNothing();

  return {
    did: following.did,
    parsedAt: following.parsedAt,
  };
};

const isEmptyProfile = (profile: ProfileViewDetailed) => {
  const { followersCount = 0, followsCount = 0, postsCount = 0 } = profile;

  if (followersCount < 10 && followsCount < 10) {
    return true;
  }

  const activityScore = followersCount + followsCount + postsCount;

  return activityScore < 100;
};
