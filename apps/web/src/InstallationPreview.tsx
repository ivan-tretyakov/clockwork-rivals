import {
  installationPreview,
  PARTS,
  RESOURCES,
  type Seat,
  type View,
} from "../../../packages/clockwork-rules/src/index";
export function InstallationPreview({
  state,
  seat,
  instance,
  target,
}: {
  state: View;
  seat: Seat;
  instance: string;
  target: number;
}) {
  const result = installationPreview(state, seat, instance, target);
  if (!result) return <p>This placement is no longer available.</p>;
  return (
    <div className="installation-preview">
      <p className="modal-intro">
        Estimate using your current reserves and saved priorities. Future Power
        actions can change these results. The new machine joins the end of your
        activation list.
      </p>
      <div className="placement-layout">
        <div className="placement-grid" aria-label="Proposed workshop">
          {result.grid.map((c, i) => (
            <div
              key={i}
              className={`${i === target ? "proposed" : ""} ${result.linked.includes(i) ? "linked" : ""}`}
            >
              <small>Slot {i + 1}</small>
              {c ? (
                <>
                  <img
                    src={`${import.meta.env.BASE_URL}assets/clockwork-rivals/${c.definitionId}.webp`}
                    alt=""
                  />
                  <span>{PARTS[c.definitionId].name}</span>
                </>
              ) : (
                <span>Empty</span>
              )}
              {i === target && <b>New</b>}
              {result.linked.includes(i) && <b>Bonus linked</b>}
            </div>
          ))}
        </div>
        <div>
          <h3>What changes</h3>
          {result.affected.map((a, i) => (
            <p className="adjacency-preview" key={i}>
              <strong>{a.name}</strong>
              <br />
              {a.text}
            </p>
          ))}
          <p className="subtle">
            All slots accept any machine. Only side-sharing neighbors activate
            adjacency bonuses.
          </p>
        </div>
      </div>
      <table className="production-comparison">
        <caption>Reserves after production · same starting resources</caption>
        <thead>
          <tr>
            <th>Resource</th>
            <th>Before</th>
            <th>After installation</th>
            <th>Change</th>
          </tr>
        </thead>
        <tbody>
          {RESOURCES.map((r) => {
            const delta = result.after.after[r] - result.before.after[r];
            return (
              <tr key={r}>
                <th>{r}</th>
                <td>{result.before.after[r]}</td>
                <td>{result.after.after[r]}</td>
                <td>
                  {delta > 0 ? "+" : ""}
                  {delta}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p>
        <strong>Before:</strong>{" "}
        {result.before.steps
          .map((c) => PARTS[c.definitionId].name)
          .join(" → ") || "No machines run"}
      </p>
      <p>
        <strong>After:</strong>{" "}
        {result.after.steps
          .map((c) => PARTS[c.definitionId].name)
          .join(" → ") || "No machines run"}
      </p>
      {result.after.skipped.map((c) => (
        <p className="subtle" key={c.id}>
          {PARTS[c.definitionId].name}: {c.reason}.
        </p>
      ))}
      {result.after.steps.flatMap((step) =>
        Object.entries(step.effect.overflow).map(([r, n]) => (
          <p className="overflow-note" key={`${step.instance}-${r}`}>
            Cap waste: {PARTS[step.definitionId].name} discards {n} {r}.
          </p>
        )),
      )}
    </div>
  );
}
