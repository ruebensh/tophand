// ============================================================================
//  /api/translate — foydalanuvchi kontentini ru/en ga mashina-tarjimasi (kesh).
//  POST { texts: string[], target: 'ru'|'en' } → { translations: string[], ... }
//  uz / uz-Cyrl bu endpointga bormaydi (uz-Cyrl frontend translit, uz — asl til).
//  GET /api/translate/status → MT holati (admin panel ko'rsatishi uchun).
// ============================================================================

import { Router } from 'express';
import { translateTexts, isTranslateConfigured } from '../services/translateService.ts';
import { reqLang, reqIsCyrillic, msg } from '../i18n/messages.ts';

const router = Router();

router.get('/status', (_req, res) => {
  res.json({
    configured: isTranslateConfigured(),
    engine: 'google',
    targets: ['ru', 'en'],
  });
});

router.post('/', async (req, res) => {
  const lang = reqLang(req);
  const cyr = reqIsCyrillic(req);
  try {
    const { texts, target } = req.body || {};
    if (!Array.isArray(texts) || typeof target !== 'string') {
      return res.status(400).json({ error: msg('translate.required', lang, undefined, cyr) });
    }
    if (target !== 'ru' && target !== 'en') {
      return res.status(400).json({ error: msg('translate.unsupportedTarget', lang, undefined, cyr) });
    }
    if (!isTranslateConfigured()) {
      // Graceful: kalit yo'q — asl matnlarni tartibi bilan qaytaramiz.
      return res.json({ translations: texts.map((t: any) => String(t ?? '')), degraded: true });
    }
    // Himoya: element soni cheklangan.
    const capped = texts.slice(0, 100).map((t: any) => (typeof t === 'string' ? t : String(t ?? '')));
    const result = await translateTexts(capped, target);
    res.json({
      translations: result.translations,
      sourceLang: result.sourceLang,
      cached: result.cachedCount,
      translated: result.translatedCount,
      degraded: false,
    });
  } catch (err: any) {
    // Tarjima xatosi sahifani buzmasin — asl matnni qaytaramiz (graceful).
    const texts = Array.isArray(req.body?.texts) ? req.body.texts : [];
    res.status(200).json({
      translations: texts.map((t: any) => String(t ?? '')),
      degraded: true,
      error: err?.message,
    });
  }
});

export default router;
