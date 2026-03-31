"use client";

import { cn } from "@/lib/utils";
import { Heart, Target, Shuffle } from "lucide-react";

interface ModeIndicatorProps {
  mode: string;
}

const modeConfig = {
  therapy: {
    label: "Terapie",
    icon: Heart,
    color: "text-rose-500 bg-rose-50 dark:bg-rose-950/30",
  },
  coaching: {
    label: "Koučink",
    icon: Target,
    color: "text-blue-500 bg-blue-50 dark:bg-blue-950/30",
  },
  mixed: {
    label: "Mix",
    icon: Shuffle,
    color: "text-violet-500 bg-violet-50 dark:bg-violet-950/30",
  },
};

export function ModeIndicator({ mode }: ModeIndicatorProps) {
  const config = modeConfig[mode as keyof typeof modeConfig] ?? modeConfig.mixed;
  const Icon = config.icon;

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium",
        config.color
      )}
    >
      <Icon className="w-3.5 h-3.5" />
      {config.label}
    </div>
  );
}
