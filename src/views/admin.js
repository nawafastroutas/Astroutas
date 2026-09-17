/** عروض لوحة الإدارة. */
import config from '../config.js';
import { html, raw, when, adminPage, alertBox, avatar, statusChip, num } from './layout.js';
import { formatRange, formatShort, formatDateTime, utcToOmanInput } from '../lib/datetime.js';
import { members as membersText, rows as rowsText, points as pointsText } from '../lib/arabic.js';
import { objectUrl } from '../lib/storage.js';
import { formatPhone } from '../lib/validate.js';
import { ROLES } from '../models/members.js';

const base = (ctx, opts) => adminPage({
  member: ctx.member, nonce: ctx.nonce, path: ctx.url.pathname, newMessages: opts.newMessages || 0, ...opts,
});

/* ------------------------------ نظرة عامّة ------------------------------ */
export const dashboardView = (ctx, { stats, upcoming, messages, flash }) => base(ctx, {
  title: 'لوحة الإدارة', newMessages: stats.newMessages,
  body: html`
    <h1>لوحة الإدارة</h1>
    ${flash}
    <div class="stat-grid">
      <div class="stat"><strong>${num(stats.members)}</strong><span>عضوًا</span></div>
      <div class="stat"><strong>${num(stats.events)}</strong><span>فعالية</span></div>
      <div class="stat"><strong>${num(stats.newMessages)}</strong><span>رسالة جديدة</span></div>
      <div class="stat"><strong>${num(stats.attendance)}</strong><span>حضورًا مسجَّلًا</span></div>
    </div>

    <section class="section">
      <div class="section__head"><h2>الفعاليات القادمة</h2><a href="/admin/events">إدارة الفعاليات ←</a></div>
      ${upcoming.length ? html`<div class="table-wrap"><table>
        <thead><tr><th>الفعالية</th><th>الموعد</th><th>الحجوزات</th><th>الحالة</th><th></th></tr></thead>
        <tbody>${upcoming.map((e) => html`<tr>
          <td><a href="/admin/events?edit=${e.id}">${e.title}</a></td>
          <td class="small">${formatRange(e.starts_at, e.ends_at)}</td>
          <td>${num(e.tickets_count)}${when(e.capacity > 0, raw(` / ${num(e.capacity)}`))}</td>
          <td>${statusChip(e)}</td>
          <td><a class="btn btn--sm btn--outline" href="/admin/scan?event=${e.id}">مسح الحضور</a></td>
        </tr>`)}</tbody>
      </table></div>` : html`<p class="empty">لا فعاليات قادمة.</p>`}
    </section>

    <section class="section">
      <div class="section__head"><h2>آخر الرسائل</h2><a href="/admin/messages">كل الرسائل ←</a></div>
      ${messages.length ? html`<div class="grid grid--2">${messages.map((m) => html`<article class="card">
        <div class="cluster" style="margin-bottom:.4rem">
          ${when(m.status === 'new', html`<span class="chip chip--danger">جديدة</span>`)}
          <span class="small muted">${formatShort(m.created_at)}</span>
        </div>
        <strong>${m.name}</strong> <span class="small muted" dir="ltr">${formatPhone(m.phone)}</span>
        <p class="small" style="margin:.5rem 0 0;white-space:pre-line">${m.body.slice(0, 160)}</p>
      </article>`)}</div>` : html`<p class="empty">لا رسائل.</p>`}
    </section>`,
});

