import { useEffect, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { supabase } from "../supabase";
import { formatBonus } from "../utils";

export type LibraryChallenge = {
  id: string;
  title: string;
  description: string | null;
  // Temps propi del repte; null = el temps per defecte de la partida.
  bonus_seconds: number | null;
};

type ChallengeLibraryScreenProps = {
  onBack: () => void;
};

const TITLE_MAX = 120;
const DESCRIPTION_MAX = 500;
const BONUS_MAX_MINUTES = 60;

export default function ChallengeLibraryScreen({
  onBack,
}: ChallengeLibraryScreenProps) {
  const [challenges, setChallenges] = useState<LibraryChallenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  // Formulari: si editingId és null, es crea un repte nou.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [bonusMinutes, setBonusMinutes] = useState(""); // buit = per defecte
  const [saving, setSaving] = useState(false);

  const bonusValid =
    bonusMinutes === "" ||
    (/^\d+$/.test(bonusMinutes) && Number(bonusMinutes) <= BONUS_MAX_MINUTES);

  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  async function loadChallenges() {
    const { data, error } = await supabase
      .from("challenge_library")
      .select("id, title, description, bonus_seconds")
      .order("title");

    setLoading(false);

    if (error) {
      console.error("challenge_library:", error);
      setErrorMessage("No s'han pogut carregar els reptes.");
      return;
    }

    setChallenges(data ?? []);
  }

  useEffect(() => {
    loadChallenges();
  }, []);

  function resetForm() {
    setEditingId(null);
    setTitle("");
    setDescription("");
    setBonusMinutes("");
  }

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const cleanTitle = title.trim();
    const cleanDescription = description.trim();

    if (!cleanTitle || !bonusValid) return;

    setSaving(true);
    setErrorMessage("");

    const values = {
      title: cleanTitle,
      description: cleanDescription || null,
      bonus_seconds: bonusMinutes === "" ? null : Number(bonusMinutes) * 60,
    };

    const { error } = editingId
      ? await supabase
          .from("challenge_library")
          .update(values)
          .eq("id", editingId)
      : await supabase.from("challenge_library").insert(values);

    setSaving(false);

    if (error) {
      console.error("challenge_library:", error);
      setErrorMessage("No s'ha pogut desar el repte.");
      return;
    }

    resetForm();
    await loadChallenges();
  }

  async function handleDelete(id: string) {
    setErrorMessage("");

    const { error } = await supabase
      .from("challenge_library")
      .delete()
      .eq("id", id);

    setDeleteTarget(null);

    if (error) {
      console.error("challenge_library:", error);
      setErrorMessage("No s'ha pogut esborrar el repte.");
      return;
    }

    if (editingId === id) resetForm();
    await loadChallenges();
  }

  function startEditing(challenge: LibraryChallenge) {
    setEditingId(challenge.id);
    setTitle(challenge.title);
    setDescription(challenge.description ?? "");
    setBonusMinutes(
      challenge.bonus_seconds === null
        ? ""
        : String(Math.round(challenge.bonus_seconds / 60))
    );
  }

  return (
    <section className="team-card" style={{ marginBottom: 24, padding: 24 }}>
      <button className="secondary-button" onClick={onBack}>
        ← Tornar al panell
      </button>

      <p className="eyebrow" style={{ marginTop: 20 }}>
        BIBLIOTECA
      </p>
      <h2>Reptes de la biblioteca</h2>
      <p className="muted">
        Aquí pots guardar els reptes que fas servir sovint. En crear una
        partida, en triaràs uns quants per a cada equip. Si canvies o esborres
        un repte, les partides que ja existeixen no canvien.
      </p>

      <form onSubmit={handleSave} style={{ marginTop: 20 }}>
        <h3>{editingId ? "Editar el repte" : "Nou repte"}</h3>

        <label htmlFor="library-title">Títol</label>
        <input
          id="library-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={TITLE_MAX}
          placeholder="Ex. Una bicicleta vermella"
          required
          style={{ display: "block", width: "100%", marginBottom: 12 }}
        />

        <label htmlFor="library-description">Descripció (opcional)</label>
        <textarea
          id="library-description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          maxLength={DESCRIPTION_MAX}
          rows={2}
          placeholder="Ex. Ha de sortir sencera a la foto."
          style={{ display: "block", width: "100%", marginBottom: 12 }}
        />

        <label htmlFor="library-bonus">
          Temps que afegeix en aprovar-lo (minuts)
        </label>
        <input
          id="library-bonus"
          type="number"
          inputMode="numeric"
          min={0}
          max={BONUS_MAX_MINUTES}
          step={1}
          value={bonusMinutes}
          onChange={(event) => setBonusMinutes(event.target.value)}
          placeholder="Per defecte"
          style={{ display: "block", width: "100%", marginBottom: 4 }}
        />
        <p className="muted" style={{ marginTop: 0 }}>
          Deixa-ho buit per fer servir el temps per defecte de cada partida
          (3 min si no el canvies). Màxim {BONUS_MAX_MINUTES} min.
        </p>
        {!bonusValid && (
          <p role="alert">
            Escriu un nombre sencer de minuts entre 0 i {BONUS_MAX_MINUTES}.
          </p>
        )}

        <div className="review-actions">
          <button
            type="submit"
            className="primary-button"
            disabled={saving || !title.trim() || !bonusValid}
            style={{ marginTop: 0 }}
          >
            {editingId ? <Pencil size={16} /> : <Plus size={16} />}
            {saving
              ? "Desant..."
              : editingId
                ? "Desar els canvis"
                : "Afegir a la biblioteca"}
          </button>

          {editingId && (
            <button
              type="button"
              className="secondary-button"
              onClick={resetForm}
              style={{ marginTop: 0 }}
            >
              Cancel·lar
            </button>
          )}
        </div>
      </form>

      {errorMessage && <p role="alert">{errorMessage}</p>}

      <h3 style={{ marginTop: 24 }}>
        Reptes guardats ({challenges.length})
      </h3>

      {loading ? (
        <p className="muted">Carregant...</p>
      ) : challenges.length === 0 ? (
        <p className="muted">Encara no hi ha cap repte a la biblioteca.</p>
      ) : (
        <div className="challenge-list">
          {challenges.map((challenge) => (
            <div className="challenge-row" key={challenge.id}>
              <span className="challenge-check">•</span>

              <span style={{ flex: 1 }}>
                <strong>{challenge.title}</strong>{" "}
                <span className="muted">
                  (
                  {challenge.bonus_seconds === null
                    ? "temps per defecte"
                    : formatBonus(challenge.bonus_seconds)}
                  )
                </span>
                {challenge.description && (
                  <>
                    <br />
                    <span className="muted">{challenge.description}</span>
                  </>
                )}
              </span>

              {deleteTarget === challenge.id ? (
                <>
                  <button
                    className="reject-button"
                    onClick={() => handleDelete(challenge.id)}
                  >
                    Esborrar
                  </button>
                  <button
                    className="secondary-button"
                    onClick={() => setDeleteTarget(null)}
                    style={{ marginTop: 0 }}
                  >
                    No
                  </button>
                </>
              ) : (
                <>
                  <button
                    className="secondary-button"
                    onClick={() => startEditing(challenge)}
                    aria-label={`Editar ${challenge.title}`}
                    style={{ marginTop: 0 }}
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    className="secondary-button"
                    onClick={() => setDeleteTarget(challenge.id)}
                    aria-label={`Esborrar ${challenge.title}`}
                    style={{ marginTop: 0 }}
                  >
                    <Trash2 size={15} />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
