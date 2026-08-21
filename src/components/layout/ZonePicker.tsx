import { MapPin } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useZone } from "@/lib/zone";

export function ZonePicker({ className }: { className?: string }) {
  const { zones, zone, setZoneId, loading } = useZone();

  return (
    <div className={className}>
      <Select value={zone?.id ?? ""} onValueChange={setZoneId} disabled={loading}>
        <SelectTrigger className="h-9 gap-2 text-xs" aria-label="اختار منطقة التوصيل">
          <MapPin className="size-4 text-primary" aria-hidden />
          <SelectValue placeholder="اختار منطقتك (اختياري)" />
        </SelectTrigger>
        <SelectContent>
          {zones.map((z) => (
            <SelectItem key={z.id} value={z.id} disabled={!z.available}>
              {z.governorate} — {z.name}
              {z.available ? "" : " (مش متاح دلوقتي)"}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
