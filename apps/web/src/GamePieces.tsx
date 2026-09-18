import { useEffect, useRef, type ReactNode } from "react";
import {
  PARTS,
  STATIONS,
  STATION_NAMES,
  RESOURCES,
  costText,
  type Card,
  type Reserve,
  type PublicPlayer,
  type Production,
  type PartDefinition,
} from "../../../packages/clockwork-rules/src/index";
export function Modal({
  title,
  children,
  close,
  wide = false,
  dismissible = true,
}: {
  title: string;
  children: ReactNode;
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
      className={"modal" + (wide ? " wide" : "")}
      onCancel={(e) => {
        e.preventDefault();
        if (dismissible) close();
      }}
      onClick={(e) => {
        if (dismissible && e.target === ref.current) close();
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
export function ResourceRow({
  values,
  compact = false,
}: {
  values: Partial<Reserve>;
  compact?: boolean;
}) {
  return (
    <div className={"resources" + (compact ? " compact" : "")}>
      {RESOURCES.filter((r) => !compact || values[r]).map((r) => (
        <span
          className={"resource " + r}
          key={r}
          title={(values[r] ?? 0) + " " + r}
        >
          <img
            className="icon"
            src={import.meta.env.BASE_URL + "assets/ui/" + r + ".svg"}
            alt=""
            aria-hidden="true"
          />
          <b>{values[r] ?? 0}</b>
          {!compact && <span>{r}</span>}
        </span>
      ))}
    </div>
  );
}
const drawings: Record<string, ReactNode> = {
  insulation: (
    <>
      <rect x="25" y="17" width="50" height="61" rx="17" />
      <rect x="33" y="23" width="34" height="49" rx="11" />
      <path d="M20 32h60M20 44h60M20 56h60M20 68h60M38 78v8m24-8v8" />
      <circle cx="50" cy="47" r="9" />
    </>
  ),
  "heat-recovery": (
    <>
      <path d="M27 68V32a23 23 0 0146 0v36M18 61l9 9 9-9M64 39l9-9 9 9M41 29v40m9-40v40m9-40v40M18 79h64" />
      <path d="M44 13h12v8H44z" />
    </>
  ),
  "pressure-tank": (
    <>
      <rect x="25" y="26" width="50" height="46" rx="18" />
      <path d="M35 72v12m30-12v12M43 26V14h14v12M37 14h26M15 49h10m50 0h10" />
      <circle cx="50" cy="48" r="12" />
      <path d="M50 48l7-6" />
    </>
  ),
  flywheel: (
    <>
      <circle cx="50" cy="46" r="31" />
      <circle cx="50" cy="46" r="23" />
      <circle cx="50" cy="46" r="7" />
      <path d="M50 15v24m0 14v24M19 46h24m14 0h24M28 24l17 17m10 10l17 17M28 68l17-17m10-10l17-17M29 83h42" />
    </>
  ),
  "steam-economizer": (
    <>
      <path d="M20 31h51a12 12 0 010 24H35a12 12 0 000 24h45M29 21l-10 10 10 10M68 69l12 10-12 10M21 19V9m14 10V6m14 13V9" />
      <circle cx="49" cy="55" r="7" />
    </>
  ),
  synchronizer: (
    <>
      <circle cx="31" cy="50" r="18" />
      <circle cx="69" cy="50" r="18" />
      <circle cx="31" cy="50" r="6" />
      <circle cx="69" cy="50" r="6" />
      <path d="M31 32V20h38v12M31 68v13h38V68M31 20l8-7m-8 7l8 7M69 81l-8-7m8 7l-8 7M13 50H6m88 0h-7" />
    </>
  ),
  "gear-cutter": (
    <>
      <path d="M20 20h60v12H20zM27 32v37m46-37v37M15 80h70M20 69h60v11H20zM44 32v12h12V32" />
      <circle cx="50" cy="57" r="12" />
      <path d="M50 39v7m0 22v7M32 57h7m22 0h7M37 44l5 5m16 16l5 5M37 70l5-5m16-16l5-5" />
    </>
  ),
  "fine-tooling": (
    <>
      <path d="M20 76l34-34m9-26a18 18 0 00-9 26l6 6a18 18 0 0026-9L72 43l-9-9zM19 68l9 9M35 28l43 48M25 13l13 5 5 13-8 8-13-5-5-13z" />
      <circle cx="77" cy="77" r="7" />
    </>
  ),
  "batch-die": (
    <>
      <path d="M16 18h68v15H16zM23 33v35m54-35v35M13 81h74v-13H13zM33 33v13m17-13v13m17-13v13" />
      <rect x="24" y="48" width="16" height="13" rx="3" />
      <rect x="43" y="48" width="16" height="13" rx="3" />
      <rect x="62" y="48" width="12" height="13" rx="3" />
    </>
  ),
};
export function PartArt({ definition: d }: { definition: PartDefinition }) {
  return d.kind === "core" ? (
    <img
      className="part-illustration"
      src={
        import.meta.env.BASE_URL + "assets/clockwork-rivals/" + d.art + ".webp"
      }
      alt=""
    />
  ) : (
    <svg className="enhancement-art" viewBox="0 0 100 96" aria-hidden="true">
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {drawings[d.id]}
      </g>
    </svg>
  );
}
export function Formula({ id }: { id: string }) {
  const d = PARTS[id];
  return d.kind === "core" ? (
    <span className="v3-formula">
      {costText(d.input!)} <b>→</b> {costText(d.output!)}
    </span>
  ) : (
    <span className="enhancement-rule">{d.text}</span>
  );
}
export function PartCard({
  card,
  onInspect,
  children,
  small = false,
}: {
  card: Card;
  onInspect?: (id: string) => void;
  children?: ReactNode;
  small?: boolean;
}) {
  const d = PARTS[card.definitionId];
  return (
    <article className={"part-card " + d.station + (small ? " mini" : "")}>
      <button
        className="part-inspect"
        onClick={() => onInspect?.(d.id)}
        aria-label={"Inspect " + d.name}
      >
        <span className="part-type">
          {STATION_NAMES[d.station]} · {d.kind}
        </span>
        <PartArt definition={d} />
        <h3>{d.name}</h3>
        <Formula id={d.id} />
      </button>
      <div className="part-bottom">
        <span>
          {d.starter ? "Starter core" : d.price + " gears to install"}
        </span>
        {children}
      </div>
    </article>
  );
}
export function Workshop({
  player,
  onInspect,
  compact = false,
}: {
  player: PublicPlayer;
  onInspect: (id: string) => void;
  compact?: boolean;
}) {
  return (
    <div
      className={"station-workshop" + (compact ? " rival-workshop" : "")}
      aria-label="Three-station workshop"
    >
      {STATIONS.map((st, i) => {
        const station = player.stations[st];
        return (
          <section
            className={
              "station-column " + st + (!station.enabled ? " switched-off" : "")
            }
            key={st}
          >
            <div className="station-label">
              <b>0{i + 1}</b>
              <span>{STATION_NAMES[st]}</span>
              <span aria-hidden="true">{i < 2 ? "→" : "⚙"}</span>
            </div>
            <button
              className="station-core"
              onClick={() => onInspect(station.core.definitionId)}
              aria-label={
                "Inspect installed " + PARTS[station.core.definitionId].name
              }
            >
              <PartArt definition={PARTS[station.core.definitionId]} />
              <h3>{PARTS[station.core.definitionId].name}</h3>
              <Formula id={station.core.definitionId} />
              <small>
                {station.operated
                  ? "✓ Operated"
                  : station.enabled
                    ? "● Enabled"
                    : "○ Switched off"}
              </small>
            </button>
            {station.enhancements.map((c, n) => (
              <button
                key={n}
                className={"station-enhancement" + (c ? " filled" : "")}
                disabled={!c}
                onClick={() => c && onInspect(c.definitionId)}
                aria-label={
                  c
                    ? "Inspect installed " + PARTS[c.definitionId].name
                    : STATION_NAMES[st] +
                      " enhancement slot " +
                      (n + 1) +
                      ", empty"
                }
              >
                {c ? (
                  <>
                    <PartArt definition={PARTS[c.definitionId]} />
                    <span>
                      <b>{PARTS[c.definitionId].name}</b>
                      <small>{PARTS[c.definitionId].text}</small>
                    </span>
                  </>
                ) : (
                  <>
                    <span className="empty-plus">+</span>
                    <span>Enhancement {n + 1}</span>
                  </>
                )}
              </button>
            ))}
          </section>
        );
      })}
    </div>
  );
}
export function ProductionSummary({
  production,
  details = true,
}: {
  production: Production;
  details?: boolean;
}) {
  return (
    <div className="production-summary">
      <div className="production-stations">
        {production.steps.map((step, i) => (
          <article
            className={"production-step" + (!step.operated ? " idle" : "")}
            key={step.station}
          >
            <div className="step-label">
              0{i + 1} · {STATION_NAMES[step.station]}
            </div>
            <h3>{PARTS[step.core.definitionId].name}</h3>
            {step.operated ? (
              <>
                <p>
                  {costText(step.input)} <b>→</b> {costText(step.generated)}
                </p>
                {Object.values(step.refunds).some(Boolean) && (
                  <small>Returns {costText(step.refunds)}</small>
                )}
                {Object.values(step.overflow).some(Boolean) && (
                  <p className="waste">Cap waste: {costText(step.overflow)}</p>
                )}
              </>
            ) : (
              <p className="idle-reason">{step.reason}</p>
            )}
            {details && step.operated && step.bonuses.length > 0 && (
              <ul className="bonus-list">
                {step.bonuses.map((b) => (
                  <li key={b.id} className={b.triggered ? "active-bonus" : ""}>
                    <b>
                      {b.triggered ? "✓" : "○"} {PARTS[b.id].name}
                    </b>
                    <small>
                      {b.reason}
                      {b.triggered ? " · " + b.retained + " retained" : ""}
                    </small>
                  </li>
                ))}
              </ul>
            )}
          </article>
        ))}
      </div>
      <div className="production-total">
        <span>Reserves after production</span>
        <ResourceRow values={production.after} />
      </div>
    </div>
  );
}
