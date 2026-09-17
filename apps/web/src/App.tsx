import React, { useEffect, useRef, useState } from "react";

import {
  ALLOWANCE,
  PARTS,
  ORDERS,
  PHASES,
  RESOURCES,
  VERSION,
  setup,
  reduce,
  legalActions,
  preview,
  productionPlan,
  project,
  publicReport,
  OBJECTIVES,
  canAfford,
  missingCost,
  costText,
  type PlaytestConfig,
  other,
  position,
  replay,
  saveGame,
  loadGame,
  chooseBotAction,
  type Action,
  type State,
  type View,
  type Seat,
  type Resource,
  type Card,
  type AcceptedAction,
  type Reserve,
} from "../../../packages/clockwork-rules/src/index";
import { InstallationPreview } from "./InstallationPreview";
import { ObjectiveCards } from "./ObjectiveCards";
import { ProductionControls } from "./ProductionControls";
import { useRoom, ROOMS_ENABLED } from "./useRoom";
import "./style.css";

type Mode = "practice" | "hotseat";
type Selection =
  { kind: "market"; id: string } | { kind: "machine"; id: string; seat: Seat };
const NAMES: Record<Seat, string> = { P0: "Teal", P1: "Copper" };
const PHASE_COPY = {
  draft:
    "Choose a part, then an empty workshop slot. Or rearrange one machine.",
  power:
    "Take coal from the shared supply. Fuel is limited and shared with your rival.",
  run: "Edit priority and enabled machines, then choose Run planned machines to finish production.",
  deliver:
    "Pay the resources listed on one guild commission to earn prestige. Choose a delivery below, or keep your reserves for next round.",
};
const phaseName = (phase: string) =>
  phase === "run" ? "Produce" : phase === "deliver" ? "Delivery" : phase;
