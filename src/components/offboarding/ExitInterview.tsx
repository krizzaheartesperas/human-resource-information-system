"use client";

import { useMemo, useState } from "react";
import { Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

type InterviewStatus = "Not Started" | "In Progress" | "Submitted";

const statusStyles: Record<InterviewStatus, string> = {
  "Not Started": "bg-slate-500/15 text-slate-700 dark:text-slate-300",
  "In Progress": "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  Submitted: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
};

const leavingReasons = [
  "Career Growth",
  "Compensation",
  "Work-Life Balance",
  "Relocation",
  "Personal Reasons",
  "Other",
];

export function ExitInterview() {
  const [rating, setRating] = useState(0);
  const [reason, setReason] = useState("");
  const [feedback, setFeedback] = useState("");
  const [isConfidential, setIsConfidential] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const status: InterviewStatus = useMemo(() => {
    if (isSubmitted) return "Submitted";
    if (rating > 0 || reason || feedback || isConfidential) return "In Progress";
    return "Not Started";
  }, [feedback, isConfidential, isSubmitted, rating, reason]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitted(true);
  }

  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-lg">Exit Interview</CardTitle>
          <Badge className={cn("border-transparent", statusStyles[status])}>{status}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">Rating</p>
            <div className="flex items-center gap-1">
              {Array.from({ length: 5 }, (_, idx) => idx + 1).map((value) => (
                <button
                  key={value}
                  type="button"
                  className="rounded-md p-1 text-muted-foreground transition-colors hover:text-amber-500"
                  onClick={() => setRating(value)}
                  aria-label={`Rate ${value} star${value > 1 ? "s" : ""}`}
                  disabled={isSubmitted}
                >
                  <Star
                    className={cn(
                      "size-5",
                      value <= rating ? "fill-amber-500 text-amber-500" : "text-muted-foreground"
                    )}
                  />
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground" htmlFor="reason-for-leaving">
              Reason for leaving
            </label>
            <select
              id="reason-for-leaving"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              disabled={isSubmitted}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Select a reason</option>
              {leavingReasons.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground" htmlFor="feedback">
              Feedback
            </label>
            <textarea
              id="feedback"
              value={feedback}
              onChange={(event) => setFeedback(event.target.value)}
              disabled={isSubmitted}
              rows={4}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="Share your feedback..."
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <Checkbox
              checked={isConfidential}
              onChange={(event) => setIsConfidential(event.currentTarget.checked)}
              disabled={isSubmitted}
              aria-label="Mark as confidential"
            />
            Mark as confidential
          </label>

          <div className="flex items-center gap-2">
            <Button type="submit" className="rounded-xl" disabled={isSubmitted}>
              Submit
            </Button>
            {isSubmitted ? (
              <Input
                readOnly
                value="Submitted successfully"
                className="h-9 border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
              />
            ) : null}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
