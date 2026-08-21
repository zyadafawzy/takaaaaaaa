export function DemoBadge({ label = "بيانات تجريبية" }: { label?: string }) {
  return (
    <span className="inline-flex items-center rounded-full bg-demo px-2 py-0.5 text-[10px] font-semibold text-demo-foreground">
      {label}
    </span>
  );
}
