import { useEffect, useState } from "react";
import { Send } from "lucide-react";
import { supabase } from "../supabase";
import type { GameMessage } from "../types";

type MonitorMessagesSectionProps = {
  gameId: string;
  messages: GameMessage[];
  teamNames: Record<string, string>;
  onSent: () => void;
};

const BODY_MAX = 300;

const QUICK_MESSAGES = [
  "Torneu al punt de trobada.",
  "La partida s'atura uns minuts. Espereu instruccions.",
  "Queden 5 minuts!",
  "Truqueu al monitor, si us plau.",
];

function formatHour(iso: string) {
  return new Date(iso).toLocaleTimeString("ca-ES", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Clau on es recorda fins a quin missatge dels equips s'ha llegit.
function seenKey(gameId: string) {
  return `monitorSeenMessages:${gameId}`;
}

// Missatges del panell del monitor: avisos als equips i respostes.
export default function MonitorMessagesSection({
  gameId,
  messages,
  teamNames,
  onSent,
}: MonitorMessagesSectionProps) {
  const [recipient, setRecipient] = useState<"" | "A" | "B">("");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [seenAt, setSeenAt] = useState("");

  useEffect(() => {
    try {
      setSeenAt(localStorage.getItem(seenKey(gameId)) ?? "");
    } catch {
      setSeenAt("");
    }
  }, [gameId]);

  const teamMessages = messages.filter((item) => item.sender === "team");
  const unreadCount = teamMessages.filter(
    (item) => item.createdAt > seenAt
  ).length;

  function markAsRead() {
    const latest = teamMessages[teamMessages.length - 1]?.createdAt ?? "";
    setSeenAt(latest);

    try {
      localStorage.setItem(seenKey(gameId), latest);
    } catch {
      // Sense localStorage, el comptador es reinicia en recarregar.
    }
  }

  function teamLabel(teamKey?: string) {
    return teamKey ? teamNames[teamKey] ?? `Equip ${teamKey}` : "";
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!text.trim()) return;

    setSending(true);
    setErrorMessage("");

    const { error } = await supabase.functions.invoke("judge-send-message", {
      body: { gameId, teamKey: recipient || null, body: text.trim() },
    });

    setSending(false);

    if (error) {
      const detail =
        error.context instanceof Response ? await error.context.text() : "";
      console.error("judge-send-message:", error.message, detail);
      setErrorMessage("No s'ha pogut enviar el missatge.");
      return;
    }

    setText("");
    onSent();
  }

  return (
    <section className="submissions-section monitor-messages">
      <div className="section-heading">
        <div>
          <p className="eyebrow">COMUNICACIÓ</p>
          <h2>Missatges amb els equips</h2>
        </div>
        <span className="count-badge" title="Missatges nous dels equips">
          {unreadCount}
        </span>
      </div>

      <form onSubmit={handleSubmit} className="sub-panel message-form">
        <label htmlFor="message-recipient">Destinatari</label>
        <select
          id="message-recipient"
          value={recipient}
          onChange={(event) =>
            setRecipient(event.target.value as "" | "A" | "B")
          }
        >
          <option value="">Tots els equips</option>
          <option value="A">{teamLabel("A")}</option>
          <option value="B">{teamLabel("B")}</option>
        </select>

        <span className="message-quick-label">Missatges ràpids</span>
        <div className="review-actions">
          {QUICK_MESSAGES.map((quick) => (
            <button
              key={quick}
              type="button"
              className="secondary-button"
              onClick={() => setText(quick)}
              style={{ marginTop: 0 }}
            >
              {quick}
            </button>
          ))}
        </div>

        <label htmlFor="monitor-message">Missatge</label>
        <textarea
          id="monitor-message"
          value={text}
          onChange={(event) => setText(event.target.value)}
          maxLength={BODY_MAX}
          rows={2}
          placeholder="Escriu un avís o tria'n un de ràpid."
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

      {messages.length === 0 ? (
        <p className="muted">Encara no hi ha cap missatge.</p>
      ) : (
        <>
          {unreadCount > 0 && (
            <button
              className="secondary-button"
              onClick={markAsRead}
              style={{ marginTop: 16 }}
            >
              Marcar com a llegits ({unreadCount})
            </button>
          )}

          <div className="message-list" style={{ marginTop: 16 }}>
            {[...messages].reverse().map((message) => (
              <div
                key={message.id}
                className={`message-item message-from-${message.sender} ${
                  message.sender === "team" && message.createdAt > seenAt
                    ? "message-unread"
                    : ""
                }`}
              >
                <span className="message-meta">
                  {message.sender === "monitor"
                    ? `Tu → ${teamLabel(message.teamKey) || "tots els equips"}`
                    : teamLabel(message.teamKey)}{" "}
                  · {formatHour(message.createdAt)}
                </span>
                <span>{message.body}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
