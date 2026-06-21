// Cloudflare Worker entry for the Split Expenses sync server.
//
// The browser connects to wss://<host>/<roomId>. We route each room id to its
// own Durable Object instance, which owns that room's document and sockets.

import { SplitRoom, type Env } from "./room";

export { SplitRoom };

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const room = url.pathname.slice(1).split("/")[0];

    if (!room) {
      return new Response("Split Expenses sync server is running.", {
        status: 200,
      });
    }

    const id = env.SPLIT_ROOM.idFromName(room);
    return env.SPLIT_ROOM.get(id).fetch(request);
  },
};