/* ------------------------------- الفعاليات ------------------------------ */
const eventForm = (event, { errors = {} } = {}) => {
  const v = event || {};
  const action = v.id ? `/admin/events/${v.id}` : '/admin/events';
  return html`<form class="form" method="post" action="${action}" novalidate>
    <div class="field">
      <label for="title">العنوان</label>
      <input type="text" id="title" name="title" value="${v.title || ''}" required data-tpl="title">
      ${when(!!errors.title, html`<span class="field__error">${errors.title}</span>`)}
    </div>
    <div class="field">
      <label for="description">الوصف</label>
      <textarea id="description" name="description" data-tpl="description">${v.description || ''}</textarea>
    </div>
    <div class="form__row">
      <div class="field">
        <label for="category">التصنيف</label>
        <input type="text" id="category" name="category" value="${v.category || ''}" list="cats" data-tpl="category">
        <datalist id="cats">
          ${['أمسية شعرية', 'ورشة', 'نادي قراءة', 'مسابقة', 'محاضرة', 'معرض', 'رحلة ثقافية']
            .map((c) => html`<option value="${c}"></option>`)}
        </datalist>
      </div>
      <div class="field">
        <label for="location">المكان</label>
        <input type="text" id="location" name="location" value="${v.location || ''}" data-tpl="location">
      </div>
    </div>
    <div class="form__row">
      <div class="field">
        <label for="starts_at">البداية <span class="muted small">(توقيت عُمان)</span></label>
        <input type="datetime-local" id="starts_at" name="starts_at" required
               value="${v.starts_at ? utcToOmanInput(v.starts_at) : ''}" data-tpl="starts_at">
        ${when(!!errors.starts_at, html`<span class="field__error">${errors.starts_at}</span>`)}
      </div>
      <div class="field">
        <label for="ends_at">النهاية <span class="muted small">(توقيت عُمان)</span></label>
        <input type="datetime-local" id="ends_at" name="ends_at" required
               value="${v.ends_at ? utcToOmanInput(v.ends_at) : ''}" data-tpl="ends_at">
        ${when(!!errors.ends_at, html`<span class="field__error">${errors.ends_at}</span>`)}
      </div>
    </div>
    <div class="form__row">
      <div class="field">
        <label for="capacity">السعة</label>
        <input type="number" id="capacity" name="capacity" min="0" value="${v.capacity ?? 0}" data-tpl="capacity">
        <span class="field__hint">صفر = بلا حدّ.</span>
      </div>
      <div class="field">
        <label for="points">نقاط الحضور</label>
        <input type="number" id="points" name="points" min="0" value="${v.points ?? 20}" data-tpl="points">
      </div>
      <div class="field">
        <label for="badge_name">اسم الشارة</label>
        <input type="text" id="badge_name" name="badge_name" value="${v.badge_name || ''}" data-tpl="badge_name">
      </div>
    </div>
    <div class="form__row">
      <div class="field">
        <label for="status">الحالة</label>
        <select id="status" name="status">
          ${[['published', 'منشورة'], ['draft', 'مسودّة'], ['cancelled', 'ملغاة']].map(([val, label]) =>
            html`<option value="${val}"${when((v.status || 'draft') === val, raw(' selected'))}>${label}</option>`)}
        </select>
      </div>
      <div class="field">
        <label for="survey_url">رابط استبيان التقييم</label>
        <input type="url" id="survey_url" name="survey_url" value="${v.survey_url || ''}" placeholder="https://forms.office.com/…">
        ${when(!!errors.survey_url, html`<span class="field__error">${errors.survey_url}</span>`)}
      </div>
    </div>
    <div class="field field--inline">
      <input type="checkbox" id="is_test" name="is_test" value="1"${when(!!v.is_test, raw(' checked'))}>
      <label for="is_test">فعالية تجريبية — خارج حساب النقاط</label>
    </div>
    <div class="form__actions">
      <button class="btn btn--primary" type="submit">${v.id ? 'حفظ التعديلات' : 'إنشاء الفعالية'}</button>
      ${when(!!v.id, html`<a class="btn btn--outline" href="/admin/events">إلغاء</a>`)}
    </div>
  </form>`;
};

