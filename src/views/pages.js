/** الصفحات العامّة وصفحات العضوية. */
import config from '../config.js';
import { html, raw, when, page, alertBox, avatar, eventCard, statusChip, num } from './layout.js';
import { events as eventsText, points as pointsText, seats as seatsText, members as membersText, times as timesText } from '../lib/arabic.js';
import { formatRange, formatDate, formatTime, formatShort, relative } from '../lib/datetime.js';
import { objectUrl } from '../lib/storage.js';
import { formatPhone } from '../lib/validate.js';

/* -------------------------------- الأخطاء ------------------------------- */
export const errorPage = (ctx, status, title, message) => page({
  title, member: ctx.member, path: ctx.url?.pathname || '/', nonce: ctx.nonce, splash: false,
  body: html`<div class="empty" style="margin-block:3rem">
    <h1>${title}</h1>
    <p class="muted">${message}</p>
    <p><a class="btn btn--primary" href="/">العودة إلى الرئيسية</a></p>
  </div>`,
});

/* ------------------------------- الرئيسية ------------------------------- */
export const homePage = (ctx, { announcements, upcoming, majors, board, stats }) => page({
  title: '', description: `${config.club.name} — فعاليات وأمسيات ومسابقات في ${config.club.college}.`,
  member: ctx.member, path: '/', nonce: ctx.nonce,
  body: html`
    <section class="hero" data-splash-enter>
      <p class="hero__eyebrow">${config.club.college} — ${config.club.university}</p>
      <h1>${config.club.name}</h1>
      <p class="hero__lede">${config.club.tagline}. نلتقي حول الكلمة: أمسيات شعرية، وورش كتابة، ومسابقات ثقافية، ونادي قراءة يجمع من يحبّ الحرف.</p>
      <div class="hero__actions">
        <a class="btn btn--primary" href="/events">تصفّح الفعاليات</a>
        ${ctx.member
          ? html`<a class="btn btn--ghost" href="/me">عضويتي</a>`
          : html`<a class="btn btn--ghost" href="/register">انضمّ إلى النادي</a>`}
      </div>
      <div class="hero__stats">
        <div class="hero__stat"><strong>${num(stats.members)}</strong><span>عضوًا</span></div>
        <div class="hero__stat"><strong>${num(stats.events)}</strong><span>فعالية</span></div>
        <div class="hero__stat"><strong>${num(stats.attendance)}</strong><span>حضورًا مسجَّلًا</span></div>
      </div>
    </section>

    ${when(announcements.length > 0, html`
    <section class="section" aria-labelledby="ann-h">
      <div class="section__head"><h2 id="ann-h">إعلانات النادي</h2></div>
      <div class="grid stack" style="--gap:1rem">
        ${announcements.map((a) => html`
          <article class="card announce${a.pinned ? ' announce--pinned' : ''}" data-splash-enter>
            ${when(!!objectUrl(a.image_key), html`<img src="${objectUrl(a.image_key)}" alt="" loading="lazy">`)}
            <div>
              <div class="cluster" style="margin-bottom:.35rem">
                ${when(!!a.pinned, html`<span class="chip chip--gold">📌 مثبَّت</span>`)}
                <span class="small muted">${formatShort(a.created_at)}</span>
              </div>
              <h3 class="card__title">${a.title}</h3>
              <p style="margin:0;white-space:pre-line">${a.body}</p>
              ${when(!!a.link_url, html`<p style="margin:.6rem 0 0">
                <a class="btn btn--sm btn--outline" href="${a.link_url}" rel="noopener noreferrer" target="_blank">التفاصيل ↗</a>
              </p>`)}
            </div>
          </article>`)}
      </div>
    </section>`)}

    <section class="section" aria-labelledby="up-h">
      <div class="section__head">
        <h2 id="up-h">الفعاليات القادمة</h2>
        <a href="/events">كل الفعاليات ←</a>
      </div>
      ${upcoming.length
        ? html`<div class="grid grid--3">${upcoming.map((e) => eventCard(e))}</div>`
        : html`<p class="empty">لا توجد فعاليات قادمة الآن. تابعنا قريبًا.</p>`}
    </section>

    <div class="grid grid--2">
      <section aria-labelledby="maj-h">
        <div class="section__head"><h2 id="maj-h">التخصّصات الأكثر حضورًا</h2></div>
        ${majors.length ? html`<div class="card" data-splash-enter>
          <ol style="list-style:none;padding:0;margin:0;display:grid;gap:.85rem">
            ${majors.map((m, i) => html`<li>
              <div class="between" style="gap:.6rem;margin-bottom:.3rem">
                <span class="cluster"><span class="rank-num rank-num--${i + 1}">${num(i + 1)}</span> <strong>${m.major}</strong></span>
                <span class="small muted">${membersText(m.members_count)}</span>
              </div>
              <div class="progress"><span style="width:${Math.round((m.members_count / majors[0].members_count) * 100)}%"></span></div>
            </li>`)}
          </ol>
        </div>` : html`<p class="empty">لا يوجد أعضاء بعد.</p>`}
      </section>

      <section aria-labelledby="board-h">
        <div class="section__head">
          <h2 id="board-h">أعضاء الإدارة</h2>
          <a href="/structure">هيكلة النادي ←</a>
        </div>
        ${board.length ? html`<div class="grid grid--4">
          ${board.slice(0, 4).map((m) => html`<div class="card board-card" data-splash-enter>
            ${avatar(m)}
            <strong>${m.full_name}</strong>
            <span class="chip">${m.club_role}</span>
          </div>`)}
        </div>` : html`<p class="empty">لم تُحدَّد رتب بعد.</p>`}
      </section>
    </div>`,
});

