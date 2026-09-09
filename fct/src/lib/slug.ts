/** 시트명 → URL 슬러그 (예: 'SAC-10 Plus ' → 'SAC-10-Plus') */
export function sheetSlug(name: string) {
  return name.trim().replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
