"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useCurrentUser } from "@/lib/CurrentUserContext";
import { getPortalPaths } from "@/core/routes/portal-routes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from "recharts";
import {
  getHeadcountByDepartment,
  getWorkflowRequestsByStatus,
  getEmploymentTypeDistribution,
  getPayrollSummary,
  getLeaveRequestsTrend,
  getWorkflowRequestsTrend,
} from "@/features/dashboard/services/analytics";
import { cn } from "@/lib/utils";
import { DASHBOARD_CARD_DARK_TW } from "@/features/dashboard/dashboard-card-styles";

const CHART_CARD_CLASS = cn("rounded-3xl", DASHBOARD_CARD_DARK_TW);

/* Explicit colors for Recharts SVG (CSS vars may not resolve in SVG)
   Company palette:
   - Gargoyle Gas (#FFE14E) – primary chart accent
   - Space Cadet (#192853) – navy
   - Supporting blues/yellows for variety
*/
const CHART_COLORS = [
  "#FFF7B0", // very light yellow
  "#FFE14E", // primary yellow
  "#FACC15", // mid yellow
  "#EAB308", // deep amber
  "#38BDF8", // sky blue (contrast slice)
  "#192853", // space cadet navy (small darkest slice)
];

const PRIMARY_CHART_YELLOW = "#FFE14E";