/* ------------------------------- الفعاليات ------------------------------ */
export const eventsPage = (ctx, { upcoming, past, q }) => page({
  title: 'الفعاليات', member: ctx.member, path: '/events', nonce: ctx.nonce,
  description: 'كل فعاليات نادي الثقافة والأدب — القادم منها والمنتهي.',
  body: html`
    <h1>الفعاليات</h1>
    <form class="toolbar" role="search" method="get" action="/events">
      <label class="visually-hidden" for="q">ابحث في الفعاليات</label>
      <input type="search" id="q" name="q" value="${q}" placeholder="ابحث بالعنوان أو التصنيف أو المكان…">
      <button class="btn btn--primary" type="submit">بحث</button>
      ${when(!!q, html`<a class="btn btn--outline" href="/events">إلغاء البحث</a>`)}
    </form>
    ${when(!!q, html`<p class="muted small">نتائج البحث عن «${q}»: ${eventsText(upcoming.length + past.length)}.</p>`)}

    <section class="section" aria-labelledby="up-h">
      <div class="section__head"><h2 id="up-h">القادمة</h2></div>
      ${upcoming.length
        ? html`<div class="grid grid--3">${upcoming.map((e) => eventCard(e))}</div>`
        : html`<p class="empty">لا توجد فعاليات قادمة.</p>`}
    </section>

    <section class="section" aria-labelledby="past-h">
      <div class="section__head"><h2 id="past-h">المنتهية</h2></div>
      ${past.length
        ? html`<div class="grid grid--3">${past.map((e) => eventCard(e))}</div>`
        : html`<p class="empty">لا توجد فعاليات منتهية بعد.</p>`}
    </section>`,
});

