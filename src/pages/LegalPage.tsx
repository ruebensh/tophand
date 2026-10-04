// ============================================================================
//  LegalPage — huquqiy / axborot sahifalari (AdSense tasdiqi uchun shart).
// ----------------------------------------------------------------------------
//  Bitta komponent turli `kind` qiymatlari orqali 4 sahifani chiqaradi:
//    'privacy' | 'terms' | 'about' | 'contact'
//  App.tsx routing: /privacy, /terms, /about, /contact.
//  Kontent O'zbek tilida, tophand.uz uchun umumiy namunaviy matn.
// ============================================================================

import React from 'react';
import { ShieldCheck, Scale, Info, Mail, MapPin, Phone, ArrowLeft } from 'lucide-react';

export type LegalKind = 'privacy' | 'terms' | 'about' | 'contact';

interface Section {
  h: string;
  p: string[];
  list?: string[];
}

const CONTACT_EMAIL = 'info@tophand.uz';
const SUPPORT_EMAIL = 'support@tophand.uz';
const UPDATED = '01.10.2026';

interface DocMeta {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  sections: Section[];
}

const DOCS: Record<LegalKind, DocMeta> = {
  privacy: {
    title: 'Maxfiylik siyosati',
    subtitle: 'Shaxsiy maʼlumotlaringizni qanday yigʻamiz, ishlatamiz va himoya qilamiz.',
    icon: <ShieldCheck className="w-5 h-5 text-blue-600" />,
    sections: [
      {
        h: '1. Yigʻiladigan maʼlumotlar',
        p: [
          'TopHand (tophand.uz) platformasidan foydalanishda siz quyidagi maʼlumotlarni taqdim etishingiz mumkin:',
        ],
        list: [
          'Hisob maʼlumotlari: ism, telefon raqami, elektron pochta.',
          'Profil maʼlumotlari: hudud, tashkil nomi, eʼlonlarda koʻrsatilgan maʼlumotlar.',
          'Texnik maʼlumotlar: IP manzil, brauzer turi, qurilta identifikatorlari va foydalanish statistikasi.',
          'Joylashuv maʼlumotlari (ruxsat berganingizda) — yaqin atrofdagi eʼlonlarni koʻrsatish uchun.',
        ],
      },
      {
        h: '2. Maʼlumotlardan foydalanish',
        p: [
          'Maʼlumotlar quyidagi maqsatlarda ishlatiladi: eʼlonlarni joylashtirish va koʻrsatish, hisob xavfsizligini taʼminlash, xizmat sifatini yaxshilash, foydalanuvchilar oʻrtasida aloqa (chat/qoʻngʻiroq)ni tashkil etish hamda spam va suiisteʼmal holatlarning oldini olish.',
        ],
      },
      {
        h: '3. Uchinchi tomon xizmatlari',
        p: [
          'Kirish uchun Google/Telegram autentifikatsiyasi, xabarnoma yuborish uchun email va push-xizmatlari, hamda (kelajakda) reklama tarmoqlaridan foydalanishimiz mumkin. Bunday hamkorlar faqat xizmat koʻrsatish uchun zarur boʻlgan maʼlumotlarni oladi.',
        ],
      },
      {
        h: '4. Maʼlumotlarni saqlash va himoya',
        p: [
          'Maʼlumotlar shifrlangan kanallar orqali uzatiladi va zamonaviy texnik tadbirlar bilan himoyalanadi. Siz istalgan vaqtda profilingizni tahrirlash yoki hisobingizni oʻchirishni soʻrashingiz mumkin.',
        ],
      },
      {
        h: '5. Huquqlaringiz',
        p: [
          'Oʻz maʼlumotlaringizga kirish, ularni toʻgʻrilash yoki oʻchirish boʻyicha soʻrov yuborish huquqiga egasiz. Bunday soʻrovlar uchun biz bilan bogʻlaning.',
        ],
      },
    ],
  },
  terms: {
    title: 'Foydalanish shartlari',
    subtitle: 'Platformadan foydanish uchun asosiy qoida va tamoyillar.',
    icon: <Scale className="w-5 h-5 text-blue-600" />,
    sections: [
      {
        h: '1. Umumiy qoidalar',
        p: [
          'TopHand — Oʻzbekistondagi mahalliy xizmatlar va ish bozori platformasi. Platformadan foydalanish ushbu shartlarga rozilik bildirish hisoblanadi.',
        ],
      },
      {
        h: '2. Eʼlon joylashtirish',
        p: [
          'Joylashtiriladigan eʼlonlar qonunga xilov boʻlmasligi, haqiqiy va aniqrax boʻlishi kerak. Quyidagilar taqiqlanadi:',
        ],
        list: [
          'Nostandard, aldaydigan yoki takrorlanuvchi eʼlonlar.',
          'Qonun bilan cheklangan tovar va xizmatlar (qurol, dori-voqa va h.k.).',
          'Boshqa foydalanuvchining huquqlarini buzadigan kontent.',
        ],
      },
      {
        h: '3. Moderasiya',
        p: [
          'Platforma maʼmuriyi eʼlonlarni tekshirish, tahrirlash yoki qoidalarga zid boʻlsa olib tashlash huquqiga ega. Bu foydalanuvchilar xavfsizligini taʼminlash uchun amalga oshiriladi.',
        ],
      },
      {
        h: '4. Toʻlov va obuna',
        p: [
          'Aytilgan xizmatlar pullik boʻlishi mumkin. Joriy narx va tariflar platforma tomonidan oʻzgartirilishi mumkin; amaldagi tariflar eʼlon joylashtirishda koʻrsatiladi.',
        ],
      },
      {
        h: '5. Masʼuliyat chegarasi',
        p: [
          'TopHand foydalanuvchilar oʻrtasidagi bitimlar uchun vositachi hisoblanmaydi. Eʼlonlar mazmuni va ularga javobgarlik eʼlon egalari zimmasidadir.',
        ],
      },
    ],
  },
  about: {
    title: 'Biz haqimizda',
    subtitle: 'TopHand — mahalliy xizmatlar va ish bozorini birlashtiruvchi platforma.',
    icon: <Info className="w-5 h-5 text-blue-600" />,
    sections: [
      {
        h: 'Missiyamiz',
        p: [
          'Oʻzbekistondagi har bir mahallaga tezkor, shaffof va qulay xizmat va ish bozini olib kelish. Kichik biznes, ustalar va izlovchilarni bitta joyda birlashtirish.',
        ],
      },
      {
        h: 'Nima qilamiz?',
        p: ['TopHand orqali siz:'],
        list: [
          'Xizmat va tovarlarni bepul eʼlon qilib sotishingiz yoki topishingiz;',
          'Viloyat va tumanlar boʻyicha yaqin atrofdagi takliflarni koʻrishingiz;',
          'Ish oʻrinlari va mahoratli ustalarni topishingiz;',
          'Bosqichli filtrlash, xaridlar roʻyxati va suhbat orqali qulay aloqa qurishingiz.',
        ],
      },
      {
        h: 'Qayerdamiz?',
        p: [
          'Platforma butun Oʻzbekiston boʻylab — Toshkentdan boshlab, hududlar va tumanlargacha ishlaydi. Biz jamoaviy bozor tamoyiliga asoslangan holda doimiy takomillashib boramiz.',
        ],
      },
    ],
  },
  contact: {
    title: 'Biz bilan bogʻlanish',
    subtitle: 'Savol, taklif yoki shikoyatlaringiz uchun biz bilan bogʻlaning.',
    icon: <Mail className="w-5 h-5 text-blue-600" />,
    sections: [
      {
        h: 'Aloqa kanallari',
        p: [
          'Umumiy savollar uchun: ' + CONTACT_EMAIL,
          'Qoʻllab-quvvatlash (texnik yordam): ' + SUPPORT_EMAIL,
          'Platforma: tophand.uz',
        ],
      },
      {
        h: 'Yordam markazi',
        p: [
          'Hisob, eʼlon yoki toʻlovlar boʻyicha muammolarni tezroq hal qilish uchun ilovangizda muammoning mohiyatini va tegishli eʼlon/profil havolasini qoldiring.',
        ],
      },
    ],
  },
};

