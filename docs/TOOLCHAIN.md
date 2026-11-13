# Toolchain

Манифест окружения для Фазы 1. Аналог `Gemfile`/`Brewfile`: здесь перечислено, что и зачем установлено. Точные версии npm-пакетов фиксирует `package-lock.json`.

## Что установлено

| Компонент | Версия | Как поставлен | Зачем |
|---|---|---|---|
| macOS | 27.2.1 (arm64) | система | целевая платформа разработки |
| Homebrew | 7.0.13 | система | установка Node |
| Node.js | **22.23.5** (LTS) | `brew install node@22` + `brew link --overwrite --force node@22` | Vite 7 и npm-скрипты |
| npm | 10.9.9 | вместе с Node | зависимости и скрипты |
| Vite | 7.3.8 | `npm install` | dev-сервер с HMR и production-сборка |
| vite-plugin-singlefile | 2.3.4 | `npm install` | инлайн JS/CSS в один `dist/index.html` |
| Rollup | 4.68.3 | транзитивно через Vite/плагин | сборка |
| esbuild | 0.28.2 | транзитивно через Vite | трансформация и минификация |
| ESLint | 10.14.0 | `npm install` | lint рукописного JS и конфигов |
| @eslint/js | 10.0.1 | транзитивно с ESLint | recommended-правила |
| globals | 17.14.0 | `npm install` | browser/node-глобалы для ESLint |
| Prettier | 3.10.1 | `npm install` | форматирование рукописных JS/MD/JSON |
| Python | 3.15.2 | система | `npm run preview` и headless smoke-сервер |
| Microsoft Edge | 157.0.4341.46 | система | headless smoke по умолчанию; Chrome/Chromium — fallback |

Не установлены (пока не нужны): Playwright, Vitest.

ESLint и Prettier работают по **рукописному** коду и конфигам: `vite.config.js`, `eslint.config.js`, `prettier.config.js`, `src/engine/input/bindings.js`, README. Минифицированные legacy-модули (`src/game/main.js`, `src/engine/*/index.js`), CSS и docs исключены — их форматирование/линтинг дал бы большой шум без пользы. См. [`eslint.config.js`](../eslint.config.js) и [`.prettierignore`](../.prettierignore).

## Файлы-манифесты

- [`Brewfile`](../Brewfile) — системные пакеты (Node 22).
- [`.nvmrc`](../.nvmrc) — точная версия Node для nvm/asdf.
- [`package.json`](../package.json) — npm-манифест: скрипты, `engines`, `packageManager`.
- [`package-lock.json`](../package-lock.json) — lock-файл npm с точными версиями.
- [`.npmrc`](../.npmrc) — локальный кэш npm внутри репозитория (чтобы установка не зависела от прав на `~/.npm`).
- [`vite.config.js`](../vite.config.js) — корень `src/`, сборка в один `dist/index.html`.
- [`eslint.config.js`](../eslint.config.js) — flat config, scope рукописного JS.
- [`prettier.config.js`](../prettier.config.js) и [`.prettierignore`](../.prettierignore) — форматирование.

## Установка с нуля

```sh
brew bundle
brew link --overwrite --force node@22
node -v      # v22.23.5
npm -v       # 10.9.9
npm ci
```

Если Homebrew нет: поставьте Node 22 LTS с nodejs.org — версии и скрипты не меняются.

## Проверка

```sh
npm run build                 # dist/index.html, один файл
npm run smoke                 # legacy index.html
SERVE_DIR=dist SMOKE_NAME=dist npm run smoke
npm run dev                   # http://127.0.0.1:5173, HMR
```

## Почему Node 22, а не bundled Node 24

В среде DSH есть собственный Node 24.21.0, но Rollup native (`.node`) не проходил проверку code signature при загрузке — Vite build падал. С Homebrew Node 22.23.5 Rollup загружается, Vite 7 работает. На другой машине/CI достаточно Node 22 LTS; код сборки от этого не зависит.

## Сборка HTML

У `src/index.html` должны быть явные `</head>` и `<body>`, а `<meta charset="utf-8">` — до встроенного скрипта. Vite + `vite-plugin-singlefile` вставляет бандл в `<head>`; если charset окажется после него, кириллица/типографика в строках может превратиться в mojibake.

## Что это меняет для игры

Ничего в рантайме. Игра остаётся статическим `index.html`; Node, Vite и npm нужны только для разработки и сборки. Игроку достаточно `python3 -m http.server`.