/* ---------------------------- تفاصيل الفعالية ---------------------------- */
export const eventPage = (ctx, {
  event, seats, ticket, ended, attendees, images, evaluated, hasSurvey, flash,
}) => page({
  title: event.title, member: ctx.member, path: '/events', nonce: ctx.nonce,
  description: event.description.slice(0, 160),
  scripts: ['/js/evaluate.js'],
  body: html`
    ${flash}
    <article class="card" style="padding:clamp(1.2rem,1rem+2vw,2rem)" data-splash-enter>
      <div class="cluster" style="margin-bottom:.8rem">
        ${when(!!event.category, html`<span class="chip chip--teal">${event.category}</span>`)}
        ${statusChip(event)}
        ${when(event.points > 0, html`<span class="chip chip--gold">${pointsText(event.points)} للحضور</span>`)}
        ${when(!!event.badge_name, html`<span class="chip">🏅 ${event.badge_name}</span>`)}
      </div>
      <h1 style="margin-bottom:.6rem">${event.title}</h1>
      <div class="card__meta" style="margin-bottom:1.2rem">
        <span>🗓️ ${formatRange(event.starts_at, event.ends_at)} <span class="muted">(بتوقيت عُمان)</span></span>
        ${when(!!event.location, html`<span>📍 ${event.location}</span>`)}
        <span>🎟️ ${seats === null ? 'المقاعد غير محدودة' : (seats > 0 ? `المتبقّي: ${seatsText(seats)} من ${num(event.capacity)}` : 'اكتملت المقاعد')}</span>
      </div>
      <p style="white-space:pre-line;font-size:1.02rem">${event.description}</p>

      <div class="card__foot" style="border-top:1px solid var(--border);padding-top:1.1rem">
        ${ticket
          ? html`<a class="btn btn--primary" href="/t/${ticket.code}">تذكرتي</a>
                 <span class="chip chip--success">✓ حجزك مؤكَّد</span>`
          : ended
            ? html`<span class="chip chip--outline">انتهت هذه الفعالية</span>`
            : event.status === 'cancelled'
              ? html`<span class="chip chip--danger">أُلغيت هذه الفعالية</span>`
              : (seats !== null && seats <= 0)
                ? html`<span class="chip chip--danger">اكتملت المقاعد</span>`
                : ctx.member
                  ? html`<form method="post" action="/events/${event.id}/book">
                      <button class="btn btn--primary" type="submit">احجز مقعدك</button>
                    </form>`
                  : html`<a class="btn btn--primary" href="/login?next=${encodeURIComponent(`/events/${event.id}`)}">سجّل دخولك للحجز</a>`}
        <a class="btn btn--outline btn--sm" href="/events/${event.id}/calendar.ics">أضِف إلى التقويم</a>
      </div>
    </article>

    ${when(images.length > 0, html`
    <section class="section" aria-labelledby="gal-h">
      <div class="section__head"><h2 id="gal-h">معرض الصور</h2></div>
      <div class="gallery">
        ${images.map((img) => html`<figure><img src="${objectUrl(img.object_key)}" alt="صورة من فعالية ${event.title}" loading="lazy"></figure>`)}
      </div>
    </section>`)}

    <section class="section" aria-labelledby="eval-h">
      <div class="section__head"><h2 id="eval-h">تقييم الفعالية</h2></div>
      <div class="card" data-splash-enter>
        ${hasSurvey
          ? html`<p>رأيك يصنع الفعالية القادمة. عبئ الاستبيان واكسب
                   <strong>${pointsText(config.evaluationPoints)}</strong> تُضاف إلى رصيدك — مرّة واحدة لكل فعالية.</p>
                 ${ctx.member
                   ? html`<form method="post" action="/events/${event.id}/evaluate" data-evaluate>
                       <button class="btn btn--teal" type="submit">
                         ${evaluated ? 'فتح الاستبيان (قُيّم سابقًا)' : 'قيّم الفعالية واكسب النقاط'}
                       </button>
                       <p class="small muted" data-evaluate-status role="status" style="margin:.6rem 0 0">
                         ${when(evaluated, raw('سبق أن قيّمت هذه الفعالية — النقاط تُمنح مرّة واحدة.'))}
                       </p>
                     </form>`
                   : html`<a class="btn btn--teal" href="/login?next=${encodeURIComponent(`/events/${event.id}`)}">سجّل دخولك للتقييم</a>`}`
          : html`<p class="muted">لم يُضَف استبيان تقييم لهذه الفعالية بعد.</p>`}
      </div>
    </section>

    <section class="section" aria-labelledby="att-h">
      <div class="section__head"><h2 id="att-h">من حضر</h2></div>
      ${ended
        ? (attendees.length
          ? html`<div class="table-wrap"><table>
              <caption class="visually-hidden">قائمة من حضر فعالية ${event.title}</caption>
              <thead><tr><th>#</th><th>الاسم</th><th>التخصّص</th></tr></thead>
              <tbody>${attendees.map((a, i) => html`<tr>
                <td>${num(i + 1)}</td><td>${a.full_name}</td><td>${a.major}</td>
              </tr>`)}</tbody>
            </table></div>`
          : html`<p class="empty">لم يُسجَّل حضور في هذه الفعالية.</p>`)
        : html`<p class="empty">تُعرض أسماء الحضور بعد انتهاء الفعالية.</p>`}
    </section>`,
});

