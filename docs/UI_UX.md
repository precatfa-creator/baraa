# UI and UX

## 1. Design goal

Baraa should feel extremely easy, clean, and modern. The main users may use the app repeatedly during work, often from phones, so the interface must be fast, readable, and low-friction.

## 2. Language and direction

- UI language: Arabic.
- Layout direction: RTL.
- Code/comments/database values: English.

HTML root:

```html
<html lang="ar" dir="rtl">
```

## 3. Visual style

- Clean white/gray background.
- Soft borders.
- Rounded cards.
- Clear primary action buttons.
- Large touch targets.
- Minimal visual noise.
- Status colors used consistently.

## 4. Typography

Recommended fonts:

1. Tajawal
2. Cairo
3. IBM Plex Sans Arabic

Recommended MVP: Tajawal.

## 5. Color suggestions

- Primary: blue or teal.
- Success: green.
- Warning: amber.
- Danger: red.
- Neutral: slate/gray.

Status badges:

- ناقص / missing: red or amber.
- قيد الشراء / in_purchase: blue.
- تم توفيره / fulfilled: green.
- ملغي / cancelled: gray.

## 6. Layout principles

Mobile-first:

- Cards for request list on mobile.
- Table/grid on desktop.
- Sticky primary action where useful.
- Bottom-sheet/dialog for add request on mobile.

Desktop:

- Sidebar navigation.
- Dashboard cards.
- Tables with filters.

## 7. Primary screens

### Login

- Simple centered form.
- App name/logo.
- Email/password.
- Clear error message.

### Dashboard

- Summary cards:
  - النواقص
  - قيد الشراء
  - تم توفيره اليوم
- Recent active requests.
- Quick add button.

### Shortage requests

- Search input.
- Status tabs.
- Add request button.
- Request cards/table.
- Quick status action buttons based on role.

### Items

- Search by Arabic name or barcode.
- Add/edit item for admins.
- Active/inactive filter.

### Users and pharmacies

Admin-only screens.

## 8. UX rules

- Adding a shortage must take less than 20 seconds.
- Status update should be one tap/click where possible.
- Confirmation only for destructive actions.
- Use Arabic success/error toasts.
- Keep forms short.
- Default to active requests, not full history.

## 9. Arabic UI labels

Navigation:

- لوحة التحكم
- النواقص
- الأصناف
- المستخدمون
- الصيدليات
- الإعدادات

Actions:

- إضافة صنف
- إضافة ناقص
- بدء الشراء
- تم التوفير
- إلغاء
- حفظ
- رجوع

Messages:

- تم الحفظ بنجاح
- تم تحديث الحالة
- لا تملك صلاحية تنفيذ هذا الإجراء
- حدث خطأ، حاول مرة أخرى
