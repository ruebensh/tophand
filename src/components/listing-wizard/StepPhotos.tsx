// ============================================================================
//  StepPhotos — WIZARD Step 2 (Fotolar va video).
//  Asl DynamicFieldRenderer'dagi IMAGES + VIDEOS bloklari shu yerga ko'chirildi
//  (Avito tartibi: avval rasmlar). Media ixtiyoriy — "Keyingi" validatsiya
//  talab qilmaydi. Rasm/vidjet URL'lari RHF omboriga (images/videos) yoziladi.
// ============================================================================

import React from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { UploadCloud, X } from 'lucide-react';
import type { WizardFormValues } from '../../types/wizard.ts';
import { useWizardController } from './wizardContext.tsx';

const StepPhotos: React.FC = () => {
  const ctl = useWizardController();
  const { t } = ctl;
  const { control } = useFormContext<WizardFormValues>();

  return (
    <div className="space-y-6">
      <div className="text-center max-w-lg mx-auto">
        <h2 className="text-lg font-black text-gray-900">{t('wizard.step.photos')}</h2>
        <p className="text-xs text-gray-500 mt-1">{t('wizard.photosHint')}</p>
      </div>

      {/* IMAGES */}
      <Controller
        control={control}
        name="images"
        render={({ field }) => (
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-gray-800">{t('create.imagesLabel')}</label>
              <span className="text-[11px] text-gray-400">{field.value.length}/8</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {field.value.map((url, idx) => (
                <div key={idx} className="relative aspect-square rounded-2xl overflow-hidden border border-gray-200">
                  <img src={url} alt={`Upload ${idx}`} className="w-full h-full object-cover" />
                  <button type="button" onClick={() => ctl.handleRemoveImage(idx)} className="absolute top-1.5 right-1.5 p-1 rounded-full bg-rose-600 text-white shadow-md cursor-pointer">
                    <X className="w-3.5 h-3.5" />
                  </button>
                  {idx === 0 && <span className="absolute bottom-1.5 left-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-sm bg-blue-600 text-white">{t('create.cover')}</span>}
                </div>
              ))}
              {field.value.length < 8 && (
                <button type="button" disabled={ctl.isUploadingImage} onClick={() => ctl.fileInputRef.current?.click()} className="aspect-square rounded-2xl border-2 border-dashed border-gray-300 hover:border-blue-500 hover:bg-blue-50/30 flex flex-col items-center justify-center p-3 transition-colors cursor-pointer">
                  <UploadCloud className={`w-6 h-6 text-gray-400 mb-1 ${ctl.isUploadingImage ? 'animate-bounce text-blue-600' : ''}`} />
                  <span className="text-[11px] font-bold text-gray-600">{ctl.isUploadingImage ? t('create.uploading') : t('create.uploadImage')}</span>
                </button>
              )}
            </div>
            <input type="file" ref={ctl.fileInputRef} onChange={ctl.handleImageUpload} accept="image/*" multiple className="hidden" />
          </div>
        )}
      />

      {/* VIDEOS */}
      <Controller
        control={control}
        name="videos"
        render={({ field }) => (
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-gray-800">{t('create.videosLabel')}</label>
              <span className="text-[11px] text-gray-400">{field.value.length}/2</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {field.value.map((url, idx) => (
                <div key={idx} className="relative aspect-square rounded-2xl overflow-hidden border border-gray-200 bg-black">
                  <video src={url} className="w-full h-full object-cover" muted playsInline />
                  <button type="button" onClick={() => ctl.handleRemoveVideo(idx)} className="absolute top-1.5 right-1.5 p-1 rounded-full bg-rose-600 text-white shadow-md cursor-pointer">
                    <X className="w-3.5 h-3.5" />
                  </button>
                  <span className="absolute bottom-1.5 left-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-sm bg-violet-600 text-white">{t('create.videoTag')}</span>
                </div>
              ))}
              {field.value.length < 2 && (
                <button type="button" disabled={ctl.isUploadingVideo} onClick={() => ctl.videoInputRef.current?.click()} className="aspect-square rounded-2xl border-2 border-dashed border-gray-300 hover:border-violet-500 hover:bg-violet-50/30 flex flex-col items-center justify-center p-3 transition-colors cursor-pointer">
                  <UploadCloud className={`w-6 h-6 text-gray-400 mb-1 ${ctl.isUploadingVideo ? 'animate-bounce text-violet-600' : ''}`} />
                  <span className="text-[11px] font-bold text-gray-600">{ctl.isUploadingVideo ? t('create.uploading') : t('create.uploadVideo')}</span>
                </button>
              )}
            </div>
            <input type="file" ref={ctl.videoInputRef} onChange={ctl.handleVideoUpload} accept="video/mp4,video/webm" className="hidden" />
          </div>
        )}
      />
    </div>
  );
};

export default StepPhotos;