/* ----------------------------- هيكلة النادي ----------------------------- */
export const structurePage = (ctx, { board, ranked }) => page({
  title: 'هيكلة النادي', member: ctx.member, path: '/structure', nonce: ctx.nonce,
  description: 'أعضاء إدارة نادي الثقافة والأدب وترتيب الأعضاء بالنقاط.',
  body: html`
    <h1>هيكلة النادي</h1>
    <p class="muted">إدارة النادي، ثم الأعضاء مرتَّبين بمجموع نقاطهم — والنقاط تُحسب من الحضور والتقييمات.</p>

    <section class="section" aria-labelledby="board-h">
      <div class="section__head"><h2 id="board-h">الإدارة</h2></div>
      ${board.length ? html`<div class="grid grid--4">
        ${board.map((m) => html`<article class="card board-card" data-splash-enter>
          ${avatar(m, { size: 'lg' })}
          <strong>${m.full_name}</strong>
          <span class="chip">${m.club_role}</span>
          <span class="small muted">${m.major}</span>
          <span class="small">${pointsText(m.total_points)} · حضر ${timesText(m.attendance_count)}</span>
        </article>`)}
      </div>` : html`<p class="empty">لم تُحدَّد رتب بعد.</p>`}
    </section>

    <section class="section" aria-labelledby="rank-h">
      <div class="section__head"><h2 id="rank-h">الأعضاء</h2></div>
      ${ranked.length ? html`<div class="table-wrap"><table>
        <caption class="visually-hidden">أعضاء النادي مرتَّبين بالنقاط</caption>
        <thead><tr><th>#</th><th>العضو</th><th>التخصّص</th><th>النقاط</th><th>مرّات الحضور</th></tr></thead>
        <tbody>
          ${ranked.map((m, i) => html`<tr>
            <td><span class="rank-num${i < 3 ? ` rank-num--${i + 1}` : ''}">${num(i + 1)}</span></td>
            <td><span class="person">${avatar(m)}<span>${m.full_name}</span></span></td>
            <td>${m.major}</td>
            <td><strong>${num(m.total_points)}</strong></td>
            <td>${num(m.attendance_count)}</td>
          </tr>`)}
        </tbody>
      </table></div>` : html`<p class="empty">لا يوجد أعضاء بعد.</p>`}
    </section>`,
});

/* -------------------------------- عن النادي ------------------------------ */
export const aboutPage = (ctx) => page({
  title: 'عن النادي', member: ctx.member, path: '/about', nonce: ctx.nonce,
  description: `تعريف ${config.club.name} وأهدافه.`,
  body: html`
    <h1>عن النادي</h1>
    <div class="grid grid--2">
      <article class="card" data-splash-enter>
        <h2>من نحن</h2>
        <p>${config.club.name} نادٍ طلابي في ${config.club.college} — ${config.club.university}.
           يجمع الطلبة الذين تستهويهم الكلمة: شعرًا ونثرًا وقراءةً ونقدًا وخطابة،
           ويمنحهم مساحة يقولون فيها ما لديهم، ويسمعون من غيرهم.</p>
        <p>نلتقي على مدار الفصل الدراسي في أمسيات وورش ومسابقات،
           ونفتح الباب لكل طالب وطالبة في الكلية مهما كان تخصّصه.</p>
      </article>
      <article class="card" data-splash-enter>
        <h2>أهدافنا</h2>
        <ul style="padding-inline-start:1.2rem;display:grid;gap:.5rem">
          <li>تنمية الذائقة الأدبية ومهارات الكتابة والإلقاء لدى الطلبة.</li>
          <li>إحياء اللغة العربية وتراثها في الوسط الجامعي.</li>
          <li>اكتشاف المواهب الأدبية ورعايتها وإتاحة منصّة لها.</li>
          <li>تشجيع القراءة الحرّة وبناء مجتمع قرائي داخل الكلية.</li>
          <li>ربط النشاط الثقافي بالمجتمع المحلّي في الرستاق.</li>
        </ul>
      </article>
    </div>
    <div class="grid grid--3 section">
      ${[
        { t: 'أمسيات شعرية', d: 'منابر مفتوحة للشعراء الطلبة، وضيوف من خارج الكلية.' },
        { t: 'ورش الكتابة', d: 'ورش عملية في القصة والمقال والكتابة الإبداعية.' },
        { t: 'نادي القراءة', d: 'كتاب كل شهر، وجلسة نقاش مفتوحة حوله.' },
        { t: 'مسابقات ثقافية', d: 'مسابقات في الشعر والقصة والإملاء والمعلومات العامّة.' },
        { t: 'نقاط وشارات', d: 'حضورك يُسجَّل بمسح تذكرتك، فتكسب نقاطًا وشارات تُبنى عليها هيكلة النادي.' },
        { t: 'عضوية مفتوحة', d: 'التسجيل متاح لكل طالب في الكلية بالرقم الجامعي والإيميل الجامعي.' },
      ].map((c) => html`<article class="card" data-splash-enter>
        <h3 class="card__title">${c.t}</h3><p class="muted" style="margin:0">${c.d}</p>
      </article>`)}
    </div>`,
});

