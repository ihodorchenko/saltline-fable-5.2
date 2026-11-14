// @ts-check
// Data-driven GLASSLINE tutorial course. Coordinates are meters; the route runs
// mostly toward -Z, turns slightly, climbs to the balance roof and drops to the
// finish. Keep geometry data here, not in game code.

export const tutorialLevel = {
  id: 'tutorial',
  name: 'ROOFTOP INDUCTION',
  spawn: { x: 0, y: 0.05, z: 10, yaw: 0 },
  fallY: -6,
  palette: [0xd7d2c6, 0xc3cbca, 0xb3bdc2],
  scenery: [
    { pos: [-14, 5, 8], size: [6, 10, 8], color: 0x77838a },
    { pos: [15, 4, 5], size: [5, 8, 9], color: 0x89949a },
    { pos: [-16, 7, -8], size: [7, 14, 7], color: 0x6f7c83 },
    { pos: [17, 5, -18], size: [6, 10, 10], color: 0x7d888e },
    { pos: [-15, 8, -34], size: [7, 16, 8], color: 0x69767d },
    { pos: [16, 6, -45], size: [6, 12, 9], color: 0x7a858b },
    { pos: [-13, 4, -58], size: [5, 8, 7], color: 0x879197 },
  ],
  platforms: [
    // 01 — start roof, jump across the first gap.
    {
      id: 'start-roof',
      pos: [0, -0.25, 9],
      size: [10, 0.5, 6],
      material: 'concrete',
    },
    {
      id: 'jump-roof',
      pos: [0, -0.25, 2],
      size: [8, 0.5, 4],
      material: 'concrete',
    },
    {
      id: 'jump-roof-2',
      pos: [2, -0.25, -3],
      size: [7, 0.5, 4],
      material: 'concrete',
    },
    // 02 — slide roof with a low overhang.
    {
      id: 'slide-roof',
      pos: [2, -0.25, -9],
      size: [7, 0.5, 6],
      material: 'concrete',
    },
    // 03 — vault roof.
    {
      id: 'vault-roof',
      pos: [2, -0.25, -15],
      size: [7, 0.5, 5],
      material: 'concrete',
    },
    // 04 — mantle onto the first elevated roof.
    {
      id: 'mantle-roof',
      pos: [2, 1.35, -21],
      size: [8, 0.5, 7],
      material: 'concrete',
    },
    // 05 — wallrun roof with the wall alongside.
    {
      id: 'wallrun-roof',
      pos: [2, 1.35, -30.5],
      size: [8, 0.5, 7],
      material: 'concrete',
    },
    // 06 — climb roof above the tall wall.
    {
      id: 'climb-roof',
      pos: [2, 3.25, -38.5],
      size: [8, 0.5, 7],
      material: 'concrete',
    },
    {
      id: 'climb-landing',
      pos: [-4, 3.25, -35.5],
      size: [4, 0.5, 5],
      material: 'concrete',
    },
    // 07 — balance roof and beam.
    {
      id: 'balance-roof',
      pos: [2, 3.25, -45],
      size: [6, 0.5, 4],
      material: 'concrete',
    },
    {
      id: 'balance-exit',
      pos: [2, 3.25, -55],
      size: [6, 0.5, 4],
      material: 'concrete',
    },
    // 08 — drop/roll to the finish roof.
    {
      id: 'finish-roof',
      pos: [2, 1.45, -61],
      size: [8, 0.5, 6],
      material: 'concrete',
    },
  ],
  obstacles: [
    {
      id: 'slide-overhang',
      pos: [2, 1.85, -8],
      size: [4, 0.5, 3],
      color: 0xe6e8e6,
    },
    {
      id: 'vault-block',
      pos: [2, 0.4, -14],
      size: [2, 0.8, 1],
      color: 0xe6e8e6,
    },
    {
      id: 'wallrun-wall',
      pos: [6, 3, -30],
      size: [0.4, 4, 10],
      color: 0xe6e8e6,
    },
    {
      id: 'wallclimb-wall',
      pos: [2, 2.9, -34.8],
      size: [8, 2.6, 0.4],
      color: 0xe6e8e6,
    },
    {
      id: 'balance-beam',
      pos: [2, 3.65, -50],
      size: [0.6, 0.3, 6],
      color: 0xb51f2a,
      collider: true,
      tag: 'balance',
    },
    {
      id: 'finish-pad',
      pos: [2, 1.73, -62],
      size: [4, 0.06, 4],
      color: 0xb51f2a,
      collider: false,
    },
  ],
  checkpoints: [
    {
      id: 'start',
      stage: 'MOVEMENT',
      prompt: 'WASD move · Shift sprint · Space jump',
      pos: [0, 0, 9],
      yaw: 0,
      radius: 1.6,
    },
    {
      id: 'jump',
      stage: 'JUMP',
      prompt: 'Run and jump the gap; sprint for longer jumps',
      pos: [0, 0, 2],
      yaw: 0,
      radius: 1.5,
    },
    {
      id: 'slide',
      stage: 'SLIDE',
      prompt: 'Run and press C to slide under the overhang',
      pos: [2, 0, -10.5],
      yaw: 0,
      radius: 1.5,
    },
    {
      id: 'vault',
      stage: 'VAULT',
      prompt: 'Space near the low block to vault it',
      pos: [2, 0, -16],
      yaw: 0,
      radius: 1.5,
    },
    {
      id: 'mantle',
      stage: 'MANTLE',
      prompt: 'Space at the high ledge to mantle onto the roof',
      pos: [2, 1.6, -22],
      yaw: 0,
      radius: 1.7,
    },
    {
      id: 'wallrun',
      stage: 'WALLRUN',
      prompt: 'Jump at the side wall and run; Space to jump off',
      pos: [2, 1.6, -29],
      yaw: 0,
      radius: 1.6,
    },
    {
      id: 'wallclimb',
      stage: 'WALLCLIMB',
      prompt: 'Jump at the tall wall; climb, then move onto the roof',
      pos: [-4, 3.5, -36],
      yaw: 0,
      radius: 1.7,
    },
    {
      id: 'balance',
      stage: 'BALANCE',
      prompt: 'Cross the beam with A/D corrections',
      pos: [2, 3.5, -46],
      yaw: 0,
      radius: 1.6,
    },
    {
      id: 'drop',
      stage: 'ROLL',
      prompt: 'Drop to the lower roof and hold C to roll on landing',
      pos: [2, 3.5, -56],
      yaw: 0,
      radius: 1.6,
    },
    {
      id: 'finish',
      stage: 'FINISH',
      prompt: 'Reach the red finish pad',
      pos: [2, 1.7, -59],
      yaw: 0,
      radius: 1.8,
    },
  ],
  finish: { pos: [2, 1.7, -62], radius: 1.8 },
};
