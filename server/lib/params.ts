/**
 * Report #9: so'rov/qo'shimcha jismdagi boolean qiymatni QAT'IY interpretatsiya
 * qilish. `Boolean(x)` xavfli — `Boolean('false')` === true (noma'lum matn
 * truthy). Bu yordamchi faqat aniq true/false ko'rinishlarini qabul qiladi va
 * ularni haqiqiy boolean'ga aylantiradi; qolgan barcha kirishlar uchun `null`
 * qaytaradi (chaqiruvchi 400 qaytarsin).
 *
 * Qabul qilinadi: true|'true'|1|'1'|'yes'|'on'  → true
 *               false|'false'|0|'0'|'no'|'off' → false
 */
export function parseStrictBoolean(raw: unknown): boolean | null {
  if (typeof raw === 'boolean') return raw;
  if (typeof raw === 'number') {
    if (raw === 1) return true;
    if (raw === 0) return false;
    return null;
  }
  if (typeof raw === 'string') {
    const v = raw.trim().toLowerCase();
    if (v === 'true' || v === '1' || v === 'yes' || v === 'on') return true;
    if (v === 'false' || v === '0' || v === 'no' || v === 'off') return false;
  }
  return null;
}
