"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

const PREFIX = "+63 ";

function formatPhilippineNumber(digits: string): string {
  const d = digits.replace(/\D/g, "").slice(0, 10);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)} ${d.slice(3)}`;
  return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`;
}

function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

export interface PhoneInputProps extends Omit<React.ComponentProps<"input">, "value" | "onChange"> {
  value?: string;
  onChange?: (value: string) => void;
  className?: string;
}

const PhoneInput = React.forwardRef<HTMLInputElement, PhoneInputProps>(
  ({ value, onChange, className, id, ...props }, ref) => {
    const isControlled = value !== undefined;
    const [internalDigits, setInternalDigits] = React.useState("");

    const raw = isControlled
      ? value.replace(/^\+63\s*/i, "").replace(/\D/g, "")
      : internalDigits;
    const displayValue = formatPhilippineNumber(raw);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const inputVal = e.target.value;
      const digits = digitsOnly(inputVal).slice(0, 10);
      const formatted = formatPhilippineNumber(digits);
      const full = digits ? `${PREFIX}${formatted}` : "";
      if (!isControlled) setInternalDigits(digits);
      onChange?.(full);
    };

    return (
      <div
        className={cn(
          "flex h-9 w-full items-center overflow-hidden rounded-md border border-input bg-transparent text-base shadow-sm transition-colors focus-within:ring-2 focus-within:ring-accent focus-within:ring-offset-2 focus-within:ring-offset-background md:text-sm",
          className
        )}
      >
        <span className="flex shrink-0 select-none items-center border-r border-input bg-muted px-3 py-1 text-muted-foreground">
          {PREFIX}
        </span>
        <input
          ref={ref}
          type="tel"
          inputMode="numeric"
          autoComplete="tel"
          id={id}
          value={displayValue}
          onChange={handleChange}
          placeholder="000 000 0000"
          className="min-w-0 flex-1 border-0 bg-transparent px-3 py-1 outline-none placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50"
          {...props}
        />
      </div>
    );
  }
);
PhoneInput.displayName = "PhoneInput";

export { PhoneInput };
