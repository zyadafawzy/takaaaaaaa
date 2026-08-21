import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { DeliveryZone } from "@/domain/types";
import { catalogRepository } from "@/services/catalog-repository";
import { readJson, writeJson } from "./session";

const ZONE_KEY_BASE = "zone";

type ZoneContextValue = {
  zones: DeliveryZone[];
  zone: DeliveryZone | null;
  setZoneId: (id: string) => void;
  loading: boolean;
};

const ZoneContext = createContext<ZoneContextValue>({
  zones: [],
  zone: null,
  setZoneId: () => {},
  loading: true,
});

export function ZoneProvider({
  children,
  zones: providedZones,
  scope = "tikka",
}: {
  children: ReactNode;
  zones?: DeliveryZone[];
  scope?: string;
}) {
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [zoneId, setZoneIdState] = useState<string>("");
  const [loading, setLoading] = useState(true);

  const zoneKey = `${scope}.${ZONE_KEY_BASE}`;

  useEffect(() => {
    if (providedZones) {
      setZones(providedZones);
      setZoneIdState(readJson<string>(zoneKey, ""));
      setLoading(false);
      return;
    }
    let alive = true;
    catalogRepository
      .listZones()
      .then((list) => {
        if (!alive) return;
        setZones(list);
        setZoneIdState(readJson<string>(zoneKey, ""));
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [providedZones, zoneKey]);

  const value = useMemo<ZoneContextValue>(
    () => ({
      zones,
      zone: zones.find((z) => z.id === zoneId) ?? null,
      loading,
      setZoneId: (id: string) => {
        setZoneIdState(id);
        writeJson(zoneKey, id);
      },
    }),
    [zones, zoneId, loading, zoneKey],
  );

  return <ZoneContext.Provider value={value}>{children}</ZoneContext.Provider>;
}

export function useZone() {
  return useContext(ZoneContext);
}
