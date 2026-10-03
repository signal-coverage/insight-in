// The colour themes of the app. Each one is an independent palette: a class on <html> whose
// colours live in app/globals.css (light, dark) or app/themes.css (all the others). "light" and
// "dark" keep the ids they were stored under; an id is also a CSS class, so it is one lowercase
// word.
//
// `colors` are the theme's own five palette colours, for the previews that show a theme before it
// is chosen. The stylesheets own the real values (app/themes.test.ts checks that these match them).
export const THEMES = [
  {
    id: "light",
    label: "Modo claro",
    colors: ["#f8f7ff", "#b8b8ff", "#9381ff", "#ffeedd", "#ffd8be"],
  },
  {
    id: "dark",
    label: "Modo oscuro",
    colors: ["#0d1b2a", "#1b263b", "#415a77", "#778da9", "#e0e1dd"],
  },
  {
    id: "ocean",
    label: "Brisa oceánica",
    colors: ["#e63946", "#f1faee", "#a8dadc", "#457b9d", "#1d3557"],
  },
  {
    id: "rustic",
    label: "Encanto rústico",
    colors: ["#fffcf2", "#ccc5b9", "#403d39", "#252422", "#eb5e28"],
  },
  {
    id: "coastal",
    label: "Costa fresca",
    colors: ["#2b2d42", "#8d99ae", "#edf2f4", "#ef233c", "#d90429"],
  },
  {
    id: "harmony",
    label: "Armonía monocromática",
    colors: ["#cfdbd5", "#e8eddf", "#f5cb5c", "#242423", "#333533"],
  },
  {
    id: "beach",
    label: "Día de playa soleado",
    colors: ["#001524", "#15616d", "#ffecd1", "#ff7d00", "#78290f"],
  },
  {
    id: "sky",
    label: "Cielo monocromático",
    colors: ["#000000", "#2f4550", "#586f7c", "#b8dbd9", "#f4f4f9"],
  },
  {
    id: "twilight",
    label: "Serenata del crepúsculo",
    colors: ["#564787", "#dbcbd8", "#f2fdff", "#9ad4d6", "#101935"],
  },
  {
    id: "autumn",
    label: "Cosecha de otoño",
    colors: ["#202c39", "#283845", "#b8b08d", "#f2d492", "#f29559"],
  },
  {
    id: "cozy",
    label: "Confort acogedor",
    colors: ["#bfb48f", "#564e58", "#904e55", "#f2efe9", "#252627"],
  },
  {
    id: "minimalist",
    label: "Elegancia minimalista",
    colors: ["#2d3142", "#bfc0c0", "#ffffff", "#ef8354", "#4f5d75"],
  },
  {
    id: "forest",
    label: "Bosque encantado",
    colors: ["#134611", "#3e8914", "#3da35d", "#96e072", "#e8fccf"],
  },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];

export const THEME_IDS: readonly ThemeId[] = THEMES.map((theme) => theme.id);
