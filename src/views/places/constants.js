// Re-export only. The pocket and the itinerary must render the same place with
// the same colour block and the same icon — visually it is "the same thing moved
// across", not "copied into a different kind of thing" (DDR-16). Any local
// palette here would break that equality, so there is nothing else in this file.
export { ITEM_TYPES, typeOf } from "../trip/constants.js";
