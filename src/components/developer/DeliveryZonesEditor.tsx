import { useState } from "react";
import { MapPin, Plus, Trash2 } from "lucide-react";

import { EGYPT_LOCATIONS, areasOf } from "@/lib/egypt-locations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type ZoneDraft = {
  name: string;
  governorate: string;
  fee: number;
  minimumOrder: number;
  freeDeliveryThreshold: number | null;
};

/** اختيار المحافظة ← مناطقها، مع رسوم توصيل لكل منطقة. */
export function DeliveryZonesEditor({
  zones,
  onChange,
}: {
  zones: ZoneDraft[];
  onChange: (next: ZoneDraft[]) => void;
}) {
  const [governorate, setGovernorate] = useState(EGYPT_LOCATIONS[0]!.name);
  const [fee, setFee] = useState(25);
  const [minimumOrder, setMinimumOrder] = useState(100);
  const [freeThreshold, setFreeThreshold] = useState<string>("");

  const areas = areasOf(governorate);
  const picked = new Set(zones.filter((z) => z.governorate === governorate).map((z) => z.name));

  const toggleArea = (area: string) => {
    if (picked.has(area)) {
      onChange(zones.filter((z) => !(z.governorate === governorate && z.name === area)));
      return;
    }
    onChange([
      ...zones,
      {
        name: area,
        governorate,
        fee,
        minimumOrder,
        freeDeliveryThreshold: freeThreshold.trim() === "" ? null : Number(freeThreshold),
      },
    ]);
  };

  const addAll = () => {
    const next = [...zones];
    areas.forEach((area) => {
      if (!next.some((z) => z.governorate === governorate && z.name === area)) {
        next.push({
          name: area,
          governorate,
          fee,
          minimumOrder,
          freeDeliveryThreshold: freeThreshold.trim() === "" ? null : Number(freeThreshold),
        });
      }
    });
    onChange(next);
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-4">
        <div className="space-y-1.5">
          <Label htmlFor="zone-gov">المحافظة</Label>
          <select
            id="zone-gov"
            value={governorate}
            onChange={(event) => setGovernorate(event.target.value)}
            className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
          >
            {EGYPT_LOCATIONS.map((item) => (
              <option key={item.name} value={item.name}>
                {item.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="zone-fee">رسوم التوصيل</Label>
          <Input
            id="zone-fee"
            type="number"
            min={0}
            value={fee}
            onChange={(event) => setFee(Number(event.target.value))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="zone-min">أقل طلب</Label>
          <Input
            id="zone-min"
            type="number"
            min={0}
            value={minimumOrder}
            onChange={(event) => setMinimumOrder(Number(event.target.value))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="zone-free">توصيل مجاني فوق</Label>
          <Input
            id="zone-free"
            type="number"
            min={0}
            placeholder="اختياري"
            value={freeThreshold}
            onChange={(event) => setFreeThreshold(event.target.value)}
          />
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-background p-3">
        <div className="mb-2 flex items-center gap-2 text-xs">
          <MapPin className="size-4 text-primary" />
          <span className="font-bold">مناطق {governorate}</span>
          <Button type="button" size="sm" variant="outline" className="ms-auto" onClick={addAll}>
            <Plus className="me-1 size-3.5" /> ضيف كل المناطق
          </Button>
        </div>
        <div className="flex max-h-56 flex-wrap gap-2 overflow-y-auto">
          {areas.map((area) => {
            const active = picked.has(area);
            return (
              <button
                key={area}
                type="button"
                onClick={() => toggleArea(area)}
                className={`rounded-full border px-3 py-1.5 text-xs font-bold transition-colors ${
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-surface hover:border-primary"
                }`}
              >
                {area}
              </button>
            );
          })}
        </div>
      </div>

      {zones.length > 0 ? (
        <div className="space-y-1.5 rounded-2xl border border-border bg-background p-3">
          <p className="text-xs font-bold text-muted-foreground">
            المناطق المختارة ({zones.length})
          </p>
          <ul className="max-h-52 space-y-1 overflow-y-auto text-xs">
            {zones.map((zone, index) => (
              <li
                key={`${zone.governorate}-${zone.name}`}
                className="flex items-center gap-2 rounded-xl bg-surface px-3 py-2"
              >
                <span className="font-bold">{zone.name}</span>
                <span className="text-muted-foreground">{zone.governorate}</span>
                <span className="ms-auto price">توصيل {zone.fee} — أقل طلب {zone.minimumOrder}</span>
                <button
                  type="button"
                  aria-label={`حذف ${zone.name}`}
                  onClick={() => onChange(zones.filter((_, i) => i !== index))}
                  className="text-destructive"
                >
                  <Trash2 className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
