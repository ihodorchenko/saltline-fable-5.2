# Third-party notices — GLASSLINE

GLASSLINE itself is original work released under the repository's MIT license
(see `LICENSE`). The browser bundle embeds the following third-party runtime.

## three.js

- Version: r180
- License: MIT
- Upstream: https://github.com/mrdoob/three.js
- Use: renderer, scene graph, materials and geometry primitives embedded in the
  single-file build.

```text
The MIT License

Copyright © 2010-2025 three.js authors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Build and test tooling

The repository's `devDependencies` are used at build/test time only. The
installed tree was audited on 2026-11-14 and contains permissive licenses only:
MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause, ISC and BlueOak-1.0.0. No GPL,
AGPL or unknown-license packages were found.

## GLASSLINE assets

- Level geometry, palette, props and signage: authored in this repository.
- Surface textures: generated at runtime with Canvas 2D.
- Audio: generated at runtime with Web Audio oscillators and filtered noise.
- Fonts: system font stacks (`IBM Plex Mono`, `Arial Narrow`, `Helvetica Neue`);
  no font files are bundled.
- No third-party images, models, music, sound samples or logos are shipped.
