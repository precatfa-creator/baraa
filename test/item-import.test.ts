import { test } from "node:test";
import assert from "node:assert/strict";
import { mapSheetRow } from "../src/lib/item-import.ts";

test("maps Arabic spreadsheet headers to canonical item fields", () => {
  assert.deepEqual(
    mapSheetRow({
      "الاسم بالعربية": " باراسيتامول ",
      "الاسم بالإنجليزية": " Paracetamol ",
      الباركود: 6221000000099,
      التصنيف: " مسكنات ",
      الوحدة: " علبة ",
    }),
    {
      name_ar: "باراسيتامول",
      name_en: "Paracetamol",
      barcode: "6221000000099",
      category: "مسكنات",
      unit: "علبة",
    },
  );
});

test("maps case-insensitive English headers and defaults missing fields", () => {
  assert.deepEqual(mapSheetRow({ NAME: "Aspirin", BARCODE: "123" }), {
    name_ar: "Aspirin",
    name_en: "",
    barcode: "123",
    category: "",
    unit: "",
  });
});
