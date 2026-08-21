import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Megaphone, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  storeAdminAnnouncements,
  storeAdminDeleteAnnouncement,
  storeAdminSaveAnnouncement,
} from "@/lib/store-admin.functions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/s/$storeSlug/admin/announcements")({
  component: StoreAdminAnnouncements,
});

function StoreAdminAnnouncements() {
  const { storeSlug } = Route.useParams();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["store-admin", storeSlug, "announcements"],
    queryFn: () => storeAdminAnnouncements({ data: { storeSlug } }),
    retry: false,
  });
  const [content, setContent] = useState("");

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["store-admin", storeSlug, "announcements"] });

  const save = useMutation({
    mutationFn: (input: { id?: string; content: string; active: boolean }) =>
      storeAdminSaveAnnouncement({ data: { storeSlug, ...input } }),
    onSuccess: async () => {
      setContent("");
      await invalidate();
      toast.success("تم الحفظ");
    },
    onError: () => toast.error("مقدرناش نحفظ الإعلان"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => storeAdminDeleteAnnouncement({ data: { storeSlug, id } }),
    onSuccess: async () => {
      await invalidate();
      toast.success("تم الحذف");
    },
    onError: () => toast.error("مقدرناش نحذف الإعلان"),
  });

  if (query.isLoading) return <Skeleton className="h-72 w-full rounded-2xl" />;
  if (query.isError) return <p className="text-sm text-destructive">مفيش صلاحية للإعلانات.</p>;

  const announcements = query.data?.announcements ?? [];

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="flex items-center gap-2 text-lg font-extrabold">
          <Megaphone className="size-5" /> إعلان جديد
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          الإعلان النشط بيظهر في شريط أعلى صفحة المتجر.
        </p>
        <form
          className="mt-4 space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (content.trim().length < 2) return;
            save.mutate({ content: content.trim(), active: true });
          }}
        >
          <div>
            <Label htmlFor="announcement-content">نص الإعلان</Label>
            <Textarea
              id="announcement-content"
              value={content}
              maxLength={300}
              onChange={(event) => setContent(event.target.value)}
              className="mt-1"
              rows={3}
            />
          </div>
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? "بنحفظ..." : "نشر الإعلان"}
          </Button>
        </form>
      </section>

      <section className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="text-lg font-extrabold">الإعلانات ({announcements.length})</h2>
        <div className="mt-4 space-y-3">
          {announcements.length === 0 ? (
            <p className="text-sm text-muted-foreground">مفيش إعلانات.</p>
          ) : null}
          {announcements.map((item) => (
            <div
              key={item.id}
              className="flex flex-wrap items-center gap-3 rounded-xl border border-border p-3"
            >
              <p className="min-w-48 flex-1 text-sm">{item.content}</p>
              <div className="flex items-center gap-2">
                <Switch
                  checked={item.active}
                  onCheckedChange={(checked) =>
                    save.mutate({ id: item.id, content: item.content, active: checked })
                  }
                />
                <span className="text-sm text-muted-foreground">
                  {item.active ? "ظاهر" : "متوقف"}
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="text-destructive"
                onClick={() => remove.mutate(item.id)}
                aria-label="حذف الإعلان"
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
