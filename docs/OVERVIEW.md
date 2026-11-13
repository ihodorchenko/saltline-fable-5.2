# Saltline — технический обзор

Рабочий конспект по зеркалу **saltline-fable-5.2**: что это, как устроено, где что менять и как быстро проверить. Цель — не реверс-инжинирить проект заново при каждом возвращении.

Документ описательный: он не заменяет код. Если текст расходится с `index.html` — верьте коду и обновите текст.

**Проверено:** 2026-11-13. База — коммит `09c5177` (импорт артефакта); поверх него в этом форке добавлены `docs/OVERVIEW.md` и два ремапа управления (раздел 11).
**Отпечаток:** `index.html` = 1 423 592 байт, sha256 `2599361f982c1a8575d19440913735ced6ff0310378f3479730fd6be4b19aef1`.

Проверка актуальности:

```sh
shasum -a 256 index.html
# 2599361f982c1a8575d19440913735ced6ff0310378f3479730fd6be4b19aef1  index.html
```

Если хеш другой — цифры и проценты ниже могли устареть. Якоря в колонке «grep» ищутся по тексту и обычно переживают изменения лучше номеров строк, но при правках файла их всё равно надо перепроверять.

---

## 1. TL;DR

- **Saltline** — браузерный FPS в одном файле: рассветный контейнерный порт, дождь, три uplink-реле, дроны «Gull» и робопсы «Hound», один карабин, катер на финале.
- Один проход ~5–10 минут; уровня, оружия и врагов ровно столько, сколько нужно одной миссии.
- Внутри: `three.js r180` + ~690 КБ собственного кода, ≈79 GLSL-фрагментов, процедурные текстуры, модели, анимации и **весь звук** (57 синтезируемых звуков, две свёрточные реверберации).
- Нет сборки, нет ассетов, нет внешних библиотек кроме Google Fonts. Всё в `index.html`.
- Проверено в headless-браузере: игра стартует, рендерит, ошибок нет. На программном рендерере автоматически выбирается `medium`; на реальном GPU — `high`, на мобильных — `low`.

Происхождение: README утверждает, что игра сгенерирована «Claude Fable 5.2» одним промптом (~8 часов, ~2.7M output / 445M input токенов, ~$550 по API-цене), автор поста — Felix Rieseberg (Anthropic), оригинал — claude.ai artifact. Цифры — со слов автора, здесь не проверялись. Изначально это зеркало; в этом форке код игры изменён только в управлении (раздел 11), плюс добавлен этот документ.

---

## 2. Репозиторий

| | |
|---|---|
| Файлы | `README.md`, `index.html` (legacy single file, 6 193 строки), `docs/OVERVIEW.md`; на `exp/foundation` — `src/`, `tools/`, `package.json` |
| Ветки | `main` = `09c5177` (исходное зеркало); `dev` = `ddfbf83` (docs + ремапы); `exp/foundation` — Phase 1 |
| Remote | `git@github.com:ihodorchenko/saltline-fable-5.2.git` (форк от `realcodebear`) |
| Коммиты | 7 на `dev`: импорт, три README, docs, два ремапа; `exp/foundation` добавляет Phase 1 |
| Лицензия | отсутствует |
| CI / тесты / сорсмапы | CI нет; на `exp/foundation` есть Vite-сборка, `tools/smoke.sh` и baseline-скриншоты (в `artifacts/`, не коммитятся) |
| Демо | `https://realcodebear.github.io/saltline-fable-5.2/` — исходное зеркало (без локальных ремапов); на момент проверки отвечает `200` |
| Внешние запросы страницы | только `fonts.googleapis.com` и `fonts.gstatic.com` (подтверждено сетевым логом) |

### Локальные изменения в этом форке

- `docs/OVERVIEW.md` — этот обзор.
- Управление: бег `X`, огонь `Shift`/ЛКМ, прицел `E`/ПКМ, взаимодействие `F` (подробнее — раздел 11).
- `README.md` — ссылка на docs, раздел Development и обновлённый «What changed».
- Phase 1 (`exp/foundation`): `src/` + Vite-сборка в `dist/index.html`; input — `src/engine/input/`, UI — `src/engine/ui/`, audio — `src/engine/audio/`, materials — `src/engine/materials/`, physics — `src/engine/physics/`, render — `src/engine/render/`, CSS — `src/ui/styles.css`; root `index.html` пока остаётся legacy-файлом.

Игровая логика, кроме ремапов управления и структурного выноса Phase 1, соответствует `09c5177`.

Запуск локально:

