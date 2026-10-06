// ============================================================================
//  Backend xabarlar lug'ati (uz / ru / en). uz-Cyrl runtime transliteratsiya.
//  Route'lar `reqLang(req)` orqali tilni aniqlaydi, `msg(key, lang, vars)` esa
//  matnni qaytaradi. Kalit topilmasa uz'ga qaytadi (fallback).
// ============================================================================

import type { Request } from 'express';
import { uzLatnToCyrillic } from './translit.ts';

export type MsgLocale = 'uz' | 'ru' | 'en';

const MESSAGES: Record<MsgLocale, Record<string, string>> = {
  uz: {
    'generic.error': 'So‘rovni bajarib bo‘lmadi',
    'generic.serverError': 'Serverda ichki xatolik yuz berdi',
    'auth.required': 'Iltimos, avval tizimga kiring',
    'auth.forbidden': 'Sizda bu amal uchun ruxsat yo‘q',
    'notFound': 'Topilmadi',
    'translate.required': 'Tarjima uchun matn (texts) va maqsad tili (target) talab qilinadi',
    'translate.unsupportedTarget': 'Bu til uchun mashina tarjimasi qo‘llab-quvvatlanmaydi',
    'translate.notConfigured': 'Tarjima xizmati sozlanmagan (API kaliti yo‘q)',
    'translate.failed': 'Tarjimada xatolik yuz berdi',
    'email.verifySubject': 'TopHand — tasdiqlash kodi',
    'email.resetSubject': 'TopHand — parolni tiklash kodi',
    'email.codeTitle': 'Parolni tiklash yoki tasdiqlash',
    'email.codeIntro': 'TopHand hisobingiz uchun tasdiqlash kodi quyida keltirilgan. Kod 15 daqiqa davomida amal qiladi:',
    'email.codeIgnore': 'Agar siz ushbu kodni so‘ramagan bo‘lsangiz, bu xatni e‘tiborsiz qoldiring.',
    'email.footer': 'Mahalliy Xizmatlar va Ish Bozori Platformasi',
    'notif.newMessage': 'Sizga yangi xabar keldi',
    'notif.listingApproved': "E'loningiz tasdiqlandi",
    'notif.listingRejected': "E'loningiz rad etildi",
  },
  ru: {
    'generic.error': 'Не удалось выполнить запрос',
    'generic.serverError': 'Внутренняя ошибка сервера',
    'auth.required': 'Пожалуйста, сначала войдите в систему',
    'auth.forbidden': 'У вас нет прав для этого действия',
    'notFound': 'Не найдено',
    'translate.required': 'Для перевода требуются текст (texts) и целевой язык (target)',
    'translate.unsupportedTarget': 'Машинный перевод на этот язык не поддерживается',
    'translate.notConfigured': 'Сервис перевода не настроен (отсутствует API-ключ)',
    'translate.failed': 'Произошла ошибка при переводе',
    'email.verifySubject': 'TopHand — код подтверждения',
    'email.resetSubject': 'TopHand — код восстановления пароля',
    'email.codeTitle': 'Восстановление или подтверждение пароля',
    'email.codeIntro': 'Код подтверждения для вашего аккаунта TopHand указан ниже. Он действителен 15 минут:',
    'email.codeIgnore': 'Если вы не запрашивали этот код, просто проигнорируйте это письмо.',
    'email.footer': 'Платформа местных услуг и рынка труда',
    'notif.newMessage': 'Вам пришло новое сообщение',
    'notif.listingApproved': 'Ваше объявление одобрено',
    'notif.listingRejected': 'Ваше объявление отклонено',
  },
  en: {
    'generic.error': 'Could not complete the request',
    'generic.serverError': 'Internal server error',
    'auth.required': 'Please log in first',
    'auth.forbidden': 'You do not have permission for this action',
    'notFound': 'Not found',
    'translate.required': 'Translation requires text (texts) and a target language (target)',
    'translate.unsupportedTarget': 'Machine translation to this language is not supported',
    'translate.notConfigured': 'Translation service is not configured (missing API key)',
    'translate.failed': 'An error occurred while translating',
    'email.verifySubject': 'TopHand — verification code',
    'email.resetSubject': 'TopHand — password reset code',
    'email.codeTitle': 'Password reset or verification',
    'email.codeIntro': 'The verification code for your TopHand account is shown below. The code is valid for 15 minutes:',
    'email.codeIgnore': "If you didn't request this code, please ignore this email.",
    'email.footer': 'Local Services & Job Market Platform',
    'notif.newMessage': 'You have a new message',
    'notif.listingApproved': 'Your listing has been approved',
    'notif.listingRejected': 'Your listing has been rejected',
  },
};

const INTL_TO_MSG: Record<string, MsgLocale> = {
  uz: 'uz', 'uz-Cyrl': 'uz', 'uz-Latn': 'uz', ru: 'ru', en: 'en',
};

// Normalizator: 'uz-Cyrl'/'uz-Latn'/'uz' → uz; 'ru*' → ru; 'en*' → en.
export function normalizeLocale(raw?: string | null): MsgLocale {
  if (!raw) return 'uz';
  const base = raw.trim().toLowerCase();
  if (base.startsWith('ru')) return 'ru';
  if (base.startsWith('en')) return 'en';
  if (base.startsWith('uz')) {
    // uz-Cyrl ham uz lug'atidan transliteratsiya qilinadi (msg() ichida).
    return 'uz';
  }
  return 'uz';
}

// So'rovning ?lang yoki Accept-Language sarlavhasidan tilni olamiz.
export function reqLang(req: Request): MsgLocale {
  const q = (req.query.lang as string) || (req.headers['x-lang'] as string);
  if (q) {
    const base = q.trim().toLowerCase();
    if (base.startsWith('ru')) return 'ru';
    if (base.startsWith('en')) return 'en';
    if (base.startsWith('uz')) return 'uz';
  }
  const al = req.headers['accept-language'];
  if (al) {
    const first = al.split(',')[0]?.split(';')[0]?.trim();
    return normalizeLocale(first);
  }
  return 'uz';
}

// Kirill varianti kerakmi — so'rov tilidan kelib chiqib aniqlaymiz.
export function reqIsCyrillic(req: Request): boolean {
  const q = ((req.query.lang as string) || (req.headers['x-lang'] as string) || '').trim().toLowerCase();
  if (q.startsWith('uz-cyrl') || q.includes('uz_cyrl')) return true;
  return false;
}

export function msg(key: string, lang: MsgLocale, vars?: Record<string, string | number>, cyrillic = false): string {
  let text = MESSAGES[lang]?.[key] ?? MESSAGES.uz[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      text = text.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(v));
    }
  }
  if (cyrillic && lang === 'uz') text = uzLatnToCyrillic(text);
  return text;
}

export { INTL_TO_MSG };
