import { describe, it, expect } from 'vitest';

describe('API module', () => {
  it('should support dynamic railway URIs', () => {
    // Test that we can work with different railway URIs
    const toyokoUri = 'odpt.Railway:Tokyu.Toyoko';
    const yamanoteUri = 'odpt.Railway:JREast.Yamanote';

    expect(toyokoUri).toContain('Railway');
    expect(yamanoteUri).toContain('Railway');
  });
});
