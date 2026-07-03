"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCurrentUser } from "@/lib/CurrentUserContext";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export function HandbookAcknowledgment() {
  const { user } = useCurrentUser();
  const [agreed, setAgreed] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAcknowledge = () => {
    if (!agreed) return;
    
    setIsSubmitting(true);
    // Simulate API call
    setTimeout(() => {
      setAcknowledged(true);
      setIsSubmitting(false);
    }, 1500);
  };

  const today = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  if (acknowledged) {
    return (
      <Card className="border-green-500/20 bg-green-500/5 py-8 text-center animate-in fade-in zoom-in duration-500">
        <CardContent className="flex flex-col items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500/20 text-green-500">
            <CheckCircle2 className="size-10" />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-bold text-foreground">Acknowledgment Success</h3>
            <p className="text-muted-foreground max-w-md">
              Thank you, <span className="font-semibold text-foreground">{user?.name}</span>. Your acknowledgment of the Employee Handbook has been recorded on {today}.
            </p>
          </div>
          <Badge variant="outline" className="mt-2 border-green-500/50 text-green-600 dark:text-green-400 px-4 py-1">
            Verified Status: Compliant
          </Badge>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card id="acknowledgment" className="scroll-mt-24 border-primary/20 bg-card overflow-hidden shadow-sm">
      <CardHeader className="border-b border-[#161b30]/10 bg-[#161b30]/5">
        <div className="flex items-center gap-3">
          <ShieldCheck className="size-6 text-[#161b30]" />
          <CardTitle className="text-lg font-bold text-[#161b30]">Employee Acknowledgment</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-6 pt-6">
        <div className="space-y-4">
          <p className="text-muted-foreground text-sm leading-relaxed">
            I confirm that I have read, understood, and agreed to follow the policies, procedures, and guidelines stated in this Employee Handbook.
          </p>
          <p className="text-muted-foreground text-sm leading-relaxed">
            I understand that the company may update handbook content, policies, and procedures when necessary, and that employees are expected to stay informed of official updates.
          </p>
        </div>

        <div className="grid gap-6 rounded-xl border border-[#161b30]/10 bg-[#161b30]/5 p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="employee-name" className="text-[10px] uppercase tracking-wider text-muted-foreground">Employee Name</Label>
              <Input 
                id="employee-name" 
                value={user?.name || "Loading..."} 
                readOnly 
                className="border-[#161b30]/20 bg-background font-semibold text-[#161b30]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ack-date" className="text-[10px] uppercase tracking-wider text-muted-foreground">Date Acknowledged</Label>
              <Input 
                id="ack-date" 
                value={today} 
                readOnly 
                className="border-[#161b30]/20 bg-background text-[#161b30]"
              />
            </div>
          </div>

          <div className="flex items-start gap-3 pt-2">
            <button
              id="agree-checkbox"
              type="button"
              role="checkbox"
              aria-checked={agreed}
              aria-label="Acknowledge employee handbook"
              onClick={() => setAgreed((current) => !current)}
              className={cn(
                "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#161b30]/30 focus-visible:ring-offset-2",
                agreed
                  ? "border-[#161b30] bg-[#161b30] text-white"
                  : "border-[#161b30]/30 bg-white text-transparent hover:border-[#161b30]/60"
              )}
            >
              <CheckCircle2 className="size-4" />
            </button>
            <div
              onClick={() => setAgreed((current) => !current)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setAgreed((current) => !current);
                }
              }}
              role="button"
              tabIndex={0}
              className="text-left"
            >
              <Label 
                htmlFor="agree-checkbox" 
                className="cursor-pointer select-none text-sm font-medium leading-relaxed text-[#161b30]"
              >
                I have read and understood the Employee Handbook and agree to comply with all company policies and procedures.
              </Label>
            </div>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex justify-end border-t border-[#161b30]/10 bg-[#161b30]/5 py-4">
        <Button 
          onClick={handleAcknowledge} 
          disabled={!agreed || isSubmitting}
          className={cn(
            "px-8 font-bold transition-all",
            agreed ? "bg-[#161b30] text-white hover:opacity-90" : "bg-muted text-muted-foreground"
          )}
        >
          {isSubmitting ? (
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
              Processing...
            </div>
          ) : (
            "Acknowledge Handbook"
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