/* --------------------------------- تواصل -------------------------------- */
export const contactPage = (ctx, { values = {}, errors = {}, flash = raw('') } = {}) => page({
  title: 'تواصل معنا', member: ctx.member, path: '/contact', nonce: ctx.nonce,
  body: html`
    <h1>تواصل معنا</h1>
    <div class="grid grid--2">
      <div>
        ${flash}
        <form class="form card" method="post" action="/contact" novalidate>
          <div class="field">
            <label for="name">الاسم</label>
            <input type="text" id="name" name="name" value="${values.name || ''}" required
                   ${raw(errors.name ? 'aria-invalid="true" aria-describedby="e-name"' : '')}>
            ${when(!!errors.name, html`<span class="field__error" id="e-name">${errors.name}</span>`)}
          </div>
          <div class="field">
            <label for="phone">رقم الجوال</label>
            <input type="tel" id="phone" name="phone" value="${values.phone || ''}" inputmode="tel" required
                   ${raw(errors.phone ? 'aria-invalid="true" aria-describedby="e-phone"' : '')}>
            <span class="field__hint">ثمانية أرقام عُمانية، أو رقم دولي مع مفتاح الدولة.</span>
            ${when(!!errors.phone, html`<span class="field__error" id="e-phone">${errors.phone}</span>`)}
          </div>
          <div class="field">
            <label for="body">رسالتك</label>
            <textarea id="body" name="body" required ${raw(errors.body ? 'aria-invalid="true" aria-describedby="e-body"' : '')}>${values.body || ''}</textarea>
            ${when(!!errors.body, html`<span class="field__error" id="e-body">${errors.body}</span>`)}
          </div>
          <div class="form__actions"><button class="btn btn--primary" type="submit">إرسال</button></div>
        </form>
      </div>
      <aside class="card" data-splash-enter>
        <h2>معلومات التواصل</h2>
        <p>${config.club.college}<br>${config.club.university}</p>
        <p>البريد: <a href="mailto:${config.club.email}">${config.club.email}</a></p>
        <p class="muted small">تصل رسالتك إلى إدارة النادي مباشرة، ونردّ عليك على رقمك.</p>
      </aside>
    </div>`,
});

/* --------------------------- الدخول والتسجيل ---------------------------- */
export const loginPage = (ctx, { values = {}, error = '', next = '', flash = raw('') } = {}) => page({
  title: 'الدخول', member: null, path: '/login', nonce: ctx.nonce,
  body: html`
    <div style="max-width:30rem;margin-inline:auto">
      <h1>الدخول</h1>
      <p class="muted">أدخل رقم جوالك المسجَّل — لا حاجة لكلمة سر.</p>
      ${flash}
      ${alertBox('error', error)}
      <form class="form card" method="post" action="/login" novalidate>
        <input type="hidden" name="next" value="${next}">
        <div class="field">
          <label for="phone">رقم الجوال</label>
          <input type="tel" id="phone" name="phone" inputmode="tel" autocomplete="tel"
                 value="${values.phone || ''}" required autofocus>
          <span class="field__hint">مثال: ٩١٢٣٤٥٦٧</span>
        </div>
        <div class="form__actions">
          <button class="btn btn--primary btn--block" type="submit">دخول</button>
        </div>
      </form>
      <p class="center" style="margin-top:1rem">لست عضوًا بعد؟ <a href="/register">سجّل عضويتك</a></p>
    </div>`,
});

