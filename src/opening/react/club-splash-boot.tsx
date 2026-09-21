/**
 * قرار عرض شاشة الافتتاح — يُنفَّذ قبل أول رسمة.
 *
 * الشاشة تُرسم ظاهرة من الخادم، وإلا رأى الزائر المحتوى ثم غطّته الشاشة بعده،
 * وهو أسوأ من غيابها. ولأنها تُرسم ظاهرة فلا بدّ من قرارٍ متزامن يسبق الرسم،
 * لا تأثير React يجري بعده.
 *
 * القرار يُنفَّذ بحقن <style> في <head> لا بسمة على <html>. السبب أن React
 * يقارن سمات الجذر عند الهيدريشن، فسمةٌ يكتبها سكربت قبله تُعدّ اختلافًا
 * ويُسجَّل خطأ في الطرفية. أما عنصر <style> مُضاف من خارج شجرة React فلا
 * يقارنه أحد.
 *
 * يُسقط الشاشة متى ما رُئيت في هذه الجلسة، أو فُتح الموقع في تبويب خلفي، أو
 * تعطّل التخزين. و«تقليل الحركة» يتكفّل به CSS وحده بلا انتظار أي سكربت.
 *
 * `?splash=1` يفرض العرض متجاوزًا علامة الجلسة والتبويب الخلفي — للمعاينة
 * دون مسح تخزين المتصفّح في كل مرة.
 */
const BOOT = `(function(){var f=location.search.indexOf('splash=1')>-1,s=false;try{if(!f&&(sessionStorage.getItem('club-splash-seen')||document.visibilityState!=='visible')){s=true}else{sessionStorage.setItem('club-splash-seen','1')}}catch(e){s=!f}window.__clubSplashSkip=s;if(s){var e=document.createElement('style');e.textContent='.club-splash{display:none}';document.head.appendChild(e)}})()`;

export function ClubSplashBoot() {
  return <script dangerouslySetInnerHTML={{ __html: BOOT }} />;
}
