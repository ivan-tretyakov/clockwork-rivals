import { useEffect, useRef, useState } from "react";
import {
  VERSION,
  PARTS,
  ORDERS,
  OBJECTIVES,
  STATIONS,
  STATION_NAMES,
  PHASES,
  DEFAULT_CONFIG,
  gameConfig,
  setup,
  reduce,
  project,
  publicReport,
  legalActions,
  productionPlan,
  installationPreview,
  canAfford,
  missingCost,
  costText,
  chooseBotAction,
  saveGame,
  loadGame,
  other,
  type Seat,
  type Action,
  type Card,
  type AcceptedAction,
  type PlaytestConfig,
} from "../../../packages/clockwork-rules/src/index";
import { useRoom, ROOMS_ENABLED } from "./useRoom";
import { ObjectiveCards } from "./ObjectiveCards";
import {
  Modal,
  ResourceRow,
  PartArt,
  PartCard,
  Formula,
  Workshop,
  ProductionSummary,
} from "./GamePieces";
import "./style.css";
import "./stations.css";
const NAMES = { P0: "Teal", P1: "Copper" };
const LABELS = {
  acquire: "Acquire",
  install: "Install",
  power: "Power",
  run: "Produce",
  deliver: "Delivery",
};
const COPY = {
  acquire:
    "Take one market part for free, or draw two privately and keep one. Your hand holds up to three parts.",
  install:
    "Invest gears to install one part from your private hand, or save them for a commission. Enhancements stay when a core is replaced.",
  power:
    "Take up to two coal, one at a time. The three-coal supply is shared with your rival.",
  run: "Switch stations on or off, review the complete result, then run your workshop once. Energy → Conversion → Fabrication.",
  deliver:
    "Pay all listed resources for one commission. Both players finish Delivery before the market refills or the match ends.",
};
type Mode = "practice" | "hotseat";
type Dialog =
  | "new"
  | "rules"
  | "catalogue"
  | "menu"
  | "feedback"
  | "objective"
  | "hand"
  | "blind"
  | null;
