/*
 * JAAM Alert Card v1.4
 * Lovelace-картка для інтеграції jaam_ha (https://github.com/J-A-A-M/jaam_ha)
 * Показує стан тривоги в домашньому регіоні, рівень (жовтий/червоний)
 * та типи загроз з анімованими SVG-іконками.
 *
 * Сутності знаходяться автоматично через реєстр (platform: jaam_ha + translation_key),
 * тому entity_id вказувати не треба.
 *
 * Конфіг (усе необов'язкове):
 *   type: custom:jaam-alert-card
 *   device_id: <id пристрою>   # якщо JAAM-мап кілька
 *   title: Мапа тривог          # замість назви району
 *   show_temp: true             # температура в регіоні
 *   show_status: true           # індикатор WebSocket-з'єднання
 *   show_controls: true         # панель керування (мапа, дисплей, лампа, нічний, режими)
 *   show_climate: true          # рядок клімату кімнати (температура, вологість, тиск з датчика мапи)
 *
 * Керування: тап — перемкнути, довге натискання — вікно сутності (яскравість/колір лампи тощо).
 */

const CARD_VERSION = "1.4";

// Порядок = пріоритет для головної іконки
const THREATS = {
  nuclear:   { label: "Ядерна загроза" },
  chemical:  { label: "Хімічна загроза" },
  ballistic: { label: "Балістика" },
  missiles:  { label: "Ракети" },
  kab:       { label: "КАБи" },
  drones:    { label: "Ударні БпЛА" },
  artillery: { label: "Артобстріл" },
  urban:     { label: "Вуличні бої" },
  explosion: { label: "Небезпека вибухів" },
  recon:     { label: "Розвідувальні БпЛА" },
};

const LEVELS = {
  red:    { title: "Червоний рівень", sub: "Повітряна тривога", cls: "red" },
  yellow: { title: "Жовтий рівень",   sub: "Будьте уважні",     cls: "yellow" },
  air:    { title: "Повітряна тривога", sub: "",                cls: "red" },
  threat: { title: "Загроза",          sub: "",                 cls: "yellow" },
  safe:   { title: "Тривоги немає",    sub: "",                 cls: "safe" },
};

/* ---------------- [v1.3] Енергосистема і радіація домашнього регіону ---------------- */
const ENERGY_STATES = {
  sufficient:           { label: "Достатньо",          color: "#43a047", cls: "ok" },
  insufficient:         { label: "Не вистачає",        color: "#f9a825", cls: "warn" },
  significant_shortage: { label: "Значно не вистачає", color: "#fb8c00", cls: "warn2" },
  outage:               { label: "Відключення",        color: "#e53935", cls: "bad" },
};
// Пороги як у прошивці (RadiationConfig): 300 / 600 / 1000 нЗв/год
function radiationInfo(v) {
  if (!(v > 0))  return { label: "Немає даних",        color: null,      cls: "na" };
  if (v < 300)   return { label: "В межах норми",      color: "#43a047", cls: "ok" };
  if (v < 600)   return { label: "Підвищений",         color: "#f9a825", cls: "warn" };
  if (v < 1000)  return { label: "Вище норми",         color: "#fb8c00", cls: "warn2" };
  return           { label: "Суттєво вище норми",  color: "#e53935", cls: "bad" };
}

// Маленькі іконки для рядка погоди
const MINI = {
  pin:   `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5Z"/></svg>`,
  home:  `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 3 2 12h3v8h5v-6h4v6h5v-8h3L12 3Z"/></svg>`,
  temp:  `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M15 13V5a3 3 0 0 0-6 0v8a5 5 0 1 0 6 0Zm-3 7a3 3 0 0 1-1.5-5.6l.5-.3V5a1 1 0 0 1 2 0v9.1l.5.3A3 3 0 0 1 12 20Z"/></svg>`,
  drop:  `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2s-7 7.6-7 12.5a7 7 0 0 0 14 0C19 9.6 12 2 12 2Z"/></svg>`,
  gauge: `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 4a10 10 0 0 0-10 10c0 2.2.7 4.2 1.9 5.9l1.6-1.2A8 8 0 1 1 20 14c0 1.7-.5 3.3-1.5 4.7l1.6 1.2A10 10 0 0 0 12 4Zm4.2 4.4-5 4.6a2 2 0 1 0 2.4 2.4l4.6-5-2-2Z"/></svg>`,
};

/* ---------------- Анімовані SVG-іконки (viewBox 0 0 100 100, currentColor) ---------------- */

