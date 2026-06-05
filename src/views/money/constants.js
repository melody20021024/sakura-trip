import { Utensils, BedDouble, Train, ShoppingBag, Ticket, MoreHorizontal } from "lucide-react";

// Expense categories (F-22). Bar colours align with itinerary type colours.
export const CATEGORIES = [
  { v: "eat", label: "吃", icon: Utensils, bar: "bg-amber-400", chip: "bg-amber-100 text-amber-600" },
  { v: "stay", label: "住宿", icon: BedDouble, bar: "bg-rose-300", chip: "bg-rose-100 text-rose-600" },
  { v: "transport", label: "交通", icon: Train, bar: "bg-sky-400", chip: "bg-sky-100 text-sky-600" },
  { v: "shopping", label: "購物", icon: ShoppingBag, bar: "bg-pink-400", chip: "bg-pink-100 text-pink-600" },
  { v: "ticket", label: "門票", icon: Ticket, bar: "bg-purple-400", chip: "bg-purple-100 text-purple-600" },
  { v: "other", label: "其他", icon: MoreHorizontal, bar: "bg-gray-400", chip: "bg-gray-100 text-gray-500" },
];

export const catOf = (v) => CATEGORIES.find((c) => c.v === v) || CATEGORIES[CATEGORIES.length - 1];