export const registerPage = (ctx, { values = {}, errors = {}, error = '' } = {}) => page({
  title: 'التسجيل', member: null, path: '/register', nonce: ctx.nonce,
  body: html`
    <div style="max-width:34rem;margin-inline:auto">
      <h1>انضمّ إلى النادي</h1>
      <p class="muted">التسجيل مفتوح لطلبة ${config.club.college}.</p>
      ${alertBox('error', error)}
      <form class="form card" method="post" action="/register" novalidate>
        <div class="field">
          <label for="full_name">الاسم الثلاثي</label>
          <input type="text" id="full_name" name="full_name" value="${values.full_name || ''}" required
                 autocomplete="name" ${raw(errors.full_name ? 'aria-invalid="true" aria-describedby="e-name"' : '')}>
          <span class="field__hint">ثلاث كلمات فأكثر، بالحروف فقط.</span>
          ${when(!!errors.full_name, html`<span class="field__error" id="e-name">${errors.full_name}</span>`)}
        </div>
        <div class="field">
          <label for="phone">رقم الجوال</label>
          <input type="tel" id="phone" name="phone" value="${values.phone || ''}" required
                 inputmode="tel" autocomplete="tel" ${raw(errors.phone ? 'aria-invalid="true" aria-describedby="e-phone"' : '')}>
          <span class="field__hint">ثمانية أرقام عُمانية، أو رقم دولي مع مفتاح الدولة. به تدخل لاحقًا.</span>
          ${when(!!errors.phone, html`<span class="field__error" id="e-phone">${errors.phone}</span>`)}
        </div>
        <div class="form__row">
          <div class="field">
            <label for="student_id">الرقم الجامعي</label>
            <input type="text" id="student_id" name="student_id" value="${values.student_id || ''}" required
                   inputmode="numeric" ${raw(errors.student_id ? 'aria-invalid="true" aria-describedby="e-sid"' : '')}>
            <span class="field__hint">أرقام فقط، من ٥ إلى ١٢ خانة.</span>
            ${when(!!errors.student_id, html`<span class="field__error" id="e-sid">${errors.student_id}</span>`)}
          </div>
          <div class="field">
            <label for="major">التخصّص</label>
            <input type="text" id="major" name="major" value="${values.major || ''}" required list="majors"
                   ${raw(errors.major ? 'aria-invalid="true" aria-describedby="e-major"' : '')}>
            <datalist id="majors">
              ${['اللغة العربية', 'اللغة الإنجليزية', 'الرياضيات', 'العلوم', 'الدراسات الاجتماعية', 'تقنية المعلومات', 'التربية الإسلامية', 'التربية الفنية', 'التربية الرياضية']
                .map((m) => html`<option value="${m}"></option>`)}
            </datalist>
            ${when(!!errors.major, html`<span class="field__error" id="e-major">${errors.major}</span>`)}
          </div>
        </div>
        <div class="field">
          <label for="email">الإيميل الجامعي</label>
          <input type="email" id="email" name="email" value="${values.email || ''}" required
                 autocomplete="email" ${raw(errors.email ? 'aria-invalid="true" aria-describedby="e-email"' : '')}>
          <span class="field__hint">لا بدّ أن ينتهي بـ ${config.emailDomain}</span>
          ${when(!!errors.email, html`<span class="field__error" id="e-email">${errors.email}</span>`)}
        </div>
        <div class="form__actions">
          <button class="btn btn--primary btn--block" type="submit">تسجيل العضوية</button>
        </div>
      </form>
      <p class="center" style="margin-top:1rem">لديك عضوية؟ <a href="/login">ادخل برقم جوالك</a></p>
    </div>`,
});

