import Image from "next/image";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { ExternalLink, FileJson2 } from "lucide-react";

import { db } from "@senka/db/client";
import {
  Link as DbLink,
  Domain,
  Post,
  PostMedia,
  PostToTag,
  PostToTopic,
  Tag,
  Topic,
  User,
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

async function getPostData(id: string) {
  const post = await db.query.Post.findFirst({
    where: eq(Post.id, id),
    with: {
      author: true,
      media: true,
      links: {
        with: {
          domain: true,
        },
      },
      tags: {
        with: {
          tag: true,
        },
      },
      topics: {
        with: {
          topic: true,
        },
      },
    },
  });

  return post;
}

export default async function PostPage({ params }: { params: { id: string } }) {
  const post = await getPostData(params.id);

  if (!post) {
    return <div>Post not found</div>;
  }

  return (
    <div className="container mx-auto p-4">
      {/* Post Content Section */}
      <Card className="mb-8 p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            {post.author.avatar && (
              <Image
                src={post.author.avatar}
                alt={post.author.handle}
                width={64}
                height={64}
                className="rounded-full"
              />
            )}
            <div>
              <Link href={`/actor/${encodeURIComponent(post.author.did)}`}>
                <h2 className="text-xl font-bold hover:underline">
                  {post.author.displayName}
                </h2>
                <p className="text-gray-600">@{post.author.handle}</p>
              </Link>
              <p className="mt-2 text-sm text-gray-500">
                Posted on {post.createdAt.toLocaleString()}
              </p>
            </div>
          </div>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon">
                <FileJson2 className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent className="max-w-3xl sm:max-w-2xl">
              <SheetHeader>
                <SheetTitle>Raw Post Data</SheetTitle>
              </SheetHeader>
              <div className="mt-4">
                <pre className="overflow-auto rounded-md bg-muted p-4 text-sm">
                  {JSON.stringify(post, null, 2)}
                </pre>
              </div>
            </SheetContent>
          </Sheet>
        </div>

        <div className="mt-4">
          <p className="whitespace-pre-wrap">{post.content}</p>
        </div>

        {/* Engagement Metrics */}
        <div className="mt-4 flex gap-4 text-sm text-gray-600">
          <span>{post.likesCount} likes</span>
          <Separator orientation="vertical" />
          <span>{post.replyCount} replies</span>
          <Separator orientation="vertical" />
          <span>{post.repostCount} reposts</span>
          <Separator orientation="vertical" />
          <span>{post.quoteCount} quotes</span>
        </div>
      </Card>

      {/* NSFW Warning */}
      {post.isNsfw && (
        <Card className="mb-4 border-red-200 bg-red-50 p-4">
          <p className="font-semibold text-red-600">⚠️ NSFW Content</p>
          <p className="text-sm text-red-500">
            Text NSFW Score: {post.textNsfwScore}
          </p>
        </Card>
      )}

      {/* Sentiment Analysis */}
      {post.sentimentLabel && (
        <Card className="mb-4 p-4">
          <h3 className="text-lg font-bold">Sentiment Analysis</h3>
          <p>
            Label: {post.sentimentLabel} (Score: {post.sentimentScore})
          </p>
        </Card>
      )}

      {/* Media Section */}
      {post.media.length > 0 && (
        <div className="mb-8">
          <h2 className="mb-4 text-xl font-bold">Media</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {post.media.map((media) => (
              <Card key={media.id} className="p-4">
                <div className="relative aspect-video">
                  <Image
                    src={media.url}
                    alt="Post media"
                    fill
                    className="rounded-md object-cover"
                  />
                </div>
                <div className="mt-2 text-sm text-gray-600">
                  <p>Type: {media.mimeType}</p>
                  <p>Size: {(media.size / 1024 / 1024).toFixed(2)} MB</p>
                  <p>
                    Dimensions: {media.width}x{media.height}
                  </p>
                  {media.isNsfw && (
                    <p className="text-red-600">
                      NSFW Score: {media.nsfwScore}
                    </p>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Links Section */}
      {post.links.length > 0 && (
        <div className="mb-8">
          <h2 className="mb-4 text-xl font-bold">Links</h2>
          <div className="grid gap-4">
            {post.links.map((link) => (
              <Card key={link.id} className="p-4">
                <div className="flex items-center justify-between">
                  <a
                    href={link.uri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-blue-500 hover:underline"
                  >
                    {link.uri}
                    <ExternalLink className="h-4 w-4" />
                  </a>
                  <span
                    className={cn(
                      "rounded px-2 py-1 text-sm",
                      link.domain.trustScore >= 70
                        ? "bg-green-100 text-green-800"
                        : link.domain.trustScore >= 40
                          ? "bg-yellow-100 text-yellow-800"
                          : "bg-red-100 text-red-800",
                    )}
                  >
                    Trust Score: {link.domain.trustScore}
                  </span>
                </div>
                {link.domain.category && (
                  <p className="mt-2 text-sm text-gray-600">
                    Category: {link.domain.category}
                  </p>
                )}
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Tags and Topics Section */}
      <div className="grid grid-cols-2 gap-8">
        {post.tags.length > 0 && (
          <div>
            <h2 className="mb-4 text-xl font-bold">Tags</h2>
            <div className="flex flex-wrap gap-2">
              {post.tags.map(({ tag }) => (
                <span
                  key={tag.id}
                  className="rounded-full bg-blue-100 px-3 py-1 text-sm text-blue-800"
                >
                  {tag.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {post.topics.length > 0 && (
          <div>
            <h2 className="mb-4 text-xl font-bold">Topics</h2>
            <div className="flex flex-wrap gap-2">
              {post.topics.map(({ topic, score }) => (
                <span
                  key={topic.id}
                  className="rounded-full bg-purple-100 px-3 py-1 text-sm text-purple-800"
                >
                  {topic.name} ({score})
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
