import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

export function ProductGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="rounded-3xl border border-white/[0.03] bg-card p-3 shadow-soft">
          <Skeleton className="mb-3 aspect-square w-full rounded-2xl bg-muted/20" />
          <Skeleton className="mb-2 h-4 w-3/4 rounded-md bg-muted/20" />
          <Skeleton className="h-4 w-1/2 rounded-md bg-muted/20" />
        </div>
      ))}

    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-surface p-8 text-center">
      <p className="text-base font-semibold">{title}</p>
      <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">{description}</p>
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function ErrorState({ onRetry }: { onRetry?: () => void }) {
  return (
    <div className="rounded-xl border border-destructive/30 bg-surface p-8 text-center">
      <p className="text-base font-semibold">حصلت مشكلة وإحنا بنحمّل البيانات</p>
      <p className="mt-2 text-sm text-muted-foreground">جرّب تاني بعد ثانية، ولو فضلت المشكلة كلمنا.</p>
      {onRetry ? (
        <Button className="mt-4" onClick={onRetry}>
          جرّب تاني
        </Button>
      ) : null}
    </div>
  );
}