const randomSeed = () => crypto.getRandomValues(new Uint32Array(1))[0];
const SAVE_KEY = "clockwork-local-v2";
function initialGame() {
  let warning = "";
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw && localStorage.getItem("clockwork-local-v1"))
      warning =
        "Rules 0.2 starts a new match with private objectives. Your earlier 0.1 autosave remains preserved in this browser; old save files cannot be loaded into these rules.";
    if (raw) {
      const data = JSON.parse(raw);
      const saved = loadGame(JSON.stringify(data.save));
      return {
        state: saved.state,
        actions: saved.actions,
        mode: (data.mode === "hotseat" ? "hotseat" : "practice") as Mode,
        warning,
      };
    }
  } catch (e) {
    warning = `Saved game could not be loaded: ${(e as Error).message}. Your stored backup is preserved. Start a new match to use the current rules.`;
  }
  return {
    state: setup({ seed: randomSeed(), rulesVersion: VERSION }),
    actions: [] as AcceptedAction[],
    mode: "practice" as Mode,
    warning,
  };
}
function Icon({ name }: { name: string }) {
  return (
    <img
      className="icon"
      src={`${import.meta.env.BASE_URL}assets/ui/${name}.svg`}
      alt=""
      aria-hidden="true"
    />
  );
}
function Owner({ seat }: { seat: Seat }) {
  return (
    <span className={`owner ${seat}`} aria-hidden="true">
      {seat === "P0" ? "●" : "◆"}
    </span>
  );
}
function ResourceRow({
  values,
  compact = false,
}: {
  values: Partial<Reserve>;
  compact?: boolean;
}) {
  return (
    <div className={`resources ${compact ? "compact" : ""}`}>
      {RESOURCES.filter((r) => !compact || values[r]).map((r) => (
        <span
          className={`resource ${r}`}
          key={r}
          title={`${values[r] ?? 0} ${r}`}
        >
          <Icon name={r} />
          <b key={values[r] ?? 0}>{values[r] ?? 0}</b>
          <span>{r === "gears" ? "gears" : r}</span>
        </span>
      ))}
    </div>
  );
}
function Formula({ id }: { id: string }) {
  const e = PARTS[id].effect;
  return e.kind === "convert" ? (
    <span className="formula">
      <ResourceRow values={e.input!} compact />
      <span className="arrow">→</span>
      <ResourceRow values={e.output!} compact />
      {e.adjacencyBonus && (
        <span className="bonus" title="Orthogonal adjacency bonus">
          +
        </span>
      )}
    </span>
  ) : (
    <span className="passive-formula">
      {id === "condenser" ? "+1 steam · adjacency" : "+1 coal · Power"}
    </span>
  );
}
function CommissionArt({ id }: { id: string }) {
  return (
    <svg
      className="commission-art"
      viewBox="0 0 100 90"
      fill="none"
      aria-hidden="true"
    >
      <g
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {id === "steamworks" ? (
          <>
            <path d="M18 80V47h64v33M26 47V31h10v16M22 31h18M48 47V20h12v27M44 20h20M16 80h70M27 58h12v12H27zM52 58h17v22" />
            <path d="M30 26c-8-9 7-9 0-18M54 14c-8-8 8-8 1-14" />
            <circle cx="71" cy="38" r="9" />
            <path d="M71 38v-5" />
          </>
        ) : id === "automated-foundry" ? (
          <>
            <path d="M17 80V45l22-15v15l22-15v15h22v35H17ZM66 45V16h10v29M25 62h11v9H25zM46 62h11v9H46zM68 60v20" />
            <circle cx="38" cy="18" r="9" />
            <path d="M38 6v4M38 26v4M26 18h4M46 18h4M30 10l3 3M43 23l3 3" />
          </>
        ) : id === "street-clock" ? (
          <>
            <path d="M46 40v38h8V40M35 82h30M41 78h18M50 7v5M34 23h-5M66 23h5" />
            <circle cx="50" cy="26" r="17" />
            <circle cx="50" cy="26" r="12" />
            <path d="M50 18v8l7 4" />
          </>
        ) : id === "clock-tower" ? (
          <>
            <path d="M33 81V32h34v49M27 81h46M29 32h42L50 11 29 32ZM41 81V65h18v16M50 11V6M50 7h12l-5 5h-7" />
            <circle cx="50" cy="45" r="9" />
            <path d="M50 39v6l5 3M39 58h22" />
          </>
        ) : (
          <>
            <path d="M19 81h62M24 81V45h52v36M20 45h60M28 44a22 22 0 0 1 44 0M50 22V13M45 13h10M43 81V64h14v17M32 54h6M62 54h6M32 67h6M62 67h6M63 27l14-11 5 6-13 11M73 14l10 12" />
            <path d="M39 44c0-16 5-22 11-22s11 6 11 22" />
          </>
        )}
      </g>
      <path d="M13 85h74" stroke="currentColor" opacity=".25" />
    </svg>
  );
}
function Modal({
  title,
  children,
  close,
  wide = false,
  dismissible = true,
}: {
  title: string;
  children: React.ReactNode;
  close: () => void;
  wide?: boolean;
  dismissible?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const before = document.activeElement as HTMLElement;
    ref.current?.showModal();
    return () => {
      ref.current?.close();
      before?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      aria-label={title}
      className={wide ? "modal wide" : "modal"}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onClick={(e) => {
        if (e.target === ref.current) close();
      }}
    >
      <div className="modal-head">
        <h2>{title}</h2>
        {dismissible && (
          <button
            className="icon-button"
            aria-label="Close dialog"
            onClick={close}
          >
            ×
          </button>
        )}
      </div>
      {children}
    </dialog>
  );
}
export default function App() {
  const [initial] = useState(initialGame);
  const [local, setLocal] = useState(initial.state);
  const [actions, setActions] = useState(initial.actions);
  const [mode, setMode] = useState<Mode>(initial.mode);
  const net = useRoom();
  const online = net.status !== "offline";
  const localViewer: Seat =
    mode === "practice" ? "P0" : (local.activePlayer ?? "P0");
  const state =
    online && net.snapshot ? net.snapshot.state : project(local, localViewer);
  const seat: Seat = online
    ? (net.welcome?.seat ?? "P0")
    : mode === "practice"
      ? "P0"
      : (state.activePlayer ?? "P0");
  const rival = other(seat);
  const [objectiveOpen, setObjectiveOpen] = useState(false);
  const [privacySeat, setPrivacySeat] = useState<Seat | null>(null);
  const [newConfig, setNewConfig] = useState<PlaytestConfig>({
    ...initial.state.config,
  });
  const handoffRequired =
    !online &&
    mode === "hotseat" &&
    state.config.objectives !== "off" &&
    state.status === "active" &&
    privacySeat !== seat;
  useEffect(() => {
    setObjectiveOpen(false);
  }, [seat, net.snapshot?.matchId]);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [placement, setPlacement] = useState<{
    action: Extract<Action, { type: "draft-install" }>;
    index: number;
  } | null>(null);
  const [moving, setMoving] = useState<number | null>(null);
  const [dialog, setDialog] = useState<
    "new" | "rules" | "catalogue" | "menu" | "feedback" | null
  >(null);
  const [confirmation, setConfirmation] = useState<{
    title: string;
    text: string;
    action: Action;
  } | null>(null);
  const [notice, setNotice] = useState(initial.warning);
  const [storageBlocked, setStorageBlocked] = useState(
    initial.warning.startsWith("Saved game could not"),
  );
  const [sound, setSound] = useState(false);
  const soundContext = useRef<AudioContext | null>(null);
  const [newMode, setNewMode] = useState<Mode | "online">("practice");
  const [seedInput, setSeedInput] = useState("");
  const [showRival, setShowRival] = useState(false);
  const [finishedDismissed, setFinishedDismissed] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [exported, setExported] = useState<{
    name: string;
    json: string;
    url: string;
  } | null>(null);
  useEffect(
    () => () => {
      if (exported) URL.revokeObjectURL(exported.url);
    },
    [exported],
  );
  const importInput = useRef<HTMLInputElement>(null);
  const locked = useRef(false);
  const connected =
    !online ||
    (net.status === "connected" &&
      !!net.snapshot?.connected.P0 &&
      !!net.snapshot?.connected.P1);
  const canPlay =
    state.status === "active" &&
    state.activePlayer === seat &&
    connected &&
    !net.pending &&
    !handoffRequired;
  const legal = canPlay ? legalActions(state, seat) : [];
  const selectedCard =
    selection?.kind === "market"
      ? state.market.find((c) => c.id === selection.id)
      : selection
        ? state.players[selection.seat].grid.find((c) => c?.id === selection.id)
        : null;
  const inspected = selectedCard ? PARTS[selectedCard.definitionId] : null;
  const effect =
    selection?.kind === "machine"
      ? preview(state, selection.seat, selection.id)
      : null;
  const current = state.players[seat];
  const opponent = state.players[rival];
  const runFinished =
    state.phase === "run" &&
    (state.passed[seat] || state.counts[seat] >= ALLOWANCE.run);
  const production = state.phase === "run" ? productionPlan(state, seat) : null;
  const deliveryFinished =
    state.phase === "deliver" &&
    (state.passed[seat] || state.counts[seat] >= ALLOWANCE.deliver);
  const affordableOrders = state.orders.filter((card) =>
    canAfford(current.resources, ORDERS[card.definitionId].cost),
  );
  const closestOrder = [...state.orders].sort(
    (a, b) =>
      Object.values(
        missingCost(current.resources, ORDERS[a.definitionId].cost),
      ).reduce((sum, n) => sum + n, 0) -
      Object.values(
        missingCost(current.resources, ORDERS[b.definitionId].cost),
      ).reduce((sum, n) => sum + n, 0),
  )[0];
  const lastProduction = state.log
    .slice()
    .reverse()
    .find(
      (event) =>
        event.type === "produce" &&
        event.actor === seat &&
        event.round === state.round,
    );
  const lastDelivery = state.log
    .slice()
    .reverse()
    .find((event) => event.type === "deliver" && event.round === state.round);
  const workflowRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (
      state.status === "active" &&
      (state.phase === "run" || state.phase === "deliver")
    ) {
      workflowRef.current?.scrollIntoView({ block: "start" });
      workflowRef.current?.focus({ preventScroll: true });
    }
  }, [state.phase, state.round, seat, state.status]);
  const close = () => setDialog(null);
  useEffect(() => {
    if (storageBlocked) return;
    try {
      localStorage.setItem(
        SAVE_KEY,
        JSON.stringify({ mode, save: saveGame(local, actions) }),
      );
    } catch {
      setNotice(
        "Autosave is unavailable in this browser. Keep this tab open to retain your match.",
      );
    }
  }, [local, actions, mode, storageBlocked]);
  useEffect(() => {
    setSelection(null);
    setMoving(null);
    setConfirmation(null);
    setPlacement(null);
    locked.current = false;
    if (state.status === "active") setFinishedDismissed(false);
  }, [state.revision, net.snapshot?.matchId, online]);
  useEffect(() => {
    if (
      online ||
      mode !== "practice" ||
      local.activePlayer !== "P1" ||
      local.status !== "active" ||
      dialog ||
      confirmation
    )
      return;
    const timer = setTimeout(() => act(chooseBotAction(local), "P1"), 650);
    return () => clearTimeout(timer);
  }, [local, mode, online, dialog, confirmation]);
  function chime() {
    if (!sound) return;
    try {
      const ctx = (soundContext.current ??= new AudioContext());
      void ctx.resume();
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(
        state.phase === "deliver" ? 660 : 440,
        ctx.currentTime,
      );
      gain.gain.setValueAtTime(0.035, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
      oscillator.start();
      oscillator.stop(ctx.currentTime + 0.18);
    } catch {
      /* Audio is optional. */
    }
  }
  function act(action: Action, actor: Seat = seat) {
    if (action.type === "choose-objective") setObjectiveOpen(false);
    if (locked.current) return;
    if (online) {
      locked.current = true;
      net.command(action);
      setConfirmation(null);
      return;
    }
    const result = reduce(local, actor, action);
    if (!result.ok) {
      setNotice(result.message);
      return;
    }
    locked.current = true;
    setLocal(result.state);
    setActions([...actions, { actor, action }]);
    setConfirmation(null);
    chime();
  }
  useEffect(() => {
    if (!net.pending) locked.current = false;
  }, [net.pending]);
  function newGame(nextMode: Mode, seed = randomSeed(), initiative?: Seat) {
    net.leave();
    setMode(nextMode);
    setLocal(
      setup({
        seed,
        rulesVersion: VERSION,
        initiativeOverride: initiative,
        config: newConfig,
      }),
    );
    setActions([]);
    setPrivacySeat(null);
    setObjectiveOpen(false);
    setSelection(null);
    setMoving(null);
    setFinishedDismissed(false);
    setStorageBlocked(false);
    setNotice("");
    locked.current = false;
    close();
  }
  function undo() {
    let count = actions.length - 1;
    if (mode === "practice") {
      while (count >= 0 && actions[count].actor !== "P0") count--;
    }
    if (count < 0 || actions[count].action.type === "choose-objective") return;
    const next = actions.slice(0, count);
    setActions(next);
    setLocal(
      replay(
        local.seed,
        local.initialInitiative,
        next,
        local.privateSetup,
        local.config,
      ),
    );
    setFinishedDismissed(false);
  }
  function download(value: unknown, name: string) {
    const json = JSON.stringify(value, null, 2);
    const url = URL.createObjectURL(
      new Blob([json], { type: "application/json" }),
    );
    setExported({ name, json, url });
    close();
    setFinishedDismissed(true);
  }
  async function importSave(file?: File) {
    if (!file) return;
    try {
      const saved = loadGame(await file.text());
      net.leave();
      setLocal(saved.state);
      setActions(saved.actions);
      setMode("hotseat");
      setNewConfig(saved.config);
      setPrivacySeat(null);
      setObjectiveOpen(false);
      setFinishedDismissed(false);
      setStorageBlocked(false);
      close();
      setNotice("Save imported and replay verified.");
    } catch (e) {
      setNotice(`Import failed: ${(e as Error).message}`);
    }
  }
  function chooseSlot(index: number, owner: Seat) {
    if (
      owner === seat &&
      canPlay &&
      state.setupComplete &&
      state.phase === "draft"
    ) {
      if (moving !== null) {
        const action = legal.find(
          (a) =>
            a.type === "reconfigure" &&
            position(a.from) === moving &&
            position(a.to) === index,
        );
        if (action) {
          act(action);
          return;
        }
      }
      if (selection?.kind === "market") {
        const action = legal.find(
          (a) =>
            a.type === "draft-install" &&
            a.marketInstance === selection.id &&
            position(a.slot) === index,
        );
        if (action?.type === "draft-install") {
          setPlacement({ action, index });
          return;
        }
      }
    }
    const card = state.players[owner].grid[index];
    if (card) {
      setSelection({ kind: "machine", id: card.id, seat: owner });
      setMoving(null);
    }
  }
  function confirmDelivery(id: string) {
    const card = state.orders.find((order) => order.id === id)!;
    const order = ORDERS[card.definitionId];
    setConfirmation({
      title: `Deliver ${order.name}?`,
      text: `Pay ${costText(order.cost)} to fulfill ${order.name}. Earn ${order.prestige} prestige (${current.prestige} → ${current.prestige + order.prestige}). Reserves afterward: ${costText(Object.fromEntries(RESOURCES.map((r) => [r, current.resources[r] - (order.cost[r] ?? 0)])))}. This ends your Delivery turn.`,
      action: { type: "deliver", commission: id },
    });
  }
  function grid(owner: Seat, small = false) {
    return (
      <div
        className={`workshop-grid ${small ? "mini" : ""}`}
        role="group"
        aria-label={`${NAMES[owner]} workshop`}
      >
        {state.players[owner].grid.map((card, index) => {
          const target =
            owner === seat &&
            legal.some(
              (a) =>
                (a.type === "draft-install" &&
                  selection?.kind === "market" &&
                  a.marketInstance === selection.id &&
                  position(a.slot) === index) ||
                (a.type === "reconfigure" &&
                  moving !== null &&
                  position(a.from) === moving &&
                  position(a.to) === index),
            );
          const ready =
            card &&
            owner === seat &&
            !runFinished &&
            production?.steps.some((step) => step.instance === card.id);
          const adjacent =
            selection?.kind === "machine" &&
            selection.seat === owner &&
            effect?.adjacent.includes(index);
          return (
            <button
              key={index}
              className={`grid-slot ${card ? "machine" : "empty"} ${target ? "target" : ""} ${ready ? "ready" : ""} ${card?.exhausted ? "exhausted" : ""} ${card && selection?.id === card.id ? "selected" : ""} ${adjacent ? "adjacent" : ""}`}
              onClick={() => chooseSlot(index, owner)}
              aria-label={`${NAMES[owner]} slot ${index + 1}${card ? `: ${PARTS[card.definitionId].name}` : ": empty"}${target ? (moving !== null ? ", move or swap here" : ", install here") : ""}`}
              data-testid={`${owner}-slot-${index}`}
            >
              <span className="coordinate">
                {Math.floor(index / 3) + 1}·{(index % 3) + 1}
              </span>
              {card ? (
                <>
                  <img
                    className="machine-art"
                    src={`${import.meta.env.BASE_URL}assets/clockwork-rivals/${card.definitionId}.webp`}
                    alt=""
                  />
                  <span className="machine-title">
                    {PARTS[card.definitionId].name}
                  </span>
                  {!small && <Formula id={card.definitionId} />}
                  <span className={`machine-status ${ready ? "can-run" : ""}`}>
                    {target
                      ? moving !== null
                        ? "↔ Move or swap"
                        : "↳ Place here"
                      : adjacent
                        ? "✦ Bonus linked"
                        : card.exhausted
                          ? "✓ Used"
                          : card.boosted
                            ? "✓ Boost used"
                            : ready
                              ? `● Sequence ${production!.steps.findIndex((step) => step.instance === card.id) + 1}`
                              : PARTS[card.definitionId].effect.kind ===
                                  "convert"
                                ? "○ Ready"
                                : "◇ Passive"}
                  </span>
                </>
              ) : (
                <>
                  <span className="empty-plus">+</span>
                  <span>
                    {target
                      ? moving !== null
                        ? "Move here"
                        : "Install here"
                      : "Empty slot"}
                  </span>
                </>
              )}
            </button>
          );
        })}
      </div>
    );
  }
  if (online && !net.snapshot)
    return (
      <main className="connection-screen">
        <span className="brand-gear">⚙</span>
        <div className="eyebrow">CLOCKWORK RIVALS</div>
        <h1>
          {net.status === "error"
            ? "The table is unavailable."
            : "Opening your table…"}
        </h1>
        <p>
          {net.error ||
            "Connecting to the private room and restoring your workshop."}
        </p>
        {net.status === "error" && (
          <button className="button" onClick={() => location.reload()}>
            Retry connection
          </button>
        )}
        <button className="text-button" onClick={() => net.leave()}>
          Return to your local game
        </button>
      </main>
    );
  const turnLabel =
    state.status === "finished"
      ? "Match complete"
      : !connected
        ? net.status === "connected"
          ? "Waiting for your rival"
          : "Connecting to the table"
        : state.activePlayer === seat
          ? mode === "hotseat" && !online
            ? `${NAMES[seat]}’s turn`
            : "Your turn"
          : online
            ? "Your rival’s turn"
            : "Automaton is thinking";
  const remaining = Math.max(0, ALLOWANCE[state.phase] - state.counts[seat]);
  return (
    <>
      <header className="site-header">
        <a
          className="wordmark"
          href={location.pathname}
          onClick={(e) => e.preventDefault()}
          aria-label="Clockwork Rivals"
        >
          <span className="brand-gear">⚙</span>
          <span>
            CLOCKWORK
            <b>
              RIVALS
              <span className="brand-line" />
            </b>
          </span>
        </a>
        <nav aria-label="Main navigation">
          <span className="nav-active">Game table</span>
          <button onClick={() => setDialog("catalogue")}>
            Machine catalogue
          </button>
          <button onClick={() => setDialog("rules")}>
            How to play <span className="help-dot">?</span>
          </button>
        </nav>
        <div className="header-actions">
          <button
            className="sound-button"
            aria-label={sound ? "Mute sound" : "Enable sound"}
            aria-pressed={sound}
            onClick={() => setSound(!sound)}
          >
            {sound ? "♪ Sound on" : "♪ Sound off"}
          </button>
          <button className="button outline" onClick={() => setDialog("new")}>
            New game <span>↗</span>
          </button>
        </div>
      </header>
      <main className="game-shell">
        <section className="table-heading">
          <div>
            <div className="eyebrow">
              THE GUILD OF CLOCKMAKERS <span>•</span> EST. 1886
            </div>
            <h1>
              Ingenuity meets rivalry<span>.</span>
            </h1>
            <p>Build your engine. Make your mark.</p>
          </div>
          <div className="match-meta">
            <span className="mode-tag">
              <i />
              {online
                ? "Private online table"
                : mode === "practice"
                  ? "Practice · vs Automaton"
                  : "Local · two players"}
            </span>
            <div className="round-count">
              Round <b>{state.round}</b>
              <span>/ {state.config.maxRounds}</span>
              <div className="round-dots">
                {Array.from({ length: state.config.maxRounds }, (_, i) => (
                  <i key={i} className={i < state.round ? "filled" : ""} />
                ))}
              </div>
            </div>
          </div>
        </section>
        {(notice || net.error) && (
          <div className="notice" role="alert">
            <span>{net.error || notice}</span>
            <button
              aria-label="Dismiss message"
              onClick={() => {
                setNotice("");
                net.clearError();
              }}
            >
              ×
            </button>
          </div>
        )}
        {online && (
          <div className="online-banner">
            <span>
              <span className={`connection-dot ${connected ? "live" : ""}`} />
              {net.status === "reconnecting"
                ? "Connection lost. Reconnecting to your saved seat…"
                : net.status === "error"
                  ? "Room connection unavailable"
                  : net.welcome
                    ? `Room ${net.welcome.roomId} · You are ${NAMES[seat]}`
                    : "Opening a private table…"}
              {net.snapshot &&
                !connected &&
                net.status === "connected" &&
                (net.snapshot.claimed[rival]
                  ? " · Game paused. Your rival has two minutes to reconnect."
                  : " · Invite a friend to begin.")}
            </span>
            <div>
              {net.welcome && (
                <button
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(location.href);
                      setNotice(
                        "Invite link copied. Share it with your rival.",
                      );
                    } catch {
                      setNotice(`Invite link: ${location.href}`);
                    }
                  }}
                >
                  Copy invite ↗
                </button>
              )}
              {net.snapshot?.canClaimForfeit[seat] && (
                <button onClick={() => net.message("forfeit")}>
                  Claim forfeit
                </button>
              )}
              <button
                onClick={() => {
                  net.leave();
                  setNotice("Returned to your saved local table.");
                }}
              >
                Leave room
              </button>
            </div>
          </div>
        )}
        <section className="phase-strip" aria-label="Round phases">
          {PHASES.map((phase, i) => (
            <div
              className={`phase-step ${state.phase === phase ? "active" : ""} ${PHASES.indexOf(state.phase) > i ? "complete" : ""}`}
              key={phase}
            >
              <span className="phase-number">
                {PHASES.indexOf(state.phase) > i ? "✓" : `0${i + 1}`}
              </span>
              <div>
                <b>{phaseName(phase)}</b>
                <span>
                  {
                    [
                      "Build your workshop",
                      "Gather the fuel",
                      "Bring it to life",
                      "Earn your prestige",
                    ][i]
                  }
                </span>
              </div>
              <span className="phase-limit">
                {phase === "run"
                  ? "All machines"
                  : `${ALLOWANCE[phase]} ${ALLOWANCE[phase] > 1 ? "actions" : "action"}`}
              </span>
            </div>
          ))}
        </section>
        <div className="turn-bar" aria-live="polite">
          <span className="turn-name">
            <Owner seat={state.activePlayer ?? seat} />
            {turnLabel}
            <span className="thinking-dots">
              {!canPlay && connected && state.status === "active" ? " ···" : ""}
            </span>
          </span>
          <span className="turn-instruction">
            {runFinished
              ? "Production complete. Delivery starts automatically when your rival is done."
              : !state.setupComplete
                ? "Inspect the public market, then choose your private objective. Both choices lock before Draft."
                : PHASE_COPY[state.phase]}
          </span>
          <span className="turn-allowance">
            {!state.setupComplete
              ? "Choose one private objective"
              : state.phase === "run"
                ? runFinished
                  ? "Production complete"
                  : "One click · all machines"
                : state.status === "active" && connected
                  ? `${remaining} / ${ALLOWANCE[state.phase]} actions left`
                  : "Final prestige includes objectives"}
          </span>
        </div>
        {state.status === "active" &&
          (state.phase === "run" || state.phase === "deliver") && (
            <section
              className={`phase-workflow ${state.phase}`}
              ref={workflowRef}
              tabIndex={-1}
              aria-label={
                state.phase === "run" ? "Production" : "Delivery desk"
              }
            >
              {state.phase === "run" && production ? (
                <>
                  <div className="workflow-heading">
                    <div>
                      <span className="step-label">
                        <Owner seat={seat} /> 03 · PRODUCE ·{" "}
                        {NAMES[seat].toUpperCase()} WORKSHOP
                      </span>
                      <h2>
                        {runFinished
                          ? "Production complete."
                          : "Plan your production."}
                      </h2>
                      <p>
                        {runFinished
                          ? "Waiting for your rival to produce. Delivery opens automatically."
                          : "One click runs your enabled machines in priority order, revisiting them as resources become available. Then your production turn ends."}
                      </p>
                    </div>
                    {!runFinished && (
                      <button
                        className="button"
                        disabled={!canPlay}
                        onClick={() => act({ type: "produce" })}
                      >
                        {production.steps.length
                          ? "Run planned machines →"
                          : "Continue to Delivery →"}
                      </button>
                    )}
                  </div>
                  {!runFinished && (
                    <>
                      <ProductionControls
                        state={state}
                        seat={seat}
                        enabled={canPlay}
                        act={act}
                      />
                      <button
                        className="text-button"
                        disabled={!canPlay}
                        onClick={() => act({ type: "pass" })}
                      >
                        Skip production & keep reserves →
                      </button>
                      <h3 className="sequence-heading">Expected execution</h3>
                      <ol
                        className="production-sequence"
                        aria-label="Production sequence"
                      >
                        {production.steps.map((step, index) => (
                          <li key={step.instance}>
                            <span className="sequence-number">{index + 1}</span>
                            <img
                              src={`${import.meta.env.BASE_URL}assets/clockwork-rivals/${step.definitionId}.webp`}
                              alt=""
                            />
                            <span>
                              <b>{PARTS[step.definitionId].name}</b>
                              <small>
                                Slot {Math.floor(step.slot / 3) + 1}·
                                {(step.slot % 3) + 1}
                              </small>
                              <small>
                                {RESOURCES.filter((r) => step.effect.input[r])
                                  .map((r) => `${step.effect.input[r]} ${r}`)
                                  .join(" + ")}{" "}
                                →{" "}
                                {RESOURCES.filter((r) => step.effect.output[r])
                                  .map((r) => `${step.effect.output[r]} ${r}`)
                                  .join(" + ")}
                              </small>
                            </span>
                            {index < production.steps.length - 1 && (
                              <span className="sequence-arrow">→</span>
                            )}
                          </li>
                        ))}
                      </ol>
                      <div className="production-outcome">
                        <span>Reserves after production</span>
                        <ResourceRow values={production.after} />
                        {production.steps.some(
                          (step) =>
                            Object.keys(step.effect.overflow).length > 0,
                        ) && (
                          <p className="overflow-note">
                            Cap waste:{" "}
                            {production.steps
                              .flatMap((step) =>
                                Object.entries(step.effect.overflow).map(
                                  ([r, n]) =>
                                    `${PARTS[step.definitionId].name}: ${n} ${r}`,
                                ),
                              )
                              .join("; ")}
                          </p>
                        )}
                      </div>
                      <p className="workflow-note">
                        {production.steps.length
                          ? "Your priority order controls execution. Passive bonuses apply automatically. Disabled machines never spend resources."
                          : "No unused machine has the resources it needs. Your reserves carry over."}
                        {production.skipped.length > 0 &&
                          ` Skipped: ${production.skipped.map((card) => `${PARTS[card.definitionId].name}: ${card.reason}`).join(", ")}.`}
                      </p>
                    </>
                  )}
                </>
              ) : (
                <>
                  <div className="workflow-heading">
                    <div>
                      <span className="step-label">
                        <Owner seat={seat} /> 04 · DELIVERY ·{" "}
                        {NAMES[seat].toUpperCase()} WORKSHOP
                      </span>
                      <h2>
                        {deliveryFinished
                          ? "Your delivery turn is complete."
                          : "Fulfill a guild commission."}
                      </h2>
                      <p>
                        {deliveryFinished
                          ? "Waiting for your rival. The next round starts automatically."
                          : "Choose one commission below. Pay all its listed resources to the guild and earn the shown prestige."}
                      </p>
                    </div>
                    <div className="delivery-reserves">
                      <span className="step-label">AVAILABLE TO SPEND</span>
                      <ResourceRow values={current.resources} />
                    </div>
                  </div>
                  {lastProduction && (
                    <p className="production-receipt">
                      ✓ Production complete:{" "}
                      {(lastProduction.data.sequence as string[])
                        .map((id) => PARTS[id].name)
                        .join(" → ") || "no machines could run"}
                      .
                    </p>
                  )}
                  {lastDelivery && (
                    <p className="delivery-receipt" role="status">
                      ✓ {lastDelivery.text}
                    </p>
                  )}
                  {!deliveryFinished && (
                    <>
                      <p
                        className={`delivery-guidance ${affordableOrders.length ? "ready" : ""}`}
                      >
                        {!state.orders.length
                          ? "All commissions have been claimed. Keep your reserves for the next round."
                          : affordableOrders.length
                            ? `${affordableOrders.length} ${affordableOrders.length === 1 ? "commission is" : "commissions are"} affordable. ${canPlay ? "Choose a Deliver button below." : "Wait for your Delivery turn to choose."}`
                            : `Nothing is affordable yet. Closest: ${ORDERS[closestOrder.definitionId].name} needs ${costText(missingCost(current.resources, ORDERS[closestOrder.definitionId].cost))} more. Keep your resources and produce again next round.`}
                      </p>
                      <div className="delivery-options">
                        {state.orders.map((card) => {
                          const order = ORDERS[card.definitionId];
                          const missing = costText(
                            missingCost(current.resources, order.cost),
                          );
                          return (
                            <article
                              key={card.id}
                              className={`delivery-option ${!missing ? "affordable" : ""}`}
                            >
                              <CommissionArt id={card.definitionId} />
                              <div>
                                <h3>{order.name}</h3>
                                <p>
                                  Pay {costText(order.cost)} <span>→</span>{" "}
                                  <strong>+{order.prestige} prestige</strong>
                                </p>
                              </div>
                              <button
                                className={`button ${missing ? "outline" : ""}`}
                                disabled={!canPlay || !!missing}
                                onClick={() => confirmDelivery(card.id)}
                              >
                                {missing
                                  ? `Missing: ${missing}`
                                  : `Deliver ${order.name} →`}
                              </button>
                            </article>
                          );
                        })}
                      </div>
                      <div className="delivery-footer">
                        <p>
                          Coal, steam, work and unspent gears all carry into the
                          next round.
                        </p>
                        <button
                          className={`button ${affordableOrders.length ? "outline" : ""}`}
                          disabled={!canPlay}
                          onClick={() => act({ type: "pass" })}
                        >
                          {affordableOrders.length
                            ? "Save resources & end Delivery →"
                            : "Keep resources & end Delivery →"}
                        </button>
                      </div>
                    </>
                  )}
                </>
              )}
            </section>
          )}
        {state.config.objectives !== "off" && state.status !== "finished" && (
          <section className="objective-banner">
            <div>
              <span className="step-label">PRIVATE OBJECTIVES</span>
              <h2>
                {!state.setupComplete
                  ? "Choose your reason to rival."
                  : "Your secret ambition"}
              </h2>
              <p>
                {!state.setupComplete
                  ? "Inspect the market and commissions, then choose one of two cards privately. Draft begins after both choices lock."
                  : `One private objective is worth +${state.config.objectiveBonus} final prestige. Public target: ${state.config.targetPrestige}; hidden bonuses are added only at the end.`}
              </p>
              <small>
                Teal: {state.objectiveReady.P0 ? "ready" : "choosing"} · Copper:{" "}
                {state.objectiveReady.P1 ? "ready" : "choosing"}
              </small>
            </div>
            <button
              className="button outline"
              disabled={handoffRequired}
              onClick={() => setObjectiveOpen(true)}
            >
              {state.objectiveReady[seat]
                ? "Inspect private objective"
                : "Choose private objective"}{" "}
              ↗
            </button>
          </section>
        )}
        <div className="shared-table">
          <section className="market-section">
            <div className="section-heading">
              <h2>
                Parts market <span>01—10</span>
              </h2>
              <span>
                {state.partDeckCount} in deck{" "}
                <span className="deck-icon">▱</span>
              </span>
            </div>
            <div className="market-row">
              {state.market.map((card) => (
                <button
                  key={card.id}
                  data-testid="market-card"
                  className={`market-card ${selection?.id === card.id ? "selected" : ""}`}
                  onClick={() => {
                    setSelection({ kind: "market", id: card.id });
                    setMoving(null);
                  }}
                  aria-label={`Inspect ${PARTS[card.definitionId].name} in market`}
                >
                  <span className="card-category">
                    {PARTS[card.definitionId].category}
                    <span>↗</span>
                  </span>
                  <img
                    src={`${import.meta.env.BASE_URL}assets/clockwork-rivals/${card.definitionId}.webp`}
                    alt=""
                  />
                  <span className="market-name">
                    {PARTS[card.definitionId].name}
                  </span>
                  <Formula id={card.definitionId} />
                  <span className="market-footer">
                    {state.phase === "draft" && state.setupComplete && canPlay
                      ? "Select to install"
                      : "Inspect machine"}
                  </span>
                </button>
              ))}
              {!state.market.length && (
                <p className="empty-message">
                  The parts market is empty. Rearrange your workshop or pass.
                </p>
              )}
            </div>
          </section>
          <section className="orders-section">
            {state.phase !== "deliver" && (
              <>
                <div className="section-heading">
                  <h2>Guild commissions</h2>
                  <span>
                    <Icon name="prestige" />
                    Target {state.config.targetPrestige}
                  </span>
                </div>
                <div className="orders-row">
                  {state.orders.map((card) => {
                    const order = ORDERS[card.definitionId];
                    const affordable = legal.some(
                      (a) => a.type === "deliver" && a.commission === card.id,
                    );
                    return (
                      <button
                        className={`order-card ${affordable ? "affordable" : ""}`}
                        key={card.id}
                        data-testid="commission"
                        onClick={() =>
                          affordable
                            ? confirmDelivery(card.id)
                            : setNotice(
                                `${order.name}: spend ${costText(order.cost)} for ${order.prestige} prestige during your Delivery turn.`,
                              )
                        }
                        aria-label={`${order.name}, ${costText(order.cost)} for ${order.prestige} prestige${affordable ? ", deliver" : ""}`}
                      >
                        <span className="order-points">
                          {order.prestige}
                          <Icon name="prestige" />
                        </span>
                        <CommissionArt id={card.definitionId} />
                        <span className="order-title">{order.name}</span>
                        <span className="order-cost">
                          {costText(order.cost)}{" "}
                          <span>{affordable ? "Deliver ↗" : "to deliver"}</span>
                        </span>
                      </button>
                    );
                  })}
                  {!state.orders.length && (
                    <p>
                      {state.orderDeckCount > 0
                        ? "New commissions arrive next round."
                        : "All guild commissions have been claimed."}
                    </p>
                  )}
                </div>
              </>
            )}
            <div className="coal-pool">
              <span className="coal-label">
                <Icon name="coal" />
                <b>Shared coal</b>
                <small>Refills each round</small>
              </span>
              <div
                className="coal-pieces"
                aria-label={`${state.sharedCoal} coal available`}
              >
                {Array.from(
                  { length: state.config.sharedCoal },
                  (_, i) => i,
                ).map((i) => (
                  <span
                    key={i}
                    className={
                      i < state.sharedCoal
                        ? "coal-piece available"
                        : "coal-piece"
                    }
                  >
                    {i < state.sharedCoal ? "◆" : "◇"}
                  </span>
                ))}
              </div>
              <button
                className="button small"
                disabled={!legal.some((a) => a.type === "take-coal")}
                onClick={() => act({ type: "take-coal", useValve: false })}
              >
                Take 1 coal
              </button>
            </div>
            {legal.some((a) => a.type === "take-coal" && a.useValve) && (
              <button
                className="valve-action"
                onClick={() => act({ type: "take-coal", useValve: true })}
              >
                Use Priority Valve → Take 2 coal
              </button>
            )}
          </section>
        </div>
        <div className="workshops">
          <section className={`own-workshop ${seat}`}>
            <div className="workshop-heading">
              <div>
                <div className="eyebrow">
                  <Owner seat={seat} />
                  {NAMES[seat].toUpperCase()} WORKSHOP <span>· {seat}</span>
                </div>
                <h2>
                  {online || mode === "practice"
                    ? "Your workshop"
                    : `${NAMES[seat]}’s workshop`}
                </h2>
              </div>
              <div className="prestige-score">
                <Icon name="prestige" />
                <b>{current.prestige}</b>
                <span>prestige</span>
              </div>
            </div>
            <div className="reserve-bar">
              <ResourceRow values={current.resources} />
              <span className="reserve-cap">RESERVES · MAX 8 EACH</span>
            </div>
            <div className="workshop-body">
              <div className="grid-column">
                {grid(seat)}
                <div className="grid-caption">
                  <span>↔ Side-by-side machines can unlock bonuses.</span>
                  <span>3 × 3 WORKSHOP</span>
                </div>
              </div>
              <aside
                className={`inspector ${selection ? "has-selection" : ""}`}
                aria-label="Machine inspector"
              >
                <div className="inspector-heading">
                  <span>
                    {moving !== null
                      ? "REARRANGE MACHINE"
                      : inspected
                        ? selection?.kind === "market"
                          ? "FROM THE MARKET"
                          : "MACHINE DETAILS"
                        : "THE WORKBENCH"}
                  </span>
                  {selection && (
                    <button
                      aria-label="Clear selection"
                      onClick={() => {
                        setSelection(null);
                        setMoving(null);
                      }}
                    >
                      ×
                    </button>
                  )}
                </div>
                {inspected && selectedCard ? (
                  <>
                    <img
                      className="inspector-art"
                      src={`${import.meta.env.BASE_URL}assets/clockwork-rivals/${inspected.id}.webp`}
                      alt={`${inspected.name} illustration`}
                    />
                    <span className="card-category">{inspected.category}</span>
                    <h3>{inspected.name}</h3>
                    <p className="rules-text">{inspected.rulesText}</p>
                    {selection?.kind === "market" ? (
                      <div className="inspection-action">
                        {canPlay &&
                        state.setupComplete &&
                        state.phase === "draft" ? (
                          <>
                            <span className="step-label">NEXT STEP</span>
                            <p>
                              {current.grid.every(Boolean)
                                ? "Your workshop is full. Choose a machine to replace."
                                : "Choose a marked slot to preview the installation before committing your Draft action."}
                            </p>
                          </>
                        ) : (
                          <p>Available to draft during your Draft turn.</p>
                        )}
                      </div>
                    ) : (
                      <>
                        {effect && effect.affordable && (
                          <div className="conversion-preview">
                            <span className="step-label">AFTER ACTIVATION</span>
                            <ResourceRow values={effect.after} />
                            {effect.adjacent.length > 0 && (
                              <p className="bonus-note">
                                ✦ Adjacency bonus included. Linked neighbors are
                                outlined in brass.
                              </p>
                            )}
                            {Object.keys(effect.overflow).length > 0 && (
                              <p className="overflow-note">
                                Reserve cap:{" "}
                                {Object.entries(effect.overflow)
                                  .map(([r, v]) => `${v} ${r}`)
                                  .join(", ")}{" "}
                                discarded.
                              </p>
                            )}
                          </div>
                        )}
                        {selection?.kind === "machine" &&
                          selection.seat === seat &&
                          state.phase === "run" && (
                            <p className="subtle">
                              {selectedCard.exhausted
                                ? "Already produced this round."
                                : inspected.effect.kind !== "convert"
                                  ? "Passive bonus applied automatically."
                                  : "Included automatically when you choose Run planned machines above, if its inputs are available."}
                            </p>
                          )}
                        {selection?.kind === "machine" &&
                          selection.seat === seat &&
                          state.phase === "draft" &&
                          canPlay && (
                            <button
                              className="button outline"
                              onClick={() =>
                                setMoving(
                                  current.grid.findIndex(
                                    (c) => c?.id === selectedCard.id,
                                  ),
                                )
                              }
                            >
                              {moving !== null
                                ? "Choose a destination slot"
                                : "Move or swap this machine"}
                            </button>
                          )}
                        {moving !== null && (
                          <p className="bonus-note">
                            Choose any other slot. Occupied slots swap machines.
                            This uses your Draft action.
                          </p>
                        )}
                        {!effect && (
                          <p className="subtle">
                            {inspected.id === "priority-valve"
                              ? current.valveUsed
                                ? "Valve bonus used this round."
                                : "Use its bonus with a Power action."
                              : selectedCard.boosted
                                ? "Boost used this round."
                                : "Boosts one adjacent Boiler automatically."}
                          </p>
                        )}
                      </>
                    )}
                  </>
                ) : (
                  <div className="inspector-empty">
                    <span className="workbench-mark">⚒</span>
                    <h3>
                      {state.phase === "run"
                        ? "Set things in motion."
                        : "Every part has a purpose."}
                    </h3>
                    <p>
                      {state.phase === "run"
                        ? "Use Run planned machines above to run your workshop. Select a machine here to inspect its recipe and adjacency bonuses."
                        : "Select a machine to inspect its conversion and discover how it fits into your engine."}
                    </p>
                    <div className="engine-chain">
                      <Icon name="coal" />
                      <span>→</span>
                      <Icon name="steam" />
                      <span>→</span>
                      <Icon name="work" />
                      <span>→</span>
                      <Icon name="gears" />
                    </div>
                    <button
                      className="text-button"
                      onClick={() => setDialog("rules")}
                    >
                      A quick guide to the game ↗
                    </button>
                  </div>
                )}
              </aside>
            </div>
            <div className="action-footer">
              <span>
                {!state.setupComplete
                  ? "Choose your private objective before Draft."
                  : state.phase === "run"
                    ? "Use the production panel above to run your workshop."
                    : state.phase === "deliver"
                      ? "Choose a commission or keep your reserves at the Delivery desk above."
                      : canPlay
                        ? `You can take ${remaining} more ${remaining === 1 ? "action" : "actions"} in ${state.phase}.`
                        : turnLabel}
              </span>
              <div>
                {!online && (
                  <button
                    className="text-button"
                    disabled={
                      !actions.some(
                        (a) => mode === "hotseat" || a.actor === "P0",
                      )
                    }
                    onClick={undo}
                  >
                    ↶ Undo
                  </button>
                )}
                {state.phase !== "run" && state.phase !== "deliver" && (
                  <button
                    className="button outline"
                    disabled={!canPlay || !state.setupComplete}
                    onClick={() => act({ type: "pass" })}
                  >
                    Pass {state.phase} <span>→</span>
                  </button>
                )}
              </div>
            </div>
          </section>
          <aside className="rival-column">
            <section
              className={`rival-workshop ${rival} ${showRival ? "expanded" : ""}`}
            >
              <div className="rival-header">
                <div>
                  <div className="eyebrow">
                    <Owner seat={rival} />
                    {NAMES[rival].toUpperCase()} <span>· {rival}</span>
                  </div>
                  <h2>
                    {!online && mode === "practice"
                      ? "The Automaton"
                      : "Rival’s workshop"}
                  </h2>
                </div>
                <span className="rival-score">
                  <Icon name="prestige" />
                  <b>{opponent.prestige}</b>
                </span>
              </div>
              <ResourceRow values={opponent.resources} />
              {state.config.objectives !== "off" &&
                state.status !== "finished" && (
                  <div className="rival-secret">
                    <span aria-hidden="true">◇</span>
                    <div>
                      Private objective
                      <small>
                        {state.objectiveReady[rival]
                          ? "Card locked · revealed at match end"
                          : "Choosing privately"}
                      </small>
                    </div>
                  </div>
                )}
              <button
                className="rival-toggle"
                onClick={() => setShowRival(!showRival)}
              >
                {showRival ? "Hide" : "Inspect"} rival’s workshop{" "}
                {showRival ? "−" : "+"}
              </button>
              <div className="rival-grid-wrap">{grid(rival, true)}</div>
              <div className="rival-foot">
                <span>{opponent.delivered.length} commissions delivered</span>
                <span>
                  {state.initiative === rival
                    ? "◆ Initiative"
                    : "Next round initiative"}
                </span>
              </div>
            </section>
            <section className="activity">
              <div className="section-heading">
                <h2>Workshop journal</h2>
                <span>LIVE</span>
              </div>
              <ol aria-label="Game activity">
                {state.log
                  .slice(-5)
                  .reverse()
                  .map((event, i) => (
                    <li key={`${event.revision}-${i}`}>
                      <span className={`log-dot ${event.actor || ""}`} />
                      <div>
                        <p>{event.text}</p>
                        <span>
                          Round {event.round} · {event.phase}
                        </span>
                      </div>
                    </li>
                  ))}
                {!state.log.length && (
                  <li>
                    <span className="log-dot" />
                    <div>
                      <p>A new rivalry begins. The first machines are ready.</p>
                      <span>Round 1 · Draft</span>
                    </div>
                  </li>
                )}
              </ol>
            </section>
          </aside>
        </div>
        <footer className="site-footer">
          <span>
            CLOCKWORK RIVALS <span> / </span> PROTOTYPE v{VERSION}
          </span>
          <span>
            {state.config.targetPrestige} public prestige ·{" "}
            {state.config.maxRounds} rounds
            {state.config.objectives !== "off" &&
              ` · +${state.config.objectiveBonus} private objective`}
          </span>
          <div>
            <button onClick={() => setDialog("feedback")}>
              Playtest notes
            </button>
            <button onClick={() => setDialog("menu")}>Game menu ☰</button>
          </div>
        </footer>
      </main>
      {handoffRequired && (
        <Modal
          title={`Pass the screen to ${NAMES[seat]}`}
          close={() => {}}
          dismissible={false}
        >
          <div className="privacy-screen">
            <span aria-hidden="true">◇</span>
            <p>
              Only {NAMES[seat]} should look at their private objective. The
              public table is safe to share.
            </p>
            <button
              className="button full"
              onClick={() => setPrivacySeat(seat)}
            >
              I’m {NAMES[seat]} · continue →
            </button>
          </div>
        </Modal>
      )}
      {objectiveOpen && !handoffRequired && (
        <Modal
          title="Your private objective"
          close={() => setObjectiveOpen(false)}
          wide
        >
          <ObjectiveCards
            objective={state.objective}
            bonus={state.config.objectiveBonus}
            canChoose={canPlay && !state.setupComplete}
            choose={(objective) => act({ type: "choose-objective", objective })}
          />
          <button
            className="text-button full"
            onClick={() => setObjectiveOpen(false)}
          >
            Hide private card
          </button>
        </Modal>
      )}
      {dialog === "new" && (
        <Modal title="A new rivalry" close={close}>
          <p className="modal-intro">
            Choose your table. Your local game saves automatically.
          </p>
          <div className="mode-choices">
            {(
              [
                [
                  "practice",
                  "Practice",
                  "Play against the Automaton. Learn at your pace.",
                ],
                [
                  "hotseat",
                  "Pass & play",
                  "Two clockmakers, one screen. Private cards use a handoff screen.",
                ],
                [
                  "online",
                  "Private online room",
                  "Invite one friend. Moves and reconnects are saved.",
                ],
              ] as const
            )
              .filter(([id]) => id !== "online" || ROOMS_ENABLED)
              .map(([id, title, description]) => (
                <button
                  key={id}
                  className={newMode === id ? "chosen" : ""}
                  onClick={() => setNewMode(id)}
                >
                  <span>{title}</span>
                  <small>{description}</small>
                  <b>{newMode === id ? "●" : "○"}</b>
                </button>
              ))}
          </div>
          {!ROOMS_ENABLED && (
            <p className="subtle">
              This public table supports Practice and Pass &amp; play. Online
              rooms are not available on this site.
            </p>
          )}
          <details className="playtest-settings">
            <summary>Playtest rules</summary>
            <label className="field-label">
              Private objectives
              <select
                aria-label="Private objectives"
                value={newConfig.objectives}
                onChange={(e) =>
                  setNewConfig({
                    ...newConfig,
                    objectives: e.target.value as PlaytestConfig["objectives"],
                  })
                }
              >
                <option value="choice">Choose one of two (default)</option>
                <option value="random">One randomly assigned</option>
                <option value="off">Off · comparison game</option>
              </select>
            </label>
            <label className="field-label">
              Commissions
              <select
                aria-label="Commissions"
                value={newConfig.commissions}
                onChange={(e) =>
                  setNewConfig({
                    ...newConfig,
                    commissions: e.target
                      .value as PlaytestConfig["commissions"],
                  })
                }
              >
                <option value="classic">Classic · gears only</option>
                <option value="mixed">Mixed resource recipes</option>
              </select>
            </label>
            {(
              [
                ["targetPrestige", "Public prestige target", 6, 20],
                ["maxRounds", "Round limit", 4, 12],
                ["sharedCoal", "Shared coal per round", 1, 6],
                ["objectiveBonus", "Objective bonus", 0, 5],
              ] as const
            ).map(([key, label, min, max]) => (
              <label className="field-label" key={key}>
                {label}
                <input
                  type="number"
                  min={min}
                  max={max}
                  value={newConfig[key]}
                  onChange={(e) =>
                    setNewConfig({
                      ...newConfig,
                      [key]: Math.max(
                        min,
                        Math.min(max, Number(e.target.value)),
                      ),
                    })
                  }
                />
              </label>
            ))}
            <p className="subtle">
              Experimental values. Keep the defaults when comparing objective
              and commission changes.
            </p>
          </details>
          {newMode !== "online" && (
            <label className="field-label">
              Seed <span>optional · reproduce the same deal</span>
              <input
                inputMode="numeric"
                placeholder="Random"
                value={seedInput}
                onChange={(e) =>
                  setSeedInput(
                    e.target.value.replace(/[^0-9]/g, "").slice(0, 10),
                  )
                }
              />
            </label>
          )}
          <button
            className="button full"
            onClick={() => {
              if (newMode === "online") {
                close();
                void net.connect(undefined, undefined, newConfig);
              } else
                newGame(
                  newMode,
                  seedInput ? Number(seedInput) >>> 0 : randomSeed(),
                );
            }}
          >
            {newMode === "online"
              ? "Create private room ↗"
              : "Start new game →"}
          </button>
        </Modal>
      )}
      {dialog === "rules" && (
        <Modal title="A clockmaker’s field guide" close={close} wide>
          <p className="modal-intro">
            A game of clever arrangements and contested opportunities. Two
            workshops. One guild to impress.
          </p>
          <div className="rule-grid">
            {PHASES.map((p, i) => (
              <article key={p}>
                <span className="rule-number">0{i + 1}</span>
                <h3>
                  {phaseName(p)}{" "}
                  <small>
                    {p === "run"
                      ? "all usable machines once"
                      : `${ALLOWANCE[p]} ${ALLOWANCE[p] === 1 ? "action" : "actions"} each`}
                  </small>
                </h3>
                <p>{PHASE_COPY[p]}</p>
                {p === "draft" && (
                  <p>
                    Parts are free. Rearranging moves or swaps two slots.
                    Replacement is allowed only when all nine slots are
                    occupied.
                  </p>
                )}
                {p === "power" && (
                  <p>
                    A Priority Valve takes one extra available coal, once per
                    player per round. Personal reserves each hold up to 8.
                  </p>
                )}
                {p === "run" && (
                  <p>
                    Edit priority and enabled settings freely before production.
                    Grid placement determines adjacency, not execution priority.
                    Each enabled machine runs once; there is no four-machine
                    limit. The preview shows the exact sequence and final
                    reserves, including any gear spent by a Recycler. Only
                    side-sharing neighbors count for bonuses. Delivery begins
                    after both workshops produce.
                  </p>
                )}
                {p === "deliver" && (
                  <p>
                    Commissions refill after both players finish Delivery. The
                    player with initiative changes every round.
                  </p>
                )}
              </article>
            ))}
          </div>
          <div className="rule-callout">
            <h3>Make something worthy of the guild.</h3>
            <p>
              The public prestige target or round limit triggers the end after
              both Delivery opportunities. Then both private objectives are
              revealed and completed objectives add the configured bonus. Final
              prestige determines the winner, then unspent gears. A hidden bonus
              can change the winner; concession always awards the rival the
              match.
            </p>
            <p>
              Alternate actions within each phase. Passing ends your
              participation in that phase. Coal, steam, work and gears stay in
              your reserves between rounds.
            </p>
          </div>
          <button className="button" onClick={close}>
            Back to the workshop →
          </button>
        </Modal>
      )}
      {dialog === "catalogue" && (
        <Modal title="The machine catalogue" close={close} wide>
          <p className="modal-intro">
            Ten tools of the trade. Three copies of each in the parts deck, plus
            your starter machines.
          </p>
          <div className="catalogue-grid">
            {Object.values(PARTS).map((p) => (
              <article key={p.id}>
                <img
                  src={`${import.meta.env.BASE_URL}assets/clockwork-rivals/${p.id}.webp`}
                  alt={`${p.name} illustration`}
                />
                <div>
                  <span className="card-category">{p.category}</span>
                  <h3>{p.name}</h3>
                  <Formula id={p.id} />
                  <p>{p.rulesText}</p>
                </div>
              </article>
            ))}
          </div>
        </Modal>
      )}
      {dialog === "menu" && (
        <Modal title="At your table" close={close}>
          <div className="menu-details">
            <span>Rules {VERSION}</span>
            <span>Revision {state.revision}</span>
            <span>
              {online ? "Server-authoritative room" : `Seed ${local.seed}`}
            </span>
          </div>
          <div className="menu-list">
            <button onClick={() => setDialog("catalogue")}>
              Machine catalogue <span>↗</span>
            </button>
            <button onClick={() => setSound(!sound)}>
              {sound ? "Mute sound" : "Enable sound"} <span>♪</span>
            </button>
            <button
              onClick={() =>
                download(
                  publicReport(state),
                  `clockwork-public-report-${Date.now()}.json`,
                )
              }
            >
              Export public match report <span>↓</span>
            </button>
            {!online && (
              <button onClick={() => importInput.current?.click()}>
                Import a saved game <span>↑</span>
              </button>
            )}
            <button
              onClick={() => {
                close();
                setDialog("rules");
              }}
            >
              Read the rules <span>↗</span>
            </button>
            {state.status === "active" && (
              <button
                className="danger-text"
                onClick={() => {
                  close();
                  setConfirmation({
                    title: "Concede this match?",
                    text: `${NAMES[seat]} concedes. ${NAMES[rival]} will win immediately.`,
                    action: { type: "concede" },
                  });
                }}
              >
                Concede match <span>⚑</span>
              </button>
            )}
            {state.status === "finished" && (
              <button
                onClick={() => {
                  close();
                  setFinishedDismissed(false);
                }}
              >
                View results <span>↗</span>
              </button>
            )}
          </div>
          <input
            ref={importInput}
            type="file"
            accept=".json,application/json"
            hidden
            onChange={(e) => void importSave(e.target.files?.[0])}
          />
          <p className="subtle">
            {online
              ? "Invite links can claim the open rival seat. Your private reconnect credential stays in this browser."
              : "Public reports omit private cards and cannot resume a match. Autosave keeps the full game in this browser. Imports require a complete version 0.2 private backup; older saves are rejected."}
          </p>
        </Modal>
      )}
      {dialog === "feedback" && (
        <Modal title="Notes from the workbench" close={close}>
          <p className="modal-intro">
            What felt clever? What felt unclear? These notes download locally
            with the public match log for a playtest review.
          </p>
          <label className="field-label">
            Your observations
            <textarea
              rows={6}
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Which decision did your objective change? Did editing production priorities help? When did your combo become useful? Any fuel shortages, idle machines, confusing moments, or desire for a rematch?"
            />
          </label>
          <button
            className="button full"
            onClick={() => {
              download(
                {
                  rulesVersion: VERSION,
                  notes: feedback,
                  mode: online ? "online" : mode,
                  round: state.round,
                  winner: state.winner,
                  log: state.log,
                },
                `clockwork-playtest-${Date.now()}.json`,
              );
              setNotice("Playtest notes are ready to save.");
              close();
            }}
          >
            Download playtest notes ↓
          </button>
        </Modal>
      )}
      {exported && (
        <Modal title="Your export is ready" close={() => setExported(null)}>
          <p className="modal-intro">
            Save this public report or your playtest notes. Private cards are
            excluded. Public reports cannot restore a game; your local match
            resumes from browser autosave.
          </p>
          <label className="field-label">
            {exported.name}
            <textarea
              aria-label="Export file contents"
              className="export-content"
              readOnly
              rows={8}
              value={exported.json}
            />
          </label>
          <div className="dialog-actions">
            <button
              className="button outline"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(exported.json);
                  setNotice(
                    "Export contents copied. Paste into a .json file to keep it.",
                  );
                } catch {
                  setNotice("Select the file contents and copy them manually.");
                }
              }}
            >
              Copy contents
            </button>
            <a
              className="button download-link"
              href={exported.url}
              download={exported.name}
            >
              Download file ↓
            </a>
          </div>
        </Modal>
      )}
      {placement && (
        <Modal
          title={
            placement.action.replace
              ? "Review replacement"
              : "Review installation"
          }
          close={() => setPlacement(null)}
          wide
        >
          <InstallationPreview
            state={state}
            seat={seat}
            instance={placement.action.marketInstance}
            target={placement.index}
          />
          {placement.action.replace && (
            <p className="overflow-note">
              This permanently replaces{" "}
              {PARTS[current.grid[placement.index]!.definitionId].name}.
            </p>
          )}
          <div className="dialog-actions">
            <button
              className="button outline"
              onClick={() => setPlacement(null)}
            >
              Cancel
            </button>
            <button
              className="button"
              disabled={!canPlay}
              onClick={() => act(placement.action)}
            >
              Confirm installation →
            </button>
          </div>
        </Modal>
      )}
      {confirmation && (
        <Modal title={confirmation.title} close={() => setConfirmation(null)}>
          <p className="modal-intro">{confirmation.text}</p>
          <div className="dialog-actions">
            <button
              className="button outline"
              onClick={() => setConfirmation(null)}
            >
              Cancel
            </button>
            <button className="button" onClick={() => act(confirmation.action)}>
              Confirm{" "}
              {confirmation.action.type === "deliver"
                ? "delivery"
                : confirmation.action.type === "concede"
                  ? "concede"
                  : "replacement"}{" "}
              →
            </button>
          </div>
        </Modal>
      )}
      {state.status === "finished" &&
        !finishedDismissed &&
        !dialog &&
        !confirmation &&
        !exported && (
          <Modal
            title={
              state.winner === "draw"
                ? "Honors shared."
                : `${NAMES[state.winner!]} takes the honors.`
            }
            close={() => setFinishedDismissed(true)}
          >
            <div className="result-medal">
              <Icon name="prestige" />
            </div>
            <p className="result-caption">THE GUILD HAS SPOKEN</p>
            <div className="result-scores">
              {(["P0", "P1"] as const).map((p) => (
                <div key={p}>
                  <Owner seat={p} />
                  <h3>{NAMES[p]}</h3>
                  <strong>
                    {state.finalScores?.[p] ?? state.players[p].prestige}
                  </strong>
                  <div className="score-breakdown">
                    <span>{state.players[p].prestige} public prestige</span>
                    <span>
                      + {state.revealedObjectives?.[p].bonus ?? 0} objective
                    </span>
                    <b>
                      = {state.finalScores?.[p] ?? state.players[p].prestige}{" "}
                      final prestige
                    </b>
                    <small>
                      {state.players[p].resources.gears} unspent gears
                    </small>
                  </div>
                </div>
              ))}
            </div>
            {state.revealedObjectives && (
              <div className="objective-reveal">
                {(["P0", "P1"] as const).map((owner) => {
                  const reveal = state.revealedObjectives![owner];
                  return (
                    <article key={owner}>
                      <span className="step-label">
                        {NAMES[owner]} · OBJECTIVE REVEALED
                      </span>
                      <h3>
                        {reveal.selected
                          ? OBJECTIVES[reveal.selected].title
                          : "No objective"}
                      </h3>
                      <p>
                        {reveal.selected
                          ? OBJECTIVES[reveal.selected].description
                          : "Objective comparison mode"}
                      </p>
                      <strong>
                        {reveal.progress} · +{reveal.bonus} prestige
                      </strong>
                    </article>
                  );
                })}
              </div>
            )}
            <p className="subtle centered">
              {state.log.at(-1)?.type === "concede"
                ? state.log.at(-1)?.text
                : "Highest prestige wins. Unspent gears break a tie."}
            </p>
            <button
              className="button full"
              disabled={online && !!net.snapshot?.rematch[seat]}
              onClick={() =>
                online
                  ? net.message("rematch")
                  : newGame(mode, randomSeed(), other(local.initialInitiative))
              }
            >
              {online && net.snapshot?.rematch[seat]
                ? "Rematch requested · waiting for rival"
                : "Another round of rivalry →"}
            </button>
            <button
              className="text-button full"
              onClick={() => setFinishedDismissed(true)}
            >
              Review the finished workshop
            </button>
          </Modal>
        )}
    </>
  );
}
