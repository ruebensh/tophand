import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../lib/api.ts';
import { X, Building2, Save, Trash2, CheckCircle2 } from 'lucide-react';
import { Region, District } from '../../types/index.ts';
import { useI18n } from '../../i18n/IntlContext.tsx';

interface OrganizationEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  org: any | null; // null for creating new
  onSaved: () => void;
}

export const OrganizationEditModal: React.FC<OrganizationEditModalProps> = ({
  isOpen,
  onClose,
  org,
  onSaved,
}) => {
  const { t } = useI18n();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [phone, setPhone] = useState('');
  const [website, setWebsite] = useState('');
  const [address, setAddress] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [verificationStatus, setVerificationStatus] = useState<'UNVERIFIED' | 'VERIFIED'>('UNVERIFIED');
  const [regionId, setRegionId] = useState('');
  const [districtId, setDistrictId] = useState('');

  const [regions, setRegions] = useState<Region[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    apiRequest<Region[]>('/api/locations/regions').then(setRegions).catch(console.error);
  }, []);

  useEffect(() => {
    if (regionId) {
      apiRequest<District[]>(`/api/locations/districts?region_id=${regionId}`)
        .then(setDistricts)
        .catch(console.error);
    } else {
      setDistricts([]);
    }
  }, [regionId]);

  useEffect(() => {
    if (org) {
      setName(org.name || '');
      setDescription(org.description || '');
      setPhone(org.phone || '');
      setWebsite(org.website || '');
      setAddress(org.address || '');
      setLogoUrl(org.logo_url || '');
      setVerificationStatus(org.verification_status || 'UNVERIFIED');
      setRegionId(org.region_id || '');
      setDistrictId(org.district_id || '');
    } else {
      setName('');
      setDescription('');
      setPhone('');
      setWebsite('');
      setAddress('');
      setLogoUrl('');
      setVerificationStatus('UNVERIFIED');
      setRegionId('');
      setDistrictId('');
    }
  }, [org, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert(t('admin.oemNameRequired'));
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim(),
        phone: phone.trim() || undefined,
        website: website.trim() || undefined,
        address: address.trim() || undefined,
        logo_url: logoUrl.trim() || undefined,
        verification_status: verificationStatus,
        region_id: regionId || undefined,
        district_id: districtId || undefined,
      };

      if (org?.id) {
        await apiRequest(`/api/admin/organizations/${org.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } else {
        await apiRequest('/api/admin/organizations', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }

      onSaved();
      onClose();
    } catch (err: any) {
      alert(err.message || t('admin.oemGenericErr'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!org?.id) return;
    if (!confirm(t('admin.orgDeleteConfirm', { name: org.name }))) return;

    setIsSubmitting(true);
    try {
      await apiRequest(`/api/admin/organizations/${org.id}`, { method: 'DELETE' });
      onSaved();
      onClose();
    } catch (err: any) {
      alert(err.message || t('admin.oemDeleteErr'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-gray-950">
                {org ? t('admin.oemEditTitle') : t('admin.newOrgBtn')}
              </h3>
              <p className="text-xs text-gray-400">{t('admin.oemSub')}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 sm:p-6 overflow-y-auto space-y-4 text-xs">
          <div>
            <label className="font-bold text-gray-700 block mb-1">{t('admin.oemNameLabel')} *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl font-bold text-gray-900 focus:outline-hidden focus:border-blue-600"
              placeholder={t('admin.oemNamePh')}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-gray-700 block mb-1">{t('admin.oemPhone')}</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl"
                placeholder="+998 71 200 00 00"
              />
            </div>
            <div>
              <label className="font-bold text-gray-700 block mb-1">{t('admin.oemWebsite')}</label>
              <input
                type="text"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl"
                placeholder="https://example.uz"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-gray-700 block mb-1">{t('admin.oemRegion')}</label>
              <select
                value={regionId}
                onChange={(e) => setRegionId(e.target.value)}
                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl"
              >
                <option value="">{t('admin.oemSelectPh')}</option>
                {regions.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name_uz}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="font-bold text-gray-700 block mb-1">{t('admin.oemDistrict')}</label>
              <select
                value={districtId}
                onChange={(e) => setDistrictId(e.target.value)}
                disabled={!regionId}
                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl disabled:opacity-50"
              >
                <option value="">{t('admin.oemSelectPh')}</option>
                {districts.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name_uz}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="font-bold text-gray-700 block mb-1">{t('admin.oemAddress')}</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl"
              placeholder={t('admin.oemAddressPh')}
            />
          </div>

          <div>
            <label className="font-bold text-gray-700 block mb-1">Logo URL</label>
            <input
              type="text"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl"
              placeholder="https://..."
            />
          </div>

          <div>
            <label className="font-bold text-gray-700 block mb-1">{t('admin.oemVerStatus')}</label>
            <select
              value={verificationStatus}
              onChange={(e) => setVerificationStatus(e.target.value as any)}
              className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl font-bold"
            >
              <option value="UNVERIFIED">{t('admin.oemUnverified')}</option>
              <option value="VERIFIED">{t('admin.oemVerified')}</option>
            </select>
          </div>

          <div>
            <label className="font-bold text-gray-700 block mb-1">{t('admin.oemDesc')}</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl"
              placeholder={t('admin.oemDescPh')}
            />
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-gray-100">
            {org ? (
              <button
                type="button"
                onClick={handleDelete}
                className="px-4 py-2 rounded-full text-rose-600 hover:bg-rose-50 border border-rose-200 font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{t('common.delete')}</span>
              </button>
            ) : <div />}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-full border border-gray-200 font-semibold"
              >
                {t('common.cancel')}
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{org ? t('admin.oemSaveChanges') : t('admin.oemAdd')}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
