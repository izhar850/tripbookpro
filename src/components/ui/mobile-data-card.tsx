import * as React from "react"

import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"

const MobileDataCards = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("space-y-3 md:hidden", className)} {...props} />
))
MobileDataCards.displayName = "MobileDataCards"

type MobileDataCardProps = React.HTMLAttributes<HTMLDivElement> & {
  title: React.ReactNode
  subtitle?: React.ReactNode
  badge?: React.ReactNode
  headerRight?: React.ReactNode
  actions?: React.ReactNode
  contentClassName?: string
  titleClassName?: string
  actionsClassName?: string
}

const MobileDataCard = React.forwardRef<HTMLDivElement, MobileDataCardProps>(
  (
    {
      title,
      subtitle,
      badge,
      headerRight,
      actions,
      className,
      children,
      contentClassName,
      titleClassName,
      actionsClassName,
      ...props
    },
    ref
  ) => (
    <Card ref={ref} className={cn("border-border/50 bg-card shadow-sm", className)} {...props}>
      <div className="flex flex-col gap-4 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className={cn("break-words text-base font-bold text-foreground", titleClassName)}>
              {title}
            </div>
            {subtitle ? <div className="mt-1 text-xs text-muted-foreground">{subtitle}</div> : null}
          </div>
          {badge || headerRight ? (
            <div className="flex shrink-0 flex-col items-end gap-2">
              {badge}
              {headerRight}
            </div>
          ) : null}
        </div>

        <div className={cn("grid gap-3 sm:grid-cols-2", contentClassName)}>{children}</div>

        {actions ? (
          <div className={cn("flex flex-wrap gap-2 border-t border-border/50 pt-3", actionsClassName)}>
            {actions}
          </div>
        ) : null}
      </div>
    </Card>
  )
)
MobileDataCard.displayName = "MobileDataCard"

type MobileDataFieldProps = React.HTMLAttributes<HTMLDivElement> & {
  label: React.ReactNode
  value?: React.ReactNode
  valueClassName?: string
  emptyText?: string
}

const MobileDataField = React.forwardRef<HTMLDivElement, MobileDataFieldProps>(
  ({ label, value, className, valueClassName, emptyText = "N/A", ...props }, ref) => (
    <div ref={ref} className={cn("min-w-0", className)} {...props}>
      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </p>
      <div className={cn("mt-1 break-words text-sm font-medium text-foreground", valueClassName)}>
        {value || emptyText}
      </div>
    </div>
  )
)
MobileDataField.displayName = "MobileDataField"

export { MobileDataCard, MobileDataCards, MobileDataField }
