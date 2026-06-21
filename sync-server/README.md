# Split Expenses sync server

A Cloudflare Worker + Durable Object that powers live collaboration for the
Split Expenses tool. Each room id maps to one Durable Object that owns the
room's Yjs document, persists it to storage, and relays updates between the
connected devices. It speaks the `y-websocket` wire protocol, so the browser
talks to it with an unmodified `WebsocketProvider`.

It uses the **WebSocket Hibernation API**, so idle-but-connected clients do not
keep the object in memory and do not run up duration billing. This is what keeps
a small group inside the Workers Free plan.

## Deploy

```sh
cd sync-server
npm install
npx wrangler login        # once
npm run deploy            # wrangler deploy
```

Wrangler prints the deployed URL, e.g. `https://split-sync.<subdomain>.workers.dev`.

## Point the site at it

The client reads `PUBLIC_SPLIT_SYNC_URL` (see `src/components/tools/SplitExpenses.svelte`).
Set it to the **wss://** form of the deployed URL when building the site:

```sh
# .env at the repo root
PUBLIC_SPLIT_SYNC_URL=wss://split-sync.<subdomain>.workers.dev
```

For a custom domain, add a route in `wrangler.toml` and use
`wss://split-sync.thathsara.lk`. The default fallback in the client is
`wss://split-sync.thathsara.lk`; change it if you deploy elsewhere.

## Local development

```sh
npm run dev               # wrangler dev, serves ws://127.0.0.1:8787
```

Then run the site with `PUBLIC_SPLIT_SYNC_URL=ws://127.0.0.1:8787`.

## How it works

- `src/index.ts` routes `wss://host/<roomId>` to the Durable Object named `<roomId>`.
- `src/room.ts` is the Durable Object:
  - Loads the room's Yjs doc from storage on demand (rebuilt after hibernation).
  - On connect: sends sync step 1 and asks existing peers to re-announce presence.
  - On a sync message: applies it, persists the doc, and fans the update out to
    the other sockets.
  - On an awareness message: relays it verbatim (presence is ephemeral; clients
    time out stale peers themselves).

## Not yet load-tested

The code typechecks and the site builds, but this server has **not** been
deployed or exercised with live clients yet. Smoke test before relying on it:

1. `npm run dev` here; run the site with `PUBLIC_SPLIT_SYNC_URL=ws://127.0.0.1:8787`.
2. Open `/tools/split/`, add two people and an expense, click **Collaborate**.
3. Open the copied link in a second browser (or a private window).
4. Confirm both windows show "Live", the device count is 2, and an expense
   added in one appears in the other within a second.
5. Close one window, reload the other from the same link, and confirm the
   ledger is still there (served from the Durable Object, proving persistence).
6. Edit offline in one window (DevTools → Network → Offline), add an expense,
   go back online, and confirm it merges instead of overwriting.
