// ============================================================================
//  StepDescription — WIZARD Step 4 (Tavsif va narx).
//  Asl DynamicFieldRenderer'dagi PRICING/SALARY + CONTACT TIME + QO'SHIMCHA IZOH
//  bloklari shu yerga ko'chirildi. Sarlavha (title) 1-qadamda qoladi — chunki AI
//  kategoriya tavsiyasi va atribut auto-prefill aynan sarlavhaga bog'liq.
//  Bu yerda: ixtiyoriy qo'shimcha izoh + narx/maosh + qulog'li aloqa vaqti.
// ============================================================================

import React from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { DollarSign } from 'lucide-react';
import type { ContactTime } from '../../types/index.ts';
import type { WizardFormValues } from '../../types/wizard.ts';
import { useWizardController } from './wizardContext.tsx';
import { FieldError } from './fields.tsx';

const StepDescription: React.FC = () => {
  const ctl = useWizardController();
  const { t, isJobs } = ctl;
  const { control, register, watch, formState: { errors } } = useFormContext<WizardFormValues>();

  return (
    <div className="space-y-6">
      <div className="text-center max-w-lg mx-auto">
        <h2 className="text-lg font-black text-gray-900">{t('wizard.step.description')}</h2>
        <p className="text-xs text-gray-500 mt-1">{t('wizard.descriptionHint')}</p>
      </div>

      {/* QO'SHIMCHA IZOH (tavsif) */}
      <div className="p-4 rounded-2xl bg-linear-to-br from-blue-50/60 to-indigo-50/60 border border-blue-100 space-y-2">
        <label className="block text-xs font-bold text-gray-800">{t('create.descExtra')}</label>
        <textarea
          rows={4}
          {...register('customDescription')}
          placeholder={t('create.extraPh')}
          className="w-full bg-white border border-blue-200 rounded-xl p-3 text-xs font-medium focus:ring-2 focus:ring-blue-500"
        />
        <p className="text-[11px] text-gray-500">{t('wizard.descAutoNote')}</p>
      </div>

      {/* PRICING / SALARY */}
      {isJobs ? (
        <div className="p-4 rounded-2xl bg-purple-50/50 border border-purple-100 space-y-3">
          <h4 className="font-bold text-xs text-purple-900 uppercase tracking-wider flex items-center gap-1.5">
            <DollarSign className="w-3.5 h-3.5 text-purple-600" /> {t('create.salaryTitle')}
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <select {...register('salaryType')} className="bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-xs font-bold focus:ring-2 focus:ring-purple-500">
              <option value="SALARY_FIXED">{t('create.salaryFixed')}</option>
              <option value="SALARY_RANGE">{t('create.salaryRange')}</option>
              <option value="SALARY_NEGOTIABLE">{t('create.salaryNegotiable')}</option>
            </select>
            <div className="space-y-1">
              {watch('salaryType') !== 'SALARY_NEGOTIABLE' && (
                <input type="number" placeholder={t('create.salaryMinPh')} {...register('salaryMin')} className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-purple-500 w-full" />
              )}
              <FieldError message={(errors.salaryMin as any)?.message} />
            </div>
            <div className="space-y-1">
              {watch('salaryType') === 'SALARY_RANGE' && (
                <input type="number" placeholder={t('create.salaryMaxPh')} {...register('salaryMax')} className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-purple-500 w-full" />
              )}
              <FieldError message={(errors.salaryMax as any)?.message} />
            </div>
          </div>
        </div>
      ) : (
        <div className="p-4 rounded-2xl bg-blue-50/50 border border-blue-100 space-y-3">
          <h4 className="font-bold text-xs text-blue-900 uppercase tracking-wider flex items-center gap-1.5">
            <DollarSign className="w-3.5 h-3.5 text-blue-600" /> {t('create.priceTitle')}
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <select {...register('priceType')} className="bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-xs font-bold focus:ring-2 focus:ring-blue-500">
              <option value="FIXED">{t('create.priceFixed')}</option>
              <option value="FROM">{t('create.priceFrom')}</option>
              <option value="RANGE">{t('create.priceRange')}</option>
              <option value="NEGOTIABLE">{t('create.priceNegotiable')}</option>
              <option value="FREE">{t('create.priceFree')}</option>
            </select>
            <div className="space-y-1">
              {watch('priceType') !== 'NEGOTIABLE' && watch('priceType') !== 'FREE' && (
                <input type="number" placeholder={t('create.amountPh')} {...register('priceMin')} className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-blue-500 w-full" />
              )}
              <FieldError message={(errors.priceMin as any)?.message} />
            </div>
            <div className="space-y-1">
              {watch('priceType') === 'RANGE' && (
                <input type="number" placeholder={t('create.salaryMaxPh')} {...register('priceMax')} className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-blue-500 w-full" />
              )}
              <FieldError message={(errors.priceMax as any)?.message} />
            </div>
          </div>
        </div>
      )}

      {/* CONTACT TIME */}
      <div>
        <label className="block text-xs font-bold text-gray-800 mb-2">{t('create.contactTimeLabel')}</label>
        <Controller
          control={control}
          name="contactTime"
          render={({ field }) => (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[{ id: 'ANY_TIME', label: t('create.ctAny') }, { id: 'MORNING', label: t('create.ctMorning') }, { id: 'AFTERNOON', label: t('create.ctAfternoon') }, { id: 'EVENING', label: t('create.ctEvening') }].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => field.onChange(item.id as ContactTime)}
                  className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all text-center cursor-pointer ${
                    field.value === item.id ? 'bg-blue-600 text-white border-blue-600 shadow-xs' : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}
        />
      </div>
    </div>
  );
};

export default StepDescription;
