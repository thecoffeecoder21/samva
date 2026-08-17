# Samva

**Built in India, connected everywhere.** Samva is a web-first communication platform that blends the best of WhatsApp, Telegram, Slack, Discord and Instagram into one calm, fast interface — chat, media, polls, presence and communities in a single app.

Live at **[web-three-mocha-53.vercel.app](https://web-three-mocha-53.vercel.app)**.

---

## Table of contents

- [Overview](#overview)
- [Features](#features)
- [Tech stack](#tech-stack)
- [Architecture](#architecture)
- [Project structure](#project-structure)
- [Getting started](#getting-started)
- [Environment variables](#environment-variables)
- [Database](#database)
- [Development scripts](#development-scripts)
- [Deployment](#deployment)
- [Roadmap](#roadmap)

## Overview

Samva is a Next.js 16 (App Router) monorepo built as a real, deployed product rather than a static prototype — every feature below is backed by a real Postgres database, real WebSocket-based realtime delivery, real file storage, and real push notifications. Authentication, data, and infra all run on managed platforms (Clerk, Neon, Upstash, Vercel Blob) so there's no local backend to stand up.

## Features

**Messaging**
- 1:1 and group conversations, with member roles (owner/admin/member)
- Text, image, video, voice notes, documents, and link messages
- Replies, edits, deletes, emoji reactions, forwarding, pinned messages
- Read receipts, typing indicators, and online/last-seen presence
- Full-text search across conversations and messages
- Blocking, with mutual enforcement on both sides of a conversation

**Rich content**
- **Polls** — single or multiple-choice, live vote counts over realtime
- **Link previews** — Open Graph scraping (title/description/image) for any URL shared in chat, generated asynchronously after send
- **Disappearing messages** — per-conversation timers (1 hour / 1 day / 1 week), enforced server-side and cleaned up by a daily cron job
- **Message effects** — opt-in full-screen send effects (confetti, balloons, hearts, fireworks), played for both sender and receiver

**Identity & discovery**
- Public profile pages (`/u/[username]`) shareable via a generated **QR code** or copyable link
- Username-based onboarding and search

**Personalization**
- Six chat themes (Light, Dark, Midnight, Ocean, Sakura, Forest), instantly switchable
- i18n foundation with English and Hindi (हिन्दी), including Devanagari font loading — cookie-based so there's no locale flash or hydration mismatch
- Web Push notifications for new messages, opt-in from the profile page

**Platform**
- Realtime delivery via WebSockets, fanned out across serverless instances with Postgres `LISTEN`/`NOTIFY`
- Presence tracked with Upstash Redis connection counters
- Media uploads go straight to Vercel Blob via signed client uploads (no round-trip through the app server)

## Tech stack

| Layer | Choice |
|---|---|
| Framework | [Next.js 16](https://nextjs.org) (App Router, Turbopack) |
| Language | TypeScript |
| Styling | [Tailwind CSS v4](https://tailwindcss.com) (CSS-first `@theme`), custom design tokens |
| Auth | [Clerk](https://clerk.com) |
| Database | [Neon](https://neon.tech) serverless Postgres via [Drizzle ORM](https://orm.drizzle.team) |
| Realtime | WebSockets (`@vercel/functions` `experimental_upgradeWebSocket`) + Postgres `LISTEN`/`NOTIFY` |
| Presence / cache | [Upstash Redis](https://upstash.com) |
| File storage | [Vercel Blob](https://vercel.com/docs/storage/vercel-blob) |
| Push notifications | Web Push (`web-push`, self-hosted VAPID keys, service worker) |
| Monorepo | [Turborepo](https://turborepo.com) + pnpm workspaces |
| Hosting | [Vercel](https://vercel.com) (Fluid Compute, Cron Jobs) |

## Architecture

Samva is a Turborepo monorepo:

```
apps/
  web/            Next.js application — the entire product surface
packages/
  db/             Drizzle schema, migrations, and the Postgres client
  types/          Shared TypeScript types (Message, Poll, RealtimeEvent, ...)
  ui/             Shared design-system components and CSS tokens
  config/         Shared tooling config (ESLint, TypeScript)
```

Realtime works in two layers:
1. **WebSocket route** (`/api/ws`) — holds an open connection per browser tab, handles subscribe/unsubscribe/typing messages, and tracks presence.
2. **Postgres `LISTEN`/`NOTIFY` bus** (`lib/realtime/bus.ts`) — fans events out across serverless function instances (a plain in-process `EventEmitter` isn't enough once there's more than one instance). Runs over the *unpooled* Neon connection, since `LISTEN` doesn't survive connection pooling, with a keepalive query to prevent Neon's autosuspend from silently dropping the connection.

Disappearing messages are enforced twice: the read query always filters out expired rows (so it's correct even if the cron hasn't run yet), and a daily Vercel Cron job (`/api/cron/purge-expired`, guarded by `CRON_SECRET`) physically deletes them to reclaim storage.

## Project structure

```
apps/web/src/
  app/
    (app)/              Authenticated shell: chats, communities, calls, discover, profile, public profiles
    api/                Route handlers: conversations, messages, polls, push, search, upload, ws, cron
    actions/            Server Actions (e.g. locale switching)
    sign-in/ sign-up/   Clerk-hosted auth pages
  components/
    chat/               ChatWindow, MessageBubble, MessageComposer, PollMessage, dialogs, etc.
  lib/
    i18n/               Locale dictionaries, server-side locale resolution, React context
    realtime/           WebSocket client hook + Postgres pub/sub bus
    messages.ts         Message hydration, DTO mapping, link-preview + purge jobs
    queries.ts          Conversation list/header read models
    auth.ts blocks.ts push.ts uploadFile.ts ...
```

## Getting started

### Prerequisites

- Node.js ≥ 20
- pnpm 9
- A [Vercel](https://vercel.com) project with **Neon Postgres**, **Clerk**, and **Upstash Redis** integrations installed (`vercel integration add neon|clerk|upstash`), or equivalent accounts created directly with those providers

### Install

```bash
pnpm install
```

### Configure environment variables

Pull provisioned values from Vercel (recommended):

```bash
vercel link
vercel env pull apps/web/.env.local
```

Or copy `apps/web/.env.example` and fill in the values yourself — see [Environment variables](#environment-variables) below.

### Run migrations

```bash
pnpm db:generate   # generate SQL from packages/db/src/schema.ts
pnpm db:migrate    # apply migrations to your database
```

### Start the dev server

```bash
pnpm dev
```

The app runs at `http://localhost:3000`. Note: the WebSocket realtime route only works when deployed to Vercel (Fluid Compute) — locally, realtime features degrade gracefully rather than connecting.

### Build for production

```bash
pnpm build
```

## Environment variables

| Variable | Used for |
|---|---|
| `DATABASE_URL` | Pooled Neon Postgres connection (all normal queries) |
| `DATABASE_URL_UNPOOLED` | Direct Neon connection for `LISTEN`/`NOTIFY` realtime fan-out |
| `CLERK_SECRET_KEY` | Clerk server-side API |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk client-side SDK |
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` | Upstash Redis REST API (presence counters) |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob client uploads |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | Self-generated Web Push VAPID keys |
| `CRON_SECRET` | Authenticates the daily disappearing-messages purge cron |

All of these are auto-provisioned when the corresponding Vercel Marketplace integration is installed, and synced locally via `vercel env pull`.

## Database

Schema lives in `packages/db/src/schema.ts` and is managed with [Drizzle Kit](https://orm.drizzle.team/kit-docs/overview):

```bash
pnpm --filter @samva/db generate   # create a migration from schema changes
pnpm --filter @samva/db migrate    # apply pending migrations
```

Core tables: `users`, `profiles`, `conversations`, `conversation_members`, `messages`, `message_attachments`, `reactions`, `polls` / `poll_options` / `poll_votes`, `link_previews`, `blocks`, `push_subscriptions`.

## Development scripts

| Command | Description |
|---|---|
| `pnpm dev` | Run all apps in dev mode (Turborepo) |
| `pnpm build` | Production build |
| `pnpm lint` | Lint all workspaces |
| `pnpm typecheck` | Type-check all workspaces |
| `pnpm db:generate` | Generate a Drizzle migration |
| `pnpm db:migrate` | Apply Drizzle migrations |

## Deployment

Samva is deployed on Vercel with the project root set to `apps/web`. Pushing to the default branch (or running `vercel deploy --prod`) builds and deploys the Next.js app; `apps/web/vercel.json` configures the daily cron job for disappearing-message cleanup.

## Roadmap

Not yet built, tracked as future work: voice/video calling, stickers & GIFs, communities/channels, an admin/moderation dashboard, and monetization.
