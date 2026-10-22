// ============================================================================
//  listingSchema — wizard uchun zod validatsiyasi.
//  Statik maydonlar (sarlavha, kategoriya, lokatsiya, maosh/narx shartlari)
//  + superRefine orqali dinamik atribut sxemasidagi `required` maydonlar.
//  Xabarlar lokalizatsiya qilingan holda kelishi uchun `t` funksiyasi beriladi.
//  Server ham tekshiradi — bu yerda maqsad: inline UX.
// ============================================================================

import { z } from 'zod';
import type { CategoryAttribute } from '../types/index.ts';

type TFn = (key: string, vars?: Record<string, string | number>) => string;

export interface ListingSchemaCtx {
  isJobs: boolean;
  showEmployment: boolean;
  attrSchema: CategoryAttribute[];
  t: TFn;
}

export function makeListingSchema(ctx: ListingSchemaCtx) {
  const { isJobs, showEmployment, attrSchema, t } = ctx;

  const base = z.object({
    catalogId: z.string().min(1, t('wizard.errCatalog')),
    type: z.string().min(1, t('wizard.errType')),
    title: z.string().trim().min(5, t('create.errTitleMin')),
    categoryId: z.string().min(1, t('create.errCategory')),
    regionId: z.string().min(1, t('create.errRegionDistrict')),
    districtId: z.string().min(1, t('create.errRegionDistrict')),
    attributes: z.record(z.string(), z.any()),
    skills: z.array(z.string()),
    customDescription: z.string(),
    priceType: z.string(),
    priceMin: z.string(),
    priceMax: z.string(),
    salaryType: z.string(),
    salaryMin: z.string(),
    salaryMax: z.string(),
    workFormat: z.string(),
    experienceLevel: z.string(),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
    contactTime: z.string(),
    contactCustomText: z.string(),
    images: z.array(z.string()),
    videos: z.array(z.string()),
  });

  return base.superRefine((val, issue) => {
    // ── Majburiy dinamik atributlar (har biri attributes.<key> ga inline) ──
    for (const attr of attrSchema) {
      if (!attr.required) continue;
      const v = (val.attributes as Record<string, any>)[attr.key];
      if (v === undefined || v === null || String(v).trim() === '') {
        issue.addIssue({
          code: 'custom',
          message: t('wizard.errRequiredField', { label: attr.label }),
          path: ['attributes', attr.key],
        });
      }
    }

    // ── Maosh shartlari (faqat jobs) ──
    if (isJobs && val.salaryType !== 'SALARY_NEGOTIABLE') {
      const min = Number(val.salaryMin);
      if (!val.salaryMin || Number.isNaN(min) || min <= 0) {
        issue.addIssue({ code: 'custom', message: t('wizard.errSalaryMin'), path: ['salaryMin'] });
      }
      if (val.salaryType === 'SALARY_RANGE') {
        const max = Number(val.salaryMax);
        if (!val.salaryMax || Number.isNaN(max) || max < min) {
          issue.addIssue({ code: 'custom', message: t('wizard.errSalaryMax'), path: ['salaryMax'] });
        }
      }
    }

    // ── Narx shartlari (jobs emas, kelishiladigan/bepul bo'lmaganda) ──
    if (!isJobs && val.priceType !== 'NEGOTIABLE' && val.priceType !== 'FREE') {
      const min = Number(val.priceMin);
      if (!val.priceMin || Number.isNaN(min) || min < 0) {
        issue.addIssue({ code: 'custom', message: t('wizard.errPriceMin'), path: ['priceMin'] });
      }
      if (val.priceType === 'RANGE') {
        const max = Number(val.priceMax);
        if (!val.priceMax || Number.isNaN(max) || max < min) {
          issue.addIssue({ code: 'custom', message: t('wizard.errPriceMax'), path: ['priceMax'] });
        }
      }
    }

    // ── Bandlik maydonlari (jobs/services) ──
    if (showEmployment && !val.workFormat) {
      issue.addIssue({ code: 'custom', message: t('wizard.errWorkFormat'), path: ['workFormat'] });
    }
  });
}

export type ListingSchema = ReturnType<typeof makeListingSchema>;
