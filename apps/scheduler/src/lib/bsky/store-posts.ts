import type { PostView } from "@atproto/api/dist/client/types/app/bsky/feed/defs";
import type { Main as Facet } from "@atproto/api/dist/client/types/app/bsky/richtext/facet";
import { agent } from "@/lib/bsky/agent";
import { isMain as isExternalEmbed } from "@atproto/api/dist/client/types/app/bsky/embed/external";
import {
  isMain as isMainImagesEmbed,
  isView as isViewImagesEmbed,
} from "@atproto/api/dist/client/types/app/bsky/embed/images";
import { isView as isViewRecordWithMediaEmbed } from "@atproto/api/dist/client/types/app/bsky/embed/recordWithMedia";
import {
  isLink as isLinkFacet,
  isTag as isTagFacet,
} from "@atproto/api/dist/client/types/app/bsky/richtext/facet";
import axios from "axios";
import { sql } from "drizzle-orm";

import { db } from "@senka/db/client";
import {
  Domain,
  Link,
  Post,
  PostLike,
  PostMedia,
  PostToTag,
  Tag,
  User,
} from "@senka/db/schema";

async function getImageMetadata(
  url: string,
): Promise<{ mimeType: string; size: number }> {
  try {
    const response = await axios.head(url, { timeout: 5000 });

    return {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      mimeType: response.headers["content-type"] ?? "unknown",
      size: response.headers["content-length"]
        ? Number(response.headers["content-length"])
        : 0,
    };
  } catch (error: unknown) {
    console.error(`Failed to fetch metadata for ${url}:`, error);
    return { mimeType: "unknown", size: 0 };
  }
}

export const fetchPosts = async (actor: string) => {
  const {
    data: { feed },
  } = await agent.getAuthorFeed({
    actor: actor,
  });

  const postIds = [];

  for (const { post } of feed) {
    const { record } = post;

    const res = await db
      .insert(Post)
      .values({
        uri: post.uri,
        id: post.cid,
        authorDid: post.author.did,
        content: (record as { text: string }).text,
        likesCount: post.likeCount ?? 0,
        replyCount: post.replyCount ?? 0,
        repostCount: post.repostCount ?? 0,
        indexedAt: new Date(post.indexedAt),
      })
      .onConflictDoNothing()
      .returning();

    if (res[0]) {
      postIds.push(res[0].id);
    }

    const _likes = await fetchLikes(post);
    const _embeds = await fetchEmbeds(post);
  }

  return { postIds };
};

const fetchLikes = async (post: PostView) => {
  let likeCursor: string | undefined;
  const LIKES_LIMIT = 100;

  do {
    console.log(`Fetching likes for ${post.uri} in batches of ${LIKES_LIMIT}`);
    const {
      data: { likes },
    } = await agent.getLikes({
      uri: post.uri,
      cursor: likeCursor,
      limit: LIKES_LIMIT,
    });

    for (const like of likes) {
      // Try to insert the user if they don't exist
      await db
        .insert(User)
        .values({
          did: like.actor.did,
          handle: like.actor.handle,
          displayName: like.actor.displayName,
          avatar: like.actor.avatar,
          createdAt: new Date(),
        })
        .onConflictDoNothing();

      await db.insert(PostLike).values({
        postId: post.cid,
        userDid: like.actor.did,

        createdAt: new Date(like.createdAt),
        indexedAt: new Date(like.indexedAt),
      });
    }
  } while (likeCursor);
};

