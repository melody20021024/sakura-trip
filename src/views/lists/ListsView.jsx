import { Utensils, ShoppingBag, Luggage } from "lucide-react";
import { PACKING_TEMPLATE } from "../../lib/schema.js";
import { ChecklistCard } from "./ChecklistCard.jsx";

// P-03. 美食 / 待購 (F-30 carried over) + 打包 (F-31 new).
export function ListsView({ trip, confirm }) {
  return (
    <div className="space-y-4">
      <ChecklistCard trip={trip} confirm={confirm} field="food" variant="food"
        title="美食清單" icon={Utensils} placeholder="想吃的,例:一蘭拉麵" sub="地點/店名 (用於地圖)" />
      <ChecklistCard trip={trip} confirm={confirm} field="shopping" variant="shopping" withPhoto
        title="待購物清單" icon={ShoppingBag} placeholder="想買的,例:白色戀人" sub="店家/品牌 (選填)" />
      <ChecklistCard trip={trip} confirm={confirm} field="packing" variant="packing"
        title="行前打包清單" icon={Luggage} placeholder="要帶的,例:護照" template={PACKING_TEMPLATE} />
    </div>
  );
}
