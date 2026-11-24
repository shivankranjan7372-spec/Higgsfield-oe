import "server-only";

import fs from "node:fs";
import path from "node:path";
import { normalizeTag } from "./community/shared";
import { dataDir, get, newId, run, tx } from "./db";
import { imageSize, sniff } from "./media";

/**
 * Demo content for a fresh install: a few house accounts that have already published pictures,
 * so the community feed and the home page are not empty the first time the app is opened.
 *
 * It runs only when PARALLAX_DEMO_SEED=1, and only once per data directory. The pictures in
 * `seed/demo/` are AI-generated samples. Each post carries a prompt and a model id, so
 * Recreate works on all of them. The accounts have no email and no
 * password, so nobody can sign in as them. The likes and follows between them are real rows.
 */

interface SeedMember {
  handle: string;
  name: string;
  bio: string;
  /** File name under seed/demo/media. */
  avatar: string;
}

interface SeedPost {
  /** File name under seed/demo/media. */
  file: string;
  title: string;
  tags: string[];
  /** Handle of the member who posts it. */
  member: string;
  model: string;
  aspect: string;
  prompt: string;
  /** How long before the moment of seeding the post was published. */
  ageMinutes: number;
}

interface Stored {
  id: string;
  rel: string;
  mime: string;
  bytes: number;
  width: number | null;
  height: number | null;
}

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

function seedDir(): string {
  return path.join(/* turbopackIgnore: true */ process.cwd(), "seed", "demo");
}

/** A stable number from a string, so the same seed always gives the same likes. */
function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Copies one seed picture into a member's folder in the data directory. */
function store(userId: string, file: string): Stored {
  const bytes = fs.readFileSync(path.join(seedDir(), "media", path.basename(file)));
  const found = sniff(bytes);
  if (!found || found.kind !== "image") throw new Error(`${file} is not a picture`);
  const id = newId("ast");
  const rel = path.join("assets", userId, `${id}.${found.ext}`);
  const abs = path.join(dataDir(), rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, bytes);
  const size = imageSize(bytes, found.mime);
  return { id, rel, mime: found.mime, bytes: bytes.length, width: size?.width ?? null, height: size?.height ?? null };
}

export function ensureDemoSeed(): void {
  if (process.env.PARALLAX_DEMO_SEED !== "1") return;
  const list = path.join(seedDir(), "posts.json");
  if (!fs.existsSync(list)) {
    console.warn("[demo seed] seed/demo/posts.json is missing, so nothing was added.");
    return;
  }
  const seed = JSON.parse(fs.readFileSync(list, "utf8")) as { members: SeedMember[]; posts: SeedPost[] };
  if (seed.members.length === 0) return;
  // The first account marks a data directory that already has the demo content.
  if (get("SELECT 1 FROM users WHERE handle = ?", seed.members[0].handle)) return;
  // A handle that someone already took is left alone, and so are that member's posts.
  const members = seed.members.filter((m) => !get("SELECT 1 FROM users WHERE handle = ?", m.handle));
  const ids = new Map(members.map((m) => [m.handle, newId("usr")]));

  const now = Date.now();
  const joined = now - 12 * DAY;
  try {
    const avatars = new Map(members.map((m) => [m.handle, store(ids.get(m.handle)!, m.avatar)]));
    // Oldest first: the New tab lists posts in the order they were added.
    const posts = seed.posts
      .filter((p) => ids.has(p.member))
      .sort((a, b) => b.ageMinutes - a.ageMinutes)
      .map((p) => ({ ...p, stored: store(ids.get(p.member)!, p.file) }));

    const addAsset = (userId: string, s: Stored, title: string, prompt: string, model: string | null, params: object, createdAt: number, publishedAt: number | null) =>
      run(
        `INSERT INTO assets (id, user_id, kind, source, mime, bytes, width, height, path, title, prompt, model_id, params, is_public, published_at, created_at)
         VALUES (?, ?, 'image', 'generated', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        s.id,
        userId,
        s.mime,
        s.bytes,
        s.width,
        s.height,
        s.rel,
        title,
        prompt,
        model,
        JSON.stringify(params),
        publishedAt === null ? 0 : 1,
        publishedAt,
        createdAt,
      );

    tx(() => {
      for (const m of members) {
        const userId = ids.get(m.handle)!;
        const avatar = avatars.get(m.handle)!;
        run("INSERT INTO users (id, handle, name, bio, avatar_asset_id, created_at) VALUES (?, ?, ?, ?, ?, ?)", userId, m.handle, m.name, m.bio, avatar.id, joined);
        addAsset(userId, avatar, m.name, "", null, {}, joined, null);
      }
      for (const a of members) {
        for (const b of members) {
          if (a !== b) run("INSERT INTO community_follows (follower_id, followee_id, created_at) VALUES (?, ?, ?)", ids.get(a.handle)!, ids.get(b.handle)!, joined + DAY);
        }
      }
      for (const p of posts) {
        const userId = ids.get(p.member)!;
        const published = now - p.ageMinutes * MINUTE;
        // Each of the other accounts likes about two posts in three.
        const likers = members.filter((m) => m.handle !== p.member && hash(`${p.file}:${m.handle}`) % 3 !== 0);
        const postId = newId("pst");
        addAsset(userId, p.stored, p.title, p.prompt, p.model, { aspect: p.aspect }, published - 3 * MINUTE, published);
        run(
          `INSERT INTO community_posts (id, asset_id, user_id, kind, model_id, title, allow_recreate, like_count, published_at, updated_at)
           VALUES (?, ?, ?, 'image', ?, ?, 1, ?, ?, ?)`,
          postId,
          p.stored.id,
          userId,
          p.model,
          p.title,
          likers.length,
          published,
          published,
        );
        const tags = new Set(p.tags.map(normalizeTag).filter((t): t is string => t !== null));
        for (const tag of tags) run("INSERT INTO community_post_tags (post_id, tag) VALUES (?, ?)", postId, tag);
        likers.forEach((m, i) => {
          run("INSERT INTO community_likes (post_id, user_id, created_at) VALUES (?, ?, ?)", postId, ids.get(m.handle)!, Math.min(now - MINUTE, published + (i + 1) * 9 * MINUTE));
        });
      }
    });
    console.log(`[demo seed] added ${members.length} demo accounts and ${posts.length} posts.`);
  } catch (err) {
    // Nothing was saved, so the copied pictures go too.
    for (const id of ids.values()) fs.rmSync(path.join(dataDir(), "assets", id), { recursive: true, force: true });
    throw err;
  }
}
