import { MapPin, Utensils, ShoppingBag, Train, BedDouble, Sparkles } from "lucide-react";

// Itinerary item types (v1 palette). Icons live here, not in lib/schema.js.
export const ITEM_TYPES = [
  { v: "spot", label: "景點", icon: MapPin, c: "bg-purple-100 text-purple-600" },
  { v: "food", label: "美食", icon: Utensils, c: "bg-amber-100 text-amber-600" },
  { v: "shop", label: "購物", icon: ShoppingBag, c: "bg-pink-100 text-pink-600" },
  { v: "move", label: "交通", icon: Train, c: "bg-sky-100 text-sky-600" },
  { v: "stay", label: "住宿", icon: BedDouble, c: "bg-rose-100 text-rose-600" },
  { v: "other", label: "其他", icon: Sparkles, c: "bg-gray-100 text-gray-500" },
];

export const typeOf = (v) => ITEM_TYPES.find((t) => t.v === v) || ITEM_TYPES[0];
export const MAPPABLE = new Set(["spot", "food", "shop", "stay"]);