const ICONS = {
  // Щит: класи s-safe / s-yellow / s-red задають анімацію
  shield: `
    <svg viewBox="0 0 100 100" class="i-shield">
      <circle class="glow" cx="50" cy="50" r="40" fill="currentColor" opacity=".12"/>
      <circle class="wave w1" cx="50" cy="50" r="34" fill="none" stroke="currentColor" stroke-width="3"/>
      <circle class="wave w2" cx="50" cy="50" r="34" fill="none" stroke="currentColor" stroke-width="3"/>
      <g class="body">
        <path class="fillp" d="M50 14 L78 25 V48 C78 66 66 79 50 86 C34 79 22 66 22 48 V25 Z" fill="currentColor"/>
        <path d="M50 14 L78 25 V48 C78 66 66 79 50 86 C34 79 22 66 22 48 V25 Z"
              fill="none" stroke="currentColor" stroke-width="5" stroke-linejoin="round"/>
        <path class="check" d="M37 50 L47 60 L65 40" fill="none" stroke="currentColor"
              stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
        <g class="excl" fill="#fff">
          <rect x="46" y="30" width="8" height="28" rx="4"/><circle cx="50" cy="68" r="5"/>
        </g>
      </g>
    </svg>`,

  siren: `
    <svg viewBox="0 0 100 100" class="i-siren">
      <g class="beams" fill="currentColor" opacity=".35">
        <path d="M50 46 L8 30 L8 44 Z"/><path d="M50 46 L92 30 L92 44 Z"/>
      </g>
      <path d="M30 70 V52 C30 40 39 32 50 32 C61 32 70 40 70 52 V70 Z" fill="currentColor"/>
      <rect x="22" y="70" width="56" height="10" rx="3" fill="currentColor"/>
      <path class="flash" d="M42 50 C42 45 45 42 50 42" stroke="#fff" stroke-width="4"
            fill="none" stroke-linecap="round"/>
      <g class="rays" stroke="currentColor" stroke-width="4" stroke-linecap="round">
        <line x1="50" y1="12" x2="50" y2="22"/><line x1="22" y1="22" x2="28" y2="29"/>
        <line x1="78" y1="22" x2="72" y2="29"/>
      </g>
    </svg>`,

  drones: `
    <svg viewBox="0 0 100 100" class="i-drone">
      <g class="hover">
        <g stroke="currentColor" stroke-width="5" stroke-linecap="round">
          <line x1="30" y1="30" x2="70" y2="70"/><line x1="70" y1="30" x2="30" y2="70"/>
        </g>
        <rect x="40" y="40" width="20" height="20" rx="5" fill="currentColor"/>
        <circle cx="50" cy="50" r="3" fill="#fff" class="led"/>
        <g fill="currentColor" opacity=".55">
          <ellipse class="rotor" cx="27" cy="27" rx="15" ry="3.5"/>
          <ellipse class="rotor r2" cx="73" cy="27" rx="15" ry="3.5"/>
          <ellipse class="rotor r2" cx="27" cy="73" rx="15" ry="3.5"/>
          <ellipse class="rotor" cx="73" cy="73" rx="15" ry="3.5"/>
        </g>
      </g>
    </svg>`,

  missiles: `
    <svg viewBox="0 0 100 100" class="i-missile">
      <g class="fly">
        <g class="trail" stroke="currentColor" stroke-width="3" stroke-linecap="round" opacity=".5">
          <line x1="4" y1="50" x2="22" y2="50"/><line x1="10" y1="42" x2="24" y2="42"/>
          <line x1="10" y1="58" x2="24" y2="58"/>
        </g>
        <path class="flame" d="M30 44 L20 50 L30 56 Z" fill="#ff9800"/>
        <path d="M30 44 H72 L88 50 L72 56 H30 Z" fill="currentColor"/>
        <path d="M34 44 L28 34 H40 L46 44 Z M34 56 L28 66 H40 L46 56 Z" fill="currentColor"/>
        <path d="M58 46 H66 V54 H58 Z" fill="#fff" opacity=".35"/>
      </g>
    </svg>`,

  ballistic: `
    <svg viewBox="0 0 100 100" class="i-ballistic">
      <path d="M8 86 Q50 -20 92 86" fill="none" stroke="currentColor" stroke-width="2.5"
            stroke-dasharray="4 5" opacity=".45"/>
      <line x1="4" y1="88" x2="96" y2="88" stroke="currentColor" stroke-width="3" opacity=".6"/>
      <g>
        <path d="M-10 -4 H6 L12 0 L6 4 H-10 Z" fill="currentColor"/>
        <path d="M-10 -4 L-15 0 L-10 4 Z" fill="#ff9800"/>
        <animateMotion dur="2.4s" repeatCount="indefinite" rotate="auto"
                       path="M8 86 Q50 -20 92 86"/>
      </g>
      <circle class="impact" cx="92" cy="86" r="6" fill="#ff9800"/>
    </svg>`,

  kab: `
    <svg viewBox="0 0 100 100" class="i-kab">
      <g class="fall">
        <g class="wobble">
          <path d="M42 22 H58 V62 C58 72 54 80 50 84 C46 80 42 72 42 62 Z" fill="currentColor"/>
          <path d="M42 26 L30 16 V30 Z M58 26 L70 16 V30 Z" fill="currentColor"/>
          <path d="M42 48 L18 56 L42 54 Z M58 48 L82 56 L58 54 Z" fill="currentColor" opacity=".8"/>
        </g>
      </g>
      <g class="whistle" stroke="currentColor" stroke-width="3" stroke-linecap="round" opacity=".5">
        <line x1="34" y1="4" x2="34" y2="14"/><line x1="66" y1="4" x2="66" y2="14"/>
        <line x1="50" y1="0" x2="50" y2="10"/>
      </g>
    </svg>`,

  artillery: `
    <svg viewBox="0 0 100 100" class="i-artillery">
      <g class="recoil">
        <rect x="34" y="40" width="50" height="10" rx="3" fill="currentColor"
              transform="rotate(-25 40 60)"/>
      </g>
      <circle class="muzzle" cx="84" cy="30" r="9" fill="#ff9800"/>
      <circle class="shell" cx="84" cy="30" r="3" fill="currentColor"/>
      <path d="M22 62 H62 L66 72 H18 Z" fill="currentColor"/>
      <circle cx="30" cy="78" r="9" fill="none" stroke="currentColor" stroke-width="5"/>
      <circle cx="56" cy="78" r="9" fill="none" stroke="currentColor" stroke-width="5"/>
    </svg>`,

  explosion: `
    <svg viewBox="0 0 100 100" class="i-explosion">
      <circle class="ring" cx="50" cy="52" r="20" fill="none" stroke="currentColor" stroke-width="3"/>
      <path class="burst" fill="currentColor"
        d="M50 12 L58 34 L80 22 L70 44 L92 52 L70 60 L80 82 L58 70 L50 92 L42 70 L20 82 L30 60 L8 52 L30 44 L20 22 L42 34 Z"/>
      <path class="core" fill="#ff9800"
        d="M50 32 L55 45 L68 40 L61 52 L68 64 L55 59 L50 72 L45 59 L32 64 L39 52 L32 40 L45 45 Z"/>
    </svg>`,

  urban: `
    <svg viewBox="0 0 100 100" class="i-urban">
      <path class="flash f1" d="M28 18 L32 26 L24 26 Z" fill="#ff9800"/>
      <path class="flash f2" d="M72 12 L77 22 L67 22 Z" fill="#ff9800"/>
      <g fill="currentColor">
        <rect x="10" y="44" width="20" height="46"/><rect x="34" y="28" width="22" height="62"/>
        <rect x="60" y="38" width="16" height="52"/><rect x="80" y="54" width="12" height="36"/>
      </g>
      <g fill="#fff" opacity=".7">
        <rect class="w w1" x="15" y="52" width="4" height="5"/><rect class="w w2" x="21" y="64" width="4" height="5"/>
        <rect class="w w3" x="39" y="36" width="4" height="5"/><rect class="w w1" x="47" y="50" width="4" height="5"/>
        <rect class="w w2" x="39" y="66" width="4" height="5"/><rect class="w w3" x="65" y="46" width="4" height="5"/>
        <rect class="w w1" x="65" y="62" width="4" height="5"/><rect class="w w2" x="84" y="62" width="4" height="5"/>
      </g>
    </svg>`,

  chemical: `
    <svg viewBox="0 0 100 100" class="i-chemical">
      <path d="M40 14 H60 M44 14 V40 L22 80 C20 85 23 88 28 88 H72 C77 88 80 85 78 80 L56 40 V14"
            fill="none" stroke="currentColor" stroke-width="5" stroke-linejoin="round"/>
      <path d="M31 66 H69 L76 81 C77 84 75 85 72 85 H28 C25 85 23 84 24 81 Z" fill="currentColor" opacity=".6"/>
      <circle class="bub b1" cx="42" cy="76" r="3.5" fill="currentColor"/>
      <circle class="bub b2" cx="54" cy="78" r="2.5" fill="currentColor"/>
      <circle class="bub b3" cx="60" cy="74" r="3" fill="currentColor"/>
    </svg>`,

  nuclear: `
    <svg viewBox="0 0 100 100" class="i-nuclear">
      <circle class="pulse" cx="50" cy="50" r="40" fill="none" stroke="currentColor" stroke-width="3"/>
      <g class="spin" fill="currentColor">
        <path d="M50 50 L36 26 A28 28 0 0 1 64 26 Z"/>
        <path d="M50 50 L78 50 A28 28 0 0 1 64 74 Z"/>
        <path d="M50 50 L36 74 A28 28 0 0 1 22 50 Z"/>
      </g>
      <circle cx="50" cy="50" r="8" fill="currentColor" stroke="var(--jac-bg)" stroke-width="3"/>
    </svg>`,

  recon: `
    <svg viewBox="0 0 100 100" class="i-recon">
      <path d="M8 50 C22 28 36 20 50 20 C64 20 78 28 92 50 C78 72 64 80 50 80 C36 80 22 72 8 50 Z"
            fill="none" stroke="currentColor" stroke-width="5"/>
      <g class="look">
        <circle cx="50" cy="50" r="14" fill="currentColor"/>
        <circle cx="54" cy="46" r="4" fill="#fff" opacity=".8"/>
      </g>
      <line class="scan" x1="12" y1="50" x2="88" y2="50" stroke="currentColor" stroke-width="2" opacity=".5"/>
    </svg>`,
};


