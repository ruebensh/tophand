import { serverError } from '../lib/error.ts';
import { Router } from 'express';
import { GoogleGenAI } from '@google/genai';
import { queryAll } from '../db/database.ts';

const router = Router();

// POST /api/ai/suggest-category
// Request body: { title: string, description?: string }
router.post('/suggest-category', async (req, res) => {
  try {
    const { title, description } = req.body;
    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ error: 'Sarlavha (title) kiritilishi shart' });
    }

    const textToAnalyze = `${title.trim()}\n${(description || '').trim()}`.trim();

    // Bazadagi barcha faol ota va bola kategoriyalarni olamiz
    const categories = await queryAll(`
      SELECT c.id, c.catalog_id, c.name_uz, c.parent_id
      FROM categories c
      WHERE c.is_active = 1
      ORDER BY c.parent_id IS NOT NULL, c.sort_order ASC
    `);

    const parents = categories.filter((c: any) => !c.parent_id);
    const subs = categories.filter((c: any) => Boolean(c.parent_id));

    // Tayyor kontekst strukturasi
    const catalogSummary = parents.map((p: any) => {
      const pSubs = subs.filter((s: any) => s.parent_id === p.id);
      return {
        catalog_id: p.catalog_id,
        category_id: p.id,
        category_name: p.name_uz,
        subcategories: pSubs.map((s: any) => ({
          subcategory_id: s.id,
          subcategory_name: s.name_uz,
        })),
      };
    });

    const apiKey = process.env.GEMINI_API_KEY;
    let aiResult: any = null;

    if (apiKey && apiKey !== 'MY_GEMINI_API_KEY' && apiKey.trim().length > 10) {
      try {
        const ai = new GoogleGenAI({ apiKey });
        const prompt = `
Siz O'zbekistondagi "TopHand" e'lonlar va xizmatlar platformasining sun'iy intellekt yordamchisisiz.
Quyidagi e'lon matnini tahlil qiling va unga eng mos keluvchi katalog (catalog_id), ota kategoriya (category_id), subkategoriya (subcategory_id) va e'lon turini (type: SERVICE_OFFER | SERVICE_REQUEST | JOB_OPENING | JOB_SEEKER) aniqlang.

Mavjud kataloglar:
1) 'services' (Xizmatlar: ustalar, go'zallik, ta'mirlash, tozalash va hk.) -> type: SERVICE_OFFER yoki SERVICE_REQUEST
2) 'jobs' (Ish e'lonlari: do'konga sotuvchi kerak, IT dasturchi vakansiyasi, haydovchi kerak va hk.) -> type: JOB_OPENING yoki JOB_SEEKER

Kategoriyalar va subkategoriyalar ro'yxati (JSON):
${JSON.stringify(catalogSummary, null, 2)}

Foydalanuvchi kiritgan e'lon matni:
"""
${textToAnalyze}
"""

Javobni FAQAT quyidagi JSON formatda qaytaring (hech qanday qo'shimcha matnsiz yoki markdown formatsiz):
{
  "catalog_id": "services yoki jobs",
  "category_id": "eng mos kelgan category_id",
  "subcategory_id": "eng mos kelgan subcategory_id yoki null",
  "type": "SERVICE_OFFER yoki SERVICE_REQUEST yoki JOB_OPENING yoki JOB_SEEKER",
  "confidence": 0.95,
  "suggested_tags": ["tag1", "tag2"],
  "reasoning_uz": "Nega bu kategoriya tanlanganligi haqida qisqacha izoh"
}
`;

        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
        });

        const rawText = response.text || '';
        // Extract JSON from response
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          aiResult = JSON.parse(jsonMatch[0]);
        }
      } catch (geminiErr: any) {
        console.warn('Gemini API call failed or timed out, falling back to heuristic matching:', geminiErr.message);
      }
    }

    // Agar AI ishlamasa yoki kalit kiritilmagan bo'lsa: Aqlli Heuristic Fallback
    if (!aiResult) {
      const lowerText = textToAnalyze.toLowerCase();

      // Ish e'lonlari kalit so'zlari
      const isJob = /(kerak|vakansiya|ishga taklif|oylik|maosh|ishchi|ish o['']rni|talab qilinadi|grafik|rezyume|ish qidiryapman)/i.test(lowerText);
      const isJobSeeker = /(ish qidiryapman|rezyume|tajribam bor|ish izlayapman)/i.test(lowerText);
      const isServiceRequest = /(usta kerak|qildirmoqchiman|kerak edi|yordam kerak)/i.test(lowerText) && !isJob;

      let catalog_id = isJob ? 'jobs' : 'services';
      let type = 'SERVICE_OFFER';
      if (isJob) {
        type = isJobSeeker ? 'JOB_SEEKER' : 'JOB_OPENING';
      } else if (isServiceRequest) {
        type = 'SERVICE_REQUEST';
      }

      // Eng yaxshi mos subkategoriyani topish
      let bestSub: any = null;
      let bestParent: any = null;
      let maxScore = 0;

      for (const p of parents) {
        if (p.catalog_id !== catalog_id) continue;
        const pSubs = subs.filter((s: any) => s.parent_id === p.id);

        for (const s of pSubs) {
          const subWords = s.name_uz.toLowerCase().split(/[\s,–—\/-]+/);
          let score = 0;
          for (const w of subWords) {
            if (w.length > 3 && lowerText.includes(w)) {
              score += 2;
            }
          }
          if (lowerText.includes(p.name_uz.toLowerCase())) {
            score += 1;
          }
          if (score > maxScore) {
            maxScore = score;
            bestSub = s;
            bestParent = p;
          }
        }
      }

      // Agar maxsus mos topilmasa, katalogdagi birinchi yoki eng ommabop kategoriyani tanlaymiz
      if (!bestParent) {
        bestParent = parents.find((p: any) => p.catalog_id === catalog_id) || parents[0];
        const pSubs = subs.filter((s: any) => s.parent_id === bestParent?.id);
        bestSub = pSubs[0] || null;
      }

      aiResult = {
        catalog_id,
        category_id: bestParent?.id,
        subcategory_id: bestSub?.id || null,
        type,
        confidence: maxScore > 0 ? 0.85 : 0.6,
        suggested_tags: [],
        reasoning_uz: 'Matn tahliliga ko‘ra eng mos keluvchi kategoriya',
      };
    }

    res.json(aiResult);
  } catch (err: any) {
    serverError(res, err);
  }
});

export default router;
