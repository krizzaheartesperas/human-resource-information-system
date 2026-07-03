"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { CreditCard } from "lucide-react";

function digitsOnly(value: string) {
  return value.replace(/\D/g, "");
}

function formatCardNumber(value: string) {
  const digits = digitsOnly(value).slice(0, 19);
  const parts = digits.match(/.{1,4}/g) ?? [];
  return parts.join(" ");
}

function formatExpiry(value: string) {
  const digits = digitsOnly(value).slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

function maskCardNumber(value: string) {
  const digits = digitsOnly(value);
  if (digits.length === 0) return "•••• •••• •••• ••••";
  const last4 = digits.slice(-4).padStart(4, "•");
  return `•••• •••• •••• ${last4}`;
}

function detectBrand(value: string) {
  const digits = digitsOnly(value);
  if (digits.startsWith("4")) return "VISA";
  if (digits.startsWith("5") || digits.startsWith("2")) return "MASTERCARD";
  return "CARD";
}

export default function PaymayaCardForm({ className }: { className?: string }) {
  const [cardholderName, setCardholderName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const [sameAsBilling, setSameAsBilling] = useState(true);

  const brand = useMemo(() => detectBrand(cardNumber), [cardNumber]);
  const maskedNumber = useMemo(() => maskCardNumber(cardNumber), [cardNumber]);
  const previewName = useMemo(
    () => (cardholderName.trim() ? cardholderName.trim().toUpperCase() : "CARDHOLDER NAME"),
    [cardholderName]
  );
  const previewExpiry = useMemo(() => (expiry.trim() ? expiry.trim() : "MM/YY"), [expiry]);

  return (
    <Card className={cn("rounded-2xl border-border/70 shadow-sm", className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg font-medium">
          <CreditCard className="size-5 text-muted-foreground" />
          Card Details
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-[360px_1fr] lg:items-start">
          <div className="relative mx-auto w-full max-w-sm">
            <div className="relative aspect-[1.586/1] overflow-hidden rounded-2xl bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 p-5 text-white shadow-lg">
              <div className="absolute inset-0 opacity-30 [background:radial-gradient(900px_circle_at_20%_10%,rgba(255,255,255,.18),transparent_48%),radial-gradient(800px_circle_at_70%_80%,rgba(255,255,255,.12),transparent_55%)]" />
              <div className="pointer-events-none absolute -bottom-10 -left-6 select-none font-[var(--font-maya-logo)] text-[180px] font-black leading-none text-white/5">
                m
              </div>
              <div className="relative flex h-full flex-col justify-between">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="relative h-10 w-14 overflow-hidden rounded-md bg-gradient-to-br from-zinc-200/80 via-zinc-100/70 to-zinc-400/70 shadow-sm ring-1 ring-white/10">
                      <div className="absolute left-0 top-0 h-full w-full opacity-70 [background:linear-gradient(90deg,transparent_0%,rgba(0,0,0,.18)_48%,transparent_100%)]" />
                      <div className="absolute inset-0">
                        <div className="absolute left-0 top-1/2 h-0.5 w-full -translate-y-1/2 bg-zinc-800/25" />
                        <div className="absolute left-1/3 top-0 h-full w-0.5 bg-zinc-800/25" />
                        <div className="absolute left-2/3 top-0 h-full w-0.5 bg-zinc-800/25" />
                        <div className="absolute left-1/2 top-1/2 h-4 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border border-zinc-800/25" />
                      </div>
                    </div>
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 28 28"
                      className="size-6 opacity-85"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    >
                      <path d="M10.5 15.5c.9-.9.9-2.4 0-3.3" />
                      <path d="M13.8 18.8c2.8-2.8 2.8-7.3 0-10.1" />
                      <path d="M17.2 22.2c4.6-4.6 4.6-12 0-16.6" />
                    </svg>
                  </div>
                  <div className="text-right font-[var(--font-maya-logo)] text-3xl font-black leading-none tracking-tight text-emerald-400">
                    maya
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="font-mono text-lg tracking-wider sm:text-xl">{maskedNumber}</div>
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div className="space-y-1">
                      <div className="text-white/70">Name</div>
                      <div className="truncate text-sm font-medium">{previewName}</div>
                    </div>
                    <div className="space-y-1 text-right">
                      <div className="text-white/70">Expires</div>
                      <div className="text-sm font-medium">{previewExpiry}</div>
                    </div>
                  </div>
                </div>

                <div className="flex items-end justify-between">
                  <div className="text-[10px] font-medium tracking-widest text-white/55">{brand}</div>
                  <div className="text-right text-3xl font-black italic tracking-tight text-white/90">VISA</div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid gap-3">
              <div className="space-y-1.5">
                <label className="text-sm text-muted-foreground" htmlFor="cardholderName">
                  Cardholder Name
                </label>
                <Input
                  id="cardholderName"
                  value={cardholderName}
                  onChange={(event) => setCardholderName(event.target.value)}
                  placeholder="Full name"
                  className="h-11 rounded-xl"
                  autoComplete="cc-name"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm text-muted-foreground" htmlFor="cardNumber">
                  Card Number
                </label>
                <Input
                  id="cardNumber"
                  inputMode="numeric"
                  value={formatCardNumber(cardNumber)}
                  onChange={(event) => setCardNumber(event.target.value)}
                  placeholder="1234 5678 9012 3456"
                  className="h-11 rounded-xl font-mono"
                  autoComplete="cc-number"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-sm text-muted-foreground" htmlFor="expDate">
                    Exp. Date
                  </label>
                  <Input
                    id="expDate"
                    inputMode="numeric"
                    value={formatExpiry(expiry)}
                    onChange={(event) => setExpiry(event.target.value)}
                    placeholder="MM/YY"
                    className="h-11 rounded-xl font-mono"
                    autoComplete="cc-exp"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm text-muted-foreground" htmlFor="cvv">
                    CVV
                  </label>
                  <Input
                    id="cvv"
                    inputMode="numeric"
                    value={digitsOnly(cvv).slice(0, 4)}
                    onChange={(event) => setCvv(event.target.value)}
                    placeholder="123"
                    className="h-11 rounded-xl font-mono"
                    autoComplete="cc-csc"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Checkbox
                checked={sameAsBilling}
                onChange={(event) => setSameAsBilling(event.target.checked)}
                aria-label="Same as billing address"
              />
              <span className="text-sm text-muted-foreground">Same as billing address</span>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="button" className="min-w-40">
                Save Card
              </Button>
              <Button type="button" variant="outline" className="min-w-40">
                Cancel
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
