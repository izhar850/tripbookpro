"use client"

import * as React from "react"
import { ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react"

import { cn } from "@/lib/utils"
import { TableHead } from "@/components/ui/table"
import type { SortDirection } from "@/lib/transport-utils"

type SortableTableHeadProps = React.ThHTMLAttributes<HTMLTableCellElement> & {
  active?: boolean
  direction?: SortDirection
  onSort: () => void
  align?: "left" | "center" | "right"
}

export function SortableTableHead({
  active,
  direction = "asc",
  onSort,
  align = "left",
  className,
  children,
  ...props
}: SortableTableHeadProps) {
  const Icon = active ? (direction === "asc" ? ChevronUp : ChevronDown) : ChevronsUpDown

  return (
    <TableHead className={className} {...props}>
      <button
        type="button"
        onClick={onSort}
        className={cn(
          "inline-flex w-full items-center gap-1 text-xs font-bold text-muted-foreground transition-colors hover:text-foreground",
          align === "right" && "justify-end",
          align === "center" && "justify-center"
        )}
      >
        <span>{children}</span>
        <Icon className="h-3.5 w-3.5 shrink-0" />
      </button>
    </TableHead>
  )
}