export const eventsView = (ctx, {
  events, editing, errors, flash, images = [], templates, newMessages,
}) => base(ctx, {
  title: 'الفعاليات', newMessages, scripts: ['/js/admin-events.js'],
  body: html`
    <div class="between"><h1>الفعاليات</h1></div>
    ${flash}

    <details class="panel"${when(!editing, raw(' open'))}>
      <summary>${editing ? `تعديل: ${editing.title}` : 'إنشاء فعالية جديدة'}</summary>
      <div class="panel__body">
        ${when(!editing, html`<div class="cluster" style="margin-bottom:1rem">
          <span class="small muted">قوالب جاهزة:</span>
          ${templates.map((t, i) => html`<button class="btn btn--sm btn--outline" type="button" data-template="${i}">${t.label}</button>`)}
        </div>
        <script type="application/json" data-templates>${raw(JSON.stringify(templates).replace(/</g, '\\u003c'))}</script>`)}
        ${eventForm(editing, { errors })}
      </div>
    </details>

    ${when(!!editing, () => html`
      <details class="panel" open>
        <summary>صور الفعالية ورمز التقييم</summary>
        <div class="panel__body">
          <div class="grid grid--2">
            <div>
              <h3>معرض الصور</h3>
              <p class="small muted">تُضغط الصورة في المتصفّح قبل الرفع (بحدّ ${num(Math.round(config.uploads.maxBytes / 1024 / 1024 * 10) / 10)} ميجابايت).</p>
              <div class="field">
                <label for="event-image">أضف صورة</label>
                <input type="file" id="event-image" accept="image/*"
                       data-upload="/admin/events/${editing.id}/images">
                <span class="field__hint" data-upload-status role="status"></span>
              </div>
              ${images.length ? html`<div class="gallery">${images.map((img) => html`<figure>
                <img src="${objectUrl(img.object_key)}" alt="">
                <form method="post" action="/admin/events/${editing.id}/images/${img.id}/delete" style="margin-top:.3rem">
                  <button class="btn btn--sm btn--danger btn--block" type="submit">حذف</button>
                </form>
              </figure>`)}</div>` : html`<p class="muted small">لا صور بعد.</p>`}
            </div>
            <div>
              <h3>رمز التقييم</h3>
              ${editing.survey_url
                ? html`<p class="small muted">اعرض الباركود على الشاشة في نهاية الفعالية — يمسحه الحضور فتُحتسب نقاطهم ثم يُفتح الاستبيان.</p>
                       <a class="btn btn--teal" href="/admin/events/${editing.id}/survey" target="_blank" rel="noopener">عرض الباركود على الشاشة ↗</a>`
                : html`<p class="muted small">أضف رابط الاستبيان في النموذج أعلاه ليظهر الباركود.</p>`}
            </div>
          </div>
        </div>
      </details>`)}

    <div class="table-wrap">
      <table>
        <thead><tr><th>الفعالية</th><th>الموعد</th><th>الحجوزات</th><th>الحضور</th><th>الحالة</th><th>إجراءات</th></tr></thead>
        <tbody>
          ${events.map((e) => html`<tr>
            <td>
              <strong>${e.title}</strong>
              ${when(!!e.is_test, html` <span class="chip chip--outline">تجريبية</span>`)}
              <div class="small muted">${e.category || '—'} · ${e.location || '—'}</div>
            </td>
            <td class="small nowrap">${formatRange(e.starts_at, e.ends_at)}</td>
            <td>${num(e.tickets_count)}${when(e.capacity > 0, raw(` / ${num(e.capacity)}`))}</td>
            <td>${num(e.attendance_count)}</td>
            <td>${statusChip(e)}</td>
            <td>
              <div class="cluster">
                <a class="btn btn--sm btn--outline" href="/admin/events?edit=${e.id}">تعديل</a>
                <a class="btn btn--sm btn--outline" href="/admin/scan?event=${e.id}">مسح</a>
                ${e.attendance_count > 0
                  ? html`<form method="post" action="/admin/events/${e.id}/cancel">
                      <button class="btn btn--sm btn--outline" type="submit"
                        title="سُجّل حضور في هذه الفعالية، فلا تُحذف حفاظًا على نقاط الأعضاء">إلغاء</button>
                    </form>`
                  : html`<form method="post" action="/admin/events/${e.id}/delete" data-confirm="سيُحذف «${e.title}» نهائيًّا. متأكّد؟">
                      <button class="btn btn--sm btn--danger" type="submit">حذف</button>
                    </form>`}
              </div>
            </td>
          </tr>`)}
        </tbody>
      </table>
    </div>
    ${when(events.length === 0, html`<p class="empty">لا فعاليات بعد.</p>`)}`,
});

/** شاشة عرض باركود التقييم. */
export const surveyQrView = (ctx, { event, qrSvg, url }) => base(ctx, {
  title: `باركود تقييم ${event.title}`,
  body: html`
    <div class="center" style="max-width:36rem;margin-inline:auto">
      <h1>${event.title}</h1>
      <p class="muted">امسح الرمز لتقييم الفعالية وكسب ${pointsText(config.evaluationPoints)}.</p>
      <div class="ticket__qr" style="display:inline-block;margin-block:1rem">${raw(qrSvg)}</div>
      <p class="small muted" dir="ltr" style="word-break:break-all">${url}</p>
      <p class="no-print"><a class="btn btn--outline" href="/admin/events?edit=${event.id}">← عودة</a></p>
    </div>`,
});

