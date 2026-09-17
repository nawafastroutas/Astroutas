/** رسائل مؤقّتة عبر الرابط — برموز ثابتة لا نصّ حرّ (يمنع حقن الرسائل). */
import { alertBox } from '../views/layout.js';
import { raw } from './html.js';

export const FLASH = {
  booked: ['success', 'تمّ حجز مقعدك — هذه تذكرتك، اعرضها عند المدخل.'],
  already_booked: ['info', 'لديك تذكرة في هذه الفعالية بالفعل.'],
  profile_saved: ['success', 'حُفظت بياناتك.'],
  message_sent: ['success', 'وصلت رسالتك إلى إدارة النادي — شكرًا لك.'],
  registered: ['success', 'أهلًا بك في النادي! عضويتك جاهزة.'],
  logged_out: ['info', 'خرجت من حسابك.'],
  event_saved: ['success', 'حُفظت الفعالية.'],
  event_created: ['success', 'أُنشئت الفعالية.'],
  event_deleted: ['success', 'حُذفت الفعالية.'],
  event_cancelled: ['success', 'حُوِّلت الفعالية إلى «ملغاة».'],
  member_saved: ['success', 'حُدِّثت بيانات العضو.'],
  announcement_saved: ['success', 'حُفظ الإعلان.'],
  announcement_deleted: ['success', 'حُذف الإعلان.'],
  message_read: ['success', 'عُلِّمت الرسالة مقروءة.'],
  image_deleted: ['success', 'حُذفت الصورة.'],
  needs_login: ['info', 'سجّل دخولك أولًا.'],
};

/** @returns {import('./html.js').Raw} */
export function flashFrom(query) {
  const ok = query.get('ok');
  const err = query.get('err');
  if (ok && FLASH[ok]) return alertBox(FLASH[ok][0], FLASH[ok][1]);
  if (err && FLASH[err]) return alertBox('error', FLASH[err][1]);
  return raw('');
}