/* -------------------------------- عضويتي -------------------------------- */
export const mePage = (ctx, { member, points, badges, tickets, errors = {}, flash = raw('') }) => page({
  title: 'عضويتي', member, path: '/me', nonce: ctx.nonce,
  body: html`
    <h1>عضويتي</h1>
    ${flash}
    <div class="stat-grid section" style="margin-top:1rem">
      <div class="stat"><strong>${num(points.total_points)}</strong><span>مجموع نقاطي</span></div>
      <div class="stat"><strong>${num(points.attendance_count)}</strong><span>مرّات الحضور</span></div>
      <div class="stat"><strong>${num(points.evaluation_count)}</strong><span>تقييمات</span></div>
      <div class="stat"><strong>${num(tickets.length)}</strong><span>تذاكري</span></div>
    </div>

    <section class="section" aria-labelledby="t-h">
      <div class="section__head"><h2 id="t-h">تذاكري</h2></div>
      ${tickets.length ? html`<div class="grid grid--2">
        ${tickets.map((t) => html`<article class="card" data-splash-enter>
          <div class="cluster" style="margin-bottom:.4rem">
            ${t.attendance_id
              ? html`<span class="chip chip--success">✓ حضور مسجَّل</span>`
              : (new Date(t.ends_at).getTime() < Date.now()
                ? html`<span class="chip chip--outline">لم يُسجَّل حضور</span>`
                : html`<span class="chip chip--teal">قادمة</span>`)}
            ${when(!!t.badge_name, html`<span class="chip chip--gold">🏅 ${t.badge_name}</span>`)}
          </div>
          <h3 class="card__title"><a href="/events/${t.event_id}">${t.event_title}</a></h3>
          <div class="card__meta"><span>🗓️ ${formatRange(t.starts_at, t.ends_at)}</span></div>
          <div class="card__foot">
            <a class="btn btn--sm btn--primary" href="/t/${t.code}">عرض التذكرة</a>
            <code class="small muted" dir="ltr">${t.code}</code>
          </div>
        </article>`)}
      </div>` : html`<p class="empty">لا تذاكر بعد — <a href="/events">تصفّح الفعاليات</a>.</p>`}
    </section>

    <section class="section" aria-labelledby="b-h">
      <div class="section__head"><h2 id="b-h">شاراتي</h2></div>
      ${badges.length
        ? html`<div class="cluster">${badges.map((b) => html`<span class="chip chip--gold" title="${b.event_title}">🏅 ${b.badge_name}</span>`)}</div>`
        : html`<p class="empty">لم تكسب شارات بعد — احضر فعالية وامسح تذكرتك.</p>`}
    </section>

    <section class="section" aria-labelledby="p-h">
      <div class="section__head"><h2 id="p-h">بياناتي</h2></div>
      <div class="grid grid--2">
        <form class="form card" method="post" action="/me" novalidate>
          <div class="field">
            <label for="full_name">الاسم الثلاثي</label>
            <input type="text" id="full_name" name="full_name" value="${member.full_name}" required
                   ${raw(errors.full_name ? 'aria-invalid="true"' : '')}>
            ${when(!!errors.full_name, html`<span class="field__error">${errors.full_name}</span>`)}
          </div>
          <div class="field">
            <label for="major">التخصّص</label>
            <input type="text" id="major" name="major" value="${member.major}" required
                   ${raw(errors.major ? 'aria-invalid="true"' : '')}>
            ${when(!!errors.major, html`<span class="field__error">${errors.major}</span>`)}
          </div>
          <div class="form__actions"><button class="btn btn--primary" type="submit">حفظ التعديلات</button></div>
        </form>
        <div class="card">
          <h3>بيانات لا تُعدَّل من هنا</h3>
          <div class="ticket__meta">
            <div><span class="k">رقم الجوال</span><span class="v" dir="ltr">${formatPhone(member.phone)}</span></div>
            <div><span class="k">الرقم الجامعي</span><span class="v" dir="ltr">${member.student_id}</span></div>
            <div><span class="k">الإيميل الجامعي</span><span class="v" dir="ltr">${member.email}</span></div>
            <div><span class="k">تاريخ الانضمام</span><span class="v">${formatShort(member.joined_at)}</span></div>
          </div>
          <p class="small muted" style="margin-top:1rem">لتعديل الجوال أو الرقم الجامعي أو الإيميل، راسل إدارة النادي.</p>
          <form method="post" action="/logout" style="margin-top:1rem">
            <button class="btn btn--outline btn--sm" type="submit">تسجيل الخروج</button>
          </form>
        </div>
      </div>
    </section>`,
});

