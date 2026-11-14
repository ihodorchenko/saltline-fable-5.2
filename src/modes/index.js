// Mode selection for the game shell: campaign/title, showcase and bench.
// Showcase implementations stay in the game; this module owns the registry
// shape and the URL/hash resolution rules.

/**
 * @param {{level: Function, backdrop: Function, ground: Function, fx: Function,
 *          weapon: Function, enemies: Function, props: Function, render: Function,
 *          glassline?: {create: Function, showcase: Function}}} modules
 * @returns {{showcases: object, resolve: Function}}
 */
export function createModes(modules) {
  const showcases = {
    mats: {},
    level: modules.level,
    backdrop: modules.backdrop,
    ground: modules.ground,
    fx: modules.fx,
    weapon: modules.weapon,
    enemies: modules.enemies,
    props: modules.props,
    render: modules.render,
    glassline: modules.glassline,
  };

  /**
   * @param {Record<string, string>} params parsed URL query
   * @param {string} hash location.hash
   * @returns {{kind: 'campaign'|'showcase'|'bench', bench: boolean, showcase: string|null}}
   */
  function resolve(params, hash) {
    const bench = !!params.bench || hash === '#bench';
    if (bench) return { kind: 'bench', bench: true, showcase: null };

    const name = params.show && showcases[params.show] ? params.show : null;
    if (name) return { kind: 'showcase', bench: false, showcase: name };
    return { kind: 'campaign', bench: false, showcase: null };
  }

  return { showcases, resolve };
}
