import {
  Server,
  Room,
  type Client,
  matchMaker,
  ServerError,
} from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import express from "express";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { Session, token, type RecordData } from "./session";
import type { Seat } from "../../../packages/clockwork-rules/src/index";
const dataDir = resolve(process.env.DATA_DIR || ".local");
mkdirSync(dataDir, { recursive: true });
const db = new DatabaseSync(resolve(dataDir, "rooms.sqlite"));
db.exec(
  "PRAGMA journal_mode = WAL; CREATE TABLE IF NOT EXISTS rooms (id TEXT PRIMARY KEY, data TEXT NOT NULL, updated INTEGER NOT NULL)",
);
const save = db.prepare(
  "INSERT OR REPLACE INTO rooms (id,data,updated) VALUES (?,?,?)",
);
const restoreTickets = new Map<string, RecordData>();
const sessions = new Map<string, Session>();
class ClockworkRoom extends Room {
  maxClients = 2;
  autoDispose = false;
  session!: Session;
  seatByClient = new Map<string, Seat>();
  rates = new Map<string, { at: number; n: number }>();
  onCreate(options: { creatorKey?: string; restoreTicket?: string }) {
    const restored = options.restoreTicket
      ? restoreTickets.get(options.restoreTicket)
      : undefined;
    if (restored) {
      this.roomId = restored.roomId;
      restoreTickets.delete(options.restoreTicket!);
    } else if (
      !options.creatorKey ||
      !/^[a-zA-Z0-9-]{32,100}$/.test(options.creatorKey)
    )
      throw new ServerError(400, "Missing creator credential.");
    this.session = new Session(
      this.roomId,
      options.creatorKey ?? "",
      restored,
      (d) => {
        save.run(d.roomId, JSON.stringify(d), d.updatedAt);
      },
    );
    this.session.commit();
    sessions.set(this.roomId, this.session);
    this.onMessage("sync", (client) => {
      this.sendSnapshot(client);
    });
    this.onMessage("command", (client, message) => {
      if (!this.allowed(client)) return;
      const seat = this.seatByClient.get(client.sessionId);
      if (!seat) return;
      const result = this.session.command(seat, message);
      client.send("ack", result);
      this.publish();
    });
    this.onMessage("rematch", (client) => {
      if (this.allowed(client)) {
        const seat = this.seatByClient.get(client.sessionId);
        if (seat) this.session.requestRematch(seat);
        this.publish();
      }
    });
    this.onMessage("forfeit", (client) => {
      if (this.allowed(client)) {
        const seat = this.seatByClient.get(client.sessionId);
        if (seat) this.session.forfeit(seat);
        this.publish();
      }
    });
    this.clock.setInterval(() => {
      if (
        !this.clients.length &&
        Date.now() - this.session.data.updatedAt > 86_400_000
      ) {
        db.prepare("DELETE FROM rooms WHERE id = ?").run(this.roomId);
        void this.disconnect();
      } else if (this.clients.length) this.publish();
    }, 10_000);
  }
  allowed(client: Client) {
    const now = Date.now();
    const rate = this.rates.get(client.sessionId) ?? { at: now, n: 0 };
    if (now - rate.at > 1000) {
      rate.at = now;
      rate.n = 0;
    }
    rate.n++;
    this.rates.set(client.sessionId, rate);
    if (rate.n > 30) {
      client.send("ack", {
        ok: false,
        error: "Too many commands. Please slow down.",
        revision: this.session.data.state.revision,
      });
      return false;
    }
    return true;
  }
  onAuth(_client: Client, options: Record<string, string>) {
    try {
      return this.session.authenticate(options);
    } catch (e) {
      throw new ServerError(403, (e as Error).message);
    }
  }
  onJoin(client: Client, _options: unknown, auth: Seat) {
    if (this.session.connected[auth])
      throw new ServerError(403, "Seat already connected.");
    const credential = this.session.join(auth);
    this.seatByClient.set(client.sessionId, auth);
    client.send("welcome", {
      seat: auth,
      token: credential,
      invite: this.session.data.invite,
      roomId: this.roomId,
    });
    this.publish();
  }
  onLeave(client: Client) {
    const seat = this.seatByClient.get(client.sessionId);
    if (seat) this.session.leave(seat);
    this.seatByClient.delete(client.sessionId);
    this.rates.delete(client.sessionId);
    this.publish();
    void this.unlock();
  }
  sendSnapshot(client: Client) {
    const seat = this.seatByClient.get(client.sessionId);
    if (!seat) return;
    client.send("welcome", {
      seat,
      token: this.session.data.seats[seat].token,
      invite: this.session.data.invite,
      roomId: this.roomId,
    });
    client.send("snapshot", this.session.snapshot());
  }
  publish() {
    this.broadcast("snapshot", this.session.snapshot());
  }
  onDispose() {
    sessions.delete(this.roomId);
  }
}
const requestRates = new Map<string, { at: number; n: number }>();
const server = new Server({
  greet: false,
  transport: new WebSocketTransport({ maxPayload: 32 * 1024 }),
  express: (app) => {
    app.use((req, res, next) => {
      const origin = req.headers.origin;
      const allowed = process.env.ALLOWED_ORIGIN;
      if (origin && (!allowed || origin === allowed))
        res.header("Access-Control-Allow-Origin", origin);
      res.header("Access-Control-Allow-Headers", "Content-Type");
      res.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
      if (req.method === "OPTIONS") {
        res.sendStatus(204);
        return;
      }
      if (req.path.includes("/matchmake/")) {
        const key = req.socket.remoteAddress ?? "local";
        const now = Date.now();
        let r = requestRates.get(key);
        if (!r || now - r.at > 60000) r = { at: now, n: 0 };
        r.n++;
        requestRates.set(key, r);
        if (r.n > 60) {
          res
            .status(429)
            .json({
              error: "Too many connection requests. Try again in a minute.",
            });
          return;
        }
      }
      next();
    });
    app.get("/api/health", (_req, res) =>
      res.json({ ok: true, game: "clockwork-rivals", version: "0.1.0" }),
    );
    app.use(express.static(resolve("dist/web")));
  },
});
server.define("clockwork", ClockworkRoom);
const port = Number(process.env.PORT ?? 2567);
await server.listen(port, "0.0.0.0");
db.prepare("DELETE FROM rooms WHERE updated < ?").run(Date.now() - 86_400_000);
for (const row of db.prepare("SELECT data FROM rooms").all()) {
  const data = JSON.parse(row.data as string) as RecordData;
  const ticket = token();
  restoreTickets.set(ticket, data);
  await matchMaker.createRoom("clockwork", { restoreTicket: ticket });
}
console.log(`Clockwork room server listening on http://localhost:${port}`);
