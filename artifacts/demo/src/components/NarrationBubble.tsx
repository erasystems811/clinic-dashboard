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
        "absolute z-30 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 px-3 py-3 sm:px-5 sm:py-3.5 rounded-xl border border-primary/30 bg-card/95 backdrop-blur shadow-xl",
        "left-2 right-2 sm:left-1/2 sm:right-auto sm:w-auto sm:-translate-x-1/2 sm:max-w-lg",
        position === "bottom" ? "bottom-4 sm:bottom-6" : "top-4 sm:top-6",
        "scale-in",
        className
      )}
    >
      <div className="flex items-start gap-3 sm:gap-4">
        {/* Teal accent line */}
        <div className="w-0.5 self-stretch min-h-[24px] rounded-full bg-primary shrink-0 mt-0.5" />
        <p className="text-sm text-foreground leading-snug flex-1">{text}</p>
      </div>

      {onNext && (
        <div className="relative w-full sm:w-auto shrink-0">
          {/* Pulsing glow ring — draws attention to the Continue button */}
          <span className="absolute -inset-1 rounded-lg bg-primary/35 animate-ping [animation-duration:2s] pointer-events-none" />
          <Button
            size="sm"
            onClick={onNext}
            className="relative w-full sm:w-auto gap-1.5 text-xs"
          >
            {nextLabel}
            <ChevronRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}
