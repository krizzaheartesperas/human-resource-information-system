import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type ApprovalState = "Approved" | "Pending";

export type ApprovalItem = {
  role: string;
  status: ApprovalState;
};

type ApprovalStatusProps = {
  items: ApprovalItem[];
};

const statusStyles: Record<ApprovalState, string> = {
  Approved: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  Pending: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
};

export function ApprovalStatus({ items }: ApprovalStatusProps) {
  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg">Approval Status</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.map((item) => (
          <div
            key={item.role}
            className="flex items-center justify-between rounded-xl border border-border/70 bg-background p-3"
          >
            <p className="text-sm font-medium text-foreground">{item.role}</p>
            <Badge className={cn("border-transparent", statusStyles[item.status])}>
              {item.status}
            </Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
