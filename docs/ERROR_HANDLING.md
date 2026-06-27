# Error Handling

## 1. Goals

- Show simple Arabic messages to users.
- Log technical detail for developers.
- Avoid leaking sensitive database/security details.
- Use consistent error codes.

## 2. Action response pattern

```ts
type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: string; message: string; fieldErrors?: Record<string, string[]> }
```

## 3. Common error codes

| Code | Arabic message |
|---|---|
| `UNAUTHENTICATED` | يجب تسجيل الدخول أولاً |
| `FORBIDDEN` | لا تملك صلاحية تنفيذ هذا الإجراء |
| `NOT_FOUND` | العنصر غير موجود |
| `VALIDATION_ERROR` | يرجى مراجعة البيانات المدخلة |
| `DUPLICATE_BARCODE` | الباركود مستخدم مسبقاً |
| `INVALID_STATUS_TRANSITION` | لا يمكن تغيير الحالة بهذه الطريقة |
| `SERVER_ERROR` | حدث خطأ، حاول مرة أخرى |

## 4. UI behavior

- Inline field errors for validation.
- Toast for successful actions.
- Toast/dialog for failed mutations.
- Empty state for no data.
- Skeleton loading for lists.

## 5. Logging

MVP:

- Console/server logs.

Later:

- Sentry for exceptions.
- Structured logs for security/audit actions.
