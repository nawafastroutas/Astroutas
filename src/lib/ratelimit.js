/** حدّ معدّل بنافذة منزلقة في الذاكرة — لكل مفتاح (عادةً IP + المسار). */
import { minutes } from './arabic.js';

const buckets = new Map();
let lastSweep = Date.now();

function sweep(now) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, entry] of buckets) {
    if (entry.expires <= now) buckets.delete(key);
  }
}

/**
 * @returns {{allowed:boolean, remaining:number, retryAfterSec:number}}
 */
export function hit(key, { limit, windowMs }, now = Date.now()) {
  sweep(now);
  const entry = buckets.get(key);
  const cutoff = now - windowMs;
  const stamps = entry ? entry.stamps.filter((t) => t > cutoff) : [];

  if (stamps.length >= limit) {
    const retryAfterSec = Math.max(1, Math.ceil((stamps[0] + windowMs - now) / 1000));
    buckets.set(key, { stamps, expires: stamps[0] + windowMs });
    return { allowed: false, remaining: 0, retryAfterSec };
  }

  stamps.push(now);
  buckets.set(key, { stamps, expires: now + windowMs });
  return { allowed: true, remaining: limit - stamps.length, retryAfterSec: 0 };
}

export function reset() { buckets.clear(); }

/** رسالة عربية موحّدة عند تجاوز الحدّ. */
export const tooManyMessage = (retryAfterSec) => {
  const mins = Math.ceil(retryAfterSec / 60);
  return mins > 1 ? `محاولات كثيرة. حاول بعد ${minutes(mins)}.` : 'محاولات كثيرة. حاول بعد قليل.';
};
