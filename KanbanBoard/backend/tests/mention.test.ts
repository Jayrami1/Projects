import { describe, it, expect } from 'vitest';

describe('Unit Logic: Regex Mention Parsing', () => {
  const mentionRegex = /@\[([^\]@]+)\]\(([^)[]+)\)/g;

  it('should extract emails from multiple valid mention strings', () => {
    const input = 'Check this @[xyz](xyz@test.com) and @[abc](abc@test.com)';
    const matches = [...input.matchAll(mentionRegex)];

    expect(matches).toHaveLength(2);
    expect(matches[0][2]).toBe('xyz@test.com');
    expect(matches[1][2]).toBe('abc@test.com');
  });

  it('should correctly handle the malformed case where a parenthesis is missing', () => {
    const input = 'Hey @[xyz](missing-parenthesis and Hey @[abc](abc@test.com)';
    const matches = [...input.matchAll(mentionRegex)];
    expect(matches).toHaveLength(1);
    expect(matches[0][2]).toBe('abc@test.com');
  });
});
