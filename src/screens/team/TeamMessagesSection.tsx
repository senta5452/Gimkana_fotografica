import { useState } from "react";
import { Send } from "lucide-react";
import type { GameMessage } from "../../types";

type TeamMessagesSectionProps = {
  messages: GameMessage[];
  onSend: (text: string) => Promise<string | null>;
};

const BODY_MAX = 300;

function formatHour(iso: string) {
  return new Date(iso).toLocaleTimeString("ca-ES", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Missatges amb el monitor a la pantalla de l'equip: historial i resposta.
export default function TeamMessagesSection({
  messages,
  onSend,
}: TeamMessagesSectionProps) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!text.trim()) return;

    setSending(true);
    setErrorMessage("");

    const error = await onSend(text.trim());

    setSending(false);

    if (error) {
      setErrorMessage(error);
      return;
    }

    setText("");
  }

  return (
    <section className="team-card messages-card">
      <p className="eyebrow">MISSATGES</p>
      <h2>Missatges amb el monitor</h2>

      {messages.length === 0 ? (
        <p className="muted">Encara no hi ha cap missatge.</p>
      ) : (
        <div className="message-list">
          {[...messages].reverse().map((message) => (
            <div
              key={message.id}
              className={`message-item message-from-${message.sender}`}
            >
              <span className="message-meta">
                {message.sender === "monitor"
                  ? message.toAll
                    ? "Monitor · a tots els equips"
                    : "Monitor · al vostre equip"
                  : "Vosaltres"}{" "}
                · {formatHour(message.createdAt)}
              </span>
              <span>{message.body}</span>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit} className="message-form">
        <label htmlFor="team-message">Escriu al monitor</label>
        <textarea
          id="team-message"
          value={text}
          onChange={(event) => setText(event.target.value)}
          maxLength={BODY_MAX}
          rows={2}
          placeholder="Ex. Ja hem arribat al punt de trobada."
        />

        {errorMessage && <p role="alert">{errorMessage}</p>}

        <button
          type="submit"
          className="primary-button"
          disabled={sending || !text.trim()}
        >
          <Send size={16} />
          {sending ? "Enviant..." : "Enviar"}
        </button>
      </form>
    </section>
  );
}
