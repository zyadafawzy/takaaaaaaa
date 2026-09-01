import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";

import {
  storeAdminAddMember,
  storeAdminRemoveMember,
  storeAdminTeam,
  storeAdminUpdateMember,
} from "@/lib/store-admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/s/$storeSlug/admin/team")({
  component: StoreAdminTeam,
});

const tierLabels: Record<string, string> = {
  owner: "صاحب المتجر — كل الصلاحيات",
  manager: "مشرف / مدير فرع — بيع ومخزون وتقارير",
  cashier: "كاشير — شاشة البيع بس",
};

function StoreAdminTeam() {
  const { storeSlug } = Route.useParams();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["store-admin", storeSlug, "team"],
    queryFn: () => storeAdminTeam({ data: { storeSlug } }),
    retry: false,
  });

  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [tier, setTier] = useState<"owner" | "manager" | "cashier">("cashier");

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["store-admin", storeSlug, "team"] });

  const addMember = useMutation({
    mutationFn: () =>
      storeAdminAddMember({
        data: {
          storeSlug,
          username: username.trim().toLowerCase(),
          fullName: fullName.trim(),
          tier,
          password: password.trim(),
        },
      }),
    onSuccess: async () => {
      setUsername("");
      setFullName("");
      setPassword("");
      await invalidate();
      toast.success("تم إضافة العضو للفريق");
    },
    onError: (error: Error) => {
      if (error.message.includes("FORBIDDEN")) toast.error("صاحب المتجر بس اللي يقدر يدير الفريق");
      else toast.error("مقدرناش نضيف العضو");
    },
  });

  const updateMember = useMutation({
    mutationFn: (input: { id: string; tier?: "owner" | "manager" | "cashier"; active?: boolean }) =>
      storeAdminUpdateMember({ data: { storeSlug, ...input } }),
    onSuccess: async () => {
      await invalidate();
      toast.success("تم التحديث");
    },
    onError: () => toast.error("مقدرناش نحدّث العضو"),
  });

  const removeMember = useMutation({
    mutationFn: (id: string) => storeAdminRemoveMember({ data: { storeSlug, id } }),
    onSuccess: async () => {
      await invalidate();
      toast.success("تم حذف العضو");
    },
    onError: () => toast.error("مقدرناش نحذف العضو"),
  });

  if (query.isLoading) return <Skeleton className="h-72 w-full rounded-2xl" />;
  if (query.isError)
    return <p className="text-sm text-destructive">مفيش صلاحية لعرض فريق المتجر.</p>;

  const members = query.data?.members ?? [];

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="flex items-center gap-2 text-lg font-extrabold">
          <UserPlus className="size-5" /> إضافة عضو للفريق
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          أنشئ حساب دخول مستقل وحدد دوره. اسم المستخدم بيشتغل داخل المتجر ده فقط.
        </p>
        <form
          className="mt-4 grid gap-3 md:grid-cols-5"
          onSubmit={(event) => {
            event.preventDefault();
            addMember.mutate();
          }}
        >
          <div className="md:col-span-2">
            <Label htmlFor="member-username">اسم المستخدم</Label>
            <Input
              id="member-username"
              dir="ltr"
              pattern="[a-z0-9][a-z0-9_-]{2,31}"
              placeholder="مثال: cashier1"
              required
              value={username}
              onChange={(event) => setUsername(event.target.value.toLowerCase())}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="member-name">الاسم</Label>
            <Input
              id="member-name"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="member-password">كلمة مرور مبدئية</Label>
            <Input
              id="member-password"
              type="password"
              dir="ltr"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-1"
              minLength={8}
              required
            />
          </div>
          <div>
            <Label>الصلاحية</Label>
            <Select value={tier} onValueChange={(value) => setTier(value as typeof tier)}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                  <SelectItem value="cashier">كاشير — البيع فقط</SelectItem>
                  <SelectItem value="manager">مدير فرع — التشغيل والمخزون</SelectItem>
                  <SelectItem value="owner">صاحب متجر — كل الصلاحيات</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-5">
            <Button type="submit" disabled={addMember.isPending}>
              {addMember.isPending ? "بنضيف..." : "إضافة"}
            </Button>
          </div>
        </form>
      </section>

      <section className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="text-lg font-extrabold">الفريق الحالي ({members.length})</h2>
        <div className="mt-4 space-y-3">
          {members.length === 0 ? (
            <p className="text-sm text-muted-foreground">مفيش أعضاء لسه.</p>
          ) : null}
          {members.map((member) => (
            <div
              key={member.id}
              className="flex flex-wrap items-center gap-3 rounded-xl border border-border p-3"
            >
              <div className="min-w-40">
                <p className="font-bold">{member.full_name || member.username}</p>
                <p className="text-xs text-muted-foreground" dir="ltr">
                  @{member.username}
                </p>
              </div>
              <Select
                value={member.tier}
                onValueChange={(value) =>
                  updateMember.mutate({
                    id: member.id,
                    tier: value as "owner" | "manager" | "cashier",
                  })
                }
              >
                <SelectTrigger className="w-56">
                  <SelectValue>{tierLabels[member.tier] ?? member.tier}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cashier">كاشير — البيع فقط</SelectItem>
                  <SelectItem value="manager">مدير فرع — التشغيل والمخزون</SelectItem>
                  <SelectItem value="owner">صاحب متجر — كل الصلاحيات</SelectItem>
                </SelectContent>

              </Select>
              <div className="flex items-center gap-2">
                <Switch
                  checked={member.active}
                  onCheckedChange={(checked) =>
                    updateMember.mutate({ id: member.id, active: checked })
                  }
                />
                <span className="text-sm text-muted-foreground">
                  {member.active ? "نشط" : "موقوف"}
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="ms-auto text-destructive"
                onClick={() => removeMember.mutate(member.id)}
                aria-label="حذف العضو"
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
