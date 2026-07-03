import { TableCell, TableRow } from "@/components/ui/table";

export function TableSkeletonRows({
  columns,
  rows = 1,
  prefix = "sk",
  cellClassName,
}: {
  columns: number;
  rows?: number;
  prefix?: string;
  cellClassName?: string;
}) {
  return (
    <>
      {Array.from({ length: rows }).map((_, ri) => (
        <TableRow key={`${prefix}-${ri}`}>
          <TableCell colSpan={Math.max(columns, 1)} className={cellClassName}>
            <div className="py-2 text-sm text-muted-foreground">Loading...</div>
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}