```sh
python3 -m http.server 8731
# открыть http://localhost:8731 — клик по странице захватывает мышь и включает звук
```

---

## 3. Анатомия одного файла

> На `exp/foundation` тот же код вынесен в `src/game/main.js` (пока копия legacy) и собирается Vite в `dist/index.html`; dev-сервер с HMR — `npm run dev`. Таблица ниже описывает legacy-файл в корне.

| Блок | Границы | Размер | Доля |
|---|---|---|---|
| `<head>`: meta, шрифты, viewport | строки 1–6 | ~0.5 КБ | — |
| CSS (дизайн-токены, HUD, меню, тач, a11y) | строки 7–338 | 30.8 КБ | 2.2% |
| `three.js r180` + `BufferGeometryUtils` + PMREM | строки 349 – середина 4180 | ~702 КБ | 49.3% |
| Игровой код (включая шейдеры) | с 51.5% файла до конца | ~690 КБ | 48.5% |

Метрики по всему файлу (включая three.js): ≈**79** фрагментов с `void main()`, ≈**1 082** вхождения `function`, ≈**174** `class`. Никаких модулей, source map и импортов: один `<script>` с одним IIFE. Код минифицирован, но часть комментариев и все GLSL-строки читаемы — по ним удобно ориентироваться.

### Модули и деградация

`render`, `mats`, `level`, `backdrop`, `ground`, `fx`, `audio`, `weapon`, `enemies`, `hud`, `player`, `combat`, `game`, `input`.

Для восьми модулей есть **stub-реализации** (`dr={ground:…}`: `ground`, `backdrop`, `fx`, `audio`, `weapon`, `enemies`, `hud`, `mats`): если модуль падает на старте, игра продолжает работать в урезанном виде. `render` и `level` обязательные, а `physics`, `props`, `input`, `player`, `combat` и `game` создаются напрямую — их падение даёт фатальный экран (`bM`). Все ошибки собираются в `window.__errors`, фатальные — в `window.__fatal`.

---

## 4. Загрузка и главный цикл

Порядок boot (`async function QC(`): render → materials → physics → props → input → level → backdrop → ground → physics.build → fx → audio → player → combat → weapon → enemies → hud → game → `render.onLevelReady()` → автозапуск (только при `?shot` / `?autostart`) → цикл.

Экран загрузки показывает шаги: «Waking the renderer», «Mixing paint, rust and rain», «Stacking containers», «Raising the cranes», «Flooding the apron», «Loading tracers and smoke», «Checking the rifle», «Waking the Harbormaster», «Waiting for first light», «Ready».

Замеры boot в headless-Edge/SwiftShader (`q=low`): `render` 2.6–3.2 с, `mats` 0.4–0.6 с, `level` 4.0–4.7 с, `backdrop` 4.9–7.2 с. Итого холодный старт ~12–16 с на софт-рендере; на реальном GPU существенно быстрее (не измерялось).

Главный цикл (`renderer.setAnimationLoop`):

```
input → game.update → player / weapon / enemies (если экран игровой)
     → влажность вьюмодели по interiorBox → fx, ground, level, backdrop, mats (кроме паузы)
     → audio → hud → (камера showcase) → bench.frame → render.frame
```

`dt` зажимается в 0.05 с. Ошибки каждого модуля логируются один раз на модуль, чтобы не спамить консоль.

---

## 5. Игровые правила

Состояния: `title → intro → playing → paused / dead → complete`. Интро длится 3.5 с (ретрай — 1.3 с), в это время показывается карточка локации и идёт радио.

| Параметр | Значение |
|---|---|
| Цель | вырезать 3 реле, затем дойти до катера |
| Взаимодействие | ≤ 2.2 м, угол ≥ 0.45, удерживать `F` **2.4 с** |
| Волны после реле | `{gull:3,hound:1}`, `{gull:3,hound:2}`, `{gull:4,hound:3}` |
| Одновременно живых | 9 |
| Интервал спавна | 0.85 с |
| После всех реле | до 5 «преследователей» (интервал 7 с, если живых < 4) |
| Рейтинг | время + точность + отсутствие ретраев → `Messy, Loud, Steady, Clean, Sharp, Surgical` |

Формула рейтинга: `<270 с` → 2, `<400 с` → 1; точность `≥50%` → 2, `≥30%` → 1; без ретраев → +1. Индекс 0–5 в массив названий.

Радио (`_l`):

