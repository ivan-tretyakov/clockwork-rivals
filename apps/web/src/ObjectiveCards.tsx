import {
  OBJECTIVES,
  type PublicState,
} from "../../../packages/clockwork-rules/src/index";

export function ObjectiveCards({
  objective,
  bonus,
  canChoose,
  choose,
}: {
  objective: PublicState["objective"];
  bonus: number;
  canChoose: boolean;
  choose: (id: string) => void;
}) {
  if (!objective)
    return <p>Your private card is available only from your own seat.</p>;
  const ids = objective.selected ? [objective.selected] : objective.offers;
  return (
    <>
      <p className="modal-intro">
        One private objective · +{bonus} prestige at normal match end. A hidden
        bonus can change the winner. Only selected cards are revealed after the
        match.
      </p>
      <div className="objective-cards">
        {ids.map((id) => (
          <article className="objective-card" key={id}>
            <span className="objective-symbol" aria-hidden="true">
              {OBJECTIVES[id].symbol}
            </span>
            <span className="step-label">PRIVATE OBJECTIVE · +{bonus}</span>
            <h3>{OBJECTIVES[id].title}</h3>
            <p>{OBJECTIVES[id].description}</p>
            {objective.selected ? (
              <div
                className={`objective-progress ${objective.progress?.complete ? "complete" : ""}`}
              >
                <strong>
                  {objective.progress?.complete
                    ? "Currently complete"
                    : "In progress"}
                </strong>
                <p>{objective.progress?.text}</p>
                <small>
                  Evaluated after final Delivery. Reserve goals can become
                  incomplete if you spend the resources.
                </small>
              </div>
            ) : (
              <button
                className="button full"
                disabled={!canChoose}
                onClick={() => choose(id)}
              >
                Choose {OBJECTIVES[id].title} →
              </button>
            )}
          </article>
        ))}
      </div>
    </>
  );
}
