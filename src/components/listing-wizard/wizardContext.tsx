// ============================================================================
//  WizardController context — konteyner (CreateListingPage) barcha ma'lumot,
//  holat va handler'larni shu bitta obyekt orqali qadam komponentlariga beradi.
//  Forma qiymatlari esa alohida RHF FormProvider'da saqlanadi.
// ============================================================================

import { createContext, useContext } from 'react';
import type {
  Catalog,
  Category,
  Region,
  District,
  Organization,
  CategoryAttribute,
  ListingType,
} from '../../types/index.ts';
import type { PublicMonetization } from '../../lib/api.ts';

export interface AiSuggestion {
  catalog_id?: string;
  category_id?: string;
  subcategory_id?: string;
  type?: ListingType;
  confidence?: number;
  reasoning_uz?: string;
}

export interface WizardController {
  // ── Reference data ──
  catalogs: Catalog[];
  categories: Category[];
  regions: Region[];
  districts: District[];
  userOrgs: Organization[];
  attrSchema: CategoryAttribute[];
  monetization: PublicMonetization | null;
  // ── Derived ──
  isJobs: boolean;
  isServices: boolean;
  showEmployment: boolean;
  isLeafSelected: boolean;
  subcategoriesOfParent: Category[];
  parentCategories: Category[];
  // ── i18n ──
  t: (key: string, vars?: Record<string, string | number>) => string;
  localized: (obj: Record<string, any> | null | undefined, base?: string) => string;
  intlLocale: string;
  userName?: string;
  // ── AI state ──
  aiSuggestion: AiSuggestion | null;
  isAiLoading: boolean;
  aiFilledKeys: string[];
  isAttrPrefilling: boolean;
  attrPrefillReason: string;
  isGeneratingDesc: boolean;
  // ── Media / locating ──
  isUploadingImage: boolean;
  isUploadingVideo: boolean;
  isLocating: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  videoInputRef: React.RefObject<HTMLInputElement | null>;
  // ── Edit mode ──
  isEditing: boolean;
  // ── Qoralama (DRAFT) holati ──
  // Yuklangan e'lon DRAFT bo'lsa true — Submit tugmasi "joylash" ma'nosini beradi.
  isDraftEditing: boolean;
  isSavingDraft: boolean;
  lastDraftSavedAt: number | null;
  // ── Bot-himoya (captcha) ──
  // null => o'fiq (vidjet chizilmaydi). Token vidjet callback'i orqali keladi.
  captchaSitekey: string | null;
  onCaptchaChange: (token: string) => void;
  // ── Handlers ──
  chooseCatalog: (cat: Catalog) => void;
  chooseType: (type: ListingType) => void;
  selectCategory: (id: string) => void;
  requestAiSuggestion: (title?: string) => void;
  applyAiSuggestion: () => void;
  runAttrPrefill: () => void;
  handleToggleFeature: (feat: string) => void;
  handleImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleRemoveImage: (index: number) => void;
  handleVideoUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleRemoveVideo: (index: number) => void;
  handleDetectGPS: () => void;
  saveDraft: () => void;
}

const WizardControllerContext = createContext<WizardController | null>(null);

export const WizardControllerProvider = WizardControllerContext.Provider;

export function useWizardController(): WizardController {
  const ctx = useContext(WizardControllerContext);
  if (!ctx) throw new Error('useWizardController must be used within WizardControllerProvider');
  return ctx;
}
