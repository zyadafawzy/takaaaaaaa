import type { ReactNode } from "react";
import { Breadcrumbs } from "./Breadcrumbs";

export function StaticPage({
  title,
  intro,
  children,
}: {
  title: string;
  intro: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-2xl px-3 py-6 md:px-6">
      <Breadcrumbs items={[{ label: title }]} />
      <h1 className="mb-2 text-2xl font-extrabold">{title}</h1>
      <p className="mb-6 text-sm text-muted-foreground">{intro}</p>
      <div className="space-y-4 text-sm leading-7">{children}</div>
    </div>
  );
}
