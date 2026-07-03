"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useCurrentUser } from "@/lib/CurrentUserContext";
import { getDemoLinkedMayaCard, getDemoPaymayaPayoutDefaults } from "@/lib/demo-paymaya-payout";
import {
  digitsOnlyPan,
  formatPanInputGroups,
  maskPan16Digits,
} from "@/lib/payoutCard";
import { supabase } from "@/lib/supabase/client";
import { isSupabaseAuthConfigured } from "@/lib/supabase/supabaseAuth";
import { Eye, EyeOff, Wallet } from "lucide-react";

type PayoutAccountRow = {
  payout_preference: string | null;
  card_holder_name: string | null;
  card_number: string | null;
};

const formatCardNumber = (value: string) =>
  value.replace(/\D/g, "").replace(/(.{4})/g, "$1 ").trim();

const maskCardNumber = (value: string) => {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  return `**** **** **** ${digits.slice(-4)}`;
};

export default function PayoutAccountInformationCard({ className }: { className?: string }) {
  const { user, updateUser } = useCurrentUser();
  const paymayaDefaults = useMemo(
    () => getDemoPaymayaPayoutDefaults(user),
    [user.email, user.employeeNumber, user.name, user.personalPhone]
  );
  const demoLinkedCard = useMemo(() => getDemoLinkedMayaCard(user.employeeNumber), [user.employeeNumber]);

  const [accountHolderName, setAccountHolderName] = useState(paymayaDefaults.accountHolderName);
  const [mayaAccountNumber, setMayaAccountNumber] = useState(paymayaDefaults.paymayaMobile.replace(/\D/g, "").slice(0, 11));
  const [paymayaEmail, setPaymayaEmail] = useState(paymayaDefaults.paymayaEmail);

  const [linkedCardHolderName, setLinkedCardHolderName] = useState(paymayaDefaults.accountHolderName);
  const [cardNumberInput, setCardNumberInput] = useState("");
  const [existingCardRaw, setExistingCardRaw] = useState("");
  const [isReplacingCard, setIsReplacingCard] = useState(false);
  const [showCardNumber, setShowCardNumber] = useState(false);
  const [loadedAccount, setLoadedAccount] = useState<PayoutAccountRow | null>(null);

  const [formError, setFormError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setAccountHolderName(paymayaDefaults.accountHolderName);
    setMayaAccountNumber(paymayaDefaults.paymayaMobile.replace(/\D/g, "").slice(0, 11));
    setPaymayaEmail(paymayaDefaults.paymayaEmail);
  }, [paymayaDefaults.accountHolderName, paymayaDefaults.paymayaEmail, paymayaDefaults.paymayaMobile]);

  useEffect(() => {
    const timer = toast ? setTimeout(() => setToast(null), 2200) : null;
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [toast]);

  useEffect(() => {
    let cancelled = false;

    const demoRaw = demoLinkedCard?.cardNumberMasked ?? "";
    const demoHolder = demoLinkedCard?.cardHolderName ?? paymayaDefaults.accountHolderName;

    async function loadPayoutAccount() {
      if (!isSupabaseAuthConfigured()) {
        if (!cancelled) {
          setLoadedAccount(null);
          setAccountHolderName(paymayaDefaults.accountHolderName);
          setMayaAccountNumber(paymayaDefaults.paymayaMobile.replace(/\D/g, "").slice(0, 11));
          setPaymayaEmail(paymayaDefaults.paymayaEmail);
          setLinkedCardHolderName(demoHolder);
          setExistingCardRaw(demoRaw);
          setCardNumberInput("");
          setIsReplacingCard(false);
          setShowCardNumber(false);
        }
        return;
      }

      const { data, error } = await supabase
        .from("employee_payout_accounts")
        .select("payout_preference,card_holder_name,card_number")
        .eq("employee_id", user.employeeId)
        .maybeSingle<PayoutAccountRow>();

      if (cancelled) return;

      if (error) {
        setLoadedAccount(null);
        setAccountHolderName(paymayaDefaults.accountHolderName);
        setMayaAccountNumber(paymayaDefaults.paymayaMobile.replace(/\D/g, "").slice(0, 11));
        setPaymayaEmail(paymayaDefaults.paymayaEmail);
        setLinkedCardHolderName(demoHolder);
        setExistingCardRaw(demoRaw);
        setCardNumberInput("");
        setIsReplacingCard(false);
        setShowCardNumber(false);
        return;
      }

      const row = data ?? null;
      setLoadedAccount(row);
      setAccountHolderName((row?.card_holder_name ?? "").trim() || paymayaDefaults.accountHolderName);
      setMayaAccountNumber(paymayaDefaults.paymayaMobile.replace(/\D/g, "").slice(0, 11));
      setPaymayaEmail(paymayaDefaults.paymayaEmail);
      setLinkedCardHolderName((row?.card_holder_name ?? "").trim() || demoHolder);
      setExistingCardRaw((row?.card_number ?? "").trim() || demoRaw);
      setCardNumberInput("");
      setIsReplacingCard(false);
      setShowCardNumber(false);
    }

    void loadPayoutAccount();

    return () => {
      cancelled = true;
    };
  }, [
    demoLinkedCard?.cardHolderName,
    demoLinkedCard?.cardNumberMasked,
    paymayaDefaults.accountHolderName,
    paymayaDefaults.paymayaEmail,
    paymayaDefaults.paymayaMobile,
    user.employeeId,
  ]);

  const existingDigits = useMemo(() => digitsOnlyPan(existingCardRaw), [existingCardRaw]);
  const hasExistingCard = existingCardRaw.length > 0;
  const effectiveDigits = isReplacingCard ? digitsOnlyPan(cardNumberInput) : existingDigits;
  const cardFieldValue = showCardNumber
    ? formatCardNumber(effectiveDigits)
    : effectiveDigits
      ? maskCardNumber(effectiveDigits)
      : hasExistingCard
        ? existingCardRaw
        : "";
  const cardPlaceholder = hasExistingCard ? maskCardNumber(existingDigits) || existingCardRaw : "Enter 16-digit card number";

  const handleSave = async () => {
    setFormError(null);
    setSaveMessage(null);

    const replacingOrAdding = !hasExistingCard || isReplacingCard;
    const digits = digitsOnlyPan(cardNumberInput);
    const accountDigits = digitsOnlyPan(mayaAccountNumber);

    if (accountDigits.length !== 11) {
      setFormError("Maya account number must be exactly 11 digits.");
      return;
    }

    if (replacingOrAdding && digits.length !== 16) {
      setFormError("Card number must be 16 digits.");
      return;
    }
    const cardToStore = replacingOrAdding ? digits : existingCardRaw;
    const nextHolder = linkedCardHolderName.trim() || accountHolderName.trim();

    setIsSaving(true);
    try {
      if (isSupabaseAuthConfigured()) {
        const payload = {
          employee_id: user.employeeId,
          payout_preference: "maya",
          card_holder_name: nextHolder || null,
          card_number: cardToStore || null,
          updated_at: new Date().toISOString(),
        };

        const { error } = await supabase.from("employee_payout_accounts").upsert(payload, { onConflict: "employee_id" });
        if (error) {
          if (error.message.toLowerCase().includes("employee_payout_accounts") || error.message.includes("relation")) {
            setSaveMessage({
              type: "error",
              text: "Database is missing the payout table. Apply migration 20260429120000_employees_payout_maya_card.sql, then try again.",
            });
          } else {
            setSaveMessage({ type: "error", text: error.message });
          }
          return;
        }
        setLoadedAccount({
          payout_preference: "maya",
          card_holder_name: nextHolder || null,
          card_number: cardToStore || null,
        });
      }

      updateUser({
        payoutPreference: "maya",
        payoutCardHolderName: nextHolder || null,
        payoutCardNumberMasked: maskPan16Digits(cardToStore) || null,
      });
      setExistingCardRaw(cardToStore);
      setCardNumberInput("");
      setIsReplacingCard(false);
      setShowCardNumber(false);
      setSaveMessage({ type: "success", text: "Maya account saved successfully." });
      setToast("Maya account saved successfully.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={cn("space-y-6", className)}>
      <Card className="rounded-2xl border-border/70 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg font-medium">
            <Wallet className="size-5 text-muted-foreground" />
            Maya Account
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground" htmlFor="accountHolderName">
              Account Holder Name
            </label>
            <Input
              id="accountHolderName"
              value={accountHolderName}
              readOnly
              className="h-11 rounded-lg"
              autoComplete="name"
            />
            <p className="text-xs text-muted-foreground">Name registered on your Maya wallet.</p>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground" htmlFor="mayaAccountNumber">
              Maya Account Number
            </label>
            <Input
              id="mayaAccountNumber"
              inputMode="numeric"
              value={mayaAccountNumber}
              onChange={(event) => setMayaAccountNumber(digitsOnlyPan(event.target.value).slice(0, 11))}
              placeholder="09165432109"
              className="h-11 rounded-lg"
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground">
              This is your registered Maya account number used for salary deposits.
            </p>
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <label className="text-sm font-medium text-foreground" htmlFor="paymayaEmail">
              Maya Email
            </label>
            <Input
              id="paymayaEmail"
              type="email"
              value={paymayaEmail}
              onChange={(event) => setPaymayaEmail(event.target.value)}
              placeholder="name@example.com"
              className="h-11 rounded-lg"
              autoComplete="email"
            />
          </div>

        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border/70 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-medium">Linked Card Information</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <label className="text-sm font-medium text-foreground" htmlFor="linkedCardHolderName">
              Card Holder Name
            </label>
            <Input
              id="linkedCardHolderName"
              value={linkedCardHolderName}
              onChange={(event) => setLinkedCardHolderName(event.target.value)}
              placeholder="As shown on card"
              className="h-11 rounded-lg"
              autoComplete="cc-name"
            />
            <p className="text-xs text-muted-foreground">Card holder for your linked Maya payout card.</p>
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <label className="text-sm font-medium text-foreground" htmlFor="cardNumber">
              Card Number
            </label>
            <div className="relative">
              <Input
                id="cardNumber"
                inputMode="numeric"
                autoComplete="cc-number"
                value={cardFieldValue}
                onChange={(event) => {
                  const next = digitsOnlyPan(event.target.value).slice(0, 16);
                  setIsReplacingCard(true);
                  setCardNumberInput(next);
                }}
                placeholder={cardPlaceholder || "Enter 16-digit card number"}
                className="h-11 rounded-lg pr-12 font-mono"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 h-9 w-9 -translate-y-1/2"
                onClick={() => setShowCardNumber((prev) => !prev)}
                aria-label={showCardNumber ? "Hide card number" : "Show card number"}
              >
                {showCardNumber ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {hasExistingCard
                ? "Stored securely. Click the eye icon to reveal or hide."
                : "Enter a 16-digit card number to link your Maya card."}
            </p>
          </div>
        </CardContent>
      </Card>

      {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
      {saveMessage ? (
        <p
          className={cn(
            "text-sm",
            saveMessage.type === "success" ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"
          )}
        >
          {saveMessage.text}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button type="button" className="min-w-44" disabled={isSaving} onClick={() => void handleSave()}>
          {isSaving ? "Saving..." : "Save Maya Account"}
        </Button>
      </div>

      {toast ? (
        <div className="fixed bottom-5 right-5 z-50 rounded-lg bg-emerald-600 px-4 py-2 text-sm text-white shadow-lg">
          {toast}
        </div>
      ) : null}
    </div>
  );
}
