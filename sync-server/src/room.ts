// Durable Object that syncs one Split Expenses room.
//
// It speaks the y-websocket wire protocol so the browser's WebsocketProvider can
// talk to it unmodified. The room's Yjs document is the source of truth and is
// persisted to Durable Object storage, so a friend can open the link and catch
// up even when nobody else is currently online.
//
// WebSocket Hibernation is used (ctx.acceptWebSocket + the webSocket* handlers):
// idle-but-connected clients let the object be evicted from memory, so we are
// not billed for duration while a group just leaves the tab open. When a message
// finally arrives the object wakes and the doc is rebuilt from storage.

import { DurableObject } from "cloudflare:workers";
import * as Y from "yjs";
import * as syncProtocol from "y-protocols/sync";
import * as encoding from "lib0/encoding";
import * as decoding from "lib0/decoding";

const MESSAGE_SYNC = 0;
const MESSAGE_AWARENESS = 1;
const MESSAGE_QUERY_AWARENESS = 3;

const DOC_KEY = "doc-state";

export interface Env {
  SPLIT_ROOM: DurableObjectNamespace;
}

export class SplitRoom extends DurableObject<Env> {
  private doc: Y.Doc | null = null;

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected a WebSocket upgrade.", { status: 426 });
    }

    const { 0: client, 1: server } = new WebSocketPair();
    // Hibernatable accept: the runtime can evict us while this stays open.
    this.ctx.acceptWebSocket(server);
    await this.onConnect(server);

    return new Response(null, { status: 101, webSocket: client });
  }

  // Lazily (re)build the document. After hibernation `this.doc` is gone but the
  // bytes survive in storage, so every handler reaches the doc through here.
  private async getDoc(): Promise<Y.Doc> {
    if (this.doc) return this.doc;

    const doc = new Y.Doc();
    const stored = await this.ctx.storage.get<ArrayBuffer | Uint8Array>(DOC_KEY);
    if (stored) Y.applyUpdate(doc, new Uint8Array(stored as ArrayBuffer));

    // Persist after each change and fan the change out to the other clients.
    doc.on("update", (update: Uint8Array, origin: unknown) => {
      void this.ctx.storage.put(DOC_KEY, Y.encodeStateAsUpdate(doc));
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MESSAGE_SYNC);
      syncProtocol.writeUpdate(encoder, update);
      this.broadcast(encoding.toUint8Array(encoder), origin as WebSocket | null);
    });

    this.doc = doc;
    return doc;
  }

  private broadcast(payload: Uint8Array, except: WebSocket | null) {
    for (const ws of this.ctx.getWebSockets()) {
      if (ws === except) continue;
      try {
        ws.send(payload);
      } catch {
        /* socket is going away; close handler will clean it up */
      }
    }
  }

  private async onConnect(ws: WebSocket) {
    const doc = await this.getDoc();

    // Send sync step 1 so the new client replies with whatever it has that we
    // are missing, and we reply (in onMessage) with whatever it is missing.
    const sync = encoding.createEncoder();
    encoding.writeVarUint(sync, MESSAGE_SYNC);
    syncProtocol.writeSyncStep1(sync, doc);
    ws.send(encoding.toUint8Array(sync));

    // Ask everyone already here to re-announce their presence, which we relay
    // back to this newcomer. Avoids tracking awareness state across hibernation.
    const query = encoding.createEncoder();
    encoding.writeVarUint(query, MESSAGE_QUERY_AWARENESS);
    this.broadcast(encoding.toUint8Array(query), ws);
  }

  async webSocketMessage(ws: WebSocket, message: ArrayBuffer | string) {
    if (typeof message === "string") return; // protocol is binary only
    const data = new Uint8Array(message);
    const decoder = decoding.createDecoder(data);
    const type = decoding.readVarUint(decoder);

    if (type === MESSAGE_SYNC) {
      const doc = await this.getDoc();
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MESSAGE_SYNC);
      // Applies incoming updates (which trigger the doc 'update' fan-out above)
      // and writes any reply (sync step 2) we owe this client.
      syncProtocol.readSyncMessage(decoder, encoder, doc, ws);
      if (encoding.length(encoder) > 1) ws.send(encoding.toUint8Array(encoder));
    } else if (type === MESSAGE_AWARENESS || type === MESSAGE_QUERY_AWARENESS) {
      // Presence is relayed verbatim to the other peers. The y-protocols
      // awareness layer on each client prunes stale entries on a timeout.
      this.broadcast(data, ws);
    }
  }

  async webSocketClose(ws: WebSocket) {
    try {
      ws.close();
    } catch {
      /* already closed */
    }
  }

  async webSocketError(ws: WebSocket) {
    try {
      ws.close();
    } catch {
      /* already closed */
    }
  }
}
