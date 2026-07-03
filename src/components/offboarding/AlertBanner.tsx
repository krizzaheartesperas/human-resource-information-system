import { AlertTriangle, Info, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type AlertVariant = "warning" | "info";

type AlertBannerProps = {
  message: string;
  variant?: AlertVariant;
  onDismiss?: () => void;
};

const variantStyles: Record<AlertVariant, { container: string; icon: string; dismiss: string }> = {
  warning: {
    container:
      "border-amber-300/70 bg-amber-50 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300",
    icon: "text-amber-600 dark:text-amber-400",
    dismiss:
      "text-amber-700 hover:bg-amber-200/50 hover:text-amber-900 dark:text-amber-300 dark:hover:bg-amber-500/20",
  },
  info: {
    container:
      "border-sky-300/70 bg-sky-50 text-sky-900 dark:border-sky-500/40 dark:bg-sky-500/10 dark:text-sky-300",
    icon: "text-sky-600 dark:text-sky-400",
    dismiss:
      "text-sky-700 hover:bg-sky-200/50 hover:text-sky-900 dark:text-sky-300 dark:hover:bg-sky-500/20",
  },
};

export function AlertBanner({ message, variant = "warning", onDismiss }: AlertBannerProps) {
  const styles = variantStyles[variant];
  const IconComponent = variant === "info" ? Info : AlertTriangle;

  return (
    <div
      className={cn(
        "flex items-start justify-between gap-3 rounded-2xl border px-4 py-3 shadow-sm",
        styles.container
      )}
    >
      <div className="flex items-start gap-3">
        <IconComponent className={cn("mt-0.5 size-5 shrink-0", styles.icon)} />
        <p className="text-sm font-medium leading-relaxed">{message}</p>
      </div>
      {onDismiss ? (
        <Button
          type="button"
          size="icon"
          variant="ghost"
          onClick={onDismiss}
          className={cn("size-7 shrink-0 rounded-md", styles.dismiss)}
          aria-label="Dismiss alert"
        >
          <X className="size-4" />
        </Button>
      ) : null}
    </div>
  );
}