- intro: «Breacher, this is Control. The Harbormaster holds the berth. Cut its three uplinks — yard, shed, quay.»
- contact: «It has seen you. Gulls fly, Hounds walk. Put them down.»
- cut: «One relay dark. It felt that — machines inbound.» / «Two dark. It is throwing everything it has left at you.»
- all: «All three dark. The boat is holding at the quay ladder, south end. Run.»
- low: «You are hit hard. Get behind steel and breathe.»
- done: «Breacher is aboard. Saltline is dark. Good work.»

Катер до этого отказывается уходить: сообщение «Relays still live — the boat will not wait under fire».

---

## 6. Игрок, оружие, бой

**Игрок** (`Mt`, `Pi`): 100 hp, глаз 1.68 м, капсула r=0.32 / h=1.8, камера 74°. Ходьба 3.8, бег 6.4, присед 1.9, ADS 2.4 м/с. Гравитация 21, апекс прыжка 1 м, coyote-time 0.12, jump-buffer 0.13. Реген 25 hp/с через 4 с после урона. Урон от падения — выше 13 м/с; падение в воду — спасение у последней безопасной точки, −12 hp и разворот. Отдача и тряска камеры — в `Mt`.

**Оружие** (`mi`, `dm`): `PAC-9 Longshore`, магазин 30 (`Gv=30,B_=150,O_=720,H_=26`), 720 выстр./мин, 26 урона, weak point ×2.2. Бег блокирует стрельбу, пока `sprintT ≥ .45`; при ADS ≥ .35 в бег не перейти. Вьюмодель — отдельная камера (54°), 53 136 треугольников, 13 мешей, процедурные фазы перезарядки, эффект «запотевания» в цехе. В stub-режиме имя оружия — `KR-7` (наследие, видно только при отказе модуля).

**Бой** (`zv`): hitscan по AABB мира и по врагам; выстрелы врагов проверяют капсулу игрока (r=0.38, высота 0.95). Взрывы — урон с falloff и проверкой LOS. `combat.stats` считает выстрелы/попадания/убийства для дебрифинга.

---

## 7. Враги

`Gull` — квадрокоптер, `Hound` — четырёхногий робот. Обе модели собраны из примитивов, с процедурным ригом и анимацией. Общий менеджер: пулы 10 гульов / 8 хаундов, 5 «обломков», 32 болта.

| | Gull | Hound |
|---|---|---|
| HP | 45 | 140 |
| Атака | очередь 3 болта по 7 | очередь 4 выстрела по 5 |
| Взрыв | 30 в радиусе 3 м | — |
| Дистанция | 12–25 м | 8–18 м |
| Особое | высота 4–8 м, орбита | рывок 3 м на 15 урона |
| Скорость | 8 (патруль 3) | 4.5 (сталк 2, патруль 1.5) |
| Телеграф | 0.55 с | 0.5 с / 0.28 с перед рывком |

Восприятие (`Ui`): радиус 45 м, конус 200°, потеря цели 4 с, поиск 8 с, слух 45 м. **Токены**: одновременно стреляют максимум 2 врага (3 в толпе), пауза между «разрешениями» 1.25 с — так бой не превращается в расстрел. Режимы: `patrol`, `investigate`, `search`, `engage`; локальные состояния `move/aim/tele/burst/cool` и `wind/lunge/recover`. Есть rally (поднятие соседей по тревоге) и provoke (реакция на урон).

Модели: корпус/броня `armor_white`, металл `gunmetal`, эмиссивные линзы, прожектор-конус у Gull, трафаретные номера `G-…`/`H-…`, мигающие огни, дым и искры при смерти, тонущие обломки.

---

## 8. Уровень и контент

Мир (`var oi={min:`): `x∈[-40, 40]`, `z∈[-30, 30]`, земля `y=0`, море `y=-1.6`, стенка причала `x=30`. Игрок стартует в `(-32, 0, 6)`, лицом на восток.

Зоны:

| Зона | Границы |
|---|---|
| gate | x −40…−24, z −30…30 |
| yard | x −24…16, z −10…30 |
| shed | x −24…16, z −30…−10 |
| quay | x 16…40, z −30…30 |

Реле: **A** — двор `(1.5, 0, 7.5)`; **B** — цех `(-2, 0.03, -19.5)`; **C** — причал `(23, 0, 0)`. Катер — у лестницы на южном конце причала, `(29, 0, 20)`, радиус 2.5.

Цех: `x -16…12`, `z -28…-11`, карниз 7 м, конёк 9.5 м, световые фонари, один interior-box для пыли/реверба/вьюмодели.

Контент при полной сборке (замер `q=low`): **47 контейнеров**, **298 пропсов**, **96 атласов надписей**, **793 264 треугольника** в **125 объединённых мешах**; 42 точки спавна врагов, 55 укрытий, 12 точек кинематографической камеры.

