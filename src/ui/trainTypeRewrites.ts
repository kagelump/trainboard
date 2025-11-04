// src/ui/trainTypeRewrites.ts
// Train type name rewrite configuration

import trainTypeRewritesData from './data/train_type_rewrites.json';

/**
 * Map of train type URI to rewritten display name.
 * Used to customize how train type names are displayed.
 */
export const TRAIN_TYPE_REWRITES: Record<string, string> = trainTypeRewritesData;

/**
 * Applies any configured rewrites to a train type name.
 * @param uri The train type URI
 * @param originalName The original name from the API
 * @returns The rewritten name if a rewrite exists, otherwise the original name
 */
export function applyTrainTypeRewrite(uri: string, originalName: string): string {
  return TRAIN_TYPE_REWRITES[uri] || originalName;
}
