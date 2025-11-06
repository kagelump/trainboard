// src/ui/trainTypeRewrites.ts
// Train type name rewrite configuration

import trainTypeRewritesData from './data/train_type_rewrites.json';

/**
 * Represents a character segment with its color in a multi-colored train type display.
 */
export interface ColoredTextSegment {
  text: string;
  color: string;
}

/**
 * Type for train type rewrites - can be a simple string or an array of colored segments.
 */
export type TrainTypeRewrite = string | ColoredTextSegment[];

/**
 * Map of train type URI to rewritten display configuration.
 * Used to customize how train type names are displayed.
 */
export const TRAIN_TYPE_REWRITES: Record<string, TrainTypeRewrite> = trainTypeRewritesData;

/**
 * Applies any configured rewrites to a train type name.
 * @param uri The train type URI
 * @param originalName The original name from the API
 * @returns The rewritten name if a rewrite exists, otherwise the original name
 */
export function applyTrainTypeRewrite(uri: string, originalName: string): string {
  const rewrite = TRAIN_TYPE_REWRITES[uri];
  if (!rewrite) return originalName;
  
  // If it's an array of colored segments, join them to get the plain text
  if (Array.isArray(rewrite)) {
    return rewrite.map(seg => seg.text).join('');
  }
  
  return rewrite;
}

/**
 * Gets the rewrite configuration for a train type URI.
 * Returns the raw rewrite config which can be a string or colored segments.
 * @param uri The train type URI
 * @returns The rewrite configuration or null if none exists
 */
export function getTrainTypeRewriteConfig(uri: string): TrainTypeRewrite | null {
  return TRAIN_TYPE_REWRITES[uri] || null;
}