Пропсы (35 типов, `Gi`): контейнеры 20/40/40HC, jersey barrier, light mast, fence panel, guard booth, gate arm, bollards, relay node, shelf rack, stairs, catwalk, reefer, barrel, pallet, crate, IBC, forklift, cable reel, tires, dumpster, generator, jerry can, cone, gas cylinders, tarp, sandbags, toolbox cart, floodlight, boxes, pipes, sign post.

Контейнеры: 20ft 6.06×2.59×2.44 м, 40ft 12.19×2.59×2.44, 40HC 12.19×2.9×2.44.

Надписи и декали: вымышленные бренды (`NORDKAP LINE`, `TERN OCEANIC`, `AUREL PACIFIC`), таблички (`GATE CONTROL`, `AUTHORISED PERSONNEL ONLY`, `HARBORMASTER UPLINK`, `SALTLINE TERMINAL`), плюс десятки трафаретов, предупреждений и технических табличек (KELVAR, INTERMODAL FREIGHT, WIRING DIAGRAM SLT-R4 и т. п.). Текст рисуется в canvas и упаковывается в атласы.

Backdrop: судно, краны, портовый силуэт, море; катер. Showcase-режимы: `crane`, `ship`, `boat`, `sky`.
Ground: асфальт/бетон, лужи, мокрая кромка, разметка, трещины, дождь, круги от капель, планарные отражения.
Всё процедурное: 29 наборов материалов (~34 МБ текстур в showcase `mats`), плюс атласы надписей; на `low` — 24 набора и ~28 МБ.

---

## 9. Рендер

Две камеры: мир (74°, near 0.08 / far 900) и вьюмодель (54°, near 0.01 / far 10, layer 1). Вьюмодель рисуется после очистки глубины с `depthRange(0, .05)` — оружие не проваливается в геометрию.

HDR-таргет: RGBA half-float, MSAA из профиля качества, depth texture. Пост-цепочка (`function jy(`): `depthcopy → depthhalf → ao → vol → blur-ao → blur-vol → composite → motion → down/up (bloom, 6 уровней) → streak → adapt → dirt → grade → final`.

Что внутри:

- **Тени**: PCSS с патчем чанка three.js (`qy`), taps 10/16, searchTaps 8; карта 1024–4096 в зависимости от профиля.
- **AO**: HBAO половинного разрешения, 8–16 тапов (8 на `test`, 12 на `medium/high`, 16 на `ultra`), радиус 0.9, сила 1.6.
- **Объёмные лучи**: 10–40 шагов по профилю, sigma 0.0034, дистанция 170, «пыль» внутри цеха ×6.
- **Bloom**: 6 уровней, анаморфные streak'и, lens dirt, lens flare.
- **Motion blur**: отдельный проход с выдержкой ~1/190 с.
- **Экспозиция**: адаптация по яркости, 0.6–2.
- **Грейд**: AgX (Filament-фит) + ACES, смесь 0.25, `LOOK_POWER 1.18`, `LOOK_SAT 1.22`, split-tone, S-curve, виньетка, damage-pulse, хроматическая аберрация.
- **Финал**: FXAA, sharpen 0.3, зерно 0.02, дизеринг.
- **Небо**: отдельный шейдер (`SALTLINE_SKY`) — облачная плита, «горячий разрыв» к солнцу, молнии, aerial perspective, диск солнца; тот же кадр идёт в PMREM для IBL. Для цеха — отдельное interior-окружение (на boot применяется к 16 материалам).
- **Отражения**: планарная камера с oblique near-plane clipping для мокрого асфальта; разрешение ×0.5 на `medium`, ×1 на `ultra`, выключено на `low`.
- **Море**: 4 крупных + 6 мелких волн с дисперсией, затухание у причала, отражения неба, пена у стенки.

### Профили качества (`Pr`)

| | scale | MSAA | shadow | tex | volSteps | AO | planar | bloom | motionBlur | rain |
|---|---|---|---|---|---|---|---|---|---|---|
| test | 1 | 0 | 1024 | 256 | 10 | да | .5 | да | нет | .4 |
| low | .7 | 0 | 2048 | 512 | 12 | нет | 0 | да | нет | .5 |
| medium | .85 | 2 | 2048 | 1024 | 16 | да | .5 | да | нет | .8 |
| high | 1 | 4 | 4096 | 1024 | 24 | да | .5 | да | да | 1 |
| ultra | 1 | 4 | 4096 | 2048 | 40 | да | 1 | да | да | 1 |