/* ---------------- Керування ---------------- */
const CONTROLS = [
  { key: "map",        domain: "switch", label: "Мапа",    cls: "map" },
  { key: "display",    domain: "switch", label: "Дисплей", cls: "display" },
  { key: "lamp",       domain: "light",  label: "Лампа",   cls: "lamp" },
  { key: "night_mode", domain: "switch", label: "Нічний",  cls: "night" },
];
const SELECTS = [
  { key: "map_mode",     label: "Режим мапи",    cls: "mapm" },
  { key: "display_mode", label: "Режим дисплею", cls: "dispm" },
];
/* [v1.4] Яскравість: режим + повзунки з іконками (показуються залежно від режиму) */
const BR_MODE_KEY = "brightness_mode";
const BR_ICONS = {
  head:   `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10Zm0-5 1.8 3.2h-3.6L12 2Zm0 20-1.8-3.2h3.6L12 22ZM2 12l3.2-1.8v3.6L2 12Zm20 0-3.2 1.8v-3.6L22 12ZM4.9 4.9l3.6.9-2.7 2.7-.9-3.6Zm14.2 14.2-3.6-.9 2.7-2.7.9 3.6ZM4.9 19.1l.9-3.6 2.7 2.7-3.6.9ZM19.1 4.9l-.9 3.6-2.7-2.7 3.6-.9Z"/></svg>`,
  sunBig: `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10Zm-1-5h2v3h-2V2Zm0 17h2v3h-2v-3ZM2 11h3v2H2v-2Zm17 0h3v2h-3v-2ZM4.2 5.6l1.4-1.4 2.1 2.1-1.4 1.4-2.1-2.1Zm12.1 12.1 1.4-1.4 2.1 2.1-1.4 1.4-2.1-2.1ZM4.2 18.4l2.1-2.1 1.4 1.4-2.1 2.1-1.4-1.4ZM16.3 6.3l2.1-2.1 1.4 1.4-2.1 2.1-1.4-1.4Z"/></svg>`,
  sunSmall: `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm-.8-4.5h1.6v2.6h-1.6V3.5Zm0 14.4h1.6v2.6h-1.6v-2.6ZM3.5 11.2h2.6v1.6H3.5v-1.6Zm14.4 0h2.6v1.6h-2.6v-1.6Z" opacity=".95"/></svg>`,
  moon:   `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12.3 3a9 9 0 1 0 8.7 11.4A7.5 7.5 0 0 1 12.3 3Z"/></svg>`,
  tune:   `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M3 17v2h6v-2H3ZM3 5v2h10V5H3Zm10 16v-2h8v-2h-8v-2h-2v6h2ZM7 9v2H3v2h4v2h2V9H7Zm14 4v-2H11v2h10Zm-6-4h2V7h4V5h-4V3h-2v6Z"/></svg>`,
  monitor: `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M3 4h18a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1h-7v2h3v2H7v-2h3v-2H3a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Zm1 2v9h16V6H4Z"/></svg>`,
  monitorDim: `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M3 4h18a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1h-7v2h3v2H7v-2h3v-2H3a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Zm1 2v9h16V6H4Z"/><path fill="currentColor" d="M12 8a3.5 3.5 0 0 0 0 7V8Z" opacity=".85"/></svg>`,
  chevron: `<svg viewBox="0 0 24 24"><path fill="currentColor" d="m7 10 5 5 5-5H7Z"/></svg>`,
};
const BR_MAP = (m) => m === "sensor" || m === "auto";
const BR_SLIDERS = [
  { key: "brightness_max",           label: "Велика",                  icon: "sunBig",     min: 0,   max: 100, step: 1,   unit: "%", show: (m) => BR_MAP(m) },
  { key: "brightness_min_day",       label: "Мала день",               icon: "sunSmall",   min: 0,   max: 100, step: 1,   unit: "%", show: (m) => BR_MAP(m) },
  { key: "brightness_min_night",     label: "Мала ніч",                icon: "moon",       min: 0,   max: 100, step: 1,   unit: "%", show: (m) => BR_MAP(m) },
  { key: "light_sensor_sensitivity", label: "Чутливість",              icon: "tune",       min: 0.1, max: 30,  step: 0.1, unit: "",  show: (m) => m === "auto" },
  { key: "display_brightness",       label: "Яскравість дисплея",      icon: "monitor",    min: 1,   max: 100, step: 1,   unit: "%", show: () => true },
  { key: "display_brightness_min",   label: "Мін. дисплея", icon: "monitorDim", min: 1,   max: 100, step: 1,   unit: "%", show: (m, c) => c.on("display_auto_brightness") },
];
const BR_TOGGLES = [
  { key: "display_auto_brightness", label: "Автояскравість дисплея" },
  { key: "display_off_at_night",    label: "Вимикати дисплей вночі" },
];
const BR_KEYS = [BR_MODE_KEY].concat(BR_SLIDERS.map((x) => x.key), BR_TOGGLES.map((x) => x.key), ["brightness_current"]);

const MODE_NAMES = {
  day_night: "День/Ніч", sensor: "Сенсор освітлення", auto: "Автояскравість",
  disabled: "Вимкнено", off: "Вимкнено", alert: "Тривога", energy_system: "Енергосистема", weather: "Погода",
  radiation: "Радіація", flag: "Прапор", random: "Випадкові", lamp: "Лампа", clock: "Годинник",
  technical: "Технічна", microclimate: "Мікроклімат", combined: "Комбінований",
};
const CTRL_ICONS = {
  map: `<svg viewBox="0 0 40 40" class="ci-map">
      <path d="M5 10 L14 6 L26 10 L35 6 V30 L26 34 L14 30 L5 34 Z" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/>
      <path d="M14 6 V30 M26 10 V34" stroke="currentColor" stroke-width="2" opacity=".5"/>
      <g class="pin"><path d="M20 12 C16.5 12 15 14.5 15 16.8 C15 20 20 25 20 25 C20 25 25 20 25 16.8 C25 14.5 23.5 12 20 12 Z" fill="currentColor"/>
      <circle cx="20" cy="17" r="2" fill="var(--jac-bg)"/></g></svg>`,
  display: `<svg viewBox="0 0 40 40" class="ci-display">
      <rect x="4" y="7" width="32" height="21" rx="3" fill="none" stroke="currentColor" stroke-width="2.4"/>
      <path d="M15 34 H25 M20 28 V34" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>
      <g class="scr"><rect x="8" y="12" width="24" height="2.4" rx="1.2" fill="currentColor" opacity=".7"/></g>
      <rect x="9" y="19" width="9" height="5" rx="1" fill="currentColor" opacity=".5"/><rect x="21" y="19" width="10" height="2" rx="1" fill="currentColor" opacity=".5"/></svg>`,
  lamp: `<svg viewBox="0 0 40 40" class="ci-lamp">
      <g class="rays" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
        <line x1="20" y1="1" x2="20" y2="4"/><line x1="6" y1="7" x2="8.5" y2="9.5"/><line x1="34" y1="7" x2="31.5" y2="9.5"/>
        <line x1="1.5" y1="19" x2="4.5" y2="19"/><line x1="38.5" y1="19" x2="35.5" y2="19"/></g>
      <path class="bulb" d="M20 7 C13.5 7 10 11.5 10 16.5 C10 20.5 12.5 22.5 14 24.5 V27 H26 V24.5 C27.5 22.5 30 20.5 30 16.5 C30 11.5 26.5 7 20 7 Z" fill="currentColor" opacity=".9"/>
      <path d="M15 30 H25 M16.5 33.5 H23.5" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>`,
  night: `<svg viewBox="0 0 40 40" class="ci-night">
      <path class="moon" d="M24 6 C16 6.5 10 13 10 21 C10 29 16.5 35 24.5 35 C29 35 32.5 33 35 30 C33.5 30.5 32 30.8 30.5 30.8 C23 30.8 17.5 25 17.5 17.5 C17.5 12.6 20 8.5 24 6 Z" fill="currentColor"/>
      <g class="stars" fill="currentColor"><circle cx="29" cy="11" r="1.8"/><circle cx="34" cy="18" r="1.3"/><circle cx="26" cy="20" r="1.1"/></g></svg>`,
};

const INFO_ICONS = {
  radiation: `
    <svg viewBox="0 0 100 100" class="i-rad">
      <circle class="halo" cx="50" cy="50" r="44" fill="none" stroke="currentColor" stroke-width="3"/>
      <circle cx="50" cy="50" r="44" fill="currentColor" opacity=".10"/>
      <g fill="currentColor" opacity=".38">
        <path d="M50 50 L36 26 A28 28 0 0 1 64 26 Z"/>
        <path d="M50 50 L78 50 A28 28 0 0 1 64 74 Z"/>
        <path d="M50 50 L36 74 A28 28 0 0 1 22 50 Z"/>
      </g>
    </svg>`,
  energy: `
    <svg viewBox="0 0 100 100" class="i-energy">
      <circle class="glow" cx="50" cy="50" r="44" fill="currentColor" opacity=".12"/>
      <path class="bolt" d="M57 6 L22 56 H45 L38 94 L78 40 H55 Z" fill="currentColor"/>
      <g class="spark" stroke="currentColor" stroke-width="5" stroke-linecap="round">
        <line x1="12" y1="30" x2="20" y2="35"/><line x1="88" y1="66" x2="80" y2="61"/>
      </g>
    </svg>`,
};

