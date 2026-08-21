import {
  Apple,
  Croissant,
  Milk,
  Snowflake,
  CupSoda,
  Candy,
  ShoppingBasket,
  Tag,
  type LucideIcon,
} from "lucide-react";

const icons: Record<string, LucideIcon> = {
  fresh: Apple,
  bakery: Croissant,
  dairy: Milk,
  frozen: Snowflake,
  drinks: CupSoda,
  snacks: Candy,
  pantry: ShoppingBasket,
  offers: Tag,
};

export function CategoryIcon({ slug, className }: { slug: string; className?: string }) {
  const Icon = icons[slug] ?? ShoppingBasket;
  return <Icon className={className} aria-hidden />;
}
