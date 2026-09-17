#!/usr/bin/env node
/** منح صلاحية إدارة النادي: npm run admin -- 91234567 */
import { getDb } from '../src/db/index.js';
import * as Members from '../src/models/members.js';
import { validatePhone } from '../src/lib/validate.js';

getDb();
const input = process.argv[2];
if (!input) {
  console.error('الاستعمال: npm run admin -- <رقم الجوال>');
  process.exit(1);
}
const phone = validatePhone(input);
if (!phone.ok) { console.error(phone.message); process.exit(1); }

const member = Members.findByPhone(phone.value);
if (!member) {
  console.error(`لا توجد عضوية بالرقم ${phone.value} — سجّلها من الموقع أولًا.`);
  process.exit(1);
}
Members.updateAdminFields(member.id, {
  clubRole: member.club_role, displayOrder: member.display_order, isAdmin: 1,
});
console.log(`مُنحت صلاحية إدارة النادي لـ ${member.full_name} (${phone.value}).`);