const STYLE = `
  :host { --jac-red:#e53935; --jac-yellow:#f9a825; --jac-safe:#43a047; --jac-bg: var(--ha-card-background, var(--card-background-color, #1c1c1c)); }
  ha-card { overflow:hidden; position:relative; transition: background .6s; }
  ha-card.red    { --jac-c: var(--jac-red);    background: linear-gradient(135deg, color-mix(in srgb, var(--jac-red) 22%, var(--jac-bg)), var(--jac-bg) 70%); }
  ha-card.yellow { --jac-c: var(--jac-yellow); background: linear-gradient(135deg, color-mix(in srgb, var(--jac-yellow) 20%, var(--jac-bg)), var(--jac-bg) 70%); }
  ha-card.safe   { --jac-c: var(--jac-safe); }
  ha-card.red::before { content:""; position:absolute; inset:0; border:2px solid var(--jac-red); border-radius:inherit;
    animation: border-pulse 1.6s ease-in-out infinite; pointer-events:none; }

  .top { display:flex; align-items:center; gap:8px; padding:14px 16px 0; color: var(--secondary-text-color); font-size:14px; }
  .top .name { flex:1; font-weight:500; color: var(--primary-text-color); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .dot { width:8px; height:8px; border-radius:50%; background: var(--jac-safe); }
  .dot.off { background: var(--disabled-text-color, #777); }

  .hero { display:flex; align-items:center; gap:16px; padding:12px 16px 16px; cursor:pointer; }
  .hero .icon { width:96px; height:96px; flex:none; color: var(--jac-c); }
  .hero .icon svg { width:100%; height:100%; overflow:visible; }
  .hero .text { min-width:0; }
  .level { font-size:24px; font-weight:700; line-height:1.15; color: var(--jac-c); }
  .sub { font-size:15px; color: var(--primary-text-color); margin-top:4px; }
  .dur { font-size:13px; color: var(--secondary-text-color); margin-top:6px; }

  /* Сітка загроз: 3 в ряд, останній неповний ряд — по центру (6 підколонок) */
  .grid { display:grid; grid-template-columns: repeat(6, 1fr); gap:8px; padding:0 12px 14px; }
  .tile { grid-column: span 2; display:flex; flex-direction:column; align-items:center; gap:4px;
    padding:10px 4px 8px; border-radius:12px; text-align:center; font-size:12px; line-height:1.2;
    color: var(--disabled-text-color, #6f6f6f); background: rgba(127,127,127,.06); transition: background .4s, color .4s; }
  .tile:last-child:nth-child(3n+1) { grid-column: 3 / span 2; }
  .tile:nth-last-child(2):nth-child(3n+1) { grid-column: 2 / span 2; }
  .tile svg { width:42px; height:42px; overflow:visible; opacity:.45; }
  .tile.on { color: var(--jac-c); background: color-mix(in srgb, var(--jac-c) 16%, transparent); font-weight:600; }
  .tile.on svg { opacity:1; }
  /* неактивні: без анімації, без кольорових вставок */
  .tile:not(.on):not(.info) svg *, .tile:not(.on):not(.info) svg { animation: none !important; }

  /* [v1.3] Інформаційні плитки: енергосистема й радіація - завжди кольорові */
  .tile.info { --tc: var(--disabled-text-color, #7a7a7a); cursor:pointer;
    color: var(--primary-text-color); background: color-mix(in srgb, var(--tc) 15%, transparent); }
  .tile.info .ico { position:relative; width:42px; height:42px; color: var(--tc); }
  .tile.info .ico svg { opacity:1; width:42px; height:42px; }
  .tile.info .val { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center;
    font-weight:800; font-size:14px; line-height:1; color: var(--primary-text-color);
    text-shadow: 0 0 4px var(--jac-bg), 0 0 2px var(--jac-bg); }
  .tile.info .val small { font-size:7px; font-weight:700; opacity:.85; margin-top:1px; }
  .tile.info .ttl { font-size:11px; color: var(--secondary-text-color); }
  .tile.info .st { font-weight:600; color: var(--tc); }
  .tile.info.na .st { color: var(--secondary-text-color); font-weight:400; }
  .i-rad .halo { opacity:.35; }
  .tile.info.warn .i-rad .halo, .tile.info.warn2 .i-rad .halo { animation: ring 2.4s ease-out infinite; opacity:1; }
  .tile.info.bad .i-rad .halo { animation: ring 1.2s ease-out infinite; opacity:1; }
  .i-energy .spark { opacity:0; }
  .tile.info.ok .i-energy .glow { animation: breathe 3s ease-in-out infinite; }
  .tile.info.warn .i-energy .bolt, .tile.info.warn2 .i-energy .bolt { animation: flicker 3s steps(1) infinite; }
  .tile.info.warn2 .i-energy .spark { opacity:1; animation: blink 1.4s steps(2) infinite; }
  .tile.info.bad .i-energy .bolt { animation: blink .8s steps(2) infinite; }
  .tile.info.bad .i-energy .spark { opacity:1; animation: blink .4s steps(2) infinite; }
  @keyframes flicker { 0%,100%{opacity:1} 8%{opacity:.35} 10%{opacity:1} 55%{opacity:1} 57%{opacity:.5} 59%{opacity:1} }

  /* [v1.3] Рядок погоди: регіон у першому рядку, клімат кімнати - під ним */
  .top .rt { display:inline-flex; align-items:center; gap:3px; }
  .mini { width:14px; height:14px; flex:none; opacity:.75; }
  .clim { display:flex; flex-wrap:wrap; gap:4px 14px; padding:6px 16px 0; font-size:13px; color: var(--secondary-text-color); }
  .clim span { display:inline-flex; align-items:center; gap:4px; }
  .clim b { font-weight:600; color: var(--primary-text-color); }
  .tile:not(.on) .flame, .tile:not(.on) .muzzle, .tile:not(.on) .shell, .tile:not(.on) .impact,
  .tile:not(.on) .flash, .tile:not(.on) .ring, .tile:not(.on) .pulse, .tile:not(.on) .whistle,
  .tile:not(.on) .core, .tile:not(.on) .scan { display:none; }
  .empty { padding:16px; color: var(--secondary-text-color); }

  /* Панель керування */
  .ctrl { border-top: 1px solid var(--divider-color, rgba(127,127,127,.18)); padding:12px 12px 14px; }
  .ctrl:empty { display:none; }
  .btns { display:grid; grid-template-columns: repeat(4, 1fr); gap:8px; }
  .btn { --bc: var(--primary-color, #03a9f4); position:relative; display:flex; flex-direction:column; align-items:center; gap:5px;
    padding:12px 4px 9px; border-radius:16px; font-size:12px; color: var(--secondary-text-color);
    background: rgba(127,127,127,.07); border:1px solid transparent; cursor:pointer; overflow:hidden;
    user-select:none; -webkit-user-select:none; -webkit-tap-highlight-color: transparent;
    transition: background .35s, color .35s, border-color .35s, transform .12s; }
  .btn svg { width:34px; height:34px; overflow:visible; }
  .btn.on { color: var(--primary-text-color); border-color: color-mix(in srgb, var(--bc) 45%, transparent);
    background: radial-gradient(120% 90% at 50% 0%, color-mix(in srgb, var(--bc) 30%, transparent), color-mix(in srgb, var(--bc) 8%, transparent)); }
  .btn.on svg { color: var(--bc); filter: drop-shadow(0 0 6px color-mix(in srgb, var(--bc) 70%, transparent)); }
  .btn.na { opacity:.35; pointer-events:none; }
  .btn:active { transform: scale(.94); }
  .btn.night { --bc:#7e8cff; } .btn.map { --bc:#2ec4b6; } .btn.display { --bc:#4fc3f7; }
  .btn:not(.on) svg * { animation: none !important; }
  .btn:not(.on) .rays, .btn:not(.on) .stars, .btn:not(.on) .scr { opacity:0; }

  .modes { margin-top:12px; display:flex; flex-direction:column; gap:10px; }
  .mrow .mlabel { font-size:11px; letter-spacing:.04em; text-transform:uppercase; color: var(--secondary-text-color); margin:0 4px 6px; }
  .pills { display:flex; gap:6px; overflow-x:auto; scrollbar-width:none; padding:2px 2px 4px; scroll-snap-type:x proximity;
    -webkit-mask-image: linear-gradient(90deg, #000 calc(100% - 18px), transparent); mask-image: linear-gradient(90deg, #000 calc(100% - 18px), transparent); }
  .pills::-webkit-scrollbar { display:none; }
  /* [v1.4] розділ яскравості */
  .br { margin-top:12px; border-top:1px solid var(--divider-color, rgba(127,127,127,.18)); padding-top:6px; --pc:#ffb300; }
  .br.na { opacity:.5; pointer-events:none; }
  .brh { display:flex; align-items:center; gap:10px; padding:8px 4px; cursor:pointer; user-select:none; }
  .brh .hic { width:22px; height:22px; color:var(--pc); flex:none; }
  .brh .hic svg, .srow .sic svg { width:100%; height:100%; display:block; }
  .brh .ttl { font-weight:600; flex:1; }
  .brh .cur { font-size:13px; color:var(--secondary-text-color); }
  .brh .chev { width:22px; height:22px; color:var(--secondary-text-color); transition:transform .25s; flex:none; }
  .br.open .brh .chev { transform: rotate(180deg); }
  .brb { display:none; padding:2px 0 4px; }
  .br.open .brb { display:block; }
  .br .mrow { margin-bottom:6px; }
  .srow { display:flex; align-items:center; gap:10px; padding:7px 4px; }
  .srow .sic { width:22px; height:22px; color:var(--pc); flex:none; }
  .srow .slab { flex:0 0 38%; font-size:14px; line-height:1.15; }
  .srow .sval { flex:0 0 46px; text-align:right; font-size:13px; font-variant-numeric: tabular-nums; color:var(--secondary-text-color); }
  .srow input[type=range] { flex:1; min-width:0; height:28px; margin:0; background:transparent; -webkit-appearance:none; appearance:none; cursor:pointer; touch-action:pan-y; }
  .srow input[type=range]::-webkit-slider-runnable-track { height:6px; border-radius:3px;
    background: linear-gradient(to right, var(--pc) var(--p,0%), color-mix(in srgb, var(--primary-text-color) 18%, transparent) var(--p,0%)); }
  .srow input[type=range]::-moz-range-track { height:6px; border-radius:3px; background: color-mix(in srgb, var(--primary-text-color) 18%, transparent); }
  .srow input[type=range]::-moz-range-progress { height:6px; border-radius:3px; background: var(--pc); }
  .srow input[type=range]::-webkit-slider-thumb { -webkit-appearance:none; width:20px; height:20px; border-radius:50%; margin-top:-7px;
    background: var(--pc); border:3px solid var(--jac-bg); box-shadow:0 0 0 1px var(--pc); }
  .srow input[type=range]::-moz-range-thumb { width:14px; height:14px; border-radius:50%; background: var(--pc); border:3px solid var(--jac-bg); box-shadow:0 0 0 1px var(--pc); }
  .tgs { display:flex; flex-wrap:wrap; gap:6px; padding:6px 2px 2px; }
  .tg { padding:7px 13px; border-radius:999px; font-size:13px; cursor:pointer; border:1px solid var(--divider-color, rgba(127,127,127,.3));
    color:var(--secondary-text-color); transition: background .2s, color .2s; user-select:none; }
  .tg.on { color:#fff; font-weight:600; border-color:transparent; background: var(--pc); }
  .pill { flex:none; scroll-snap-align:start; padding:7px 13px; border-radius:999px; font-size:13px; white-space:nowrap; cursor:pointer;
    color: var(--secondary-text-color); background: rgba(127,127,127,.08); border:1px solid transparent;
    -webkit-tap-highlight-color: transparent; transition: all .25s; }
  .pill.sel { color:#fff; font-weight:600; border-color: transparent;
    background: linear-gradient(135deg, var(--pc, var(--primary-color)), color-mix(in srgb, var(--pc, var(--primary-color)) 60%, #000));
    box-shadow: 0 2px 10px color-mix(in srgb, var(--pc, var(--primary-color)) 45%, transparent); }
  .mrow.mapm { --pc:#2ec4b6; } .mrow.dispm { --pc:#4fc3f7; }

  /* анімації іконок керування */
  .ci-lamp .rays { animation: rays 2s ease-in-out infinite; }
  .ci-lamp .bulb { animation: glowp 2s ease-in-out infinite; }
  .ci-night .stars circle { animation: twinkle 1.6s ease-in-out infinite; }
  .ci-night .stars circle:nth-child(2) { animation-delay:.5s; } .ci-night .stars circle:nth-child(3) { animation-delay:1s; }
  .ci-night .moon { animation: sway 4s ease-in-out infinite; }
  .ci-display .scr { animation: scr 2.2s linear infinite; }
  .ci-map .pin { animation: pin 1.6s ease-in-out infinite; }
  @keyframes rays { 50% { transform: scale(1.18); opacity:.5; } }
  @keyframes glowp { 50% { opacity:.75; } }
  @keyframes twinkle { 50% { transform: scale(.3); opacity:.2; } }
  @keyframes scr { 0% { transform: translateY(-8px); opacity:0 } 20%{opacity:.9} 100% { transform: translateY(12px); opacity:0 } }
  @keyframes pin { 50% { transform: translateY(-5px); } }

  svg * { transform-box: fill-box; transform-origin: center; }

  @keyframes border-pulse { 50% { opacity:.15; } }
  /* shield */
  .i-shield .fillp { opacity:0; }
  .i-shield .wave, .i-shield .excl { display:none; }
  .s-safe .i-shield .glow { animation: breathe 3s ease-in-out infinite; }
  /* жовтий: щит залитий напівпрозоро, «!», повільні хвилі, легке погойдування */
  .s-yellow .i-shield .check, .s-red .i-shield .check { display:none; }
  .s-yellow .i-shield .excl, .s-red .i-shield .excl, .s-yellow .i-shield .wave, .s-red .i-shield .wave { display:inline; }
  .s-yellow .i-shield .fillp { opacity:.55; }
  .s-yellow .i-shield .body { animation: sway 2.4s ease-in-out infinite; }
  .s-yellow .i-shield .wave { animation: wave 2.4s ease-out infinite; }
  .s-yellow .i-shield .w2 { animation-delay: 1.2s; }
  /* червоний: повна заливка, мигання «!», швидкі хвилі, удар-пульс */
  .s-red .i-shield .fillp { opacity:.9; }
  .s-red .i-shield .body { animation: thump 1s ease-in-out infinite; }
  .s-red .i-shield .excl { animation: blink .5s steps(2) infinite; }
  .s-red .i-shield .glow { animation: breathe 1s ease-in-out infinite; opacity:.3; }
  .s-red .i-shield .wave { animation: wave 1.2s ease-out infinite; }
  .s-red .i-shield .w2 { animation-delay: .6s; }
  @keyframes sway { 0%,100%{transform:rotate(-4deg)} 50%{transform:rotate(4deg)} }
  @keyframes thump { 0%,100%{transform:scale(1)} 15%{transform:scale(1.1)} 30%{transform:scale(.97)} 45%{transform:scale(1.05)} }
  @keyframes wave { 0%{transform:scale(.9);opacity:.8} 100%{transform:scale(1.5);opacity:0} }
  @keyframes breathe { 50% { transform: scale(1.15); opacity:.04; } }
  /* siren */
  .i-siren .beams { transform-origin: 50px 46px; transform-box: view-box; animation: beam 1s linear infinite; }
  .i-siren .rays { animation: blink .5s steps(2) infinite; }
  @keyframes beam { 0%{transform:scaleX(1)} 50%{transform:scaleX(-1)} 100%{transform:scaleX(1)} }
  @keyframes blink { 50% { opacity:0; } }
  /* drone */
  .i-drone .rotor { animation: rotor .18s linear infinite; }
  .i-drone .r2 { animation-direction: reverse; }
  .i-drone .hover { animation: hover 2.2s ease-in-out infinite; }
  .i-drone .led { animation: blink 1s steps(2) infinite; }
  @keyframes rotor { to { transform: rotate(360deg); } }
  @keyframes hover { 50% { transform: translateY(-5px) rotate(-3deg); } }
  /* missile */
  .i-missile .fly { animation: fly 2.4s ease-in-out infinite; }
  .i-missile .flame { animation: flame .12s ease-in-out infinite alternate; transform-origin: right center; }
  .i-missile .trail { animation: trail .4s linear infinite; }
  @keyframes fly { 0%{transform:translate(-14px,6px)} 50%{transform:translate(8px,-4px)} 100%{transform:translate(-14px,6px)} }
  @keyframes flame { to { transform: scaleX(1.6); } }
  @keyframes trail { to { transform: translateX(-8px); opacity:.1; } }
  /* ballistic */
  .i-ballistic .impact { animation: impact 2.4s ease-out infinite; }
  @keyframes impact { 0%,92%{transform:scale(0);opacity:0} 95%{transform:scale(1.8);opacity:1} 100%{transform:scale(2.6);opacity:0} }
  /* kab */
  .i-kab .fall { animation: fall 1.8s ease-in infinite; }
  .i-kab .wobble { animation: wobble .3s ease-in-out infinite alternate; }
  .i-kab .whistle { animation: blink .3s steps(2) infinite; }
  @keyframes fall { 0%{transform:translateY(-22px);opacity:0} 15%{opacity:1} 85%{opacity:1} 100%{transform:translateY(14px);opacity:0} }
  @keyframes wobble { from{transform:rotate(-4deg)} to{transform:rotate(4deg)} }
  /* artillery */
  .i-artillery .recoil { animation: recoil 1.4s ease-out infinite; }
  .i-artillery .muzzle { animation: muzzle 1.4s ease-out infinite; }
  .i-artillery .shell { animation: shell 1.4s ease-out infinite; }
  @keyframes recoil { 0%,100%{transform:translate(0,0)} 6%{transform:translate(-6px,3px)} 30%{transform:translate(0,0)} }
  @keyframes muzzle { 0%{transform:scale(0);opacity:0} 5%{transform:scale(1.4);opacity:1} 25%{transform:scale(.2);opacity:0} 100%{opacity:0} }
  @keyframes shell { 0%{transform:translate(0,0);opacity:0} 5%{opacity:1} 60%{transform:translate(14px,-20px);opacity:0} 100%{opacity:0} }
  /* explosion */
  .i-explosion .burst { animation: burst 1.2s ease-out infinite; }
  .i-explosion .core { animation: burst 1.2s ease-out infinite .1s; }
  .i-explosion .ring { animation: ring 1.2s ease-out infinite; }
  @keyframes burst { 0%{transform:scale(.4) rotate(0)} 30%{transform:scale(1.05) rotate(8deg)} 100%{transform:scale(.4) rotate(0)} }
  @keyframes ring { 0%{transform:scale(.5);opacity:.9} 100%{transform:scale(2.2);opacity:0} }
  /* urban */
  .i-urban .flash { animation: flashb 1.6s ease-out infinite; opacity:0; }
  .i-urban .f2 { animation-delay: .8s; }
  .i-urban .w { animation: blink 2s steps(2) infinite; }
  .i-urban .w2 { animation-delay: .7s; } .i-urban .w3 { animation-delay: 1.3s; }
  @keyframes flashb { 0%{transform:scale(.3);opacity:0} 10%{transform:scale(1.6);opacity:1} 40%{opacity:0} 100%{opacity:0} }
  /* chemical */
  .i-chemical .bub { animation: bubble 2s ease-in infinite; }
  .i-chemical .b2 { animation-delay: .6s; } .i-chemical .b3 { animation-delay: 1.2s; }
  @keyframes bubble { 0%{transform:translateY(0);opacity:0} 15%{opacity:1} 100%{transform:translateY(-70px) scale(1.6);opacity:0} }
  /* nuclear */
  .i-nuclear .spin { animation: rotor 6s linear infinite; transform-origin: 50px 50px; transform-box: view-box; }
  .i-nuclear .pulse { animation: ring 2s ease-out infinite; }
  /* recon */
  .i-recon .look { animation: look 3s ease-in-out infinite; }
  .i-recon .scan { animation: scan 2s ease-in-out infinite; }
  @keyframes look { 0%,100%{transform:translateX(-12px)} 45%,55%{transform:translateX(12px)} }
  @keyframes scan { 0%,100%{transform:translateY(-20px);opacity:0} 50%{transform:translateY(20px);opacity:.6} }

  @media (prefers-reduced-motion: reduce) { svg *, ha-card::before { animation: none !important; } }
`;