/* -------------------------------- الأعضاء ------------------------------- */
export const membersView = (ctx, { members, q, flash, newMessages, bccHref }) => base(ctx, {
  title: 'الأعضاء', newMessages, scripts: ['/js/upload.js'],
  body: html`
    <div class="between"><h1>الأعضاء</h1><span class="chip">${membersText(members.length)}</span></div>
    ${flash}
    <div class="toolbar">
      <form role="search" method="get" action="/admin/members">
        <label class="visually-hidden" for="q">بحث شامل</label>
        <input type="search" id="q" name="q" value="${q}" placeholder="ابحث بالاسم أو الجوال أو الرقم الجامعي أو الإيميل أو التخصّص…">
        <button class="btn btn--primary" type="submit">بحث</button>
      </form>
      <a class="btn btn--outline" href="${bccHref}">مراسلة الجميع (نسخة مخفيّة)</a>
      <a class="btn btn--outline" href="/admin/export/members.csv">تصدير CSV</a>
    </div>

    <div class="table-wrap">
      <table>
        <thead><tr>
          <th>العضو</th><th>الجوال</th><th>الرقم الجامعي</th><th>الإيميل</th><th>التخصّص</th>
          <th>النقاط</th><th>الحضور</th><th>الانضمام</th><th>الرتبة والترتيب</th>
        </tr></thead>
        <tbody>
          ${members.map((m) => html`<tr>
            <td>
              <span class="person">
                ${avatar(m)}
                <span>
                  <strong>${m.full_name}</strong>
                  ${when(!!m.is_admin, html`<span class="chip chip--teal small">إدارة</span>`)}
                  <label class="small muted" style="display:block;cursor:pointer">
                    تغيير الصورة
                    <input type="file" accept="image/*" class="visually-hidden" data-upload="/admin/members/${m.id}/photo">
                  </label>
                </span>
              </span>
            </td>
            <td dir="ltr" class="nowrap"><a href="tel:${m.phone}">${formatPhone(m.phone)}</a></td>
            <td dir="ltr">${m.student_id}</td>
            <td dir="ltr" class="small"><a href="mailto:${m.email}">${m.email}</a></td>
            <td>${m.major}</td>
            <td><strong>${num(m.total_points)}</strong></td>
            <td>${num(m.attendance_count)}</td>
            <td class="small nowrap">${formatShort(m.joined_at)}</td>
            <td>
              <form method="post" action="/admin/members/${m.id}" class="cluster" style="gap:.35rem">
                <label class="visually-hidden" for="role-${m.id}">رتبة ${m.full_name}</label>
                <select id="role-${m.id}" name="club_role" style="min-width:9rem">
                  <option value="">بلا رتبة</option>
                  ${ROLES.map((r) => html`<option value="${r}"${when(m.club_role === r, raw(' selected'))}>${r}</option>`)}
                </select>
                <label class="visually-hidden" for="order-${m.id}">ترتيب ظهور ${m.full_name}</label>
                <input type="number" id="order-${m.id}" name="display_order" value="${m.display_order}"
                       style="width:4.5rem" title="ترتيب الظهور">
                <label class="small" title="صلاحية إدارة النادي">
                  <input type="checkbox" name="is_admin" value="1"${when(!!m.is_admin, raw(' checked'))}> إدارة
                </label>
                <button class="btn btn--sm btn--primary" type="submit">حفظ</button>
              </form>
            </td>
          </tr>`)}
        </tbody>
      </table>
    </div>
    ${when(members.length === 0, html`<p class="empty">لا نتائج.</p>`)}`,
});