Автовыбор (`zy`): мобильный/тач → `low`; SwiftShader/llvmpipe/мобильные GPU (Mali, Adreno, PowerVR) и Intel (кроме Arc) → `medium`; остальное → `high`. Дальше работает **динамическое разрешение**: 0.6–1.0, вниз при >21.5 мс, вверх при <17.4 мс; если на scale 0.6 кадр стабильно >26 мс — сброс профиля (ultra → high → medium → low).

Отказоустойчивость: self-test пайплайна, откат на forward-рендер, PCF вместо PCSS, проверка компиляции шейдеров (флаги в `render.stats`), stub-модули.

---

## 10. Звук

57 определений в `Go={rifle_shot…}`; на boot готовятся 93 буфера. Частоты: 44.1 кГц для «ближних» звуков, 32 кГц для мира, 22.05 кГц для эмбиента/музыки. У каждого звука: генератор, число вариантов, пик, шина, лимит голосов, приоритет, посыл в реверб, rolloff, признак предзагрузки.

- **Шины**: `world`, `near`, `amb`, `dry`, `music`; мастер: gain → компрессор (−10 dB, ratio 6) → soft-clip waveshaper → выходной гейн 0.9 → выход. На world-ветке — lowpass, который закрывается в помещении (2e4 → ~600 Гц по interior-box).
- **Реверб**: две свёртки с синтезированными IR — `ir_outdoor` и `ir_shed`; посылы плавно переключаются по interior-box, музыка идёт и в общий микс, и в реверб.
- **Музыка**: 5 слоёв (`music_drone`, `music_ost`, `music_perc`, `music_brass`, `music_motif`), кроссфейд по интенсивности боя (`0.15` покой, `0.6` тревога, `1.0` бой).
- **Лупы**: ротор Gull, серво Hound, гул реле, дождь, ветер, море; позиционирование через PannerNode/3D-слушатель.
- **Эмбиент-ваншоты**: гром, туманный горн, чайки, лязг контейнера, фалинь — с задержками и рандомизацией.
- **Генерация**: ленивая, кусками по 6 мс, чтобы не блокировать кадр; звук стартует только после жеста пользователя (AudioContext suspended).
- **Self-test** (`de`): рендерит 10-секундную сцену через `OfflineAudioContext` и возвращает peak/RMS/NaN/overload — можно проверять звук без наушников.

---

## 11. UI, настройки, ввод

HUD (`hM`): компас-лента с шагом 5° (числа каждые 15°, стороны каждые 45°), маркеры целей в экранных и мировых координатах с дистанциями, трекер реле `0/3`, предупреждения, прицел с динамическим разбросом, hit-marker (`hit/weak/kill`), 4 дуги направления урона, подсказка взаимодействия с прогресс-кольцом, kill feed (до 4), сообщения, сегментное здоровье, патроны + пипсы + имя оружия.

Радио — очередь реплик с печатью текста (~58 символов/с) и `aria-live`.

Меню (`pM`): экраны `title`, `paused`, `dead`, `complete` (дебрифинг), карточка локации, панель настроек с табами `settings`/`controls`. Настройки: качество (`low/medium/high/ultra`, по умолчанию `auto`), чувствительность 0.2–3, инверсия Y, громкость 0–1, FOV 60–95, фуллскрин. Хранятся в `localStorage` под ключом `saltline.settings.v1` (`XC` — дефолты). Отдельная подпись объясняет, что качество выбрано под устройство.

Ввод (`h_`): WASD, мышь; огонь — ЛКМ или `Shift`, прицел — ПКМ или `E`, бег — `X`, взаимодействие — `F`; R, Space, C/Ctrl, Q (melee, feat/melee), Esc/P; `V` не назначена; `Enter` на титуле запускает игру. Тач: левый стик, правый свайп, кнопки FIRE/AIM/RLD/JUMP/USE. Геймпад: RT/LT, A/B/X/Y, L3, Start. Если pointer lock недоступен — drag-to-look; есть полностью клавиатурный режим (стрелки или IJKL, огонь — `Shift`).

Доступность: `aria-label`, `aria-live` для радио, focus trap в панели, `prefers-reduced-motion`, safe-area insets, `role=dialog/tablist`.

---

## 12. Dev-режимы и диагностика

Параметры URL (читаются в `QC`):

