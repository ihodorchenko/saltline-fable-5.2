// Minimal context declarations for JSDoc/checkJs in GLASSLINE modules.
// The real engine objects are intentionally typed as `any` until an API is
// stable enough to describe precisely.

export interface GameContext {
  THREE: any;
  params?: Record<string, string>;
  scene: any;
  camera: any;
  renderer: any;
  render?: any;
  mats?: any;
  physics?: any;
  level?: any;
  input?: any;
  time?: any;
  quality?: any;
}
