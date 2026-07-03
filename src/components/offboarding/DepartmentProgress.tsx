import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

export type DepartmentProgressItem = {
  department: string;
  completed: number;
  total: number;
};

type DepartmentProgressProps = {
  items: DepartmentProgressItem[];
};

export function DepartmentProgress({ items }: DepartmentProgressProps) {
  return (
    <Card className="rounded-2xl border-amber-200/70 shadow-sm dark:border-amber-500/30">
      <CardHeader>
        <CardTitle className="text-lg">Department Progress</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {items.map((item) => {
          const percent = item.total > 0 ? Math.round((item.completed / item.total) * 100) : 0;
          return (
            <div key={item.department} className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <p className="font-medium text-foreground">{item.department} Tasks</p>
                <p className="text-muted-foreground">
                  {item.completed}/{item.total} Completed
                </p>
              </div>
              <Progress value={percent} className="h-2" />
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
