export const auditEventLabels: Record<string, string> = {
  "auth.login": "تسجيل دخول",
  "auth.logout": "تسجيل خروج",
  "auth.login_failed": "محاولة دخول فاشلة",
  "auth.login_blocked": "دخول مرفوض لحساب موقوف",
  "auth.password_changed": "تغيير كلمة المرور",
  "auth.password_changed_by_admin": "تغيير كلمة المرور بواسطة المدير",
  "auth.password_reset_requested": "طلب استعادة كلمة المرور",
  "auth.password_reset_completed": "اكتمال استعادة كلمة المرور",
  "user.created": "إنشاء مستخدم",
  "user.updated": "تعديل مستخدم",
  "admin.bulk_delete": "حذف إداري جماعي",
  "request.created": "إنشاء طلب نقص",
  "request.status_changed": "تغيير حالة طلب",
  "purchase.completed": "إتمام شراء",
  "attachment.added": "إضافة مرفق",
  "data.insert": "إضافة سجل",
  "data.update": "تعديل سجل",
  "data.delete": "حذف سجل",
};

export const entityLabels: Record<string, string> = {
  session: "جلسة",
  user: "مستخدم",
  companies: "شركة",
  pharmacies: "صيدلية",
  profiles: "مستخدم",
  items: "صنف",
  item_categories: "تصنيف",
  item_units: "وحدة",
  batches: "دفعة",
  shortage_requests: "طلب نقص",
  shortage_request_requesters: "مقدمو الطلب",
  shortage_status_history: "سجل حالة",
  sales_rep_assignments: "تعيين مندوب",
  batch_attachments: "مرفق دفعة",
  purchase_events: "عملية شراء",
};

export function auditEventLabel(value: string): string {
  return auditEventLabels[value] ?? value;
}

export function entityLabel(value: string): string {
  return entityLabels[value] ?? value;
}