export function HeadcountByDepartmentChart() {
  const data = getHeadcountByDepartment();
  return (
    <Card className={CHART_CARD_CLASS}>
      <CardHeader>
        <CardTitle className="text-base">Headcount by Department</CardTitle>
        <p className="text-sm text-muted-foreground">
          Employee distribution across departments
        </p>
      </CardHeader>
      <CardContent>
        <div className="h-[220px] w-full">
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={10}>
            <BarChart data={data} margin={{ left: 8, right: 8, top: 8, bottom: 4 }}>
              <defs>
                <linearGradient id="headcountBar" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={PRIMARY_CHART_YELLOW} stopOpacity={0.95} />
                  <stop offset="100%" stopColor={PRIMARY_CHART_YELLOW} stopOpacity={0.25} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#1f2937"
                opacity={0.5}
                vertical={false}
              />
              <XAxis
                dataKey="name"
                tick={{ fill: "#9ca3af", fontSize: 12 }}
                stroke="#4b5563"
              />
              <YAxis
                tick={{ fill: "#6b7280", fontSize: 11 }}
                stroke="#4b5563"
              />
              <Tooltip
                cursor={{ fill: "transparent" }}
                contentStyle={{
                  backgroundColor: "#020617",
                  border: "1px solid #1f2937",
                  borderRadius: "10px",
                  color: "#e5e7eb",
                }}
                formatter={(value, _name, item) => {
                  const payload = item?.payload as { fullName?: string } | undefined;
                  return [Number(value ?? 0), payload?.fullName ?? ""] as const;
                }}
              />
              <Bar
                dataKey="count"
                maxBarSize={40}
                radius={[9999, 9999, 9999, 9999]}
                fill="url(#headcountBar)"
                isAnimationActive
                animationDuration={700}
                animationEasing="ease-out"
                activeBar={{ fill: "url(#headcountBar)" }}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

export function WorkflowRequestsByStatusChart() {
  const data = getWorkflowRequestsByStatus();
  if (data.length === 0) {
    return (
      <Card className={CHART_CARD_CLASS}>
        <CardHeader>
          <CardTitle className="text-base">Workflow Requests by Status</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground py-8 text-center">
            No workflow requests yet
          </p>
        </CardContent>
      </Card>
    );
  }
  return (
    <Card className={CHART_CARD_CLASS}>
      <CardHeader>
        <CardTitle className="text-base">Workflow Requests by Status</CardTitle>
        <p className="text-sm text-muted-foreground">
          Pending, approved, rejected, etc.
        </p>
      </CardHeader>
      <CardContent>
        {(() => {
          const total = data.reduce((sum, d) => sum + d.value, 0);
          return (
            <div className="flex w-full flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              {/* Donut chart – responsive via percentage radii */}
              <div className="relative h-44 w-full sm:h-52 xl:flex-1 xl:min-w-[180px]">
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={10}>
                  <PieChart>
                    <Pie
                      data={data}
                      cx="50%"
                      cy="50%"
                      innerRadius="55%"
                      outerRadius="80%"
                      cornerRadius={12}
                      paddingAngle={2}
                      dataKey="value"
                      nameKey="name"
                    >
                      {data.map((entry, index) => (
                        <Cell
                          key={entry.name}
                          fill={CHART_COLORS[index % CHART_COLORS.length]}
                          stroke="none"
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#020617",
                        border: "1px solid #1f2937",
                        borderRadius: "10px",
                      }}
                      labelStyle={{ color: "#e5e7eb" }}
                      itemStyle={{ color: "#e5e7eb" }}
                      formatter={(value, name) => [
                        Number(value ?? 0),
                        String(name ?? "").replace(/_/g, " "),
                      ]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                {/* Center label */}
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      Total
                    </p>
                    <p className="text-sm font-semibold text-foreground">{total}</p>
                    <p className="text-[11px] text-muted-foreground">requests</p>
                  </div>
                </div>
              </div>
              {/* Legend */}
              <div className="flex-1 space-y-2">
                {data.map((item, index) => {
                  const percent =
                    total > 0 ? Math.round((item.value / total) * 100) : 0;
                  const color = CHART_COLORS[index % CHART_COLORS.length];
                  return (
                    <div
                      key={item.name}
                      className="group flex items-center justify-between rounded-md bg-secondary/40 px-3 py-2 text-xs transition-colors hover:bg-secondary/70"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: color }}
                        />
                        <span className="text-[13px] text-foreground group-hover:text-white">
                          {item.name.replace(/_/g, " ")}
                        </span>
                      </div>
                      <div className="text-right">
                        <p className="text-[11px] text-muted-foreground group-hover:text-white/80">
                          {percent}%
                        </p>
                        <p className="text-[11px] text-muted-foreground group-hover:text-white/80">
                          {item.value} req
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}
      </CardContent>
    </Card>
  );
}

export function EmploymentTypeChart() {
  const data = getEmploymentTypeDistribution();
  return (
    <Card className={CHART_CARD_CLASS}>
      <CardHeader>
        <CardTitle className="text-base">Employment Type</CardTitle>
        <p className="text-sm text-muted-foreground">
          Full-time, part-time, contract, etc.
        </p>
      </CardHeader>
      <CardContent>
        {(() => {
          const total = data.reduce((sum, d) => sum + d.value, 0);
          return (
            <div className="flex h-[220px] w-full flex-col gap-4 md:flex-row md:items-center">
              <div className="relative flex-1 h-full min-w-[140px]">
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={10}>
                  <PieChart>
                    <Pie
                      data={data}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={85}
                      cornerRadius={12}
                      paddingAngle={2}
                      dataKey="value"
                      nameKey="name"
                    >
                      {data.map((entry, index) => (
                        <Cell
                          key={entry.name}
                          fill={CHART_COLORS[index % CHART_COLORS.length]}
                          stroke="none"
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#020617",
                        border: "1px solid #1f2937",
                        borderRadius: "10px",
                      }}
                      labelStyle={{ color: "#e5e7eb" }}
                      itemStyle={{ color: "#e5e7eb" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      Total
                    </p>
                    <p className="text-sm font-semibold text-foreground">{total}</p>
                    <p className="text-[11px] text-muted-foreground">employees</p>
                  </div>
                </div>
              </div>
              {/* Legend – only show on large screens so small/mid screens focus on the pie graph */}
              <div className="hidden lg:block flex-1 min-w-[180px] space-y-2">
                {data.map((item, index) => {
                  const percent =
                    total > 0 ? Math.round((item.value / total) * 100) : 0;
                  const color = CHART_COLORS[index % CHART_COLORS.length];
                  return (
                    <div
                      key={item.name}
                      className="group flex items-center justify-between rounded-md bg-secondary/40 px-3 py-2 text-xs transition-colors hover:bg-secondary/70"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: color }}
                        />
                        <span className="text-[13px] text-foreground group-hover:text-white">
                          {item.name}
                        </span>
                      </div>
                      <div className="text-right">
                        <p className="text-[11px] text-muted-foreground group-hover:text-white/80">
                          {percent}%
                        </p>
                        <p className="text-[11px] text-muted-foreground group-hover:text-white/80">
                          {item.value} emp
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}
      </CardContent>
    </Card>
  );
}

function formatCurrencyPHP(value: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function PayrollAnalyticsCard() {
  const { user } = useCurrentUser();
  const paths = useMemo(() => getPortalPaths(user.role), [user.role]);
  const { totalPayroll, employeesPaid, pendingAdjustments } = getPayrollSummary();

  return (
    <Card className={cn("flex h-full flex-col rounded-3xl", DASHBOARD_CARD_DARK_TW)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">Payroll</CardTitle>
        <p className="text-sm text-muted-foreground">
          Current month summary
        </p>
      </CardHeader>
      <CardContent className="flex-1 space-y-4 overflow-hidden text-[11px] sm:text-xs md:text-sm">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between rounded-lg border border-border bg-[#FFE14E]/20 px-3 py-2.5">
            <span className="text-muted-foreground">Total payroll</span>
            <span className="font-semibold text-foreground">
              {formatCurrencyPHP(totalPayroll)}
            </span>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border bg-[#FFE14E]/20 px-3 py-2.5">
            <span className="text-muted-foreground">Employees paid</span>
            <span className="font-medium text-foreground">{employeesPaid}</span>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border bg-[#FFE14E]/20 px-3 py-2.5">
            <span className="text-muted-foreground">Pending adjustments</span>
            <span className="font-medium text-foreground">{pendingAdjustments}</span>
          </div>
        </div>
        <Link
          href={paths.requests}
          className="block w-full text-center text-sm font-medium text-primary hover:underline"
        >
          Payroll reports →
        </Link>
      </CardContent>
    </Card>
  );
}

export function LeaveRequestsTrendChart() {
  const data = getLeaveRequestsTrend();
  return (
    <Card className={CHART_CARD_CLASS}>
      <CardHeader>
        <CardTitle className="text-base">Leave Requests Trend</CardTitle>
        <p className="text-sm text-muted-foreground">
          Monthly leave requests (last 6 months)
        </p>
      </CardHeader>
      <CardContent>
        <div className="h-[220px] w-full">
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={10}>
            <AreaChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
              <defs>
                <linearGradient id="leaveGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={PRIMARY_CHART_YELLOW} stopOpacity={0.5} />
                  <stop offset="100%" stopColor={PRIMARY_CHART_YELLOW} stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#1f2937"
                opacity={0.5}
                horizontal
                vertical={false}
              />
              <XAxis
                dataKey="month"
                tick={{ fill: "#9ca3af", fontSize: 12 }}
                stroke="#4b5563"
              />
              <YAxis
                tick={{ fill: "#6b7280", fontSize: 11 }}
                stroke="#4b5563"
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1e293b",
                  border: "1px solid #334155",
                  borderRadius: "8px",
                  color: "#f8fafc",
                }}
                cursor={{ stroke: "#4b5563", strokeWidth: 1, strokeDasharray: "4 4" }}
                formatter={(value) => [Number(value ?? 0), "Requests"]}
              />
              <Area
                type="monotone"
                dataKey="requests"
                stroke={PRIMARY_CHART_YELLOW}
                strokeWidth={2.5}
                dot={{
                  r: 3,
                  stroke: "#e5e7eb",
                  strokeWidth: 1,
                  fill: PRIMARY_CHART_YELLOW,
                }}
                activeDot={{
                  r: 6,
                  stroke: "#e5e7eb",
                  strokeWidth: 2,
                  fill: PRIMARY_CHART_YELLOW,
                }}
                isAnimationActive
                animationDuration={800}
                animationEasing="ease-out"
                fill="url(#leaveGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

export function WorkflowRequestsTrendChart() {
  const data = getWorkflowRequestsTrend();
  return (
    <Card className={CHART_CARD_CLASS}>
      <CardHeader>
        <CardTitle className="text-base">Workflow Requests Trend</CardTitle>
        <p className="text-sm text-muted-foreground">
          Monthly workflow requests (last 6 months)
        </p>
      </CardHeader>
      <CardContent>
        <div className="h-[220px] w-full">
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={10}>
            <AreaChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
              <defs>
                <linearGradient id="workflowGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={PRIMARY_CHART_YELLOW} stopOpacity={0.5} />
                  <stop offset="100%" stopColor={PRIMARY_CHART_YELLOW} stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#1f2937"
                opacity={0.5}
                horizontal
                vertical={false}
              />
              <XAxis
                dataKey="month"
                tick={{ fill: "#9ca3af", fontSize: 12 }}
                stroke="#4b5563"
              />
              <YAxis
                tick={{ fill: "#6b7280", fontSize: 11 }}
                stroke="#4b5563"
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1e293b",
                  border: "1px solid #334155",
                  borderRadius: "8px",
                  color: "#f8fafc",
                }}
                cursor={{ stroke: "#4b5563", strokeWidth: 1, strokeDasharray: "4 4" }}
                formatter={(value) => [Number(value ?? 0), "Requests"]}
              />
              <Area
                type="monotone"
                dataKey="requests"
                stroke={PRIMARY_CHART_YELLOW}
                strokeWidth={2.5}
                dot={{
                  r: 3,
                  stroke: "#e5e7eb",
                  strokeWidth: 1,
                  fill: PRIMARY_CHART_YELLOW,
                }}
                activeDot={{
                  r: 6,
                  stroke: "#e5e7eb",
                  strokeWidth: 2,
                  fill: PRIMARY_CHART_YELLOW,
                }}
                isAnimationActive
                animationDuration={800}
                animationEasing="ease-out"
                fill="url(#workflowGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
