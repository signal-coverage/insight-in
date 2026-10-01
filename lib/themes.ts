// The colour themes of the app. Each one is an independent palette: a class on <html> whose
// colours live in app/globals.css (light, dark) or app/themes.css (all the others). "light" and
// "dark" keep the ids they were stored under; an id is also a CSS class, so it is one lowercase
// word.
export const THEMES = [
  { id: "light", label: "Modo claro" },
  { id: "dark", label: "Modo oscuro" },
  { id: "ocean", label: "Brisa oceánica" },
  { id: "rustic", label: "Encanto rústico" },
  { id: "coastal", label: "Costa fresca" },
  { id: "harmony", label: "Armonía monocromática" },
  { id: "beach", label: "Día de playa soleado" },
  { id: "sky", label: "Cielo monocromático" },
  { id: "twilight", label: "Serenata del crepúsculo" },
  { id: "autumn", label: "Cosecha de otoño" },
  { id: "cozy", label: "Confort acogedor" },
  { id: "minimalist", label: "Elegancia minimalista" },
  { id: "forest", label: "Bosque encantado" },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];

export const THEME_IDS: readonly ThemeId[] = THEMES.map((theme) => theme.id);
