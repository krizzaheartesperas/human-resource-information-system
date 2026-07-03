"use client";

import { memo } from "react";
import { Button } from "@/components/ui/button";

interface PaginationControlsProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  startIndex: number;
  endIndex: number;
  canGoNext: boolean;
  canGoPrev: boolean;
  onPageChange: (page: number) => void;
  onNext: () => void;
  onPrev: () => void;
  itemLabel?: string;
}

export const PaginationControls = memo(function PaginationControls({
  currentPage,
  totalPages,
  totalItems,
  startIndex,
  endIndex,
  canGoNext,
  canGoPrev,
  onPageChange,
  onNext,
  onPrev,
  itemLabel = "items",
}: PaginationControlsProps) {
  if (totalPages <= 1) return null;

  const pageNumbers: number[] = [];
  if (totalPages <= 5) {
    for (let i = 1; i <= totalPages; i++) pageNumbers.push(i);
  } else if (currentPage <= 3) {
    for (let i = 1; i <= 5; i++) pageNumbers.push(i);
  } else if (currentPage >= totalPages - 2) {
    for (let i = totalPages - 4; i <= totalPages; i++) pageNumbers.push(i);
  } else {
    for (let i = currentPage - 2; i <= currentPage + 2; i++) pageNumbers.push(i);
  }

  return (
    <div className="flex items-center justify-between px-2 py-3">
      <p className="text-sm text-muted-foreground">
        Showing {startIndex}–{endIndex} of {totalItems} {itemLabel}
      </p>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          disabled={!canGoPrev}
          onClick={onPrev}
        >
          Previous
        </Button>
        {pageNumbers.map((pageNum) => (
          <Button
            key={pageNum}
            variant={pageNum === currentPage ? "default" : "outline"}
            size="sm"
            className="min-w-[36px]"
            onClick={() => onPageChange(pageNum)}
          >
            {pageNum}
          </Button>
        ))}
        <Button
          variant="outline"
          size="sm"
          disabled={!canGoNext}
          onClick={onNext}
        >
          Next
        </Button>
      </div>
    </div>
  );
});
