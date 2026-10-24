import { useState } from "react";
import { Camera, Check, X } from "lucide-react";
import type { ServerSubmission } from "../types";

type ServerModerationSectionProps = {
  submissions: ServerSubmission[];
  onReview: (
    submissionId: string,
    approved: boolean,
    comment?: string
  ) => Promise<string | null>;
};

export default function ServerModerationSection({
  submissions,
  onReview,
}: ServerModerationSectionProps) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectionTarget, setRejectionTarget] = useState<string | null>(null);
  const [rejectionComments, setRejectionComments] = useState<
    Record<string, string>
  >({});
  const [errorMessage, setErrorMessage] = useState("");

  const pendingCount = submissions.filter(
    (submission) => submission.status === "pending"
  ).length;

  async function review(
    submissionId: string,
    approved: boolean,
    comment = ""
  ) {
    setBusyId(submissionId);
    setErrorMessage("");

    const error = await onReview(submissionId, approved, comment);

    setBusyId(null);

    if (error) {
      setErrorMessage(error);
      return;
    }

    setRejectionTarget(null);
  }

  return (
    <section className="submissions-section">
      <div className="section-heading">
        <div>
          <p className="eyebrow">MODERACIÓ</p>
          <h2>Fotos dels equips</h2>
        </div>
        <span className="count-badge">{pendingCount}</span>
      </div>

      {errorMessage && <p role="alert">{errorMessage}</p>}

      {submissions.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">
            <Camera size={25} />
          </div>
          <strong>Encara no hi ha cap foto enviada</strong>
          <p>Quan un equip enviï una foto, apareixerà aquí.</p>
        </div>
      ) : (
        <div className="submission-list">
          {submissions.map((submission) => (
            <article className="submission-card" key={submission.id}>
              <div className="submission-preview">
                <img
                  src={submission.photoUrl}
                  alt={`Fotografia del repte: ${submission.title}`}
                  style={{
                    width: "100%",
                    maxHeight: "240px",
                    objectFit: "contain",
                    borderRadius: "8px",
                  }}
                />
              </div>

              <div className="submission-info">
                <span className={`mini-team team-${submission.teamKey}`}>
                  {submission.teamKey === "A" ? "Equip A" : "Equip B"}
                </span>

                <h3>{submission.title}</h3>

                <p>
                  Rebuda:{" "}
                  {new Date(submission.receivedAt).toLocaleString("ca-ES")}
                </p>

                <p>
                  Estat:{" "}
                  <strong>
                    {submission.status === "approved"
                      ? "Aprovada"
                      : submission.status === "rejected"
                        ? "Rebutjada"
                        : "Pendent de validació"}
                  </strong>
                </p>

                {submission.status === "rejected" && (
                  <p>
                    <strong>Motiu:</strong>{" "}
                    {submission.comment || "Sense comentari"}
                  </p>
                )}

                {submission.status === "pending" && (
                  <>
                    <div className="review-actions">
                      <button
                        className="approve-button"
                        disabled={busyId !== null}
                        onClick={() => review(submission.id, true)}
                      >
                        <Check size={16} />{" "}
                        {busyId === submission.id ? "Desant..." : "Aprovar"}
                      </button>

                      <button
                        className="reject-button"
                        disabled={busyId !== null}
                        onClick={() => {
                          setErrorMessage("");
                          setRejectionTarget(submission.id);
                        }}
                      >
                        <X size={16} /> Rebutjar
                      </button>
                    </div>

                    {rejectionTarget === submission.id && (
                      <div className="rejection-form">
                        <label htmlFor={`server-rejection-${submission.id}`}>
                          Motiu del rebuig (obligatori)
                        </label>

                        <textarea
                          id={`server-rejection-${submission.id}`}
                          value={rejectionComments[submission.id] ?? ""}
                          onChange={(event) =>
                            setRejectionComments((current) => ({
                              ...current,
                              [submission.id]: event.target.value,
                            }))
                          }
                          placeholder="Explica per què no s'accepta aquesta fotografia..."
                          rows={3}
                          maxLength={500}
                        />

                        <div className="review-actions">
                          <button
                            className="reject-button"
                            disabled={
                              busyId !== null ||
                              !(rejectionComments[submission.id] ?? "").trim()
                            }
                            onClick={() =>
                              review(
                                submission.id,
                                false,
                                rejectionComments[submission.id] ?? ""
                              )
                            }
                          >
                            Confirmar rebuig
                          </button>

                          <button
                            type="button"
                            className="approve-button"
                            disabled={busyId !== null}
                            onClick={() => setRejectionTarget(null)}
                          >
                            Cancel·lar
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}