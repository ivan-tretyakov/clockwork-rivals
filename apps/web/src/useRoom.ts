import { useEffect, useRef, useState } from "react";
import { Client, type Room } from "@colyseus/sdk";
import {
  VERSION,
  type PublicState,
  type Seat,
  type Action,
  type PlaytestConfig,
} from "../../../packages/clockwork-rules/src/index";

export const ROOMS_ENABLED =
  import.meta.env.MODE !== "pages" || !!import.meta.env.VITE_ROOM_SERVER;

export interface Snapshot {
  state: PublicState;
  matchId: string;
  connected: Record<Seat, boolean>;
  claimed: Record<Seat, boolean>;
  rematch: Record<Seat, boolean>;
  canClaimForfeit: Record<Seat, boolean>;
}
export interface Welcome {
  seat: Seat;
  token: string;
  invite: string;
  roomId: string;
}
const endpoint = () =>
  import.meta.env.VITE_ROOM_SERVER ||
  `${location.protocol === "https:" ? "wss:" : "ws:"}//${location.hostname}${import.meta.env.DEV ? ":2567" : ":" + location.port}`.replace(
    /:$/,
    "",
  );
export function useRoom() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [welcome, setWelcome] = useState<Welcome | null>(null);
  const [status, setStatus] = useState<
    "offline" | "connecting" | "connected" | "reconnecting" | "error"
  >("offline");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const room = useRef<Room | null>(null),
    generation = useRef(0),
    latest = useRef<Snapshot | null>(null);
  const credential = useRef<Welcome | null>(null);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const pendingCommand = useRef<Record<string, unknown> | null>(null);
  const store = (key: string, value: string) => {
    try {
      localStorage.setItem(key, value);
    } catch {
      setError(
        "Browser storage is unavailable. Keep this tab open to retain your seat.",
      );
    }
  };
  function bind(r: Room, gen: number) {
    if (gen !== generation.current) {
      void r.leave();
      return;
    }
    // Durable credentials survive server restarts. This hook owns reconnects.
    r.reconnection.enabled = false;
    room.current = r;
    setStatus("connected");
    setError("");
    r.onMessage("welcome", (w: Welcome) => {
      credential.current = w;
      setWelcome(w);
      store(`clockwork-seat-${w.roomId}`, JSON.stringify(w));
    });
    r.onMessage("snapshot", (s: Snapshot) => {
      latest.current = s;
      setSnapshot(s);
      if (
        pendingCommand.current &&
        pendingCommand.current.matchId !== s.matchId
      ) {
        pendingCommand.current = null;
        setPending(false);
      }
    });
    r.onMessage(
      "ack",
      (reply: { ok: boolean; commandId?: string; error?: string }) => {
        if (
          reply.commandId === pendingCommand.current?.commandId ||
          !reply.commandId
        ) {
          pendingCommand.current = null;
          setPending(false);
          try {
            localStorage.removeItem(`clockwork-pending-${r.roomId}`);
          } catch {
            /* Storage may be unavailable. */
          }
        }
        if (!reply.ok) setError(reply.error || "Move rejected.");
      },
    );
    r.onError((_code, message) => setError(message || "Connection error."));
    r.onLeave(() => {
      if (generation.current === gen) {
        room.current = null;
        setStatus("reconnecting");
        retry(gen, 0);
      }
    });
    r.send("sync");
    if (pendingCommand.current) r.send("command", pendingCommand.current);
  }
  async function retry(gen: number, attempt: number) {
    if (generation.current !== gen) return;
    const w = credential.current;
    if (!w) {
      setStatus("error");
      setError(
        "Connection closed before your seat was saved. Open the invite again.",
      );
      return;
    }
    retryTimer.current = setTimeout(
      async () => {
        if (generation.current !== gen) return;
        try {
          bind(
            await new Client(endpoint()).joinById(w.roomId, { token: w.token }),
            gen,
          );
        } catch (e) {
          if (attempt < 45) retry(gen, attempt + 1);
          else {
            setStatus("error");
            setError(
              `Reconnect failed: ${(e as Error).message}. Reload to try again.`,
            );
          }
        }
      },
      Math.min(5000, 800 + attempt * 350),
    );
  }
  function leave() {
    generation.current++;
    clearTimeout(retryTimer.current);
    const r = room.current;
    room.current = null;
    if (r) void r.leave();
    setStatus("offline");
    setSnapshot(null);
    setWelcome(null);
    latest.current = null;
    credential.current = null;
    setPending(false);
    pendingCommand.current = null;
    history.replaceState(null, "", location.pathname);
  }
  async function connect(
    roomId?: string,
    invite?: string,
    config?: Partial<PlaytestConfig>,
  ) {
    if (!ROOMS_ENABLED) {
      setError(
        "Online rooms are not available on this site. Choose Practice or Pass & play to start a game.",
      );
      return;
    }
    leave();
    const gen = generation.current;
    setStatus("connecting");
    setError("");
    // Preserve a join URL even if the server is temporarily unavailable, so a
    // reload can retry the same room rather than losing the user's invitation.
    if (roomId)
      history.replaceState(
        null,
        "",
        `?room=${encodeURIComponent(roomId)}&invite=${encodeURIComponent(invite ?? "")}`,
      );
    try {
      const client = new Client(endpoint());
      let saved: Welcome | null = null;
      if (roomId) {
        try {
          saved = JSON.parse(
            localStorage.getItem(`clockwork-seat-${roomId}`) || "null",
          );
          pendingCommand.current = JSON.parse(
            localStorage.getItem(`clockwork-pending-${roomId}`) || "null",
          );
        } catch {
          /* A fresh invite can still be used. */
        }
      }
      credential.current = saved;
      setPending(!!pendingCommand.current);
      const r = roomId
        ? await client.joinById(
            roomId,
            saved?.token ? { token: saved.token } : { invite },
          )
        : await client.create("clockwork", {
            creatorKey: crypto.randomUUID(),
            config,
          });
      bind(r, gen);
    } catch (e) {
      if (gen === generation.current) {
        setStatus("error");
        setError(
          (e as Error).message || "Could not connect to the room server.",
        );
      }
    }
  }
  function command(action: Action) {
    const s = latest.current;
    if (!s || !room.current || pendingCommand.current) return;
    const c = {
      matchId: s.matchId,
      rulesVersion: VERSION,
      commandId: crypto.randomUUID(),
      expectedRevision: s.state.revision,
      action,
    };
    pendingCommand.current = c;
    setPending(true);
    store(`clockwork-pending-${room.current.roomId}`, JSON.stringify(c));
    room.current.send("command", c);
  }
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    if (q.get("room")) void connect(q.get("room")!, q.get("invite") || "");
    return () => {
      generation.current++;
      clearTimeout(retryTimer.current);
      void room.current?.leave();
    };
  }, []);
  useEffect(() => {
    if (welcome)
      history.replaceState(
        null,
        "",
        `?room=${encodeURIComponent(welcome.roomId)}&invite=${encodeURIComponent(welcome.invite)}`,
      );
  }, [welcome]);
  return {
    snapshot,
    welcome,
    status,
    error,
    pending,
    connect,
    leave,
    command,
    message: (type: string) => room.current?.send(type),
    clearError: () => setError(""),
  };
}
