export const themeOptions = [
  { key: "liquid", label: "Liquid glass", description: "Soft glass layers with plum, rose, aqua, and mint." },
  { key: "pearl", label: "Pearl studio", description: "Clean white, champagne, and warm ivory." },
  { key: "noir", label: "Bees Bloom", description: "Coffee brown, softened terracotta, and sand nude." },
  { key: "blush", label: "Blush bloom", description: "Rosy, gentle, and beauty-forward." },
  { key: "ocean", label: "Ocean spa", description: "Cool aqua and mint for calm operations." },
] as const;

export type ThemePreference = (typeof themeOptions)[number]["key"];

export function normalizeTheme(value: string | null | undefined): ThemePreference {
  return themeOptions.some((theme) => theme.key === value) ? (value as ThemePreference) : "liquid";
}
