/** Shapes of the community API (docs/api/community.md). */

export type PostKind = "image" | "video" | "audio";

export interface Author {
  id: string;
  handle: string;
  name: string;
  avatarUrl: string | null;
}

export interface Post {
  id: string;
  kind: PostKind;
  media: {
    assetId: string;
    url: string;
    posterUrl: string | null;
    mime: string;
    width: number | null;
    height: number | null;
    duration: number | null;
  };
  title: string;
  description: string;
  tags: string[];
  author: Author;
  model: { id: string; name: string } | null;
  allowRecreate: boolean;
  prompt: string | null;
  counts: { likes: number; saves: number; comments: number; views: number };
  viewer: { liked: boolean; saved: boolean; followingAuthor: boolean; isAuthor: boolean } | null;
  publishedAt: number;
  updatedAt: number;
}

export interface Comment {
  id: string;
  postId: string;
  body: string;
  author: Author;
  createdAt: number;
  canDelete: boolean;
}

export interface Profile {
  id: string;
  handle: string;
  name: string;
  bio: string;
  avatarUrl: string | null;
  joinedAt: number;
  counts: { posts: number; followers: number; following: number; likes: number; views: number };
  viewer: { isSelf: boolean; following: boolean; followsYou: boolean; hidden: boolean } | null;
}

export type Phase = "upcoming" | "open" | "voting" | "ended";

export interface Contest {
  id: string;
  slug: string;
  title: string;
  summary: string;
  brief: string;
  rules: string[];
  kind: PostKind | null;
  prize: string;
  phase: Phase;
  canEnter: boolean;
  canVote: boolean;
  opensAt: number;
  closesAt: number;
  endsAt: number;
  entries: number;
  viewer: { entryPostId: string | null } | null;
}

export interface Entry {
  rank: number;
  votes: number;
  enteredAt: number;
  viewer: { voted: boolean } | null;
  post: Post;
}

export interface PostPage {
  posts: Post[];
  nextCursor: string | null;
}
