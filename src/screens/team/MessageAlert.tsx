import { MessageCircle } from "lucide-react";
import type { GameMessage } from "../../types";

type MessageAlertProps = {
  message: GameMessage;
  onAcknowledge: () => void;
};

// Avís del monitor a sobre de tot, fins que l'equip el confirma.
export default function MessageAlert({
  message,
  onAcknowledge,
}: MessageAlertProps) {
  return (
    <div className="result-modal-overlay message-alert-overlay">
      <section
        className="result-modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="message-alert-title"
      >
        <div className="result-modal-trophy">
          <MessageCircle size={38} />
        </div>

        <p className="eyebrow">
          {message.toAll
            ? "AVÍS DEL MONITOR A TOTS ELS EQUIPS"
            : "AVÍS DEL MONITOR AL VOSTRE EQUIP"}
        </p>

        <h1 id="message-alert-title" className="message-alert-text">
          {message.body}
        </h1>

        <div className="result-modal-actions">
          <button
            className="primary-button result-modal-button"
            onClick={onAcknowledge}
            style={{ marginTop: 0 }}
          >
            D'acord
          </button>
        </div>
      </section>
    </div>
  );
}
