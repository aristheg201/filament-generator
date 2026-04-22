import { SAFE_ITEM_BACKINGS, VANILLA_ITEMS } from '../constants.js';

export function isValidVanillaItem(id: string): boolean {
  return VANILLA_ITEMS.has(id);
}

export function isSuspiciousVanillaBacking(id: string): boolean {
  return !SAFE_ITEM_BACKINGS.has(id);
}