| Параметр | Что делает |
|---|---|
| `?q=test\|low\|medium\|high\|ultra` | форсирует профиль качества |
| `?shot` | «скриншотный» режим: `test`-качество, автозапуск без интро |
| `?autostart` | сразу начать игру |
| `?bench` / `#bench` | бенч-режим с полётом камеры по `cinematicPath` и оверлеем статистики |
| `?show=level\|mats\|backdrop\|ground\|fx\|weapon\|enemies\|props\|render` | showcase-модуль вместо игры |
| `?bshow=crane\|ship\|boat\|sky` | вариант backdrop для `?show=backdrop` |
| `?cam=x,y,z,lx,ly,lz` | статичная камера |
| `?fov=`, `?exposure=` | переопределение камеры/экспозиции |
| `?seed=` | сид RNG (по умолчанию 4207); `?eseed=` — сид врагов |
| `?noaudio`, `?noweapon` | отключить звук/оружие |
| `?dt=0.016` | фиксированный шаг |
| `?post=0`, `?ao=0`, `?vol=0`, `?bloom=0`, `?mb=1`, `?dynres=0` | точечно выключить эффекты |

Глобалы: `window.__G` (весь граф модулей), `__stats()` (draw calls, tris, программы, разрешение, fps, state), `__setShot()`, `__errors`, `__frames`, `__ready`, `__fatal`.

Showcase-режимы удобны для осмотра контента без игры: `?show=level` — уровень с камеры, `?show=enemies` — Gull и Hound, `?show=weapon` — вьюмодель, `?show=mats` — витрина материалов, `?show=props` — сетка всех пропсов.

---

## 13. Замеры в headless (SwiftShader)

Условия: Microsoft Edge `--headless=new`, `--use-angle=swiftshader`, окно 1280×720 или 1600×900, `?q=low`, локальный `python http.server`. Это **не** репрезентативный GPU-профиль, но полезен как smoke-тест. Замеры сняты до локальных ремапов управления; на рендер они не влияют.

| Метрика | Значение |
|---|---|
| Ошибки JS | 0 (`__errors: []`) |
| Advanced pipeline | работает |
| Soft shadows (PCSS) | работает |
| Draw calls | 176 |
| Треугольники в кадре | 951 124 |
| Геометрии / текстуры / программы | 181 / 142 / 127 |
| Буфер | 890×412 (профиль `low`; динамический `scale` = 1.0 — адаптивное снижение не включалось) |
| FPS | ~13.5 (софт-рендер) |
| Уровень | 47 контейнеров, 298 пропсов, 96 атласов, 793 264 трис, 125 мешей |
| Материалы | 24 набора, 27.9 МБ текстур, 45.8 МБ «декалей» по счётчику модуля (включая атласы надписей собранного уровня) |
| Оружие | 30/150, 53 136 трис, 13 мешей |
| Аудио | 93 буфера, 2 IR, состояние `suspended` до жеста |
| Автовыбор (прогон без `?q`) | `medium` (браузер определился как SwiftShader) |

Все строки, кроме последней, — один прогон `?q=low`; автоопределение проверялось отдельным запуском без `?q`.

Скриншоты снимались там же (в репозиторий не коммитились): титул, геймплей на старте, `?show=level`, `?show=enemies`, `?show=weapon`, `?show=mats`, панель настроек.

---

## 14. Известные особенности и риски

1. **Melee (v1 на `feat/melee`).** Ранее `Melee` был объявлен в управлении и легенде без обработчика. Теперь Q → 1.8 м raycast, 40 урона, 0.8 с, state-machine rifle-butt swing 0.48 с с fire lockout, hitmarker/audio/camera kick; см. [MELEE.md](MELEE.md). Комбо, стелс-тейкдауны и отдельная модель ножа — вне v1.
2. **След артефакта.** В `<head>` остался `meta name="claude:viewport-fit-sides"`.
3. **«Nothing is downloaded» неточно:** шрифты тянутся с Google Fonts (офлайн — системные фолбэки). Остальное офлайн.
4. **Лицензия, CI, тесты, source map.** MIT покрывает изменения форка, оригинальный код/арт остаётся у автора (`NOTICE.md`). Код минифицирован, один файл 1.4 МБ — сложно сопровождать и диффить. Внутренние self-test'ы есть, но не запускаются автоматически.
5. **Тяжёлый старт.** Генерация десятков МБ текстур: на софт-рендере 12–16 с, на мобильном профиль `low` без AO и отражений.
6. **Юридический аспект.** Это зеркало чужого артефакта: автор указан, takedown предложен; MIT относится только к изменениям форка, оригинальный код/арт не лицензируется.
7. **Stub-несогласованность.** В fallback-режиме HUD покажет `KR-7`, а не `PAC-9 Longshore` — мелочь, видна только при отказе модуля `weapon`.

