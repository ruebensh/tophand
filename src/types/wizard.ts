// ============================================================================
//  Wizard tiplari — Avito uslubidagi ko'p qadamli e'lon formasi.
//  Bitta RHF ombori (WizardFormValues) barcha qadamlar bo'ylab holatni
//  saqlaydi; CategorySchema/FormFieldDefinition dinamik atributlarni,
//  JobPostingPayload esa /api/listings ga yuboriladigan yakuniy tanani bildiradi.
// ============================================================================

import type {
  ListingType,
  PriceType,
  SalaryType,
  WorkFormat,
  ContactTime,
  AttributeType,
  CategoryAttribute,
} from './index.ts';

// Bitta dinamik forma maydoni tavsifi (kategoriya atributi yoki statik blok).
export interface FormFieldDefinition {
  key: string;
  label: string;
  // Kategoriya atributi turi yoki wizardga xos maxsus kontrol turlari.
  type: AttributeType | 'salary' | 'skills' | 'location';
  options?: string[];
  unit?: string | null;
  required: boolean;
  section?: string;
  meta?: Record<string, any>;
}

// Tanlangan kategoriya uchun yig'ilgan sxema (statik + dinamik maydonlar).
export interface CategorySchema {
  category_id: string;
  parent_id?: string;
  catalog_id?: string;
  fields: FormFieldDefinition[];
}

// /api/listings (POST/PUT) payloadi bilan mos keladigan yakuniy forma tani.
export interface JobPostingPayload {
  catalog_id: string;
  type: ListingType;
  title: string;
  description: string;
  category_id: string;
  region_id: string;
  district_id: string;
  latitude?: number;
  longitude?: number;
  salary_type?: SalaryType;
  salary_min?: number;
  salary_max?: number;
  work_format?: WorkFormat;
  experience_level?: string;
  skills: string[];
  attributes: Record<string, string | number | boolean>;
  price_type?: PriceType;
  price_min?: number;
  price_max?: number;
  contact_time: ContactTime;
  contact_custom_text?: string;
  organization_id?: string;
  images: string[];
  videos: string[];
}

// RHF omboridagi barcha wizard maydonlari. Qiymatlar qadam almashinuvida
// hech qachon reset qilinmaydi — shu sababli butun forma shu bitta store'da.
export interface WizardFormValues {
  catalogId: string;
  type: ListingType | '';
  title: string;
  categoryId: string;
  // Dinamik atributlar (JSONB): kalit => qiymat.
  attributes: Record<string, string | number | boolean>;
  // Ko'nikmalar / afzalliklar chiplari (skills autosuggest + custom).
  skills: string[];
  customDescription: string;
  // Narx (jobs bo'lmagan kataloglar).
  priceType: PriceType;
  priceMin: string;
  priceMax: string;
  // Maosh (jobs).
  salaryType: SalaryType;
  salaryMin: string;
  salaryMax: string;
  // Bandlik (jobs/services).
  workFormat: WorkFormat;
  experienceLevel: string;
  // Lokatsiya.
  regionId: string;
  districtId: string;
  latitude?: number;
  longitude?: number;
  // Aloqa va tashkilot.
  contactTime: ContactTime;
  contactCustomText: string;
  organizationId: string;
  // Media.
  images: string[];
  videos: string[];
}

// Kategoriya atributini wizard dinamik maydoniga aylantiradi.
export function attributeToField(attr: CategoryAttribute): FormFieldDefinition {
  return {
    key: attr.key,
    label: attr.label,
    type: attr.type,
    options: attr.options,
    unit: attr.unit,
    required: attr.required,
    section: attr.section,
    meta: attr.meta,
  };
}
