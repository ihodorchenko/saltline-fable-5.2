// @ts-check
// Shared look for in-world signs: an ivory plate with ink type and a red top
// rule, the same language as the HUD plates. Dark translucent glass reads as mud
// against a high-key sky.

export const SIGN = {
  plate: '#f2eee3',
  ink: '#0b0f12',
  inkSoft: '#3b4950',
  rule: '#d23a39',
  edge: 'rgba(11, 15, 18, 0.28)',
};

/**
 * Paint the sign background: ivory plate, hairline edge, red top rule.
 * @param {CanvasRenderingContext2D} context
 * @param {number} width
 * @param {number} height
 */
export function drawSignPlate(context, width, height) {
  context.fillStyle = SIGN.plate;
  context.fillRect(0, 0, width, height);
  context.strokeStyle = SIGN.edge;
  context.lineWidth = 3;
  context.strokeRect(1.5, 1.5, width - 3, height - 3);
  context.fillStyle = SIGN.rule;
  context.fillRect(0, 0, width, Math.max(4, Math.round(height * 0.045)));
}