const SAVE_KEY = "clockwork-local-v3";
const newSeed = () => crypto.getRandomValues(new Uint32Array(1))[0];
function initialGame() {
  let warning = "";
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      const saved = JSON.parse(raw),
        game = loadGame(JSON.stringify(saved.save));
      return {
        state: game.state,
        actions: game.actions,
        mode: (saved.mode === "hotseat" ? "hotseat" : "practice") as Mode,
        warning,
      };
    }
    if (
      localStorage.getItem("clockwork-local-v2") ||
      localStorage.getItem("clockwork-local-v1")
    )
      warning =
        "Rules 0.3 starts a new station-based rivalry. Your earlier autosaves remain preserved; old matches cannot be resumed under these rules.";
  } catch (e) {
    warning =
      "Saved game could not be loaded: " +
      (e as Error).message +
      " Your stored backup is preserved until you start a new match.";
  }
  return {
    state: setup({ seed: newSeed(), rulesVersion: VERSION }),
    actions: [] as AcceptedAction[],
    mode: "practice" as Mode,
    warning,
  };
}
export default function App() {
  const [initial] = useState(initialGame),
    [local, setLocal] = useState(initial.state),
    [actions, setActions] = useState(initial.actions),
    [mode, setMode] = useState<Mode>(initial.mode);
  const net = useRoom(),
    online = net.status !== "offline";
  const seat: Seat = online
    ? (net.welcome?.seat ?? "P0")
    : mode === "practice"
      ? "P0"
      : (local.activePlayer ?? "P0");
  const state =
      online && net.snapshot ? net.snapshot.state : project(local, seat),
    rival = other(seat),
    player = state.players[seat],
    opponent = state.players[rival];
  const [privacySeat, setPrivacySeat] = useState<Seat | null>(null),
    [dialog, setDialog] = useState<Dialog>(null);
  const handoff =
    !online &&
    mode === "hotseat" &&
    state.status === "active" &&
    privacySeat !== seat;
  const [inspect, setInspect] = useState<string | null>(null),
    [acquire, setAcquire] = useState<{ card: Card; blind: boolean } | null>(
      null,
    ),
    [discard, setDiscard] = useState("");
  const [installation, setInstallation] = useState<Extract<
      Action,
      { type: "install" }
    > | null>(null),
    [confirm, setConfirm] = useState<{
      title: string;
      text: string;
      action: Action;
    } | null>(null);
  const [notice, setNotice] = useState(initial.warning),
    [storageBlocked, setStorageBlocked] = useState(
      initial.warning.startsWith("Saved game could not"),
    );
  const [newMode, setNewMode] = useState<Mode | "online">("practice"),
    [config, setConfig] = useState<PlaytestConfig>(initial.state.config);
  const [finishedDismissed, setFinishedDismissed] = useState(false),
    [feedback, setFeedback] = useState(""),
    [sound, setSound] = useState(false);
  const [exported, setExported] = useState<{
    url: string;
    json: string;
    name: string;
  } | null>(null);
  const importInput = useRef<HTMLInputElement>(null),
    workflow = useRef<HTMLElement>(null),
    lock = useRef(false),
    soundContext = useRef<AudioContext | null>(null);
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
    !handoff;
  const legal = canPlay ? legalActions(state, seat) : [],
    hand = state.hand ?? [],
    blind = state.blindChoices ?? [];
  const installPreview = installation
    ? installationPreview(state, seat, installation)
    : null;
  function clearPanels() {
    setDialog(null);
    setInspect(null);
    setAcquire(null);
    setInstallation(null);
    setConfirm(null);
    setDiscard("");
  }
  useEffect(() => {
    clearPanels();
  }, [seat, net.snapshot?.matchId]);
  useEffect(() => {
    lock.current = false;
    if (state.status === "active") setFinishedDismissed(false);
  }, [state.revision, online]);
  useEffect(() => {
    if (!net.pending) lock.current = false;
  }, [net.pending]);
  useEffect(() => {
    if (state.pendingActor === seat && !handoff) setDialog("blind");
  }, [state.pendingActor, seat, handoff]);
  useEffect(() => {
    if (state.setupComplete && state.status === "active") {
      workflow.current?.scrollIntoView({ block: "start" });
      workflow.current?.focus({ preventScroll: true });
    }
  }, [state.phase, state.round, state.setupComplete]);
  useEffect(() => {
    if (storageBlocked) return;
    try {
      localStorage.setItem(
        SAVE_KEY,
        JSON.stringify({ mode, save: saveGame(local, actions) }),
      );
    } catch {
      setNotice(
        "Autosave is unavailable. Keep this tab open to retain your match.",
      );
    }
  }, [local, actions, mode, storageBlocked]);
  useEffect(() => {
    if (
      online ||
      mode !== "practice" ||
      local.activePlayer !== "P1" ||
      local.status !== "active" ||
      dialog ||
      inspect ||
      confirm ||
      installation ||
      acquire
    )
      return;
    const timer = setTimeout(() => act(chooseBotAction(local), "P1"), 480);
    return () => clearTimeout(timer);
  }, [local, online, mode, dialog, inspect, confirm, installation, acquire]);
  useEffect(
    () => () => {
      if (exported) URL.revokeObjectURL(exported.url);
    },
    [exported],
  );
  function chime() {
    if (!sound) return;
    try {
      const c = (soundContext.current ??= new AudioContext());
      void c.resume();
      const o = c.createOscillator(),
        g = c.createGain();
      o.connect(g);
      g.connect(c.destination);
      o.frequency.value = state.phase === "deliver" ? 660 : 440;
      g.gain.setValueAtTime(0.025, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.16);
      o.start();
      o.stop(c.currentTime + 0.16);
    } catch {}
  }
  function act(action: Action, actor: Seat = seat) {
    if (lock.current) return;
    if (online) {
      lock.current = true;
      net.command(action);
      clearPanels();
      return;
    }
    const result = reduce(local, actor, action);
    if (!result.ok) {
      setNotice(result.message);
      return;
    }
    lock.current = true;
    setLocal(result.state);
    setActions([...actions, { actor, action }]);
    clearPanels();
    chime();
  }
  function newGame(nextMode: Mode, initiative?: Seat) {
    try {
      const s = setup({
        seed: newSeed(),
        rulesVersion: VERSION,
        initiativeOverride: initiative,
        config,
      });
      net.leave();
      setLocal(s);
      setActions([]);
      setMode(nextMode);
      setPrivacySeat(null);
      clearPanels();
      setFinishedDismissed(false);
      setStorageBlocked(false);
      setNotice("");
      lock.current = false;
    } catch (e) {
      setNotice((e as Error).message);
    }
  }
  function download(value: unknown, name: string) {
    const json = JSON.stringify(value, null, 2),
      url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    clearPanels();
    setExported({ json, url, name });
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
      setConfig(saved.config);
      setPrivacySeat(null);
      setStorageBlocked(false);
      setFinishedDismissed(false);
      clearPanels();
      setNotice("Private backup imported; replay verified.");
    } catch (e) {
      setNotice("Import failed: " + (e as Error).message);
    }
    if (importInput.current) importInput.current.value = "";
  }
  function acquireCard(card: Card, blind = false) {
    setDialog(null);
    setDiscard("");
    setAcquire({ card, blind });
  }
  function acceptAcquire() {
    if (!acquire) return;
    act({
      type: acquire.blind ? "keep-blind" : "acquire-market",
      instance: acquire.card.id,
      ...(hand.length >= 3 ? { discard } : {}),
    });
  }
  const phasePassed =
    state.passed[seat] ||
    state.counts[seat] >= (state.phase === "power" ? 2 : 1);
  const canPass = legal.some((a) => a.type === "pass");
  const privateVisible = !handoff;
  const currentPhase = state.setupComplete
    ? LABELS[state.phase]
    : "Choose an objective";
  const turnText =
    state.status === "finished"
      ? "Rivalry complete"
      : !connected
        ? "Waiting for connection"
        : canPlay
          ? "Your turn"
          : (mode === "practice" && !online
              ? "The Automaton"
              : NAMES[state.activePlayer ?? rival]) + " is deciding";
  let configError = "";
  try {
    gameConfig(config);
  } catch {
    configError =
      "Use whole numbers: target 6–40, objective bonus 0–6, shared coal 1–6.";
  }
  return (
    <>
      <header className="site-header">
        <a className="wordmark" href={import.meta.env.BASE_URL}>
          <span className="brand-gear">⚙</span>
          <span>
            CLOCKWORK
            <b>
              RIVALS <i>—</i>
            </b>
          </span>
        </a>
        <nav aria-label="Main navigation">
          <span className="active">Game table</span>
          <button onClick={() => setDialog("catalogue")}>
            Parts catalogue
          </button>
          <button onClick={() => setDialog("rules")}>How to play ?</button>
        </nav>
        <button
          className="button outline small"
          onClick={() => setDialog("new")}
        >
          New game ↗
        </button>
      </header>
      <main className="game-shell v3">
        <div className="table-heading">
          <div>
            <div className="eyebrow">
              THE GUILD OF CLOCKMAKERS <span>•</span> EST. 1886
            </div>
            <h1>
              Ingenuity meets rivalry<span>.</span>
            </h1>
            <p>Build your engine. Invest in ambition.</p>
          </div>
          <div className="match-meta">
            <span className="mode-tag">
              {online
                ? "Private online table"
                : mode === "practice"
                  ? "Practice · vs Automaton"
                  : "Pass & play"}
            </span>
            <span className="round-count">
              Round <b>{state.round}</b>
              <span>Race to {state.config.targetPrestige}</span>
            </span>
          </div>
        </div>
        {(notice || net.error) && (
          <div className="notice" role="alert">
            <span>{notice || net.error}</span>
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
          <div className="online-bar">
            <span>
              {net.status === "connected"
                ? NAMES[seat] +
                  " seat · " +
                  (connected
                    ? "Both clockmakers connected"
                    : "Waiting for your rival")
                : net.status}
            </span>
            {net.welcome && (
              <button
                className="text-button"
                onClick={() =>
                  void navigator.clipboard
                    .writeText(location.href)
                    .then(() =>
                      setNotice(
                        "Private invite copied. Open it on a different browser or device.",
                      ),
                    )
                    .catch(() =>
                      setNotice(
                        "Copy the invite from your browser address bar.",
                      ),
                    )
                }
              >
                Copy private invite ↗
              </button>
            )}
            {net.snapshot?.canClaimForfeit[seat] && (
              <button
                className="text-button"
                onClick={() => net.message("forfeit")}
              >
                Claim disconnected rival’s forfeit
              </button>
            )}
            <button
              className="text-button"
              onClick={() => {
                net.leave();
                clearPanels();
              }}
            >
              Leave table
            </button>
          </div>
        )}
        <div className="phase-strip" role="region" aria-label="Round phases">
          {PHASES.map((p, i) => (
            <div
              key={p}
              className={
                "phase-step" +
                (state.setupComplete && state.phase === p ? " active" : "")
              }
            >
              <b className="phase-number">0{i + 1}</b>
              <div>
                <strong>{LABELS[p]}</strong>
                <small>
                  {
                    [
                      "Take a part",
                      "Invest your gears",
                      "Gather fuel",
                      "Run 3 stations",
                      "Earn prestige",
                    ][i]
                  }
                </small>
              </div>
            </div>
          ))}
        </div>
        <div className="v3-turn" aria-live="polite">
          <b>
            <span className={"owner " + seat}>{seat === "P0" ? "●" : "◆"}</span>{" "}
            {turnText}
          </b>
          <span>
            {NAMES[seat]} workshop · {currentPhase}
          </span>
        </div>
        <section
          className="workflow"
          ref={workflow}
          tabIndex={-1}
          aria-label={currentPhase + " actions"}
        >
          {!state.setupComplete ? (
            <>
              <div className="step-label">A PRIVATE AMBITION</div>
              <h2>Choose your reason to rival.</h2>
              <p>
                Choose one of two private objectives. A completed card adds{" "}
                {state.config.objectiveBonus} final prestige and can change the
                winner. The public markets open after both players lock a
                choice.
              </p>
              <div className="workflow-buttons">
                <button
                  className="button"
                  disabled={handoff}
                  onClick={() => setDialog("objective")}
                >
                  {state.objectiveReady[seat]
                    ? "Inspect private objective"
                    : "Choose private objective"}{" "}
                  ↗
                </button>
                <span className="subtle">
                  Teal: {state.objectiveReady.P0 ? "ready" : "choosing"} ·
                  Copper: {state.objectiveReady.P1 ? "ready" : "choosing"}
                </span>
              </div>
            </>
          ) : state.status === "finished" ? (
            <>
              <div className="step-label">THE RIVALRY IS SETTLED</div>
              <h2>
                {state.winner === "draw"
                  ? "A worthy draw."
                  : NAMES[state.winner!] + " wins the rivalry."}
              </h2>
              <p>
                Public prestige and revealed objective bonuses determine the
                final score.
              </p>
              <button
                className="button"
                onClick={() => setFinishedDismissed(false)}
              >
                View final scores →
              </button>
            </>
          ) : (
            <>
              <div className="workflow-heading">
                <div>
                  <div className="step-label">
                    {NAMES[seat].toUpperCase()} ·{" "}
                    {LABELS[state.phase].toUpperCase()}
                  </div>
                  <h2>
                    {state.pendingActor === seat
                      ? "Choose your private part."
                      : state.phase === "acquire"
                        ? "Find your next advantage."
                        : state.phase === "install"
                          ? "Invest in your engine."
                          : state.phase === "power"
                            ? "Fuel the next shift."
                            : state.phase === "run"
                              ? "Bring the workshop to life."
                              : "Deliver to the guild."}
                  </h2>
                </div>
                {phasePassed && (
                  <span className="complete-pill">✓ Your turn is complete</span>
                )}
              </div>
              <p>
                {state.phase === "power"
                  ? "Take up to two coal, one at a time. " +
                    state.config.sharedCoal +
                    " coal is shared each round."
                  : COPY[state.phase]}
              </p>
              {state.phase === "acquire" && (
                <div className="workflow-buttons">
                  {state.pendingActor === seat ? (
                    <button
                      className="button"
                      disabled={handoff}
                      onClick={() => setDialog("blind")}
                    >
                      Resume private choice →
                    </button>
                  ) : (
                    <>
                      <a className="button" href="#parts-market">
                        Choose a market part ↓
                      </a>
                      <button
                        className="button outline"
                        disabled={!legal.some((a) => a.type === "draw-blind")}
                        onClick={() => act({ type: "draw-blind" })}
                      >
                        Draw 2 · keep 1 privately
                      </button>
                      <button
                        className="text-button"
                        disabled={!canPass}
                        onClick={() => act({ type: "pass" })}
                      >
                        Skip acquisition →
                      </button>
                    </>
                  )}
                </div>
              )}
              {state.phase === "install" && (
                <div className="workflow-buttons">
                  <button
                    className="button"
                    disabled={handoff}
                    onClick={() => setDialog("hand")}
                  >
                    Open private hand · {player.handCount} / 3 ↗
                  </button>
                  <button
                    className="button outline"
                    disabled={!canPass}
                    onClick={() => act({ type: "pass" })}
                  >
                    Save gears · skip installation →
                  </button>
                  {canPlay && !legal.some((a) => a.type === "install") && (
                    <span className="subtle">
                      {hand.length
                        ? "No affordable compatible installation. Save gears for next round."
                        : "Your hand is empty. Skip installation to collect fuel."}
                    </span>
                  )}
                </div>
              )}
              {state.phase === "power" && (
                <>
                  <div className="fuel-row">
                    <span
                      className="fuel-tokens"
                      aria-label={state.sharedCoal + " coal available"}
                    >
                      {Array.from({ length: state.sharedCoal }, (_, i) => (
                        <span key={i}>◆</span>
                      ))}
                    </span>
                    <b>{state.sharedCoal} shared coal</b>
                    <span>
                      You hold {player.resources.coal} / 8 ·{" "}
                      {state.counts[seat]} / 2 taken
                    </span>
                  </div>
                  <div className="workflow-buttons">
                    <button
                      className="button"
                      disabled={!legal.some((a) => a.type === "take-coal")}
                      onClick={() => act({ type: "take-coal" })}
                    >
                      Take 1 coal
                    </button>
                    <button
                      className="button outline"
                      disabled={!canPass}
                      onClick={() => act({ type: "pass" })}
                    >
                      Finish collecting →
                    </button>
                  </div>
                </>
              )}
              {state.phase === "run" && (
                <>
                  <div className="station-switches">
                    {STATIONS.map((st, i) => (
                      <label key={st}>
                        <input
                          type="checkbox"
                          checked={player.stations[st].enabled}
                          disabled={!canPlay || phasePassed}
                          onChange={(e) => {
                            const enabled = STATIONS.map(
                              (k) => player.stations[k].enabled,
                            ) as [boolean, boolean, boolean];
                            enabled[i] = e.target.checked;
                            act({ type: "set-stations", enabled });
                          }}
                          aria-label={"Enable " + STATION_NAMES[st]}
                        />
                        <span>
                          {STATION_NAMES[st]}
                          <small>
                            {player.stations[st].enabled
                              ? "Will run if affordable"
                              : "Preserve its input"}
                          </small>
                        </span>
                      </label>
                    ))}
                  </div>
                  {!phasePassed && (
                    <ProductionSummary
                      production={productionPlan(state, seat)}
                    />
                  )}
                  <div className="workflow-buttons">
                    <button
                      className="button"
                      disabled={!legal.some((a) => a.type === "produce")}
                      onClick={() => act({ type: "produce" })}
                    >
                      Run all enabled stations →
                    </button>
                    <button
                      className="text-button"
                      disabled={!canPass}
                      onClick={() => act({ type: "pass" })}
                    >
                      Skip production · keep reserves
                    </button>
                  </div>
                </>
              )}
              {state.phase === "deliver" && (
                <>
                  <ResourceRow values={player.resources} />
                  <div className="order-list">
                    {state.orders.map((c) => {
                      const d = ORDERS[c.definitionId],
                        affordable = canAfford(player.resources, d.cost);
                      return (
                        <article className="order-card" key={c.id}>
                          <span className="order-seal" aria-hidden="true">
                            ♜
                          </span>
                          <div>
                            <h3>{d.name}</h3>
                            <p>
                              {costText(d.cost)} <b>→ {d.prestige} prestige</b>
                            </p>
                            <small>
                              {affordable
                                ? "Ready to deliver"
                                : "Need " +
                                  costText(
                                    missingCost(player.resources, d.cost),
                                  ) +
                                  " more"}
                            </small>
                          </div>
                          <button
                            className="button small"
                            disabled={!canPlay || !affordable}
                            onClick={() =>
                              setConfirm({
                                title: "Deliver " + d.name + "?",
                                text:
                                  "Pay " +
                                  costText(d.cost) +
                                  " from your reserves and gain " +
                                  d.prestige +
                                  " public prestige. This finishes your Delivery opportunity.",
                                action: { type: "deliver", commission: c.id },
                              })
                            }
                          >
                            Deliver {d.name} →
                          </button>
                        </article>
                      );
                    })}
                  </div>
                  {state.orders.length === 0 && (
                    <p>
                      No commissions remain this round. Keep your reserves; the
                      display refills after both players finish.
                    </p>
                  )}
                  <button
                    className="button outline"
                    disabled={!canPass}
                    onClick={() => act({ type: "pass" })}
                  >
                    Keep reserves · end Delivery →
                  </button>
                </>
              )}
            </>
          )}
        </section>
        <section
          className="market-section"
          id="parts-market"
          aria-label="Parts market"
        >
          <div className="section-heading">
            <h2>
              Parts market <span>01—06</span>
            </h2>
            <small>
              {state.partDeckCount} in deck · {state.partDiscardCount} face-down
              discards
            </small>
          </div>
          {state.setupComplete ? (
            <>
              <div className="parts-display">
                {state.market.map((c, i) => (
                  <div className="market-place" key={c.id}>
                    <div className="age-label">
                      {i === 0
                        ? "Oldest"
                        : i === 1
                          ? "Next to rotate"
                          : i === state.market.length - 1
                            ? "Newest"
                            : "0" + (i + 1)}
                    </div>
                    <PartCard card={c} onInspect={setInspect}>
                      <button
                        className="take-part"
                        disabled={
                          !canPlay ||
                          state.phase !== "acquire" ||
                          !!state.pendingActor
                        }
                        onClick={() => acquireCard(c)}
                      >
                        Take into hand →
                      </button>
                    </PartCard>
                  </div>
                ))}
              </div>
              <p className="market-caption">
                Acquisition is free. Printed gear prices are paid when
                installing. The two oldest remaining parts rotate after a
                continuing round.
              </p>
            </>
          ) : (
            <div className="closed-market">
              <span>▱ ▱ ▱ ▱ ▱ ▱</span>
              <p>The market opens after both private objectives are locked.</p>
            </div>
          )}
        </section>
        {state.setupComplete && state.phase !== "deliver" && (
          <section
            className="commissions-overview"
            aria-label="Shared commissions"
          >
            <div className="section-heading">
              <h2>Guild commissions</h2>
              <small>
                {state.orderDeckCount} in deck · race to{" "}
                {state.config.targetPrestige} public prestige
              </small>
            </div>
            <div className="commission-display">
              {state.orders.map((c) => {
                const d = ORDERS[c.definitionId];
                return (
                  <article key={c.id}>
                    <span className="order-seal" aria-hidden="true">
                      ♜
                    </span>
                    <div>
                      <h3>{d.name}</h3>
                      <p>{costText(d.cost)}</p>
                    </div>
                    <b>
                      +{d.prestige}
                      <small>prestige</small>
                    </b>
                  </article>
                );
              })}
            </div>
          </section>
        )}
        <div className="workshop-heading">
          <div>
            <div className={"eyebrow " + seat}>
              {seat === "P0" ? "●" : "◆"} {NAMES[seat].toUpperCase()} WORKSHOP
            </div>
            <h2>Your engine</h2>
          </div>
          <div className="public-score">
            <strong>{player.prestige}</strong>
            <span>public prestige</span>
          </div>
        </div>
        <div className="workshop-toolbar">
          <ResourceRow values={player.resources} />
          <div className="private-buttons">
            <button
              className="button outline small"
              disabled={handoff}
              onClick={() => setDialog("hand")}
            >
              Private hand · {player.handCount} / 3
            </button>
            {state.status !== "finished" && (
              <button
                className="button outline small"
                disabled={handoff}
                onClick={() => setDialog("objective")}
              >
                Private objective ◇
              </button>
            )}
          </div>
        </div>
        <Workshop player={player} onInspect={setInspect} />
        <p className="workshop-caption">
          Pooled reserves · maximum 8 of each. Each station has one core and two
          enhancement slots. Enhancements stay when the core changes.
        </p>
        <section className="rival-panel">
          <div className="rival-overview">
            <div>
              <div className={"eyebrow " + rival}>
                {rival === "P0" ? "●" : "◆"} {NAMES[rival].toUpperCase()}
              </div>
              <h2>
                {!online && mode === "practice"
                  ? "The Automaton"
                  : "Your rival"}
              </h2>
              <p>
                {opponent.handCount} private parts ·{" "}
                {state.status === "finished"
                  ? "Objective revealed"
                  : state.objectiveReady[rival]
                    ? "Objective locked"
                    : "Choosing an objective"}
                {state.status !== "finished" && (
                  <>
                    {" "}
                    ·{" "}
                    {state.initiative === rival
                      ? "Has initiative"
                      : "Next round initiative"}
                  </>
                )}
              </p>
            </div>
            <ResourceRow values={opponent.resources} />
            <div className="public-score">
              <strong>{opponent.prestige}</strong>
              <span>public prestige</span>
            </div>
          </div>
          <details>
            <summary>Inspect rival’s public workshop</summary>
            <Workshop player={opponent} onInspect={setInspect} compact />
          </details>
        </section>
        <details className="journal">
          <summary>
            Workshop journal <span>{state.log.length} recent events</span>
          </summary>
          <ol aria-label="Game activity">
            {state.log
              .slice()
              .reverse()
              .map((e, i) => (
                <li key={i}>
                  <p>{e.text}</p>
                  <small>
                    Round {e.round} · {LABELS[e.phase]}
                  </small>
                </li>
              ))}
          </ol>
        </details>
        <footer className="site-footer">
          <span>CLOCKWORK RIVALS / PROTOTYPE v{VERSION}</span>
          <span>
            {state.config.targetPrestige} public prestige · +
            {state.config.objectiveBonus} objective · no round cutoff
          </span>
          <div>
            <button onClick={() => setDialog("feedback")}>
              Playtest notes
            </button>
            <button onClick={() => setDialog("menu")}>Game menu ☰</button>
          </div>
        </footer>
      </main>
      {handoff && (
        <Modal
          title={"Pass the screen to " + NAMES[seat]}
          close={() => {}}
          dismissible={false}
        >
          <div className="privacy-screen">
            <span aria-hidden="true">◇</span>
            <p>
              {NAMES[seat]} should be the only person looking when opening their
              hand, blind draw or objective.
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
      {privateVisible && dialog === "objective" && (
        <Modal
          title="Your private objective"
          close={() => setDialog(null)}
          wide
        >
          <ObjectiveCards
            objective={state.objective}
            bonus={state.config.objectiveBonus}
            canChoose={canPlay && !state.setupComplete}
            choose={(objective) => act({ type: "choose-objective", objective })}
          />
          <button className="text-button full" onClick={() => setDialog(null)}>
            Hide private card
          </button>
        </Modal>
      )}
      {privateVisible && (dialog === "hand" || dialog === "blind") && (
        <Modal
          title={
            dialog === "blind" ? "Choose a private part" : "Your private hand"
          }
          close={() => setDialog(null)}
          wide
        >
          <p className="modal-intro">
            {dialog === "blind"
              ? "Keep one of these parts; the other is discarded face down. These same cards remain if you reload or reconnect."
              : "Parts in your hand are private. Installing pays the printed gear price and reveals the part. You may install once per round."}
          </p>
          <div className="private-card-grid">
            {(dialog === "blind" ? blind : hand).map((c) => {
              const d = PARTS[c.definitionId],
                options = legal.filter(
                  (a): a is Extract<Action, { type: "install" }> =>
                    a.type === "install" && a.instance === c.id,
                );
              return (
                <PartCard
                  key={c.id}
                  card={c}
                  onInspect={(id) => {
                    setDialog(null);
                    setInspect(id);
                  }}
                >
                  {dialog === "blind" ? (
                    <button
                      className="button small full"
                      disabled={!canPlay}
                      onClick={() => acquireCard(c, true)}
                    >
                      Keep {d.name} →
                    </button>
                  ) : state.phase === "install" && canPlay ? (
                    <div className="install-options">
                      {options.length ? (
                        options.map((a, i) => (
                          <button
                            key={i}
                            className="button small full"
                            onClick={() => {
                              setInstallation(a);
                              setDialog(null);
                            }}
                          >
                            {d.kind === "core"
                              ? "Review core replacement →"
                              : player.stations[d.station].enhancements[a.slot!]
                                ? "Replace " +
                                  PARTS[
                                    player.stations[d.station].enhancements[
                                      a.slot!
                                    ]!.definitionId
                                  ].name +
                                  " →"
                                : "Install in " +
                                  STATION_NAMES[d.station] +
                                  " slot " +
                                  (a.slot! + 1) +
                                  " →"}
                          </button>
                        ))
                      ) : (
                        <small>
                          {player.resources.gears < d.price
                            ? "Need " +
                              (d.price - player.resources.gears) +
                              " more gears"
                            : "This definition is already installed in its station."}
                        </small>
                      )}
                    </div>
                  ) : null}
                </PartCard>
              );
            })}
          </div>
          {(dialog === "blind" ? blind : hand).length === 0 && (
            <p className="empty-state">
              No parts here yet. Acquire from the market or draw two privately
              on your Acquire turn.
            </p>
          )}
          <button className="text-button full" onClick={() => setDialog(null)}>
            Hide private cards
          </button>
        </Modal>
      )}
      {privateVisible && acquire && (
        <Modal
          title={
            (acquire.blind ? "Keep " : "Acquire ") +
            PARTS[acquire.card.definitionId].name +
            "?"
          }
          close={() => setAcquire(null)}
        >
          <div className="acquire-review">
            <PartArt definition={PARTS[acquire.card.definitionId]} />
            <Formula id={acquire.card.definitionId} />
          </div>
          <p className="modal-intro">
            This takes the part into your private hand for free. Installing it
            later costs {PARTS[acquire.card.definitionId].price} gears.
          </p>
          {hand.length >= 3 && (
            <label className="field-label">
              Your hand is full. Choose one part to discard face down.
              <select
                aria-label="Part to discard"
                value={discard}
                onChange={(e) => setDiscard(e.target.value)}
              >
                <option value="">Choose a discard…</option>
                {[...hand, acquire.card].map((c) => (
                  <option value={c.id} key={c.id}>
                    {PARTS[c.definitionId].name}
                    {c.id === acquire.card.id ? " (new part)" : ""}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="confirmation-buttons">
            <button
              className="button outline"
              onClick={() => {
                setAcquire(null);
                if (acquire.blind) setDialog("blind");
              }}
            >
              Back
            </button>
            <button
              className="button"
              disabled={!canPlay || (hand.length >= 3 && !discard)}
              onClick={acceptAcquire}
            >
              Confirm acquisition →
            </button>
          </div>
        </Modal>
      )}
      {privateVisible && installPreview && installation && (
        <Modal
          title={
            "Install " + PARTS[installPreview.part.definitionId].name + "?"
          }
          close={() => setInstallation(null)}
          wide
        >
          <p className="modal-intro">
            Pay <b>{installPreview.price} gears</b> to install in{" "}
            {STATION_NAMES[PARTS[installPreview.part.definitionId].station]}.
            {installPreview.replaced
              ? " Discard " +
                PARTS[installPreview.replaced.definitionId].name +
                " with no refund."
              : ""}{" "}
            {PARTS[installPreview.part.definitionId].kind === "core"
              ? "Both enhancements remain in place."
              : ""}
          </p>
          <div
            className="destination-preview"
            aria-label="Proposed station slots"
          >
            {STATIONS.map((st) => (
              <div
                key={st}
                className={
                  PARTS[installPreview.part.definitionId].station === st
                    ? "compatible-station"
                    : ""
                }
              >
                <b>{STATION_NAMES[st]}</b>
                {[
                  installPreview.stations[st].core,
                  ...installPreview.stations[st].enhancements,
                ].map((c, i) => (
                  <span
                    key={i}
                    className={
                      c?.id === installPreview.part.id ? "new-installation" : ""
                    }
                  >
                    <small>{i === 0 ? "Core" : "Enhancement " + i}</small>
                    {c ? PARTS[c.definitionId].name : "Empty slot"}
                    {c?.id === installPreview.part.id ? " · NEW" : ""}
                  </span>
                ))}
              </div>
            ))}
          </div>
          <div className="investment-comparison">
            <div>
              <span>Reserves after paying installation</span>
              <ResourceRow values={installPreview.reservesAfterPayment} />
            </div>
            <div>
              <span>Production without this investment</span>
              <ResourceRow values={installPreview.before.after} />
            </div>
          </div>
          <p className="preview-note">
            Proposed production below uses current reserves with the
            installation price already paid. Future Power actions can change
            this estimate.
          </p>
          <ProductionSummary production={installPreview.after} />
          <div className="confirmation-buttons">
            <button
              className="button outline"
              onClick={() => {
                setInstallation(null);
                setDialog("hand");
              }}
            >
              Cancel · keep part
            </button>
            <button
              className="button"
              disabled={!canPlay}
              onClick={() => act(installation)}
            >
              Pay {installPreview.price} gears & install →
            </button>
          </div>
        </Modal>
      )}
      {privateVisible && inspect && (
        <Modal title={PARTS[inspect].name} close={() => setInspect(null)}>
          <div className="part-detail">
            <PartArt definition={PARTS[inspect]} />
            <div className="step-label">
              {STATION_NAMES[PARTS[inspect].station]} · {PARTS[inspect].kind} ·{" "}
              {PARTS[inspect].starter
                ? "starter"
                : PARTS[inspect].price + " gears"}
            </div>
            <Formula id={inspect} />
            <p>
              {PARTS[inspect].kind === "core"
                ? PARTS[inspect].text
                : "Applies only when this station’s core operates. Compatible with every core in this station."}
            </p>
          </div>
        </Modal>
      )}
      {privateVisible && confirm && (
        <Modal title={confirm.title} close={() => setConfirm(null)}>
          <p className="modal-intro">{confirm.text}</p>
          <ResourceRow values={player.resources} />
          <div className="confirmation-buttons">
            <button className="button outline" onClick={() => setConfirm(null)}>
              Cancel
            </button>
            <button
              className="button"
              disabled={
                net.pending || (confirm.action.type !== "concede" && !canPlay)
              }
              onClick={() => act(confirm.action)}
            >
              Confirm →
            </button>
          </div>
        </Modal>
      )}
      {!handoff && dialog === "new" && (
        <Modal title="A new rivalry" close={() => setDialog(null)}>
          <p className="modal-intro">
            Both clockmakers start with three working cores and 3 gears. Choose
            your table.
          </p>
          <div className="mode-choices">
            {(
              ["practice", "hotseat", ...(ROOMS_ENABLED ? ["online"] : [])] as (
                Mode | "online"
              )[]
            ).map((m) => (
              <button
                key={m}
                className={newMode === m ? "chosen" : ""}
                onClick={() => setNewMode(m)}
              >
                <span>
                  {m === "practice"
                    ? "Practice"
                    : m === "hotseat"
                      ? "Pass & play"
                      : "Private online room"}
                </span>
                <small>
                  {m === "practice"
                    ? "Play against the Automaton."
                    : m === "hotseat"
                      ? "Two people, one screen. Private handoff between turns."
                      : "Invite a friend. Private cards and reconnects are saved."}
                </small>
                <b>{newMode === m ? "●" : "○"}</b>
              </button>
            ))}
          </div>
          {!ROOMS_ENABLED && (
            <p className="subtle">
              This public site supports Practice and Pass & play. Online rooms
              require the room server.
            </p>
          )}
          <details className="playtest-settings">
            <summary>Playtest values</summary>
            {(
              [
                ["targetPrestige", "Public prestige target", 6, 40],
                ["objectiveBonus", "Objective bonus", 0, 6],
                ["sharedCoal", "Shared coal per round", 1, 6],
              ] as const
            ).map(([k, label, min, max]) => (
              <label className="field-label" key={k}>
                {label}
                <input
                  type="number"
                  min={min}
                  max={max}
                  value={config[k]}
                  onChange={(e) =>
                    setConfig({ ...config, [k]: Number(e.target.value) })
                  }
                />
              </label>
            ))}
            <p className="subtle">
              First-test defaults: 18 prestige, +3 objective, 3 coal. There is
              no round cutoff.
            </p>
            <button
              className="text-button"
              onClick={() => setConfig(DEFAULT_CONFIG)}
            >
              Restore proposed defaults
            </button>
          </details>
          {configError && (
            <p className="notice" role="alert">
              {configError}
            </p>
          )}
          <button
            className="button full"
            disabled={!!configError}
            onClick={() => {
              if (newMode === "online") {
                clearPanels();
                void net.connect(undefined, undefined, config);
              } else newGame(newMode);
            }}
          >
            Start new game →
          </button>
        </Modal>
      )}
      {!handoff && dialog === "rules" && (
        <Modal
          title="The clockmaker’s field guide"
          close={() => setDialog(null)}
          wide
        >
          <div className="rules-v3">
            <p>
              Race to <b>{state.config.targetPrestige} public prestige</b>. Both
              players finish Delivery, then reveal private objectives worth +
              {state.config.objectiveBonus}. Highest final prestige wins;
              unspent gears break a tie, then a draw. There is no round cutoff.
            </p>
            <h3>One engine. Three stations.</h3>
            <p>
              Energy makes steam, Conversion makes work, and Fabrication makes
              gears. Each station has one core and two enhancement slots.
              Resources are pooled. Every enhancement fits every core in its own
              station; the two enhancement positions are equivalent.
            </p>
            {PHASES.map((p, i) => (
              <article key={p}>
                <b>
                  0{i + 1} · {LABELS[p]}
                </b>
                <p>
                  {p === "power"
                    ? "Take one coal per action, up to two, from the shared supply. Passing finishes your Power turn."
                    : COPY[p]}
                </p>
              </article>
            ))}
            <h3>Investment and replacement</h3>
            <p>
              Acquire once and install at most once per round. A core replaces
              its station’s core; enhancements remain. Replace an enhancement
              only when both slots are full. Two identical enhancement
              definitions cannot share a station. Replaced parts get no refund.
              Starter cores leave play; purchased parts recycle.
            </p>
            <h3>Production you can predict</h3>
            <p>
              Full printed input must be available before any refund. Each
              enabled station runs once, in order. An unaffordable station is
              skipped; later stations can still use saved resources. Generated
              output before caps controls Synchronizer and Batch Die, even if
              some overflows. Storage holds at most 8 of each resource.
            </p>
            <p>
              Synchronized Workshop has a stricter objective condition: a
              conditional bonus or refund must actually fit in storage. Capacity
              is assigned to base output, then unconditional output, then
              conditional output.
            </p>
            <h3>A changing market</h3>
            <p>
              Six parts are displayed oldest to newest. A face-up acquisition
              refills immediately. Blind acquisition privately draws two and
              keeps one. Discard to a maximum hand of three. At a continuing
              round’s end, discard the two oldest remaining market cards and
              refill. Parts and commissions recycle their own discard piles
              separately.
            </p>
            <h3>Private ambitions</h3>
            <p>
              Choose one of two objectives before the markets open. Hands, blind
              draws and unused objective offers remain private. Face-up
              acquisitions and installed cards are public knowledge. Only chosen
              objectives reveal at match end. Concession always awards the rival
              the match.
            </p>
          </div>
        </Modal>
      )}
      {!handoff && dialog === "catalogue" && (
        <Modal title="The parts catalogue" close={() => setDialog(null)} wide>
          <p className="modal-intro">
            Three starter cores. Six replacement cores and nine enhancements,
            two copies each in the 30-part deck.
          </p>
          <div className="catalogue-v3">
            {Object.values(PARTS).map((d) => (
              <PartCard
                key={d.id}
                card={{ id: d.id, definitionId: d.id }}
                onInspect={(id) => {
                  setDialog(null);
                  setInspect(id);
                }}
              />
            ))}
          </div>
          <h3 className="catalogue-title">Guild commissions · 3 copies each</h3>
          <div className="order-list">
            {Object.values(ORDERS).map((d) => (
              <article className="order-card" key={d.id}>
                <h3>{d.name}</h3>
                <p>
                  {costText(d.cost)} → {d.prestige} prestige
                </p>
              </article>
            ))}
          </div>
        </Modal>
      )}
      {!handoff && dialog === "menu" && (
        <Modal title="Your game" close={() => setDialog(null)}>
          <div className="menu-actions">
            <button
              onClick={() =>
                download(publicReport(state), "clockwork-public-report.json")
              }
            >
              Export public match report ↓
            </button>
            <button onClick={() => importInput.current?.click()}>
              Import a private backup ↑
            </button>
            <button onClick={() => setSound(!sound)}>
              {sound ? "Disable" : "Enable"} sound ♪
            </button>
            <button onClick={() => setDialog("rules")}>How to play ↗</button>
            {state.status === "active" && (
              <button
                onClick={() => {
                  setDialog(null);
                  setConfirm({
                    title: "Concede this rivalry?",
                    text: "Your rival wins immediately. Objective bonuses do not overturn a concession.",
                    action: { type: "concede" },
                  });
                }}
              >
                Concede match
              </button>
            )}
          </div>
          <p className="subtle">
            Local games autosave in this browser. Public reports omit private
            cards and cannot restore a match. Imports accept complete rules 0.3
            private backups.
          </p>
        </Modal>
      )}
      <input
        type="file"
        accept=".json,application/json"
        hidden
        ref={importInput}
        onChange={(e) => void importSave(e.target.files?.[0])}
      />
      {!handoff && dialog === "feedback" && (
        <Modal title="Playtest notes" close={() => setDialog(null)}>
          <p className="modal-intro">
            Notes stay on your device until you share them. Record elapsed time,
            first useful investment, combo runs, fuel shortages, and whether you
            want a rematch.
          </p>
          <label className="field-label">
            What changed your decisions?
            <textarea
              rows={7}
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Did you invest or deliver? Which objective changed your plan? Was a suitable commission available? Any confusing moments?"
            />
          </label>
          <button
            className="button full"
            onClick={() =>
              download(
                {
                  rulesVersion: VERSION,
                  round: state.round,
                  config: state.config,
                  notes: feedback,
                  publicMatch: publicReport(state),
                },
                "clockwork-playtest-notes.json",
              )
            }
          >
            Export notes ↓
          </button>
        </Modal>
      )}
      {exported && (
        <Modal title="Your export is ready" close={() => setExported(null)}>
          <p className="modal-intro">
            Private hands, hidden draws and unused offers are excluded. This
            report cannot restore a game.
          </p>
          <a
            className="button full"
            href={exported.url}
            download={exported.name}
          >
            Download {exported.name} ↓
          </a>
          <label className="field-label">
            Export file contents
            <textarea readOnly rows={8} value={exported.json} />
          </label>
          <button
            className="text-button"
            onClick={() =>
              void navigator.clipboard
                .writeText(exported.json)
                .then(() => setNotice("Report copied."))
                .catch(() => setNotice("Select and copy the report contents."))
            }
          >
            Copy report
          </button>
        </Modal>
      )}
      {state.status === "finished" &&
        !finishedDismissed &&
        !dialog &&
        !inspect &&
        !exported && (
          <Modal
            title={
              state.winner === "draw"
                ? "A worthy draw"
                : NAMES[state.winner!] + " wins the rivalry"
            }
            close={() => setFinishedDismissed(true)}
            wide
          >
            <p className="modal-intro">
              {state.log.some((e) => e.type === "concede")
                ? "The match ended by concession. No objective bonuses are awarded."
                : "Both Delivery opportunities are complete. Private objectives are revealed and final prestige decides the winner."}
            </p>
            <div className="final-scores">
              {(["P0", "P1"] as Seat[]).map((p) => {
                const r = state.revealedObjectives![p];
                return (
                  <article
                    key={p}
                    className={p === state.winner ? "winner" : ""}
                  >
                    <span className="step-label">{NAMES[p].toUpperCase()}</span>
                    <strong>{state.finalScores![p]}</strong>
                    <div className="score-breakdown">
                      <span>{state.players[p].prestige} public prestige</span>
                      <span>+ {r.bonus} objective bonus</span>
                      <b>= {state.finalScores![p]} final prestige</b>
                      <small>
                        {state.players[p].resources.gears} unspent gears
                      </small>
                    </div>
                    <h3>
                      {r.selected
                        ? OBJECTIVES[r.selected].title
                        : "No objective chosen"}
                    </h3>
                    <p>
                      {r.selected ? OBJECTIVES[r.selected].description : ""}
                    </p>
                    <small>{r.progress}</small>
                    <b className="objective-result">
                      {r.complete ? "✓ Completed" : "Not completed"}
                    </b>
                  </article>
                );
              })}
            </div>
            <div className="confirmation-buttons">
              <button
                className="button outline"
                onClick={() => setFinishedDismissed(true)}
              >
                Inspect final table
              </button>
              <button
                className="button"
                disabled={online && !!net.snapshot?.rematch[seat]}
                onClick={() =>
                  online
                    ? net.message("rematch")
                    : newGame(mode, other(local.initialInitiative))
                }
              >
                {online
                  ? net.snapshot?.rematch[seat]
                    ? "Waiting for rival…"
                    : "Request rematch →"
                  : "Play again · swap initiative →"}
              </button>
            </div>
          </Modal>
        )}
    </>
  );
}
