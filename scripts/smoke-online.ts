/** Real WebSocket integration against an isolated, durable server process. */
import { spawn, type ChildProcess } from "node:child_process";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import assert from "node:assert/strict";
import { Client, type Room } from "@colyseus/sdk";
import {
  VERSION,
  chooseBotAction,
  type PublicState,
  type Seat,
  type Action,
} from "../packages/clockwork-rules/src/index";
const port = 2577;
const endpoint = `http://127.0.0.1:${port}`;
const dataDir = resolve(`.local/integration-${process.pid}`);
mkdirSync(dataDir, { recursive: true });
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
let server: ChildProcess;
let serverOutput = "";
async function start() {
  server = spawn(process.execPath, ["dist/server/index.js"], {
    env: { ...process.env, PORT: String(port), DATA_DIR: dataDir },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  server.stdout!.on("data", (d) => {
    serverOutput += d.toString();
  });
  server.stderr!.on("data", (d) => {
    serverOutput += d.toString();
  });
  for (let i = 0; i < 80; i++) {
    try {
      if ((await fetch(`${endpoint}/api/health`)).ok) {
        await delay(300);
        return;
      }
    } catch {}
    await delay(100);
  }
  throw new Error(`Server did not start: ${serverOutput}`);
}
async function stop() {
  if (!server || server.exitCode !== null) return;
  const done = new Promise<void>((r) => server.once("exit", () => r()));
  server.kill();
  await done;
}
interface Snapshot {
  state: PublicState;
  matchId: string;
  connected: Record<Seat, boolean>;
}
type Reply = {
  ok: boolean;
  commandId?: string;
  duplicate?: boolean;
  error?: string;
  revision: number;
};
type Welcome = { seat: Seat; token: string; invite: string; roomId: string };
async function until(check: () => boolean, message: string) {
  for (let i = 0; i < 100; i++) {
    if (check()) return;
    await delay(50);
  }
  throw new Error(message);
}
async function join(id?: string, options?: Record<string, string>) {
  const client = new Client(endpoint);
  const room: Room = id
    ? await client.joinById(id, options)
    : await client.create("clockwork", { creatorKey: crypto.randomUUID() });
  room.reconnection.enabled = false;
  const view = {
    room,
    welcome: null as Welcome | null,
    snapshot: null as Snapshot | null,
    replies: [] as Reply[],
  };
  room.onMessage("welcome", (w) => {
    view.welcome = w;
  });
  room.onMessage("snapshot", (s) => {
    view.snapshot = s;
  });
  room.onMessage("ack", (r) => {
    view.replies.push(r);
  });
  room.onError(() => {});
  room.send("sync");
  await until(() => !!view.welcome && !!view.snapshot, "No initial room state");
  return view;
}
type View = Awaited<ReturnType<typeof join>>;
function command(v: View, action: Action) {
  return {
    commandId: crypto.randomUUID(),
    matchId: v.snapshot!.matchId,
    expectedRevision: v.snapshot!.state.revision,
    rulesVersion: VERSION,
    action,
  };
}
async function send(v: View, c: ReturnType<typeof command>) {
  const n = v.replies.length;
  v.room.send("command", c);
  await until(() => v.replies.length > n, "Command not acknowledged");
  return v.replies.at(-1)!;
}
const opened: View[] = [];
try {
  await start();
  let host = await join();
  opened.push(host);
  const id = host.room.roomId;
  const hostCredential = host.welcome!;
  await assert.rejects(() => join(id, { invite: "wrong" }));
  let guest = await join(id, { invite: hostCredential.invite });
  opened.push(guest);
  const guestCredential = guest.welcome!;
  await until(() => !!host.snapshot?.connected.P1, "Guest not connected");
  assert.equal(host.welcome!.seat, "P0");
  assert.equal(guest.welcome!.seat, "P1");
  assert.equal("seed" in host.snapshot!.state, false);
  assert.equal("partDeck" in host.snapshot!.state, false);
  let active = host.snapshot!.state.activePlayer === "P0" ? host : guest;
  const first = command(active, chooseBotAction(active.snapshot!.state));
  assert.equal((await send(active, first)).ok, true);
  await until(
    () =>
      host.snapshot!.state.revision === 1 &&
      guest.snapshot!.state.revision === 1,
    "Clients diverged",
  );
  assert.equal((await send(active, first)).duplicate, true);
  assert.equal(
    (await send(active, { ...first, commandId: crypto.randomUUID() })).ok,
    false,
  );
  assert.equal(
    (await send(active, { ...first, action: { type: "concede" } })).ok,
    false,
  );
  console.log(
    "PASS private invites, seat binding, hidden deck projection, duplicate and stale commands",
  );
  await guest.room.leave();
  await until(() => !host.snapshot!.connected.P1, "Disconnect not observed");
  assert.equal((await send(host, command(host, { type: "pass" }))).ok, false);
  guest = await join(id, { token: guestCredential.token });
  opened.push(guest);
  await until(() => host.snapshot!.connected.P1, "Seat did not reconnect");
  assert.equal(guest.snapshot!.state.revision, 1);
  console.log("PASS disconnected game pause and durable-seat reconnect");
  await stop();
  await start();
  host = await join(id, { token: hostCredential.token });
  opened.push(host);
  guest = await join(id, { token: guestCredential.token });
  opened.push(guest);
  await until(
    () => host.snapshot!.connected.P1,
    "Restored guest not connected",
  );
  assert.equal(host.snapshot!.state.revision, 1);
  active =
    first.action &&
    first.expectedRevision === 0 &&
    host.snapshot!.state.log.find((e) => e.type === "draft")?.actor === "P0"
      ? host
      : guest;
  assert.equal((await send(active, first)).duplicate, true);
  console.log(
    "PASS actual server restart restores room, state, credentials, accepted acknowledgements",
  );
  while (host.snapshot!.state.status === "active") {
    const s = host.snapshot!.state;
    const v = s.activePlayer === "P0" ? host : guest;
    await until(
      () => v.snapshot!.state.revision === s.revision,
      "Rival view lagged",
    );
    const result = await send(
      v,
      command(v, chooseBotAction(v.snapshot!.state)),
    );
    assert.equal(result.ok, true, result.error);
    await until(
      () =>
        host.snapshot!.state.revision === result.revision &&
        guest.snapshot!.state.revision === result.revision,
      "Move did not synchronize",
    );
  }
  assert.deepEqual(host.snapshot!.state, guest.snapshot!.state);
  const oldMatch = host.snapshot!.matchId;
  const oldInitiative = host.snapshot!.state.initiative;
  console.log(
    `PASS complete two-client match: round ${host.snapshot!.state.round}, ${host.snapshot!.state.revision} accepted moves, winner ${host.snapshot!.state.winner}`,
  );
  host.room.send("rematch");
  await delay(100);
  assert.equal(host.snapshot!.state.status, "finished");
  guest.room.send("rematch");
  await until(
    () =>
      host.snapshot!.matchId !== oldMatch &&
      guest.snapshot!.matchId !== oldMatch,
    "Mutual rematch failed",
  );
  assert.equal(host.snapshot!.state.revision, 0);
  const offTurn = host.snapshot!.state.activePlayer === "P0" ? guest : host;
  assert.equal(
    (await send(offTurn, command(offTurn, { type: "concede" }))).ok,
    true,
  );
  await until(
    () => host.snapshot!.state.status === "finished",
    "Concede not delivered",
  );
  console.log("PASS mutual rematch and off-turn concession");
} finally {
  for (const v of opened)
    try {
      void v.room.leave();
    } catch {}
  await stop();
}