Не проблемы, но стоит знать: звук не запустится без жеста; pointer lock может быть недоступен (есть drag-look); на мобильных включается профиль `low` (без AO и отражений) и тач-управление; качество ограничено бюджетом пикселей профиля (low 1.0 Мпикс, medium 1.5, high 2.3, ultra 3.7).

---

## 15. Шпаргалка: где что менять

| Задача | Якорь (`grep`) | Комментарий |
|---|---|---|
| Волны, тайминги миссии, лимиты | `var Yi={introSeconds` | 3.5 с интро, 2.4 с вырезание, волны, `maxAlive` |
| Характеристики Gull | `var Zv={hp:45` | hp, болты, взрыв, орбита |
| Характеристики Hound | `var Kv={hp:140` | hp, очередь, рывок |
| Восприятие, токены, пулы | `var Ui={gull:` | 45 м, 200°, 2–3 токена, пулы |
| Ощущение игрока | `var Mt={walk:3.8` / `Pi={eye:` | скорости, гравитация, реген, отдача |
| Оружие | `mi={name:"PAC-9`, `Gv=30,B_=150,O_=720,H_=26` | модель, магазин, темп, урон |
| Профили качества | `Pr={test:` | scale/MSAA/shadow/tex/vol/AO/planar/bloom/MB/rain |
| Автовыбор качества | `function zy(` | детект GPU и мобилок |
| Настройки и дефолты | `XC={quality:"auto"`, `fM="saltline.settings.v1"` | localStorage |
| Уровень | `function C1(` | сборка, реле, спавны, кинематика |
| Мир и границы | `var oi={min:` | 80×60 м, море, стенка |
| Цех и причал | `no={X0:-16`, `lb={X:30` | размеры, лестница, фонари |
| Пропсы | `var Gi={container20` | 35 типов, размеры и материалы |
| Материалы и текстуры | `function Gg(` / `function wA(` | процедурные наборы, витрина |
| Небо и солнце | `Mn={dir:`, `en={zenith:` | палитра, направление, интенсивность |
| Физика, навигация | `function d3(`, `u1=.42,Ls=.5` | AABB/капсула, шаг, сетка 0.5 м |
| Пост-пайплайн | `function jy(` | все проходы и их параметры |
| Скай-шейдер | `SALTLINE_SKY` | небо, молнии, диск солнца |
| Звук | `Go={rifle_shot`, `nC=["ir_outdoor"` | 57 звуков, предзагрузка, IR |
| Музыка | `tm=["music_drone"` | 5 слоёв |
| HUD | `function hM(` | компас, маркеры, радио, здоровье |
| Меню и текст | `function pM(`, `_l={intro:` | экраны, настройки, радиореплики |
| Управление | `h_={KeyW:"forward"` | клавиши, тач, геймпад |
| Boot и цикл | `function QC(`, `window.__G=t` | порядок модулей, цикл |
| Bench/showcase | `function eP(`, `gM={mats:` | dev-режимы |

Если файл придётся править: он минифицирован, но GLSL-строки и часть комментариев читаемы. Быстрый способ разобраться в куске — вырезать `<script>` и прогнать через `npx js-beautify` или `npx prettier --parser babel` (на 1.4 МБ может быть медленно, лучше по частям).

---

## 16. Как поддерживать этот документ

- **Изменился `index.html`** — обновите sha256 и размер в шапке, затем разделы, которых коснулась правка (константы, качество, метрики).
- **Smoke-тест** — `npm run smoke` (`tools/smoke.sh`, под капотом — Приложение A); быстрый признак здоровья: `window.__errors` пуст, `render.stats.advanced === true`, `softShadows === true`.
- **Новые замеры** — Приложение B; в разделе 13 укажите условия (GPU/софт-рендер, `q`, окно), иначе цифры несопоставимы.
- **Новые якоря** — добавляйте в шпаргалку только строки, которые реально встречаются в файле; проверяйте `grep` перед коммитом.
- **Скриншоты** в репозиторий не кладём (вес); при необходимости — во внешнее хранилище или в `docs/img/` с осознанным решением по размеру.

---

## Приложение A. Быстрая проверка в headless (macOS)

Этот сценарий реализован в `tools/smoke.sh`: `npm run smoke` или `SERVE_DIR=dist SMOKE_NAME=dist npm run smoke`.

