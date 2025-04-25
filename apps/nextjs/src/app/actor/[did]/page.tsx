import Image from "next/image";
import Link from "next/link";
import { count, eq } from "drizzle-orm";
import { ExternalLink, FileJson2 } from "lucide-react";

import { db } from "@senka/db/client";
import {
  Link as DbLink,
  Domain,
  Post,
  User,
  UserFollower,
} from "@senka/db/schema";
import { cn } from "@senka/ui";
import { Button } from "@senka/ui/button";
import { Card } from "@senka/ui/card";
import { ScrollArea } from "@senka/ui/scroll-area";
import { Separator } from "@senka/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@senka/ui/sheet";

async function getUserData(did: string) {
  const user = await db.query.User.findFirst({
    where: eq(User.did, did),
    with: {
      posts: {
        with: {
          links: {
            with: {
              domain: true,
            },
          },
        },
      },
      followers: {
        with: {
          follower: true,
        },
      },
      following: {
        with: {
          user: true,
        },
      },
    },
  });

  const postsCount = await db
    .select({ count: count() })
    .from(Post)
    .where(eq(Post.authorDid, did));
  return {
    user,
    postsCount: postsCount[0]?.count ?? 0,
  };
}

export default async function UserPage({
  params,
}: {
  params: { did: string };
}) {
  const did = decodeURIComponent(params.did);

  const { user, postsCount } = await getUserData(did);

  if (!user) {
    return <div>User ({did}) not found</div>;
  }

  return (
    <div className="container mx-auto p-4">
      {/* User Profile Section */}
      <Card className="mb-8 p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            {user.avatar && (
              <Image
                src={user.avatar}
                alt={user.handle}
                width={80}
                height={80}
                className="rounded-full"
              />
            )}
            <div>
              <h1 className="text-2xl font-bold">{user.displayName}</h1>
              <p className="text-gray-600">@{user.handle}</p>
              <div className="mt-2 flex gap-4">
                <span>{user.followersCount} followers</span>
                <Separator orientation="vertical" />
                <span>{user.followsCount} following</span>
                <Separator orientation="vertical" />
                <span>{postsCount} posts</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon">
                  <FileJson2 className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent className="max-w-3xl sm:max-w-2xl">
                <SheetHeader>
                  <SheetTitle>Raw User Data</SheetTitle>
                </SheetHeader>
                <div className="mt-4">
                  <pre className="overflow-auto rounded-md bg-muted p-4 text-sm">
                    {JSON.stringify(user, null, 2)}
                  </pre>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </Card>

      <Card
        className={cn(
          user.parsedAt ? "p-4" : "p-4 shadow-xl shadow-yellow-600/30",
          "mb-4 text-sm",
        )}
      >
        <h3 className="text-lg font-bold">Profile Parsing Status</h3>
        <p>
          {user.parsedAt
            ? `Profile parsed at: ${user.parsedAt.toLocaleString()}`
            : "Profile not parsed yet"}
        </p>
      </Card>

      {/* Posts Section */}
      <div className="mb-8">
        <h2 className="mb-4 text-xl font-bold">Posts</h2>
        <div className="grid gap-4">
          {user.posts.map((post) => (
            <Card key={post.id} className="p-4">
              <div className="flex flex-row gap-1">
                <p className="mb-2 flex-1">{post.content}</p>
                <Button variant="outline" size="icon" asChild>
                  <Link href={`/post/${post.id}`} target="_blank">
                    <ExternalLink className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
              {post.links.length > 0 && (
                <div className="mt-2">
                  <h3 className="font-semibold">Links:</h3>
                  <ul className="list-disc pl-4">
                    {post.links.map((link) => (
                      <li key={link.id}>
                        <a
                          href={link.uri}
                          className="text-blue-500 hover:underline"
                        >
                          {link.uri}
                        </a>
                        <span className="ml-2 text-sm text-gray-500">
                          (Domain Trust Score: {link.domain.trustScore})
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Card>
          ))}
        </div>
      </div>

      {/* Followers Section */}
      <div className="grid grid-cols-2 gap-8">
        <div>
          <h2 className="mb-4 text-xl font-bold">Followers</h2>
          <div className="grid gap-2">
            {user.followers.map((follow) => (
              <FollowerCard key={follow.followerDid} user={follow.follower} />
            ))}
          </div>
        </div>

        {/* Following Section */}
        <div>
          <h2 className="mb-4 text-xl font-bold">Following</h2>
          <div className="grid gap-2">
            {user.following.map((follow) => (
              <FollowerCard key={follow.userDid} user={follow.user} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const FollowerCard = ({ user }: { user: typeof User.$inferSelect }) => {
  return (
    <Link href={`/actor/${encodeURIComponent(user.did)}`}>
      <Card className="p-3 transition-colors hover:bg-accent">
        <div className="flex items-center gap-2">
          {user.avatar && (
            <Image
              src={user.avatar}
              alt={user.handle}
              width={32}
              height={32}
              className="rounded-full"
            />
          )}
          <div>
            <p className="font-semibold">{user.displayName}</p>
            <p className="text-sm text-gray-600">@{user.handle}</p>
          </div>
        </div>
      </Card>
    </Link>
  );
};
