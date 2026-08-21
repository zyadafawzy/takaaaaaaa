import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("animate-pulse rounded-md bg-primary/5 backdrop-blur-[2px]", className)} {...props} />;
}

export { Skeleton };
