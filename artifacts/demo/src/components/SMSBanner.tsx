import { useEffect, useState } from "react";
import { MessageSquare, X } from "lucide-react";

interface Props {
  message: string;
  visible: boolean;
  onDismiss: () => void;
}

export default function SMSBanner({ message, visible, onDismiss }: Props) {
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    if (visible) {
      setAnimating(true);
    }
  }, [visible]);

  if (!visible && !animating) return null;

  return (
    <div
      className={`fixed top-16 right-4 z-50 w-80 rounded-xl border border-border bg-card shadow-2xl ${
        visible ? "sms-banner-enter" : "sms-banner-exit"
      }`}
      onAnimationEnd={() => { if (!visible) setAnimating(false); }}
    >
      {/* Header bar */}
      <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-border">
        <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
          <MessageSquare className="w-3.5 h-3.5 text-primary" />
        </div>
        <div className="flex-1">
          <p className="text-[10px] font-semibold text-foreground uppercase tracking-wide">SMS · ERA Hospital</p>
          <p className="text-[10px] text-muted-foreground">Just now</p>
        </div>
        <button
          onClick={onDismiss}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Message */}
      <div className="px-3.5 py-3">
        <p className="text-xs text-foreground leading-relaxed">{message}</p>
      </div>

      {/* Powered by footer */}
      <div className="px-3.5 pb-2.5">
        <p className="text-[9px] text-muted-foreground/50">Powered by ERA Patient</p>
      </div>
    </div>
  );
}