const fetchEmbeds = async (post: PostView) => {
  console.log(`Fetching embeds for ${post.uri}`);

  console.log("Fetching links");
  const { links, domains, tags } = await fetchLinks(post);

  // Store domains
  console.log("Storing domains");
  if (domains.length > 0) {
    await db
      .insert(Domain)
      .values(
        domains.map((domain) => ({
          url: domain,
        })),
      )
      .onConflictDoNothing();
  }

  // Store links
  console.log("Storing links");
  if (links.length > 0) {
    await db
      .insert(Link)
      .values(
        links.map(({ $type, domain, uri }) => ({
          postId: post.cid,
          domainUrl: domain,
          uri: uri,
          $type: $type as string | undefined,
        })),
      )
      .onConflictDoNothing()
      .returning();
  }
  console.log("Finished storing links");

  // Store media
  console.log("Storing media");
  const media = await fetchImageEmbeds(post);
  if (media.length > 0) {
    await db
      .insert(PostMedia)
      .values(
        media.map((m) => ({
          ...m,
          postId: post.cid,
        })),
      )
      .onConflictDoNothing()
      .returning();
  }
  console.log("Finished storing media");

  // Store tags
  console.log("Storing tags");
  if (tags.length > 0) {
    const tagRecords = await db
      .insert(Tag)
      .values(tags.map((tag) => ({ name: tag })))
      .onConflictDoUpdate({
        target: Tag.name,
        set: { name: sql`EXCLUDED.name` },
      })
      .returning();

    await db
      .insert(PostToTag)
      .values(
        tagRecords.map((tag) => ({
          postId: post.cid,
          tagId: tag.id,
        })),
      )
      .onConflictDoNothing();
  }
  console.log("Finished storing tags");

  console.log(`Finished fetching embeds for ${post.uri}`);
};

const fetchLinks = async (post: PostView) => {
  const embed = post.embed;
  const links = [];
  const tags = [];
  if (isExternalEmbed(embed)) {
    links.push({
      uri: embed.external.uri,
      $type: embed.$type,
    });
  }

  const facets = (post.record as { facets?: Facet[] }).facets;
  if (facets && Array.isArray(facets)) {
    for (const facet of facets) {
      if (!facet.features || !Array.isArray(facet.features)) {
        continue;
      }

      for (const feature of facet.features) {
        if (isLinkFacet(feature)) {
          links.push({
            uri: feature.uri,
            $type: feature.$type,
          });
          continue;
        }

        if (isTagFacet(feature)) {
          tags.push(feature.tag);
          continue;
        }

        console.log(
          `Found unhandled facet ${feature.$type}: ${JSON.stringify(feature)}`,
        );
      }
    }
  }

  const formattedLinks = links.map((link) => {
    const domain = new URL(link.uri).hostname;

    return {
      uri: link.uri,
      domain: domain,
      $type: link.$type,
    };
  });

  return {
    links: formattedLinks,
    domains: formattedLinks.map((link) => link.domain),
    tags: tags,
  };
};

const fetchImageEmbeds = async (post: PostView) => {
  const embed = post.embed;

  if (!embed) {
    return [];
  }

  if (isMainImagesEmbed(embed)) {
    return embed.images.map((img) => ({
      url: `https://cdn.bsky.app/img/feed_fullsize/plain/${post.author.did}/${img.image.ref.$link}@${img.image.mimeType.split("/")[1]}`,
      mimeType: img.image.mimeType,
      size: img.image.size,
      altText: img.alt,
      width: img.aspectRatio?.width ?? 0,
      height: img.aspectRatio?.height ?? 0,
    }));
  }

  if (isViewImagesEmbed(embed)) {
    const images = [];
    for (const img of embed.images) {
      const metadata = await getImageMetadata(img.fullsize);

      images.push({
        url: img.fullsize,
        mimeType: metadata.mimeType,
        size: metadata.size,
        altText: img.alt,
        width: img.aspectRatio?.width ?? 0,
        height: img.aspectRatio?.height ?? 0,
      });
    }

    return images;
  }

  if (isViewRecordWithMediaEmbed(embed) && isViewImagesEmbed(embed.media)) {
    const images = [];
    for (const img of embed.media.images) {
      const metadata = await getImageMetadata(img.fullsize);

      images.push({
        url: img.fullsize,
        mimeType: metadata.mimeType,
        size: metadata.size,
        altText: img.alt,
        width: img.aspectRatio?.width ?? 0,
        height: img.aspectRatio?.height ?? 0,
      });
    }

    return images;
  }

  return [];
};
