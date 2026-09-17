import {
  normalizedPlan,
  PARTS,
  type Action,
  type Seat,
  type View,
} from "../../../packages/clockwork-rules/src/index";

export function ProductionControls({
  state,
  seat,
  enabled,
  act,
}: {
  state: View;
  seat: Seat;
  enabled: boolean;
  act: (action: Action) => void;
}) {
  const plan = normalizedPlan(state, seat);
  function move(from: number, to: number) {
    if (
      !enabled ||
      from === to ||
      from < 0 ||
      from >= plan.length ||
      to < 0 ||
      to >= plan.length
    )
      return;
    const next = [...plan];
    next.splice(to, 0, next.splice(from, 1)[0]);
    act({ type: "set-plan", plan: next });
  }
  return (
    <div className="production-controls">
      <h3>Your activation priorities</h3>
      <p>
        Enable the machines you want to use. Drag a row or use ↑ and ↓ to set
        priority. This order is saved between rounds; grid placement controls
        adjacency only.
      </p>
      <ol aria-label="Activation priorities">
        {plan.map((entry, i) => {
          const card = state.players[seat].grid.find(
            (c) => c?.id === entry.instance,
          )!;
          const name = PARTS[card.definitionId].name;
          return (
            <li
              key={entry.instance}
              draggable={enabled}
              onDragStart={(e) =>
                e.dataTransfer.setData("text/plain", String(i))
              }
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const index = Number(e.dataTransfer.getData("text/plain"));
                if (Number.isInteger(index)) move(index, i);
              }}
              className={!entry.enabled ? "disabled-machine" : ""}
            >
              <span className="priority-number">{i + 1}</span>
              <label>
                <input
                  type="checkbox"
                  checked={entry.enabled}
                  disabled={!enabled}
                  onChange={() =>
                    act({
                      type: "set-plan",
                      plan: plan.map((e, n) =>
                        n === i ? { ...e, enabled: !e.enabled } : e,
                      ),
                    })
                  }
                  aria-label={`Enable ${name} in slot ${state.players[seat].grid.indexOf(card) + 1}`}
                />{" "}
                <span>
                  {name}
                  <small>
                    {card.definitionId === "recycler"
                      ? "Spends 1 gear → makes 2 coal"
                      : `Slot ${state.players[seat].grid.indexOf(card) + 1}`}
                  </small>
                </span>
              </label>
              <button
                className="button outline small"
                disabled={!enabled || i === 0}
                aria-label={`Move ${name} priority ${i + 1} up`}
                onClick={() => move(i, i - 1)}
              >
                ↑
              </button>
              <button
                className="button outline small"
                disabled={!enabled || i === plan.length - 1}
                aria-label={`Move ${name} priority ${i + 1} down`}
                onClick={() => move(i, i + 1)}
              >
                ↓
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
