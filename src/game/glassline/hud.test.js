import { describe, expect, it } from 'vitest';
import { escapeHtml, keyHint, keycapHtml } from './hud.js';

describe('escapeHtml', () => {
  it('escapes markup and tolerates nullish input', () => {
    expect(escapeHtml('<b>"a" & b</b>')).toBe('&lt;b&gt;&quot;a&quot; &amp; b&lt;/b&gt;');
    expect(escapeHtml(undefined)).toBe('');
  });
});

describe('keycapHtml', () => {
  it('wraps named keys', () => {
    expect(keycapHtml('WASD move · Shift sprint · Space jump')).toBe(
      '<kbd>WASD</kbd> move · <kbd>Shift</kbd> sprint · <kbd>Space</kbd> jump',
    );
  });

  it('wraps a single letter only after press/hold', () => {
    expect(keycapHtml('Run and press C to slide')).toBe('Run and press <kbd>C</kbd> to slide');
    expect(keycapHtml('Drop and hold C to roll')).toBe('Drop and hold <kbd>C</kbd> to roll');
    expect(keycapHtml('A gap. Cross it.')).toBe('A gap. Cross it.');
  });

  it('handles the A/D pair', () => {
    expect(keycapHtml('Cross the beam with A/D corrections')).toBe(
      'Cross the beam with <kbd>A</kbd>/<kbd>D</kbd> corrections',
    );
  });

  it('never lets level copy inject markup', () => {
    const html = keycapHtml('<img src=x onerror=alert(1)> press R');
    expect(html).not.toContain('<img');
    expect(html).toContain('press <kbd>R</kbd>');
  });

  it('does not touch plain sentences', () => {
    expect(keycapHtml('Sprint the final rooftops')).toBe('Sprint the final rooftops');
  });
});

describe('keyHint', () => {
  it('renders a keycap plus action, escaped', () => {
    expect(keyHint('Backspace', 'restart')).toBe('<kbd>Backspace</kbd> restart');
    expect(keyHint('<', 'x')).toBe('<kbd>&lt;</kbd> x');
  });
});
