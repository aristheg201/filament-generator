import { SAFE_ARMOR_BACKINGS, SAFE_BLOCK_BACKINGS, SAFE_ITEM_BACKINGS, VANILLA_BLOCKS, VANILLA_ITEMS } from '../constants.js';

export function isValidVanillaItem(id: string): boolean {
  return VANILLA_ITEMS.has(id);
}

export function isValidVanillaBlock(id: string): boolean {
  return VANILLA_BLOCKS.has(id);
}

export function isSuspiciousVanillaBacking(id: string): boolean {
  return !SAFE_ITEM_BACKINGS.has(id);
}

export function isSuspiciousArmorBacking(id: string): boolean {
  return !SAFE_ARMOR_BACKINGS.has(id);
}

export function isSuspiciousBlockBacking(id: string): boolean {
  return !SAFE_BLOCK_BACKINGS.has(id);
}