/* ------------------------------- الإعلانات ------------------------------ */
export const announcementsView = (ctx, { items, editing, flash, newMessages }) => base(ctx, {
  title: 'الإعلانات', newMessages, scripts: ['/js/upload.js'],
  body: html`
    <h1>الإعلانات</h1>
    ${flash}
    <details class="panel"${when(!editing, raw(' open'))}>
      <summary>${editing ? `تعديل: ${editing.title}` : 'إعلان جديد'}</summary>
      <div class="panel__body">
        <form class="form" method="post" action="${editing ? `/admin/announcements/${editing.id}` : '/admin/announcements'}">
          <div class="field">
            <label for="a-title">العنوان</label>
            <input type="text" id="a-title" name="title" value="${editing?.title || ''}" required>
          </div>
          <div class="field">
            <label for="a-body">النصّ</label>
            <textarea id="a-body" name="body">${editing?.body || ''}</textarea>
          </div>
          <div class="form__row">
            <div class="field">
              <label for="a-link">رابط (اختياري)</label>
              <input type="url" id="a-link" name="link_url" value="${editing?.link_url || ''}">
            </div>
            <div class="field">
              <label for="a-exp">وقت الانتهاء التلقائي (اختياري)</label>
              <input type="datetime-local" id="a-exp" name="expires_at"
                     value="${editing?.expires_at ? utcToOmanInput(editing.expires_at) : ''}">
            </div>
            <div class="field">
              <label for="a-order">الترتيب اليدوي</label>
              <input type="number" id="a-order" name="sort_order" value="${editing?.sort_order ?? 0}">
            </div>
          </div>
          <div class="cluster">
            <label class="field--inline"><input type="checkbox" name="published" value="1"${when(editing ? !!editing.published : true, raw(' checked'))}> منشور</label>
            <label class="field--inline"><input type="checkbox" name="pinned" value="1"${when(!!editing?.pinned, raw(' checked'))}> مثبَّت في الصدارة</label>
          </div>
          <div class="form__actions">
            <button class="btn btn--primary" type="submit">${editing ? 'حفظ' : 'نشر'}</button>
            ${when(!!editing, html`<a class="btn btn--outline" href="/admin/announcements">إلغاء</a>`)}
          </div>
        </form>
        ${when(!!editing, () => html`<div class="field" style="margin-top:1rem">
          <label for="a-img">صورة الإعلان</label>
          <input type="file" id="a-img" accept="image/*" data-upload="/admin/announcements/${editing.id}/image">
          <span class="field__hint" data-upload-status role="status"></span>
          ${when(!!objectUrl(editing.image_key), html`<img src="${objectUrl(editing.image_key)}" alt="" style="max-width:14rem;margin-top:.6rem;border-radius:var(--radius-sm)">`)}
        </div>`)}
      </div>
    </details>

    <div class="grid grid--2">
      ${items.map((a) => html`<article class="card${a.pinned ? ' announce--pinned' : ''}">
        <div class="cluster" style="margin-bottom:.4rem">
          ${a.published ? html`<span class="chip chip--success">منشور</span>` : html`<span class="chip chip--outline">مخفي</span>`}
          ${when(!!a.pinned, html`<span class="chip chip--gold">📌 مثبَّت</span>`)}
          ${when(!!a.expires_at, html`<span class="chip chip--outline">ينتهي ${formatShort(a.expires_at)}</span>`)}
          <span class="small muted">ترتيب ${num(a.sort_order)}</span>
        </div>
        <h3 class="card__title">${a.title}</h3>
        <p class="small" style="white-space:pre-line">${a.body}</p>
        <div class="card__foot">
          <a class="btn btn--sm btn--outline" href="/admin/announcements?edit=${a.id}">تعديل</a>
          <form method="post" action="/admin/announcements/${a.id}/toggle">
            <input type="hidden" name="field" value="published">
            <button class="btn btn--sm btn--outline" type="submit">${a.published ? 'إخفاء' : 'نشر'}</button>
          </form>
          <form method="post" action="/admin/announcements/${a.id}/toggle">
            <input type="hidden" name="field" value="pinned">
            <button class="btn btn--sm btn--outline" type="submit">${a.pinned ? 'إلغاء التثبيت' : 'تثبيت'}</button>
          </form>
          <form method="post" action="/admin/announcements/${a.id}/delete" data-confirm="حذف الإعلان «${a.title}»؟">
            <button class="btn btn--sm btn--danger" type="submit">حذف</button>
          </form>
        </div>
      </article>`)}
    </div>
    ${when(items.length === 0, html`<p class="empty">لا إعلانات بعد.</p>`)}`,
});

