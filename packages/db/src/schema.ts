import { relations, sql } from "drizzle-orm";
import { index, pgTable, primaryKey } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

/**
 * Post table and relations
 */
export const Post = pgTable(
  "post",
  (t) => ({
    id: t.text().primaryKey(), // Bluesky post ID
    uri: t.text().unique(), // Bluesky post URI

    content: t.text().notNull(),

    likesCount: t.integer().default(0),
    replyCount: t.integer().default(0),
    repostCount: t.integer().default(0),
    quoteCount: t.integer().default(0),

    websiteUrl: t.text("website_url"),

    isNsfw: t.boolean().notNull().default(false),
    textNsfwScore: t.numeric(),

    sentimentLabel: t.text(),
    sentimentScore: t.numeric(),

    authorDid: t
      .text("author_did")
      .notNull()
      .references(() => User.did, { onDelete: "cascade" }),

    createdAt: t.timestamp().defaultNow().notNull(),
    indexedAt: t.timestamp({ mode: "date", withTimezone: true }).defaultNow(),

    lastAnalyzedAt: t.timestamp({ mode: "date", withTimezone: true }),

    updatedAt: t
      .timestamp({ mode: "date", withTimezone: true })
      .$onUpdateFn(() => sql`now()`),
  }),
  (t) => ({
    authorDidIdx: index("post_author_did_idx").on(t.authorDid),
    createdAtIdx: index("post_created_at_idx").on(t.createdAt),
    // Engagement counts indexes
    likesCountIdx: index("post_likes_count_idx").on(t.likesCount),
    replyCountIdx: index("post_reply_count_idx").on(t.replyCount),
    repostCountIdx: index("post_repost_count_idx").on(t.repostCount),
  }),
);

export const PostRelations = relations(Post, ({ one, many }) => ({
  author: one(User, { fields: [Post.authorDid], references: [User.did] }),
  media: many(PostMedia),
  links: many(Link),
  tags: many(PostToTag),
  topics: many(PostToTopic),
}));

/**
 * Post Interactions
 */
export const PostLike = pgTable(
  "post_like",
  (t) => ({
    postId: t
      .text("post_id")
      .notNull()
      .references(() => Post.id, { onDelete: "cascade" }),
    userDid: t
      .text("user_did")
      .notNull()
      .references(() => User.did, { onDelete: "cascade" }),

    createdAt: t.timestamp({ mode: "date", withTimezone: true }).defaultNow(),
    indexedAt: t.timestamp({ mode: "date", withTimezone: true }).defaultNow(),
  }),
  (t) => ({
    pk: primaryKey({ columns: [t.postId, t.userDid] }),
  }),
);

export const PostMedia = pgTable("post_media", (t) => ({
  id: t.uuid().notNull().primaryKey().defaultRandom(),

  postId: t
    .text("post_id")
    .notNull()
    .references(() => Post.id, { onDelete: "cascade" }), // Links to Post

  url: t.text("url").notNull(),
  mimeType: t.text("mime_type").notNull(),
  size: t.integer("size").notNull(),
  width: t.integer("width").notNull().default(0),
  height: t.integer("height").notNull().default(0),

  isNsfw: t.boolean().notNull().default(false),
  nsfwScore: t.numeric(),

  createdAt: t
    .timestamp("created_at", {
      mode: "date",
      withTimezone: true,
    })
    .defaultNow(),
}));

export const PostMediaRelations = relations(PostMedia, ({ one }) => ({
  post: one(Post, { fields: [PostMedia.postId], references: [Post.id] }),
}));

export const Tag = pgTable("tag", (t) => ({
  id: t.uuid().notNull().primaryKey().defaultRandom(),
  name: t.text("name").notNull().unique(),
}));

export const TagRelations = relations(Tag, ({ many }) => ({
  posts: many(PostToTag),
}));