class JaamAlertCard extends HTMLElement {
  setConfig(config) {
    this._config = { show_temp: true, show_status: true, show_controls: true, show_climate: true, show_brightness: true, ...config };
    this._sig = null;
    if (!this.shadowRoot) this.attachShadow({ mode: "open" });
  }

  static getStubConfig() { return {}; }
  getCardSize() { return this._config && this._config.show_controls ? 8 : 6; }

  connectedCallback() {
    this._timer = setInterval(() => this._updateDuration(), 30000);
  }
  disconnectedCallback() { clearInterval(this._timer); }

  set hass(hass) {
    this._hass = hass;
    if (!this._map) this._map = this._discover(hass);
    const st = this._state();
    const sig = JSON.stringify([st.level, st.active, st.name, st.temp, st.online, st.since, st.climate, st.energy, st.radiation]);
    if (sig !== this._sig) { this._sig = sig; this._ctrlSig = null; this._render(st); }
    // Керування оновлюється окремо, щоб не перезапускати анімації тривоги
    if (this._config.show_controls && this._map) {
      const cs = JSON.stringify(CONTROLS.map((c) => this._ctrlInfo(c.key)).concat(SELECTS.map((s) => this._ctrlInfo(s.key)), BR_KEYS.map((k) => this._ctrlInfo(k))));
      if (this._drag) { this._pending = true; return; }   // не перемальовуємо, поки тягнуть повзунок
      if (cs !== this._ctrlSig || (this._pending && !this._drag)) { this._pending = false; this._ctrlSig = cs; this._renderCtrl(); }
    }
  }

