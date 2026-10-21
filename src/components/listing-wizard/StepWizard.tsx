// ============================================================================
//  StepWizard — 6 qadamli qobiq (FormProvider ichida ishlaydi).
//  step indeksi (component state), progress bar ("Qadam n / 6"), oldinga/orqaga
//  tugmalar, CSS o'tish animatsiyasi. Holat saqlanadi: barcha maydonlar bitta
//  RHF store'da — qadam almashinuvida reset bo'lmaydi. "Keyingisi" faqat joriy
//  qadam maydonlarini trigger() bilan tekshiradi. Oxirgi qadamda Submit.
// ============================================================================

import React, { useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { ArrowLeft, ArrowRight, CheckCircle2, Save } from 'lucide-react';
import type { WizardFormValues } from '../../types/wizard.ts';
import { useWizardController } from './wizardContext.tsx';
import CategorySelector from './CategorySelector.tsx';
import StepPhotos from './StepPhotos.tsx';
import StepAttributes from './StepAttributes.tsx';
import StepDescription from './StepDescription.tsx';
import LocationStep from './LocationStep.tsx';
import SummaryReview from './SummaryReview.tsx';
import CaptchaWidget from './CaptchaWidget.tsx';

const STEP_KEYS = ['category', 'photos', 'attributes', 'description', 'location', 'summary'] as const;

interface Props {
  // Yakuniy Submit — konteyner RHF handleSubmit(natijasi)ni beradi (to'liq
  // validatsiya + AI tavsif + POST/PUT shu yerda ishga tushadi).
  onFinalSubmit: (data: WizardFormValues) => void;
  onInvalid?: () => void;
  isSubmitting: boolean;
  submitError: string;
  onCancel: () => void;
}

const StepWizard: React.FC<Props> = ({ onFinalSubmit, onInvalid, isSubmitting, submitError, onCancel }) => {
  const ctl = useWizardController();
  const { t, isJobs, showEmployment, attrSchema, subcategoriesOfParent, isLeafSelected } = ctl;
  const { trigger, handleSubmit } = useFormContext<WizardFormValues>();

  const [step, setStep] = useState(0);
  const [stepError, setStepError] = useState('');

  const total = STEP_KEYS.length;
  const isLastStep = step === total - 1;

  // Joriy qadamning tekshiriladigan maydonlari (inline validatsiya).
  const stepFieldNames = (s: number): string[] => {
    if (s === 0) return ['catalogId', 'type', 'title', 'categoryId'];
    if (s === 1) return []; // Fotolar — ixtiyoriy.
    if (s === 2) {
      // Parametrlar: majburiy atributlar + (bandlik bo'lsa) ish turi.
      const names: string[] = attrSchema.filter((a) => a.required).map((a) => `attributes.${a.key}`);
      if (showEmployment) names.push('workFormat');
      return names;
    }
    if (s === 3) return [isJobs ? 'salaryMin' : 'priceMin']; // Tavsif/narx.
    if (s === 4) return ['regionId', 'districtId']; // Lokatsiya.
    return []; // Xulosa (submit).
  };

  const goNext = async () => {
    setStepError('');
    // Barg (subcategory) talabi — Step 1.
    if (step === 0 && subcategoriesOfParent.length > 0 && !isLeafSelected) {
      setStepError(t('create.errSubcat'));
      return;
    }
    const names = stepFieldNames(step);
    const ok = names.length === 0 ? true : await trigger(names as any, { shouldFocus: true });
    if (!ok) {
      setStepError(t('wizard.fixErrors'));
      return;
    }
    setStep((s) => Math.min(s + 1, total - 1));
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const goBack = () => {
    setStepError('');
    if (step === 0) {
      onCancel();
      return;
    }
    setStep((s) => Math.max(s - 1, 0));
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const jumpTo = (s: number) => {
    setStepError('');
    setStep(s);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const renderStep = () => {
    switch (step) {
      case 0: return <CategorySelector />;
      case 1: return <StepPhotos />;
      case 2: return <StepAttributes />;
      case 3: return <StepDescription />;
      case 4: return <LocationStep />;
      default: return <SummaryReview onEdit={jumpTo} />;
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-gray-100 p-5 sm:p-8 shadow-xs">
      {/* PROGRESS */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-100">
            {t('wizard.stepOf', { n: step + 1, total })}
          </span>
          <span className="text-xs font-black text-gray-900">{t(`wizard.step.${STEP_KEYS[step]}`)}</span>
        </div>
        <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
          <div
            className="h-full bg-blue-600 rounded-full transition-all duration-300"
            style={{ width: `${((step + 1) / total) * 100}%` }}
          />
        </div>
      </div>

      {submitError && (
        <div className="mb-5 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-rose-600 rotate-45" /> <span>{submitError}</span>
        </div>
      )}
      {stepError && (
        <div className="mb-5 p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold">{stepError}</div>
      )}

      {/* STEP CONTENT (transition) */}
      <div key={step} className="wizard-step-anim">
        {renderStep()}
      </div>

      {/* BOT-HIMOYA: faqat oxirgi qadamda va sitekey bo'lganda chiziladi. */}
      {isLastStep && ctl.captchaSitekey && (
        <div className="mt-6 flex flex-col items-center gap-1.5">
          <span className="text-[11px] font-semibold text-gray-500">{t('create.captchaHint')}</span>
          <CaptchaWidget sitekey={ctl.captchaSitekey} onChange={ctl.onCaptchaChange} />
        </div>
      )}

      {/* ACTIONS */}
      <div className="pt-6 mt-6 border-t border-gray-100 flex items-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={goBack}
          className="py-3 px-6 rounded-full border border-gray-200 hover:bg-gray-50 text-gray-700 font-bold text-xs cursor-pointer flex items-center gap-1.5"
        >
          <ArrowLeft className="w-4 h-4" /> {step === 0 ? t('create.cancel') : t('wizard.back')}
        </button>

        {/* Qoralama saqlash — oxirgi qadamda (sarlavha/kategoriya/lokatsiya to'lgan). */}
        {isLastStep && (
          <button
            type="button"
            onClick={ctl.saveDraft}
            disabled={isSubmitting || ctl.isSavingDraft}
            className="py-3 px-5 rounded-full border border-blue-200 hover:bg-blue-50 text-blue-700 font-bold text-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{ctl.isSavingDraft ? t('create.draftSaving') : t('create.draftSave')}</span>
          </button>
        )}

        {step < total - 1 ? (
          <button
            type="button"
            onClick={goNext}
            className="flex-1 py-3.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            <span>{t('wizard.next')}</span> <ArrowRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit(onFinalSubmit, onInvalid)}
            disabled={isSubmitting}
            className="flex-1 py-3.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm shadow-md transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <span>{ctl.isGeneratingDesc ? t('create.aiWritingDesc') : (ctl.isEditing && !ctl.isDraftEditing ? t('create.saving') : t('create.publishing'))}</span>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>{ctl.isEditing && !ctl.isDraftEditing ? t('create.saveChanges') : t('create.publish')}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        )}

        {/* Qoralama saqlanganligi haqida yengil belgi. */}
        {ctl.lastDraftSavedAt && (
          <span className="w-full text-center text-[11px] font-semibold text-emerald-600">
            ✓ {t('create.draftSaved')}
          </span>
        )}
      </div>
    </div>
  );
};

export default StepWizard;