export const PostToTag = pgTable(
  "post_to_tag",
  (t) => ({
    postId: t
      .text("post_id")
      .notNull()
      .references(() => Post.id, { onDelete: "cascade" }),
    tagId: t
      .uuid("tag_id")
      .notNull()
      .references(() => Tag.id, { onDelete: "cascade" }),
    createdAt: t.timestamp({ mode: "date", withTimezone: true }).defaultNow(),
  }),
  (t) => ({
    pk: primaryKey({ columns: [t.postId, t.tagId] }),
    postIdIdx: index("post_to_tag_post_id_idx").on(t.postId),
    tagIdIdx: index("post_to_tag_tag_id_idx").on(t.tagId),
  }),
);

export const PostToTagRelations = relations(PostToTag, ({ one }) => ({
  post: one(Post, { fields: [PostToTag.postId], references: [Post.id] }),
  tag: one(Tag, { fields: [PostToTag.tagId], references: [Tag.id] }),
}));

export const Topic = pgTable("topic", (t) => ({
  id: t.uuid().notNull().primaryKey().defaultRandom(),
  name: t.text("name").notNull().unique(),
}));

export const TopicRelations = relations(Topic, ({ many }) => ({
  posts: many(PostToTopic),
}));

export const PostToTopic = pgTable(
  "post_to_topic",
  (t) => ({
    postId: t
      .text("post_id")
      .notNull()
      .references(() => Post.id, { onDelete: "cascade" }),
    topicId: t
      .uuid("topic_id")
      .notNull()
      .references(() => Topic.id, { onDelete: "cascade" }),
    score: t.numeric().notNull(),
    createdAt: t.timestamp({ mode: "date", withTimezone: true }).defaultNow(),
  }),
  (t) => ({
    pk: primaryKey({ columns: [t.postId, t.topicId] }),
    postIdIdx: index("post_to_topic_post_id_idx").on(t.postId),
    topicIdIdx: index("post_to_topic_topic_id_idx").on(t.topicId),
  }),
);

export const PostToTopicRelations = relations(PostToTopic, ({ one }) => ({
  post: one(Post, { fields: [PostToTopic.postId], references: [Post.id] }),
  topic: one(Topic, { fields: [PostToTopic.topicId], references: [Topic.id] }),
}));

/**
 * Link tables and relations
 */
export const Link = pgTable(
  "link",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),

    postId: t
      .text("post_id")
      .notNull()
      .references(() => Post.id, { onDelete: "cascade" }),

    uri: t.text().notNull().unique(),
    domainUrl: t
      .text()
      .notNull()
      .references(() => Domain.url, {
        onDelete: "set null",
      }),

    trustScore: t.integer().notNull().default(0),
    relevanceScore: t.integer().default(0), // How relevant the link is to the post content
    httpStatus: t.integer(),
    contentType: t.text(),

    $type: t.text(),

    lastCheckedAt: t.timestamp({ mode: "date", withTimezone: true }),
    parsedAt: t.timestamp({ mode: "date", withTimezone: true }).defaultNow(),
  }),
  (t) => ({
    postIdIdx: index("link_post_id_idx").on(t.postId),
    domainUrlIdx: index("link_domain_url_idx").on(t.domainUrl),
    trustScoreIdx: index("link_trust_score_idx").on(t.trustScore),
    relevanceScoreIdx: index("link_relevance_score_idx").on(t.relevanceScore),
  }),
);

export const LinkRelations = relations(Link, ({ one }) => ({
  post: one(Post, { fields: [Link.postId], references: [Post.id] }),
  domain: one(Domain, { fields: [Link.domainUrl], references: [Domain.url] }),
}));

export const Domain = pgTable(
  "domain",
  (t) => ({
    url: t.text().notNull().primaryKey(),

    trustScore: t.integer().notNull().default(0),
    isSslValid: t.boolean().notNull().default(false),
    dgaScore: t.numeric(),
    isMalicious: t.boolean().notNull().default(false),
    contentQuality: t.integer().default(0),
    hasValidWhois: t.boolean().notNull().default(false),
    hasValidDns: t.boolean().notNull().default(false),

    category: t.text(),
    popularity: t.integer().notNull().default(0), // Number of times linked

    createdAt: t.timestamp({ mode: "date", withTimezone: true }), // domain creation date, from WHOIS data
    lastCheckedAt: t.timestamp({ mode: "date", withTimezone: true }),
  }),
  (t) => ({
    trustScoreIdx: index("domain_trust_score_idx").on(t.trustScore),
    categoryUdx: index("domain_category_udx").on(t.category),
    popularityIdx: index("domain_popularity_idx").on(t.popularity),
    contentQualityIdx: index("domain_content_quality_idx").on(t.contentQuality),
  }),
);