  // Пошук сутностей через реєстр: platform jaam_ha + translation_key
  _discover(hass) {
    const map = {};
    const ents = hass.entities || {};
    for (const [id, e] of Object.entries(ents)) {
      if (e.platform !== "jaam_ha" || !e.translation_key) continue;
      if (this._config.device_id && e.device_id !== this._config.device_id) continue;
      map[e.translation_key] = id;
    }
    return Object.keys(map).length ? map : null;
  }

  _on(key) {
    const id = this._map && this._map[key];
    const s = id && this._hass.states[id];
    return s ? s.state === "on" : null;   // null = сутності немає
  }
  _st(key) {
    const id = this._map && this._map[key];
    return id ? this._hass.states[id] : undefined;
  }

  _state() {
    if (!this._map) return { missing: true };
    const red = this._on("home_alert_red"), yellow = this._on("home_alert_yellow"), air = this._on("home_alert_air");
    const active = Object.keys(THREATS).filter((t) => this._on("home_alert_" + t));
    const hasLevels = red !== null || yellow !== null;

    let level, levelKey;
    if (red)                       { level = "red";    levelKey = "home_alert_red"; }
    else if (yellow)               { level = "yellow"; levelKey = "home_alert_yellow"; }
    else if (!hasLevels && air)    { level = "air";    levelKey = "home_alert_air"; }
    else if (active.length)        { level = "threat"; levelKey = "home_alert_" + active[0]; }
    else                           { level = "safe";   levelKey = hasLevels ? (this._map.home_alert_yellow ? "home_alert_yellow" : "home_alert_red") : "home_alert_air"; }

    const ls = this._st(levelKey);
    const district = this._st("home_district");
    const temp = this._st("home_district_temp");
    const ws = this._st("websocket_status");
    // [v1.3] клімат кімнати, енергосистема, радіація
    const num = (k) => { const e = this._st(k); const v = e ? parseFloat(e.state) : NaN; return isNaN(v) ? null : { v, unit: e.attributes.unit_of_measurement || "" }; };
    const energy = this._st("home_energy");
    const rad = this._st("home_radiation");
    return {
      climate: { t: num("climate_temp"), h: num("climate_humidity"), p: num("climate_pressure") },
      energy: energy ? { state: energy.state, id: this._map.home_energy } : null,
      radiation: rad ? { v: parseFloat(rad.state), id: this._map.home_radiation } : null,
      level, levelKey, active,
      since: ls ? ls.last_changed : null,
      name: this._config.title || (district && district.state !== "unknown" ? district.state : "JAAM"),
      temp: temp && !isNaN(parseFloat(temp.state)) ? `${Math.round(parseFloat(temp.state))}°` : null,
      online: ws ? ws.state === "on" : true,
    };
  }

