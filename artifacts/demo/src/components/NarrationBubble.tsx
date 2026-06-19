import { type ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { Button } from "./ui";
import { cn } from "@/lib/utils";

interface Props {
  text: string | ReactNode;
  onNext?: () => void;
  nextLabel?: string;
  autoSeconds?: number;
  position?: "bottom" | "top";
  className?: string;
}

export default function NarrationBubble({
  text,
  onNext,
  nextLabel = "Continue",
  position = "bottom",
  className,
}: Props) {
  return (
    <div
      className={cn(
        "absolute z-30 flex items-center gap-4 px-5 py-3.5 rounded-xl border border-primary/30 bg-card/95 backdrop-blur shadow-xl",
        "max-w-lg w-auto",
        position === "bottom" ? "bottom-6 left-1/2 -translate-x-1/2" : "top-6 left-1/2 -translate-x-1/2",
        "scale-in",
        className
      )}
    >
      {/* Teal accent line */}
      <div className="w-0.5 h-full min-h-[32px] rounded-full bg-primary shrink-0" />

      <p className="text-sm text-foreground leading-snug flex-1">{text}</p>

      {onNext && (
        <Button
          size="sm"
          onClick={onNext}
          className="shrink-0 gap-1.5 text-xs"
        >
          {nextLabel}
          <ChevronRight className="w-3.5 h-3.5" />
        </Button>
      )}
    </div>
  );
}
