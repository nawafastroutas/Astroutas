/* Subbha — service worker
   الغرض الوحيد: تفعيل خاصية "إضافة إلى الشاشة الرئيسية" (Installable PWA).
   لا تخزين مؤقت للبيانات — المتجر يعتمد على Firebase كمصدر حقيقة حي،
   وأي كاش هنا قد يُعرض بيانات/أسعار قديمة للمستخدم. */

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', () => {
  /* تمرير كل الطلبات للشبكة مباشرة دون اعتراض. */
});