export const LegalPage: React.FC<{ kind: LegalKind; onNavigate: (route: string) => void }> = ({
  kind,
  onNavigate,
}) => {
  const doc = DOCS[kind];
  if (!doc) return null;

  return (
    <div className="max-w-3xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-10">
      <button
        onClick={() => onNavigate('/')}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#5E6C84] hover:text-[#1673E6] mb-5 cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" /> Bosh sahifa
      </button>

      <div className="bg-white rounded-3xl border border-gray-100 shadow-xs overflow-hidden">
        <div className="p-5 sm:p-7 border-b border-gray-100 flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50">
            {doc.icon}
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-black text-gray-900">{doc.title}</h1>
            <p className="text-xs text-gray-500 mt-1">{doc.subtitle}</p>
          </div>
        </div>

        <div className="p-5 sm:p-7 space-y-6">
          {doc.sections.map((s, i) => (
            <section key={i}>
              <h2 className="text-sm font-bold text-gray-900 mb-2">{s.h}</h2>
              {s.p.map((para, j) => (
                <p key={j} className="text-sm text-gray-600 leading-relaxed mb-2">
                  {para}
                </p>
              ))}
              {s.list && (
                <ul className="mt-1 space-y-1.5">
                  {s.list.map((li, k) => (
                    <li key={k} className="text-sm text-gray-600 leading-relaxed flex gap-2">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
                      <span>{li}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}

          {kind === 'contact' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div className="flex items-center gap-2 p-3 rounded-2xl bg-gray-50 border border-gray-100">
                <Mail className="w-4 h-4 text-blue-600" />
                <span className="text-xs font-semibold text-gray-700">{CONTACT_EMAIL}</span>
              </div>
              <div className="flex items-center gap-2 p-3 rounded-2xl bg-gray-50 border border-gray-100">
                <Phone className="w-4 h-4 text-blue-600" />
                <span className="text-xs font-semibold text-gray-700">tophand.uz</span>
              </div>
              <div className="flex items-center gap-2 p-3 rounded-2xl bg-gray-50 border border-gray-100 sm:col-span-2">
                <MapPin className="w-4 h-4 text-blue-600" />
                <span className="text-xs font-semibold text-gray-700">Oʻzbekiston, butun hudud boʻylab onlayn</span>
              </div>
            </div>
          )}
        </div>

        <div className="px-5 sm:px-7 py-4 border-t border-gray-100 flex items-center justify-between">
          <span className="text-[11px] text-gray-400">Oxirgi yangilanish: {UPDATED}</span>
          <span className="text-[11px] text-gray-400">© {new Date().getFullYear()} TopHand</span>
        </div>
      </div>
    </div>
  );
};

export default LegalPage;
