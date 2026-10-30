import {
  pizzaCombinationKey, isSamePizzaCombination, groupPizzaCombinationCartRows,
  getPizzaCombinationSourceItem,
} from "./pizzaCombinationCart.js";
import {
  coffeeAddonKey, isSameCoffeeAddon, groupCoffeeAddonCartRows, getCoffeeAddonSourceItem,
} from "./coffeeAddonCart.js";
import {
  chickenCombinationKey, isSameChickenCombination, groupChickenCombinationCartRows,
  getChickenCombinationSourceItem,
} from "./chickenCombinationCart.js";

export function orderCombinationKey(item) {
  return pizzaCombinationKey(item) || coffeeAddonKey(item) || chickenCombinationKey(item);
}

export function isSameOrderCombination(first, second) {
  return isSamePizzaCombination(first, second) || isSameCoffeeAddon(first, second)
    || isSameChickenCombination(first, second);
}

export function groupOrderCombinationCartRows(items = []) {
  return groupChickenCombinationCartRows(groupCoffeeAddonCartRows(groupPizzaCombinationCartRows(items)));
}

export function getOrderCombinationSourceItem(item) {
  if (item?._isChickenCombination) return getChickenCombinationSourceItem(item);
  return item?._isCoffeeAddon ? getCoffeeAddonSourceItem(item) : getPizzaCombinationSourceItem(item);
}

export function isGroupedOrderItem(item) {
  return Boolean(item?._isPizzaCombination || item?._isCoffeeAddon || item?._isChickenCombination);
}