export const DomainRelations = relations(Domain, ({ many }) => ({
  links: many(Link),
}));

/**
 * User tables and relations
 */
export const User = pgTable(
  "user",
  (t) => ({
    did: t.varchar({ length: 255 }).notNull().primaryKey(),

    handle: t.varchar({ length: 255 }).unique().notNull(),
    displayName: t.varchar({ length: 255 }),
    avatar: t.varchar({ length: 255 }),

    followersCount: t.integer().default(0),
    followsCount: t.integer().default(0),

    parsedAt: t.timestamp({ mode: "date", withTimezone: true }),

    createdAt: t.timestamp().defaultNow().notNull(),
  }),
  (t) => ({
    followersCountIdx: index("user_followers_count_idx").on(t.followersCount),
    followsCountIdx: index("user_follows_count_idx").on(t.followsCount),
  }),
);

export const UserFollower = pgTable(
  "user_follower",
  (t) => ({
    userDid: t
      .varchar({ length: 255 })
      .notNull()
      .references(() => User.did, { onDelete: "cascade" }), // The user being followed

    followerDid: t
      .varchar({ length: 255 })
      .notNull()
      .references(() => User.did, { onDelete: "cascade" }), // The user who is following

    followedAt: t.timestamp({ mode: "date", withTimezone: true }).defaultNow(),
  }),
  (t) => ({
    pk: primaryKey({ columns: [t.userDid, t.followerDid] }), // Prevent duplicate follows
    userIdx: index("user_follower_user_idx").on(t.userDid),
    followerIdx: index("user_follower_follower_idx").on(t.followerDid),
  }),
);

export const UserRelations = relations(User, ({ many }) => ({
  accounts: many(Account),

  posts: many(Post),
  followers: many(UserFollower, { relationName: "user_followers" }), // Followers of this user
  following: many(UserFollower, { relationName: "user_following" }), // Users this user is following
}));

export const UserFollowerRelations = relations(UserFollower, ({ one }) => ({
  user: one(User, {
    fields: [UserFollower.userDid],
    references: [User.did],
    relationName: "user_followers",
  }),

  follower: one(User, {
    fields: [UserFollower.followerDid],
    references: [User.did],
    relationName: "user_following",
  }),
}));

export const Account = pgTable(
  "account",
  (t) => ({
    userId: t
      .varchar({ length: 255 })
      .notNull()
      .references(() => User.did, { onDelete: "cascade" }),
    type: t
      .varchar({ length: 255 })
      .$type<"email" | "oauth" | "oidc" | "webauthn">()
      .notNull(),
    provider: t.varchar({ length: 255 }).notNull(),
    providerAccountId: t.varchar({ length: 255 }).notNull(),
    refresh_token: t.varchar({ length: 255 }),
    access_token: t.text(),
    expires_at: t.integer(),
    token_type: t.varchar({ length: 255 }),
    scope: t.varchar({ length: 255 }),
    id_token: t.text(),
    session_state: t.varchar({ length: 255 }),
  }),
  (account) => ({
    compoundKey: primaryKey({
      columns: [account.provider, account.providerAccountId],
    }),
  }),
);

export const AccountRelations = relations(Account, ({ one }) => ({
  user: one(User, { fields: [Account.userId], references: [User.did] }),
}));

export const Session = pgTable("session", (t) => ({
  sessionToken: t.varchar({ length: 255 }).notNull().primaryKey(),
  userId: t
    .varchar({ length: 255 })
    .notNull()
    .references(() => User.did, { onDelete: "cascade" }),
  expires: t.timestamp({ mode: "date", withTimezone: true }).notNull(),
}));

export const SessionRelations = relations(Session, ({ one }) => ({
  user: one(User, { fields: [Session.userId], references: [User.did] }),
}));