```sh
cd <repo>
python3 -m http.server 8731 &

"/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge" \
  --headless=new --no-sandbox --disable-gpu-sandbox \
  --user-data-dir=/tmp/edge-prof --no-first-run --disable-dev-shm-usage \
  --enable-unsafe-swiftshader --use-angle=swiftshader \
  --hide-scrollbars --window-size=1600,900 \
  --virtual-time-budget=20000 \
  --screenshot=/tmp/shot.png \
  "http://127.0.0.1:8731/?q=low"
```

Замечания:

- Без `--no-sandbox --disable-gpu-sandbox` в этой среде Edge падает с «Failed to initialize sandbox».
- `--virtual-time-budget` ускоряет таймеры, но кадры всё равно считаются реальным CPU; 15–30 с бюджета обычно достаточно.
- Для скриншотов контента используйте `?show=level|enemies|weapon|mats` (камера задаётся самим showcase) или `?autostart=1&q=low` для геймплея.
- Автодетект на SwiftShader даёт `medium`; `?q=low` ускоряет прогон.

## Приложение B. Probe: снять рантайм-метрики без CDP

В файле нет `<body>`, поэтому скрипт вставляется после единственного `</script>` в **копии** файла:

```python
src = open('index.html', encoding='utf-8').read()
probe = r'''
<script>
(function(){
  function glInfo(){
    try{ var c=window.__G.renderer.getContext(), e=c.getExtension('WEBGL_debug_renderer_info');
      return {renderer:e?c.getParameter(e.UNMASKED_RENDERER_WEBGL):c.getParameter(c.RENDERER),
              maxTex:c.getParameter(c.MAX_TEXTURE_SIZE)}; }catch(err){ return String(err); }
  }
  function snap(){
    var G=window.__G||{}, out={};
    out.quality=G.quality&&G.quality.name;
    out.errors=(window.__errors||[]).slice(0,12);
    try{ out.stats=window.__stats(); }catch(e){}
    try{ out.level=G.level&&G.level.stats; }catch(e){}
    try{ out.mats=G.mats&&G.mats.stats?G.mats.stats():null; }catch(e){}
    try{ out.weapon=G.weapon&&{name:G.weapon.name,mag:G.weapon.magSize,reserve:G.weapon.reserve,info:G.weapon.info}; }catch(e){}
    try{ out.audio=G.audio&&G.audio.debug?G.audio.debug():null; }catch(e){}
    out.gl=glInfo();
    var p=document.getElementById('probe')||document.createElement('pre');
    p.id='probe'; p.textContent='PROBE_JSON '+JSON.stringify(out);
    document.body.appendChild(p);
  }
  var n=0, iv=setInterval(function(){
    n++;
    if(window.__G&&window.__stats){ clearInterval(iv); setTimeout(snap,3000); }
    if(n>240){ clearInterval(iv); snap(); }
  },500);
})();
</script>
'''
open('/tmp/probe/index.html','w',encoding='utf-8').write(src.replace('</script>','</script>'+probe))
```

Затем поднимите сервер из `/tmp/probe`, запустите Edge из Приложения A с `--dump-dom` (вместо `--screenshot`) и вытащите строку `PROBE_JSON`:

```sh
python3 - <<'EOF'
import re, json
h = open('/tmp/probe-dom.html', encoding='utf-8').read()
m = re.search(r'PROBE_JSON (\{.*?\})</pre>', h, re.S)
print(json.dumps(json.loads(m.group(1)), indent=1, ensure_ascii=False))
EOF
```

Скрипт ждёт появления `window.__stats`, поэтому его не нужно синхронизировать с boot.

---

## Приложение C. Что проверено, а что нет

**Проверено:** загрузка и рендер в headless Chromium/Edge (SwiftShader), отсутствие JS-ошибок, работа advanced pipeline и PCSS, HUD/меню/настройки (включая обновлённую легенду управления), showcase-режимы `level`/`enemies`/`weapon`/`mats`, 200 OK на GitHub Pages, сетевой профиль (только Google Fonts), статический разбор основных подсистем и констант. Ремап управления проверен в headless синтетическими `keydown` + `input.update()`: `Shift` → `fire`, `X` → `sprint`, `E` → `ads`, `F` → `interact`, `Q` → `melee` (v1 на `feat/melee`), `Enter` огонь больше не включает; prompt показывает `F`.

**Не проверено:** реальный FPS на GPU, поведение на мобильных устройствах и в Safari/Firefox, полный проход миссии от старта до финала, звук на слух (self-test в коде есть, но я его не запускал), ввод с геймпада, поведение при отказе отдельных модулей (stub-пути), pointer lock на реальном устройстве.

Если понадобится — эти пробелы закрываются быстрее всего через `?show=…`/`?autostart` и CDP-скрипт, который эмулирует клики и клавиши.
