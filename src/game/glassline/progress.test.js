import { describe, expect, it } from 'vitest';
import {
  AUTO_RESPAWN_SECONDS,
  STUCK_PROMPT_SECONDS,
  checkpointSplit,
  formatTime,
  shouldAutoRespawn,
  shouldPromptStuck,
} from './progress.js';

describe('tutorial progress helpers', () => {
  it('formats the run timer', () => {
    expect(formatTime(0)).toBe('00:00');
    expect(formatTime(65.9)).toBe('01:05');
    expect(formatTime(-5)).toBe('00:00');
  });

  it('escalates stuck prompts before auto-respawn', () => {
    expect(shouldPromptStuck(STUCK_PROMPT_SECONDS - 0.1)).toBe(false);
    expect(shouldPromptStuck(STUCK_PROMPT_SECONDS)).toBe(true);
    expect(shouldAutoRespawn(AUTO_RESPAWN_SECONDS - 0.1)).toBe(false);
    expect(shouldAutoRespawn(AUTO_RESPAWN_SECONDS)).toBe(true);
  });

  it('computes checkpoint splits', () => {
    expect(checkpointSplit(10, 14.5)).toBe(4.5);
    expect(checkpointSplit(20, 18)).toBe(0);
  });
});
