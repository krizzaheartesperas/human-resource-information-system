"use client";

import { useState } from "react";
import { Info, Package, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type AssetStatus = "Pending" | "Returned";

export type EmployeeAsset = {
  id: string;
  name: string;
  assetTag?: string;
  status: AssetStatus;
  verifiedByAdmin?: boolean;
};

type AssetReturnProps = {
  initialAssets: EmployeeAsset[];
};

const statusStyles: Record<AssetStatus, string> = {
  Pending: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  Returned: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
};

export function AssetReturn({ initialAssets }: AssetReturnProps) {
  const [assets, setAssets] = useState<EmployeeAsset[]>(initialAssets);

  function markReturned(assetId: string) {
    setAssets((prev) =>
      prev.map((asset) =>
        asset.id === assetId ? { ...asset, status: "Returned" } : asset
      )
    );
  }

  return (
    <Card className="rounded-3xl border-border/50 shadow-sm dark:bg-[#161b30]">
      <CardHeader>
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2.5 text-lg font-bold">
            <Package className="size-5 text-[#FFE14E]" />
            Asset Return
          </CardTitle>
          <p className="text-xs font-medium text-muted-foreground">
            Mark your company assets as returned. Verification will be done by HR / IT / Admin.
          </p>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {assets.map((asset) => (
          <div
            key={asset.id}
            className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-background p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">{asset.name}</p>
              {asset.assetTag ? (
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Tag: {asset.assetTag}
                </p>
              ) : null}
              <div className="flex items-center gap-2 pt-0.5">
                <Badge className={cn("border-transparent", statusStyles[asset.status])}>
                  {asset.status === "Returned" ? "Marked as Returned" : asset.status}
                </Badge>
                {asset.status === "Returned" ? (
                  <span className="flex items-center gap-1 text-[10px] font-bold text-muted-foreground">
                    {asset.verifiedByAdmin ? (
                      <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                        <ShieldAlert className="size-3" />
                        Verified by Admin
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                        <ShieldAlert className="size-3" />
                        Awaiting Admin Verification
                      </span>
                    )}
                  </span>
                ) : null}
              </div>
            </div>

            <button
              type="button"
              onClick={() => markReturned(asset.id)}
              disabled={asset.status === "Returned"}
              className={cn(
                "inline-flex h-9 items-center justify-center rounded-xl px-4 text-xs font-bold transition-all",
                asset.status === "Returned"
                  ? "cursor-not-allowed bg-slate-100 text-slate-400 dark:bg-white/5 dark:text-slate-500"
                  : "bg-[#FFE14E] text-[#1B2447] shadow-sm hover:bg-[#F7D93C] active:scale-[0.98]"
              )}
            >
              {asset.status === "Returned" ? "Already Returned" : "Mark as Returned"}
            </button>
          </div>
        ))}

        {/* Verification disclaimer */}
        <div className="flex items-start gap-2.5 rounded-2xl border border-sky-200/50 bg-sky-50/50 px-4 py-3 dark:border-sky-500/20 dark:bg-sky-950/20">
          <Info className="mt-0.5 size-4 shrink-0 text-sky-600 dark:text-sky-400" />
          <p className="text-xs font-medium leading-relaxed text-sky-700 dark:text-sky-300">
            You can mark assets as returned, but final verification is handled by the responsible department
            (HR, IT, or Admin). Verification status will be updated once confirmed.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
