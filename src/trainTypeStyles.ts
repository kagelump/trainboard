// src/trainTypeStyles.ts
// Dynamic CSS generation for train types based on train_colors.json

import trainColorData from './train_colors.json';

// Store the dynamically created stylesheet so it can be adopted by shadow roots
let trainTypeStyleSheet: CSSStyleSheet | null = null;

/**
 * Generates and injects CSS styles for train types based on the color data.
 * This creates a unique CSS class for each train type URI.
 */
export function injectTrainTypeStyles(): void {
  // Check if styles have already been injected
  if (document.getElementById('train-type-dynamic-styles')) {
    return;
  }

  const styleElement = document.createElement('style');
  styleElement.id = 'train-type-dynamic-styles';

  let cssRules = '';

  // Generate CSS class for each train type
  for (const [uri, colors] of Object.entries(trainColorData)) {
    // Create a safe CSS class name from the URI
    // e.g., "odpt.TrainType:Tokyu.Express" -> "train-type-odpt-TrainType-Tokyu-Express"
    const className = uriToCssClass(uri);

    cssRules += `
.${className} {
  background-color: ${colors.fill};
  color: ${colors.text};
  border: 2px solid ${colors.outline};
}
`;
  }

  styleElement.textContent = cssRules;
  document.head.appendChild(styleElement);

  // Also create a constructable stylesheet for use in shadow roots
  if ('CSSStyleSheet' in window && typeof CSSStyleSheet.prototype.replaceSync === 'function') {
    try {
      trainTypeStyleSheet = new CSSStyleSheet();
      trainTypeStyleSheet.replaceSync(cssRules);
    } catch (e) {
      console.warn('Failed to create constructable stylesheet:', e);
    }
  }
}

/**
 * Gets the train type stylesheet for adoption into shadow roots.
 * Returns null if constructable stylesheets are not supported.
 */
export function getTrainTypeStyleSheet(): CSSStyleSheet | null {
  return trainTypeStyleSheet;
}

/**
 * Converts a train type URI to a valid CSS class name.
 * @param uri The train type URI (e.g., "odpt.TrainType:Tokyu.Express")
 * @returns A CSS class name (e.g., "train-type-odpt-TrainType-Tokyu-Express")
 */
export function uriToCssClass(uri: string): string {
  // Replace special characters with hyphens and prefix with "train-type-"
  return 'train-type-' + uri.replace(/[:.]/g, '-');
}

/**
 * Gets the CSS class name for a given train type URI.
 * Returns the dynamically generated class if the URI is in our color data,
 * otherwise returns the default 'type-LOC' class.
 *
 * @param uri The train type URI
 * @returns The CSS class name to use
 */
export function getTrainTypeCssClass(uri: string): string {
  if (uri in trainColorData) {
    return uriToCssClass(uri);
  }

  // Fallback to default local train style
  return 'type-LOC';
}