/* -------------------------------- التذكرة ------------------------------- */
export const ticketPage = (ctx, { ticket, qrSvg, event }) => page({
  title: `تذكرة ${ticket.event_title}`, member: ctx.member, path: '/me', nonce: ctx.nonce,
  splash: false, scripts: ['/js/ticket.js'],
  body: html`
    <div class="ticket" data-ticket>
      <div class="ticket__head">
        <h2>${ticket.event_title}</h2>
        <p style="margin:0;opacity:.85">${formatRange(event.starts_at, event.ends_at)}</p>
        ${when(!!event.location, html`<p style="margin:.2rem 0 0;opacity:.85">📍 ${event.location}</p>`)}
      </div>
      <div class="ticket__body">
        <div class="ticket__qr">${raw(qrSvg)}</div>
        <p class="small muted center" style="margin:0">اعرض هذا الرمز عند المدخل ليُمسح.</p>
        <code class="ticket__code" data-ticket-code>${ticket.code}</code>
        <div class="cluster no-print">
          <button class="btn btn--sm btn--outline" type="button" data-copy="${ticket.code}">نسخ الرمز</button>
          <button class="btn btn--sm btn--outline" type="button" data-save-ticket>حفظ التذكرة صورة</button>
          <a class="btn btn--sm btn--outline" href="/t/${ticket.code}/calendar.ics">ملفّ تقويم</a>
        </div>
        <div class="ticket__perf" aria-hidden="true"></div>
        <div class="ticket__meta">
          <div><span class="k">العضو</span><span class="v">${ticket.member_name}</span></div>
          <div><span class="k">التخصّص</span><span class="v">${ticket.member_major}</span></div>
          <div><span class="k">النقاط عند الحضور</span><span class="v">${num(ticket.event_points)}</span></div>
          ${when(!!ticket.event_badge, html`<div><span class="k">الشارة</span><span class="v">🏅 ${ticket.event_badge}</span></div>`)}
          ${ticket.attendance_id
            ? html`<div><span class="k">الحضور</span><span class="v" style="color:var(--success)">✓ مسجَّل ${formatTime(ticket.scanned_at)}</span></div>
                   <div><span class="k">بطاقة الحضور</span><span class="v" dir="ltr">${ticket.card_id}</span></div>`
            : html`<div><span class="k">الحضور</span><span class="v muted">لم يُسجَّل بعد</span></div>`}
        </div>
      </div>
    </div>
    <p class="center no-print" style="margin-top:1.5rem">
      <a class="btn btn--outline" href="/me">← تذاكري</a>
      <a class="btn btn--outline" href="/events/${ticket.event_id}">صفحة الفعالية</a>
    </p>`,
});

/* --------------------------- صفحة تقييم مستقلّة -------------------------- */
export const evaluateLandingPage = (ctx, { event, evaluated }) => page({
  title: `تقييم ${event.title}`, member: ctx.member, path: '/events', nonce: ctx.nonce,
  splash: false, scripts: ['/js/evaluate.js'],
  body: html`
    <div style="max-width:32rem;margin-inline:auto;text-align:center">
      <h1>تقييم الفعالية</h1>
      <h2 class="muted" style="font-size:1.1rem">${event.title}</h2>
      <div class="card" style="margin-top:1.5rem">
        ${ctx.member
          ? html`<p>اضغط الزرّ لتُضاف ${pointsText(config.evaluationPoints)} إلى رصيدك (مرّة واحدة)، ثم تُفتح استمارة التقييم.</p>
              <form method="post" action="/events/${event.id}/evaluate" data-evaluate>
                <button class="btn btn--primary btn--block" type="submit">
                  ${evaluated ? 'فتح الاستبيان' : 'قيّم واكسب النقاط'}
                </button>
                <p class="small muted" data-evaluate-status role="status" style="margin:.8rem 0 0">
                  ${when(evaluated, raw('سبق أن قيّمت هذه الفعالية — النقاط تُمنح مرّة واحدة.'))}
                </p>
              </form>`
          : html`<p>سجّل دخولك برقم جوالك أولًا لتُحتسب نقاطك.</p>
              <a class="btn btn--primary btn--block" href="/login?next=${encodeURIComponent(`/events/${event.id}/evaluate`)}">الدخول</a>`}
      </div>
      <p style="margin-top:1rem"><a href="/events/${event.id}">← صفحة الفعالية</a></p>
    </div>`,
});