/* -------------------------------- الرسائل ------------------------------- */
export const messagesView = (ctx, { messages, flash, newMessages }) => base(ctx, {
  title: 'الرسائل', newMessages,
  body: html`
    <h1>الرسائل الواردة</h1>
    ${flash}
    ${messages.length ? html`<div class="grid grid--2">
      ${messages.map((m) => html`<article class="card">
        <div class="cluster" style="margin-bottom:.5rem">
          ${m.status === 'new' ? html`<span class="chip chip--danger">جديدة</span>` : html`<span class="chip chip--outline">مقروءة</span>`}
          <span class="small muted">${formatDateTime(m.created_at)}</span>
        </div>
        <h3 class="card__title">${m.name}</h3>
        <p class="small" dir="ltr"><a href="tel:${m.phone}">${formatPhone(m.phone)}</a></p>
        <p style="white-space:pre-line">${m.body}</p>
        ${when(m.status === 'new', html`<form method="post" action="/admin/messages/${m.id}/read">
          <button class="btn btn--sm btn--outline" type="submit">تعليم كمقروءة</button>
        </form>`)}
      </article>`)}
    </div>` : html`<p class="empty">لا رسائل.</p>`}`,
});

/* --------------------------------- المسح -------------------------------- */
export const scanView = (ctx, { events, selectedId, newMessages }) => base(ctx, {
  title: 'مسح الحضور', newMessages, scripts: ['/js/scan.js'],
  body: html`
    <h1>مسح الحضور</h1>
    <p class="muted">امسح رمز التذكرة بالكاميرا، أو أدخل الرمز يدويًّا.
       النقاط والشارة وبطاقة الحضور تُمنح مرّة واحدة لكل تذكرة.</p>

    <div class="card" style="margin-bottom:1.2rem">
      <div class="field">
        <label for="event">الفعالية (للعلم فقط — الرمز يحدّد فعاليته بنفسه)</label>
        <select id="event" name="event" data-scan-event>
          <option value="">— كل الفعاليات —</option>
          ${events.map((e) => html`<option value="${e.id}"${when(String(selectedId) === String(e.id), raw(' selected'))}>
            ${e.title} — ${formatRange(e.starts_at, e.ends_at)}
          </option>`)}
        </select>
      </div>
    </div>

    <div class="scanner">
      <div class="cluster">
        <button class="btn btn--primary" type="button" data-scan-start>تشغيل الكاميرا</button>
        <button class="btn btn--outline" type="button" data-scan-stop hidden>إيقاف</button>
      </div>
      <p class="small muted" data-scan-support role="status"></p>
      <video class="scanner__video" data-scan-video playsinline muted hidden></video>

      <form class="form" style="width:min(28rem,100%)" data-scan-form>
        <div class="field">
          <label for="code">إدخال الرمز يدويًّا</label>
          <input type="text" id="code" name="code" dir="ltr" placeholder="ASTQ-XXXXXXXX"
                 autocomplete="off" autocapitalize="characters" spellcheck="false">
        </div>
        <button class="btn btn--teal" type="submit">تسجيل الحضور</button>
      </form>

      <div class="scan-result" data-scan-result aria-live="assertive"></div>
      <ul class="scan-log" data-scan-log aria-label="سجلّ المسح"></ul>
    </div>`,
});

/* -------------------------------- التصدير ------------------------------- */
export const exportView = (ctx, { newMessages, counts }) => base(ctx, {
  title: 'التصدير', newMessages,
  body: html`
    <h1>التصدير</h1>
    <p class="muted">ملفّا CSV بترميز UTF-8 مع BOM — تُقرأ العربية في Excel مباشرة.</p>
    <div class="grid grid--2">
      <article class="card">
        <h2>الأعضاء</h2>
        <p class="muted">كل الأعضاء ببياناتهم ونقاطهم المحسوبة وعدد مرّات حضورهم.</p>
        <p><span class="chip">${rowsText(counts.members)}</span></p>
        <a class="btn btn--primary" href="/admin/export/members.csv">تنزيل members.csv</a>
      </article>
      <article class="card">
        <h2>المشاركون في كل الفعاليات</h2>
        <p class="muted">صفّ لكل حضور: الفعالية والعضو والنقاط والشارة وبطاقة الحضور ومن مسحها.</p>
        <p><span class="chip">${rowsText(counts.attendance)}</span></p>
        <a class="btn btn--primary" href="/admin/export/attendance.csv">تنزيل attendance.csv</a>
      </article>
    </div>`,
});
