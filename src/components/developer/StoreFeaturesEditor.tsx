import { STORE_FEATURES, STORE_PLANS, featuresForPlan, type StoreFeatureMap, type StorePlanId } from "@/lib/store-features";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

/** اختيار باقة المتجر وتفعيل/إيقاف كل إمكانية على حدة. */
export function StoreFeaturesEditor({
  plan,
  features,
  onPlanChange,
  onFeaturesChange,
}: {
  plan: StorePlanId;
  features: StoreFeatureMap;
  onPlanChange: (plan: StorePlanId) => void;
  onFeaturesChange: (features: StoreFeatureMap) => void;
}) {
  const enabledCount = STORE_FEATURES.filter((f) => features[f.key]).length;

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        {STORE_PLANS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              onPlanChange(item.id);
              onFeaturesChange(featuresForPlan(item.id));
            }}
            className={`rounded-2xl border p-4 text-start transition-all ${
              plan === item.id
                ? "border-primary bg-primary-soft shadow-lg"
                : "border-border bg-background hover:border-primary/50"
            }`}
          >
            <p className="text-sm font-black">{item.name}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">{item.tagline}</p>
            <p className="mt-2 text-[11px] font-bold text-primary">{item.features.length} إمكانية</p>
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 text-xs">
        <span className="rounded-full bg-primary-soft px-3 py-1 font-bold text-primary">
          مفعّل: {enabledCount} / {STORE_FEATURES.length}
        </span>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="ms-auto"
          onClick={() => onFeaturesChange(featuresForPlan("ultimate"))}
        >
          فعّل الكل
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() =>
            onFeaturesChange(
              Object.fromEntries(STORE_FEATURES.map((f) => [f.key, false])) as StoreFeatureMap,
            )
          }
        >
          اقفل الكل
        </Button>
      </div>

      <ul className="grid gap-2 sm:grid-cols-2">
        {STORE_FEATURES.map((feature) => (
          <li
            key={feature.key}
            className="flex items-center gap-3 rounded-2xl border border-border bg-background p-3"
          >
            <div className="min-w-0">
              <p className="text-sm font-bold">{feature.label}</p>
              <p className="text-[11px] text-muted-foreground">{feature.description}</p>
            </div>
            <div className="ms-auto">
              <Switch
                checked={features[feature.key] === true}
                onCheckedChange={(checked) =>
                  onFeaturesChange({ ...features, [feature.key]: checked })
                }
                aria-label={feature.label}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
