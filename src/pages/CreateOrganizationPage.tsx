import React, { useState, useEffect } from 'react';
import { Region, District } from '../types/index.ts';
import { apiRequest } from '../lib/api.ts';
import { Building2, ArrowLeft } from 'lucide-react';

interface CreateOrganizationPageProps {
  onNavigate: (route: string) => void;
  onCreated: (orgId: string) => void;
}

export const CreateOrganizationPage: React.FC<CreateOrganizationPageProps> = ({
  onNavigate,
  onCreated,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [phone, setPhone] = useState('');
  const [website, setWebsite] = useState('');
  const [address, setAddress] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [regionId, setRegionId] = useState('');
  const [districtId, setDistrictId] = useState('');

  const [regions, setRegions] = useState<Region[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    apiRequest<Region[]>('/api/locations/regions').then(setRegions).catch(console.error);
  }, []);

  useEffect(() => {
    if (!regionId) {
      setDistricts([]);
      return;
    }
    apiRequest<District[]>(`/api/locations/districts?region_id=${regionId}`)
      .then(setDistricts)
      .catch(console.error);
  }, [regionId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Tashkilot nomi kiritilishi shart');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const res = await apiRequest<any>('/api/organizations', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          phone: phone.trim() || undefined,
          website: website.trim() || undefined,
          address: address.trim() || undefined,
          logo_url: logoUrl.trim() || undefined,
          region_id: regionId || undefined,
          district_id: districtId || undefined,
        }),
      });

      onCreated(res.id);
    } catch (err: any) {
      setError(err.message || 'Tashkilot ochishda xatolik yuz berdi');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      <button
        onClick={() => onNavigate('/')}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-blue-600 transition-colors mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Bosh sahifaga qaytish</span>
      </button>

      <div className="bg-white rounded-3xl border border-gray-100 p-6 sm:p-10 shadow-xs">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-950">Yangi tashkilot ochish</h1>
            <p className="text-xs text-gray-500">
              Kompaniya, ommaviy axborot vositasi, firma yoki xizmat ko‘rsatish korxonasi profili
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Tashkilot nomi <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Masalan: Kun.uz Media yoki Bunyodkor MCHJ"
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-medium focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Logo URL manzili
            </label>
            <input
              type="url"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="https://example.com/logo.png"
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2 text-xs font-medium focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Tashkilot faoliyati haqida
            </label>
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Kompaniya yo‘nalishi, xizmatlari va maqsadlari haqida qisqacha..."
              className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs sm:text-sm font-medium focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Telefon</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+998 71 200 00 00"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2 text-xs font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Veb-sayt</label>
              <input
                type="url"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://company.uz"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2 text-xs font-medium"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Viloyat</label>
              <select
                value={regionId}
                onChange={(e) => {
                  setRegionId(e.target.value);
                  setDistrictId('');
                }}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2 text-xs font-medium"
              >
                <option value="">Tanlang...</option>
                {regions.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name_uz}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Tuman</label>
              <select
                disabled={!regionId}
                value={districtId}
                onChange={(e) => setDistrictId(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2 text-xs font-medium disabled:opacity-50"
              >
                <option value="">Tanlang...</option>
                {districts.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name_uz}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Aniq manzil</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Masalan: Navoiy ko‘chasi, 30-uy"
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2 text-xs font-medium"
            />
          </div>

          <div className="pt-3">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 rounded-full bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs sm:text-sm shadow-md transition-colors"
            >
              {isSubmitting ? 'Ochilmoqda...' : 'Tashkilotni yaratish'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
