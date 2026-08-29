import { describe, it, expect } from 'vitest';
import { readingMinutes, excerpt } from '../src/api/blog-post/services/reading';

describe('readingMinutes', () => {
  it('floors at 1 minute for short or empty bodies', () => {
    expect(readingMinutes('')).toBe(1);
    expect(readingMinutes(null)).toBe(1);
    expect(readingMinutes('a few words only')).toBe(1);
  });

  it('scales with word count (~225 wpm)', () => {
    const body = Array.from({ length: 900 }, () => 'word').join(' ');
    expect(readingMinutes(body)).toBe(4);
  });

  it('does not count fenced code blocks toward the estimate', () => {
    const code = '```\n' + Array.from({ length: 2000 }, () => 'x').join(' ') + '\n```';
    expect(readingMinutes(`intro paragraph here\n\n${code}`)).toBe(1);
  });
});

describe('excerpt', () => {
  it('takes the first prose block, skipping a leading heading', () => {
    const body = '# A Heading\n\nThe first real paragraph explains the idea.';
    expect(excerpt(body)).toBe('The first real paragraph explains the idea.');
  });

  it('strips inline markdown markers', () => {
    expect(excerpt('This has **bold**, *italic* and `code` in it.')).toBe(
      'This has bold, italic and code in it.',
    );
  });

  it('reduces a link to its text', () => {
    expect(excerpt('See [the guide](https://example.com/x) for more.')).toBe(
      'See the guide for more.',
    );
  });

  it('clamps to a word boundary with an ellipsis', () => {
    const out = excerpt('one two three four five six seven eight nine ten', 20);
    expect(out.endsWith('…')).toBe(true);
    expect(out.length).toBeLessThanOrEqual(21);
    expect(out).not.toContain('  ');
  });

  it('returns empty string for no body', () => {
    expect(excerpt(null)).toBe('');
    expect(excerpt('')).toBe('');
  });
});