  _fmtDur(since) {
    if (!since) return "";
    const m = Math.max(0, Math.floor((Date.now() - new Date(since).getTime()) / 60000));
    if (m < 1) return "щойно";
    const d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60), mm = m % 60;
    if (d) return `${d} д ${h} год`;
    if (h) return `${h} год ${mm} хв`;
    return `${mm} хв`;
  }

  _updateDuration() {
    const el = this.shadowRoot && this.shadowRoot.querySelector(".dur");
    if (el && this._lastState) el.textContent = this._durText(this._lastState);
  }
  _durText(st) {
    const d = this._fmtDur(st.since);
    if (!d) return "";
    return st.level === "safe" ? `Без тривоги ${d}` : (d === "щойно" ? "Почалась щойно" : `Триває ${d}`);
  }

  _render(st) {
    this._lastState = st;
    const root = this.shadowRoot;
    if (st.missing) {
      root.innerHTML = `<style>${STYLE}</style><ha-card><div class="empty">
        Сутності jaam_ha не знайдено. Перевір, що інтеграція JAAM підключена${this._config.device_id ? " і device_id правильний" : ""}.</div></ha-card>`;
      return;
    }
    const L = LEVELS[st.level];
    let sub = L.sub;
    if (st.active.length) sub = THREATS[st.active[0]].label + (st.active.length > 1 ? ` +${st.active.length - 1}` : "");

    // Усі загрози завжди на сітці: сірі неактивні, кольорові з анімацією — активні
    const tiles = Object.keys(THREATS).map((t) =>
      `<div class="tile ${st.active.includes(t) ? "on" : ""}">${ICONS[t]}<span>${THREATS[t].label}</span></div>`);
    // [v1.3] Нижній ряд: Радіація | Розвідувальні БпЛА | Енергосистема
    if (st.radiation || st.energy) {
      const recon = tiles.pop();
      if (st.radiation) tiles.push(this._radiationTile(st.radiation));
      tiles.push(recon);
      if (st.energy) tiles.push(this._energyTile(st.energy));
    }
    const grid = `<div class="grid">${tiles.join("")}</div>`;
    const climate = this._climateRow(st.climate);

    root.innerHTML = `<style>${STYLE}</style>
      <ha-card class="${L.cls}">
        <div class="top">
          <span class="name">${st.name}</span>
          ${this._config.show_temp && st.temp ? `<span class="rt" title="Температура в регіоні"><span class="mini">${MINI.pin}</span>${st.temp}</span>` : ""}
          ${this._config.show_status ? `<span class="dot ${st.online ? "" : "off"}" title="${st.online ? "На зв'язку" : "Немає зв'язку з мапою"}"></span>` : ""}
        </div>
        ${climate}
        <div class="hero">
          <div class="icon s-${L.cls}">${ICONS.shield}</div>
          <div class="text">
            <div class="level">${L.title}</div>
            ${sub ? `<div class="sub">${sub}</div>` : ""}
            <div class="dur">${this._durText(st)}</div>
          </div>
        </div>
        ${grid}
        <div class="ctrl"></div>
      </ha-card>`;

    // SMIL-анімацію (балістика) CSS не зупиняє — ставимо на паузу в неактивних плитках
    root.querySelectorAll(".tile:not(.on):not(.info) svg").forEach((s) => {
      try { s.setCurrentTime(1.2); s.pauseAnimations(); } catch (e) { /* ignore */ }
    });

    root.querySelectorAll("[data-entity]").forEach((el) =>
      el.addEventListener("click", () => this._moreInfo(el.dataset.entity)));

    root.querySelector(".hero").addEventListener("click", () => {
      const ev = new Event("hass-more-info", { bubbles: true, composed: true });
      ev.detail = { entityId: this._map[st.levelKey] };
      this.dispatchEvent(ev);
    });
  }

  /* ---------- [v1.3] погода, енергосистема, радіація ---------- */
  _climateRow(c) {
    if (!this._config.show_climate || !c || (!c.t && !c.h && !c.p)) return "";
    const fmtT = (v) => `${(Math.round(v * 10) / 10).toString().replace(".", ",")}°`;
    const pUnit = (u) => (/mm|мм/i.test(u) ? "мм" : /hpa|гпа/i.test(u) ? "гПа" : u);
    const parts = [];
    if (c.t) parts.push(`<span title="Температура в кімнаті"><span class="mini">${MINI.home}</span><b>${fmtT(c.t.v)}</b></span>`);
    if (c.h) parts.push(`<span title="Вологість"><span class="mini">${MINI.drop}</span><b>${Math.round(c.h.v)}%</b></span>`);
    if (c.p) parts.push(`<span title="Тиск"><span class="mini">${MINI.gauge}</span><b>${Math.round(c.p.v)}</b> ${pUnit(c.p.unit)}</span>`);
    return `<div class="clim">${parts.join("")}</div>`;
  }

  _radiationTile(r) {
    const info = radiationInfo(r.v);
    const val = r.v > 0 ? `${Math.round(r.v)}<small>нЗв/год</small>` : "—";
    return `<div class="tile info ${info.cls}" ${info.color ? `style="--tc:${info.color}"` : ""} data-entity="${r.id}">
      <div class="ico">${INFO_ICONS.radiation}<div class="val">${val}</div></div>
      <span class="ttl">Радіація</span><span class="st">${info.label}</span></div>`;
  }

  _energyTile(e) {
    const info = ENERGY_STATES[e.state] || { label: "Невідомо", color: null, cls: "na" };
    return `<div class="tile info ${info.cls}" ${info.color ? `style="--tc:${info.color}"` : ""} data-entity="${e.id}">
      <div class="ico">${INFO_ICONS.energy}</div>
      <span class="ttl">Енергосистема</span><span class="st">${info.label}</span></div>`;
  }

  /* ---------- керування ---------- */
  _ctrlInfo(key) {
    const s = this._st(key);
    if (!s) return null;
    return { st: s.state, opts: s.attributes.options, rgb: s.attributes.rgb_color, br: s.attributes.brightness };
  }

  _modeName(key, opt) {
    const s = this._st(key);
    try { if (s && this._hass.formatEntityState) { const t = this._hass.formatEntityState(s, opt); if (t && t !== opt) return t; } } catch (e) { /* ignore */ }
    return MODE_NAMES[opt] || opt;
  }

  _renderCtrl() {
    const box = this.shadowRoot.querySelector(".ctrl");
    if (!box) return;
    const btns = CONTROLS.filter((c) => this._st(c.key)).map((c) => {
      const s = this._st(c.key);
      const on = s.state === "on";
      let style = "";
      if (c.key === "lamp" && on && s.attributes.rgb_color) style = `style="--bc: rgb(${s.attributes.rgb_color.join(",")})"`;
      const extra = c.key === "lamp" && on && s.attributes.brightness ? ` ${Math.round(s.attributes.brightness / 2.55)}%` : "";
      return `<div class="btn ${c.cls} ${on ? "on" : ""} ${s.state === "unavailable" ? "na" : ""}" data-k="${c.key}" ${style}>
        ${CTRL_ICONS[c.cls]}<span>${c.label}${extra}</span></div>`;
    }).join("");

    const sels = SELECTS.filter((x) => this._st(x.key)).map((x) => {
      const s = this._st(x.key);
      const opts = s.attributes.options || [];
      return `<div class="mrow ${x.cls}"><div class="mlabel">${x.label}</div><div class="pills">
        ${opts.map((o) => `<div class="pill ${o === s.state ? "sel" : ""}" data-sel="${x.key}" data-o="${o}">${this._modeName(x.key, o)}</div>`).join("")}
      </div></div>`;
    }).join("");

    const br = this._config.show_brightness ? this._brightnessHtml() : "";
    if (!btns && !sels && !br) { box.innerHTML = ""; return; }
    // зберігаємо прокрутку стрічок режимів між оновленнями
    const scroll = [...box.querySelectorAll(".pills")].map((p) => p.scrollLeft);
    box.innerHTML = `${btns ? `<div class="btns">${btns}</div>` : ""}${sels ? `<div class="modes">${sels}</div>` : ""}${br}`;
    box.querySelectorAll(".pills").forEach((p, i) => {
      if (scroll[i] !== undefined) p.scrollLeft = scroll[i];
      else { const sel = p.querySelector(".sel"); if (sel) p.scrollLeft = Math.max(0, sel.offsetLeft - 8); }
    });

    this._bindBrightness(box);
    box.querySelectorAll(".btn").forEach((b) => this._bindPress(b,
      () => { const c = CONTROLS.find((x) => x.key === b.dataset.k);
              this._hass.callService(c.domain, "toggle", { entity_id: this._map[c.key] }); },
      () => this._moreInfo(this._map[b.dataset.k])));
    box.querySelectorAll(".pill").forEach((p) => p.addEventListener("click", () => {
      if (p.classList.contains("sel")) return;
      p.parentElement.querySelectorAll(".pill").forEach((x) => x.classList.remove("sel"));
      p.classList.add("sel");   // миттєвий відгук, стан підтвердиться з HA
      this._hass.callService("select", "select_option", { entity_id: this._map[p.dataset.sel], option: p.dataset.o });
    }));
  }

  /* ---------- [v1.4] яскравість ---------- */
  _brightnessHtml() {
    const modeSt = this._st(BR_MODE_KEY);
    const sliders0 = BR_SLIDERS.filter((x) => this._st(x.key));
    const toggles0 = BR_TOGGLES.filter((x) => this._st(x.key));
    if (!modeSt && !sliders0.length && !toggles0.length) return "";
    const mode = modeSt ? modeSt.state : "";
    const ctx = { on: (k) => this._on(k) === true };
    const unavailable = (modeSt || this._st(sliders0.length ? sliders0[0].key : toggles0[0].key)).state === "unavailable";
    const cur = this._st("brightness_current");
    const curTxt = cur && !isNaN(parseFloat(cur.state)) ? `${Math.round(parseFloat(cur.state))}%` : "";

    let body = "";
    if (modeSt) {
      const opts = modeSt.attributes.options || [];
      body += `<div class="mrow brm"><div class="mlabel">Режим яскравості мапи</div><div class="pills">
        ${opts.map((o) => `<div class="pill ${o === modeSt.state ? "sel" : ""}" data-sel="${BR_MODE_KEY}" data-o="${o}">${this._modeName(BR_MODE_KEY, o)}</div>`).join("")}
      </div></div>`;
    }
    body += sliders0.filter((x) => x.show(mode, ctx)).map((x) => {
      const v = parseFloat(this._st(x.key).state);
      const val = isNaN(v) ? x.min : v;
      const pct = Math.max(0, Math.min(100, ((val - x.min) / (x.max - x.min)) * 100));
      const txt = x.step < 1 ? (Math.round(val * 10) / 10).toString().replace(".", ",") : Math.round(val);
      return `<div class="srow" data-k="${x.key}"><span class="sic">${BR_ICONS[x.icon]}</span><span class="slab">${x.label}</span>
        <input type="range" min="${x.min}" max="${x.max}" step="${x.step}" value="${val}" style="--p:${pct}%" ${isNaN(v) ? "disabled" : ""}>
        <span class="sval">${isNaN(v) ? "—" : txt + x.unit}</span></div>`;
    }).join("");
    if (toggles0.length) {
      body += `<div class="tgs">${toggles0.map((x) => `<div class="tg ${this._on(x.key) ? "on" : ""}" data-tg="${x.key}">${x.label}</div>`).join("")}</div>`;
    }
    return `<div class="br ${this._brOpen ? "open" : ""} ${unavailable ? "na" : ""}">
      <div class="brh"><span class="hic">${BR_ICONS.head}</span><span class="ttl">Яскравість</span>
        ${curTxt ? `<span class="cur">зараз ${curTxt}</span>` : ""}<span class="chev">${BR_ICONS.chevron}</span></div>
      <div class="brb">${body}</div></div>`;
  }

  _bindBrightness(box) {
    const br = box.querySelector(".br");
    if (!br) return;
    const fitPills = () => { const p = br.querySelector(".pills"), sel = p && p.querySelector(".sel"); if (sel) p.scrollLeft = Math.max(0, sel.offsetLeft - 8); };
    br.querySelector(".brh").addEventListener("click", () => { this._brOpen = !this._brOpen; br.classList.toggle("open", this._brOpen); if (this._brOpen) fitPills(); });
    if (this._brOpen) fitPills();
    br.querySelectorAll(".srow").forEach((row) => {
      const def = BR_SLIDERS.find((x) => x.key === row.dataset.k);
      const inp = row.querySelector("input"), out = row.querySelector(".sval");
      const show = () => {
        const v = parseFloat(inp.value);
        inp.style.setProperty("--p", `${((v - def.min) / (def.max - def.min)) * 100}%`);
        out.textContent = (def.step < 1 ? (Math.round(v * 10) / 10).toString().replace(".", ",") : Math.round(v)) + def.unit;
      };
      inp.addEventListener("pointerdown", () => { this._drag = true; });
      inp.addEventListener("input", () => { this._drag = true; show(); });
      inp.addEventListener("change", () => {
        show();
        this._hass.callService("number", "set_value", { entity_id: this._map[def.key], value: parseFloat(inp.value) });
        this._drag = false;
      });
      const end = () => setTimeout(() => { this._drag = false; }, 150);
      inp.addEventListener("pointerup", end);
      inp.addEventListener("pointercancel", end);
    });
    br.querySelectorAll(".tg").forEach((t) => t.addEventListener("click", () => {
      t.classList.toggle("on");   // миттєвий відгук, стан підтвердиться з HA
      this._hass.callService("switch", "toggle", { entity_id: this._map[t.dataset.tg] });
    }));
  }

  _bindPress(el, onTap, onHold) {
    let t = null, held = false;
    const start = () => { held = false; t = setTimeout(() => { held = true; onHold(); }, 500); };
    const cancel = () => clearTimeout(t);
    el.addEventListener("pointerdown", start);
    el.addEventListener("pointerleave", cancel);
    el.addEventListener("pointercancel", cancel);
    el.addEventListener("pointerup", () => { cancel(); if (!held) onTap(); });
    el.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  _moreInfo(entityId) {
    const ev = new Event("hass-more-info", { bubbles: true, composed: true });
    ev.detail = { entityId };
    this.dispatchEvent(ev);
  }
}

customElements.define("jaam-alert-card", JaamAlertCard);
window.customCards = window.customCards || [];
window.customCards.push({
  type: "jaam-alert-card",
  name: "JAAM Alert Card",
  description: "Тривога в домашньому регіоні: рівень і тип загрози з анімаціями",
  preview: true,
});
console.info(`%c JAAM-ALERT-CARD %c v${CARD_VERSION} `, "background:#e53935;color:#fff", "background:#333;color:#fff");
