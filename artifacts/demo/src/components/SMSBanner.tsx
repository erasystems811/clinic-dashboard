import { useEffect, useState } from "react";
import { MessageSquare, X } from "lucide-react";

interface Props {
  message: string;
  visible: boolean;
  onDismiss: () => void;
}

export default function SMSBanner({ message, visible, onDismiss }: Props) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (visible) {
      setShow(true);
    } else {
      const t = setTimeout(() => setShow(false), 350);
      return () => clearTimeout(t);
    }
  }, [visible]);

  if (!show && !visible) return null;

  return (
    <div
      style={{ zIndex: 9999 }}
      className={`fixed top-2 left-2 right-2 sm:top-4 sm:left-auto sm:right-4 sm:w-80 rounded-xl border border-border bg-card shadow-2xl transition-opacity duration-300 ${
        visible ? "opacity-100" : "opacity-0 pointer-events-none"
      }`}
    >
      {/* Green notification dot */}
      <div className="absolute -top-1 -left-1 w-3 h-3 rounded-full bg-primary border-2 border-background" />

      {/* Header bar */}
      <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-border">
        <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
          <MessageSquare className="w-3.5 h-3.5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-foreground uppercase tracking-wide">SMS · ERA Hospital</p>
          <p className="text-xs text-muted-foreground">Just now</p>
        </div>
        <button
          onClick={onDismiss}
          className="text-muted-foreground hover:text-foreground transition-colors p-0.5 shrink-0"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Message */}
      <div className="px-3.5 py-3">
        <p className="text-sm text-foreground leading-relaxed">{message}</p>
      </div>

      {/* Footer */}
      <div className="px-3.5 pb-2.5">
        <p className="text-[10px] text-muted-foreground/50">Powered by ERA Patient</p>
      </div>
    </div>
  );
}
