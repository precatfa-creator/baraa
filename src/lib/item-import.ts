export type ImportItemRow = {
  name_ar: string;
  name_en: string;
  barcode: string;
  category: string;
  unit: string;
};

export const MAX_IMPORT_ROWS = 500;

// Accept Arabic or English headers in any order/case.
const HEADER_ALIASES = {
  name_ar: ["name_ar", "الاسم بالعربية", "الاسم العربي", "الاسم", "اسم الصنف", "name"],
  name_en: ["name_en", "الاسم بالإنجليزية", "english name", "english"],
  barcode: ["barcode", "الباركود", "باركود"],
  category: ["category", "التصنيف", "تصنيف"],
  unit: ["unit", "الوحدة", "وحدة"],
} as const;

const normalize = (value: unknown) => String(value).trim().toLowerCase();

function pick(row: Record<string, unknown>, aliases: readonly string[]): string {
  for (const key of Object.keys(row)) {
    if (aliases.some((alias) => normalize(alias) === normalize(key))) {
      const value = row[key];
      return value == null ? "" : String(value).trim();
    }
  }
  return "";
}

export function mapSheetRow(row: Record<string, unknown>): ImportItemRow {
  return {
    name_ar: pick(row, HEADER_ALIASES.name_ar),
    name_en: pick(row, HEADER_ALIASES.name_en),
    barcode: pick(row, HEADER_ALIASES.barcode),
    category: pick(row, HEADER_ALIASES.category),
    unit: pick(row, HEADER_ALIASES.unit),
  };
}
