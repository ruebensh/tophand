// ============================================================================
//  legalContent — huquqiy / axborot sahifalari matnlari (privacy/terms/about/
//  contact). 3 ta lug'atli tili: uz (lotin — manba), ru, en. uz-Cyrl yozib
//  berilmaydi — uz matnidan runtime transliteratsiya qilinadi (getLegalDocs).
//  Icon'lar barcha tillarda bir xil (React node), transliteratsiyaga tegmaydi.
// ============================================================================

import React from 'react';
import { ShieldCheck, Scale, Info, Mail } from 'lucide-react';
import type { Locale } from './core.ts';
import { uzLatnToCyrillic } from './translit.ts';

export type LegalKind = 'privacy' | 'terms' | 'about' | 'contact';

export interface Section {
  h: string;
  p: string[];
  list?: string[];
}

export interface DocMeta {
  title: string;
  subtitle: string;
  sections: Section[];
}

export const CONTACT_EMAIL = 'info@tophand.uz';
export const SUPPORT_EMAIL = 'support@tophand.uz';
export const UPDATED = '01.10.2026';

export const LEGAL_ICONS: Record<LegalKind, React.ReactNode> = {
  privacy: React.createElement(ShieldCheck, { className: 'w-5 h-5 text-blue-600' }),
  terms: React.createElement(Scale, { className: 'w-5 h-5 text-blue-600' }),
  about: React.createElement(Info, { className: 'w-5 h-5 text-blue-600' }),
  contact: React.createElement(Mail, { className: 'w-5 h-5 text-blue-600' }),
};

// ─── UZBEK (LOTIN) — manba ─────────────────────────────────────────────
const uz: Record<LegalKind, DocMeta> = {
  privacy: {
    title: 'Maxfiylik siyosati',
    subtitle: 'Shaxsiy maʼlumotlaringizni qanday yigʻamiz, ishlatamiz va himoya qilamiz.',
    sections: [
      {
        h: '1. Yigʻiladigan maʼlumotlar',
        p: ['TopHand (tophand.uz) platformasidan foydalanishda siz quyidagi maʼlumotlarni taqdim etishingiz mumkin:'],
        list: [
          'Hisob maʼlumotlari: ism, telefon raqami, elektron pochta.',
          'Profil maʼlumotlari: hudud, tashkil nomi, eʼlonlarda koʻrsatilgan maʼlumotlar.',
          'Texnik maʼlumotlar: IP manzil, brauzer turi, qurilta identifikatorlari va foydalanish statistikasi.',
          'Joylashuv maʼlumotlari (ruxsat berganingizda) — yaqin atrofdagi eʼlonlarni koʻrsatish uchun.',
        ],
      },
      {
        h: '2. Maʼlumotlardan foydalanish',
        p: ['Maʼlumotlar quyidagi maqsatlarda ishlatiladi: eʼlonlarni joylashtirish va koʻrsatish, hisob xavfsizligini taʼminlash, xizmat sifatini yaxshilash, foydalanuvchilar oʻrtasida aloqa (chat/qoʻngʻiroq)ni tashkil etish hamda spam va suiisteʼmal holatlarning oldini olish.'],
      },
      {
        h: '3. Uchinchi tomon xizmatlari',
        p: ['Kirish uchun Google/Telegram autentifikatsiyasi, xabarnoma yuborish uchun email va push-xizmatlari, hamda (kelajakda) reklama tarmoqlaridan foydalanishimiz mumkin. Bunday hamkorlar faqat xizmat koʻrsatish uchun zarur boʻlgan maʼlumotlarni oladi.'],
      },
      {
        h: '4. Maʼlumotlarni saqlash va himoya',
        p: ['Maʼlumotlar shifrlangan kanallar orqali uzatiladi va zamonaviy texnik tadbirlar bilan himoyalanadi. Siz istalgan vaqtda profilingizni tahrirlash yoki hisobingizni oʻchirishni soʻrashingiz mumkin.'],
      },
      {
        h: '5. Huquqlaringiz',
        p: ['Oʻz maʼlumotlaringizga kirish, ularni toʻgʻrilash yoki oʻchirish boʻyicha soʻrov yuborish huquqiga egasiz. Bunday soʻrovlar uchun biz bilan bogʻlaning.'],
      },
    ],
  },
  terms: {
    title: 'Foydalanish shartlari',
    subtitle: 'Platformadan foydanish uchun asosiy qoida va tamoyillar.',
    sections: [
      {
        h: '1. Umumiy qoidalar',
        p: ['TopHand — Oʻzbekistondagi mahalliy xizmatlar va ish bozori platformasi. Platformadan foydalanish ushbu shartlarga rozilik bildirish hisoblanadi.'],
      },
      {
        h: '2. Eʼlon joylashtirish',
        p: ['Joylashtiriladigan eʼlonlar qonunga xilov boʻlmasligi, haqiqiy va aniqrax boʻlishi kerak. Quyidagilar taqiqlanadi:'],
        list: [
          'Nostandard, aldaydigan yoki takrorlanuvchi eʼlonlar.',
          'Qonun bilan cheklangan tovar va xizmatlar (qurol, dori-voqa va h.k.).',
          'Boshqa foydalanuvchining huquqlarini buzadigan kontent.',
        ],
      },
      {
        h: '3. Moderasiya',
        p: ['Platforma maʼmuriyi eʼlonlarni tekshirish, tahrirlash yoki qoidalarga zid boʻlsa olib tashlash huquqiga ega. Bu foydalanuvchilar xavfsizligini taʼminlash uchun amalga oshiriladi.'],
      },
      {
        h: '4. Toʻlov va obuna',
        p: ['Aytilgan xizmatlar pullik boʻlishi mumkin. Joriy narx va tariflar platforma tomonidan oʻzgartirilishi mumkin; amaldagi tariflar eʼlon joylashtirishda koʻrsatiladi.'],
      },
      {
        h: '5. Masʼuliyat chegarasi',
        p: ['TopHand foydalanuvchilar oʻrtasidagi bitimlar uchun vositachi hisoblanmaydi. Eʼlonlar mazmuni va ularga javobgarlik eʼlon egalari zimmasidadir.'],
      },
    ],
  },
  about: {
    title: 'Biz haqimizda',
    subtitle: 'TopHand — mahalliy xizmatlar va ish bozorini birlashtiruvchi platforma.',
    sections: [
      {
        h: 'Missiyamiz',
        p: ['Oʻzbekistondagi har bir mahallaga tezkor, shaffof va qulay xizmat va ish bozini olib kelish. Kichik biznes, ustalar va izlovchilarni bitta joyda birlashtirish.'],
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
        p: ['Platforma butun Oʻzbekiston boʻylab — Toshkentdan boshlab, hududlar va tumanlargacha ishlaydi. Biz jamoaviy bozor tamoyiliga asoslangan holda doimiy takomillashib boramiz.'],
      },
    ],
  },
  contact: {
    title: 'Biz bilan bogʻlanish',
    subtitle: 'Savol, taklif yoki shikoyatlaringiz uchun biz bilan bogʻlaning.',
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
        p: ['Hisob, eʼlon yoki toʻlovlar boʻyicha muammolarni tezroq hal qilish uchun ilovangizda muammoning mohiyatini va tegishli eʼlon/profil havolasini qoldiring.'],
      },
    ],
  },
};

// ─── RUS TILI ──────────────────────────────────────────────────────────
const ru: Record<LegalKind, DocMeta> = {
  privacy: {
    title: 'Политика конфиденциальности',
    subtitle: 'Как мы собираем, используем и защищаем ваши персональные данные.',
    sections: [
      {
        h: '1. Собираемые данные',
        p: ['Используя платформу TopHand (tophand.uz), вы можете предоставить следующие данные:'],
        list: [
          'Данные аккаунта: имя, номер телефона, электронная почта.',
          'Данные профиля: регион, название организации, сведения, указанные в объявлениях.',
          'Технические данные: IP-адрес, тип браузера, идентификаторы устройства и статистика использования.',
          'Данные о местоположении (с вашего разрешения) — чтобы показывать объявления рядом.',
        ],
      },
      {
        h: '2. Использование данных',
        p: ['Данные используются для следующих целей: размещение и показ объявлений, обеспечение безопасности аккаунта, повышение качества сервиса, организация связи между пользователями (чат/звонок), а также предотвращение спама и злоупотреблений.'],
      },
      {
        h: '3. Сторонние сервисы',
        p: ['Для входа мы можем использовать аутентификацию Google/Telegram, для отправки уведомлений — email и push-сервисы, а в дальнейшем — рекламные сети. Такие партнёры получают только данные, необходимые для оказания услуг.'],
      },
      {
        h: '4. Хранение и защита данных',
        p: ['Данные передаются по зашифрованным каналам и защищены современными техническими мерами. Вы можете в любое время редактировать профиль или запросить удаление аккаунта.'],
      },
      {
        h: '5. Ваши права',
        p: ['Вы имеете право запрашивать доступ к своим данным, их исправление или удаление. По таким запросам обращайтесь к нам.'],
      },
    ],
  },
  terms: {
    title: 'Условия использования',
    subtitle: 'Основные правила и принципы работы с платформой.',
    sections: [
      {
        h: '1. Общие правила',
        p: ['TopHand — платформа местных услуг и рынка труда в Узбекистане. Использование платформы означает согласие с настоящими условиями.'],
      },
      {
        h: '2. Размещение объявлений',
        p: ['Размещаемые объявления не должны нарушать закон и должны быть достоверными и точными. Запрещено:'],
        list: [
          'Нетипичные, вводящие в заблуждение или дублирующиеся объявления.',
          'Товары и услуги, ограниченные законом (оружие, наркотики и т.п.).',
          'Контент, нарушающий права других пользователей.',
        ],
      },
      {
        h: '3. Модерация',
        p: ['Администрация платформы вправе проверять, редактировать или удалять объявления, противоречащие правилам. Это делается для безопасности пользователей.'],
      },
      {
        h: '4. Оплата и подписка',
        p: ['Некоторые услуги могут быть платными. Текущие цены и тарифы могут изменяться платформой; действующие тарифы показываются при размещении объявления.'],
      },
      {
        h: '5. Ограничение ответственности',
        p: ['TopHand не является посредником в сделках между пользователями. Содержание объявлений и ответственность за них лежат на их владельцах.'],
      },
    ],
  },
  about: {
    title: 'О нас',
    subtitle: 'TopHand — платформа, объединяющая рынок местных услуг и работы.',
    sections: [
      {
        h: 'Наша миссия',
        p: ['Принести в каждый махалля Узбекистана быстрый, прозрачный и удобный рынок услуг и работы. Объединить малый бизнес, мастеров и тех, кто их ищет, в одном месте.'],
      },
      {
        h: 'Что мы делаем?',
        p: ['Через TopHand вы можете:'],
        list: [
          'Бесплатно размещать объявления об услугах и товарах — продавать или находить;',
          'Смотреть предложения рядом по областям и районам;',
          'Находить вакансии и опытных мастеров;',
          'Удобно общаться через пошаговую фильтрацию, список сохранённых и чат.',
        ],
      },
      {
        h: 'Где мы?',
        p: ['Платформа работает по всему Узбекистану — от Ташкента до областей и районов. Мы постоянно развиваемся, основываясь на принципах коллективного рынка.'],
      },
    ],
  },
  contact: {
    title: 'Связаться с нами',
    subtitle: 'Обращайтесь к нам с вопросами, предложениями или жалобами.',
    sections: [
      {
        h: 'Каналы связи',
        p: [
          'По общим вопросам: ' + CONTACT_EMAIL,
          'Поддержка (техническая помощь): ' + SUPPORT_EMAIL,
          'Платформа: tophand.uz',
        ],
      },
      {
        h: 'Центр помощи',
        p: ['Чтобы быстрее решить проблему с аккаунтом, объявлением или платежом, оставьте в обращении суть вопроса и ссылку на соответствующее объявление/профиль.'],
      },
    ],
  },
};

// ─── ANGLIYZ TILI ──────────────────────────────────────────────────────
const en: Record<LegalKind, DocMeta> = {
  privacy: {
    title: 'Privacy Policy',
    subtitle: 'How we collect, use and protect your personal information.',
    sections: [
      {
        h: '1. Information we collect',
        p: ['When using the TopHand (tophand.uz) platform you may provide the following information:'],
        list: [
          'Account information: name, phone number, email.',
          'Profile information: region, organization name, details shown in your listings.',
          'Technical information: IP address, browser type, device identifiers and usage statistics.',
          'Location information (with your permission) — to show nearby listings.',
        ],
      },
      {
        h: '2. How we use information',
        p: ['Information is used for the following purposes: publishing and displaying listings, keeping your account secure, improving service quality, enabling communication between users (chat/call), and preventing spam and abuse.'],
      },
      {
        h: '3. Third-party services',
        p: ['For sign-in we may use Google/Telegram authentication, for notifications email and push services, and (in the future) advertising networks. Such partners only receive the information required to provide their services.'],
      },
      {
        h: '4. Data storage and protection',
        p: ['Data is transmitted over encrypted channels and protected with modern technical measures. You can edit your profile or request account deletion at any time.'],
      },
      {
        h: '5. Your rights',
        p: ['You have the right to request access to, correction of, or deletion of your data. For such requests, contact us.'],
      },
    ],
  },
  terms: {
    title: 'Terms of Use',
    subtitle: 'Key rules and principles for using the platform.',
    sections: [
      {
        h: '1. General rules',
        p: ['TopHand is a local services and job marketplace platform in Uzbekistan. Using the platform means you agree to these terms.'],
      },
      {
        h: '2. Posting listings',
        p: ['Posted listings must not violate the law and must be genuine and accurate. The following are prohibited:'],
        list: [
          'Non-standard, misleading or duplicate listings.',
          'Goods and services restricted by law (weapons, narcotics, etc.).',
          'Content that infringes other users\u2019 rights.',
        ],
      },
      {
        h: '3. Moderation',
        p: ['The platform administration reserves the right to review, edit or remove listings that conflict with the rules. This is done to ensure user safety.'],
      },
      {
        h: '4. Payment and subscription',
        p: ['Some services may be paid. Current prices and tariffs may be changed by the platform; applicable tariffs are shown when posting a listing.'],
      },
      {
        h: '5. Limitation of liability',
        p: ['TopHand is not an intermediary for transactions between users. The content of listings and responsibility for them lies with their owners.'],
      },
    ],
  },
  about: {
    title: 'About us',
    subtitle: 'TopHand — a platform bringing together the local services and job market.',
    sections: [
      {
        h: 'Our mission',
        p: ['To bring a fast, transparent and convenient services and job market to every neighborhood in Uzbekistan — connecting small businesses, skilled masters and the people looking for them in one place.'],
      },
      {
        h: 'What do we do?',
        p: ['With TopHand you can:'],
        list: [
          'Post services and items for free to sell or find them;',
          'Browse nearby offers by region and district;',
          'Find jobs and skilled professionals;',
          'Communicate easily through step-by-step filters, saved items and chat.',
        ],
      },
      {
        h: 'Where are we?',
        p: ['The platform works across all of Uzbekistan — from Tashkent to the regions and districts. We keep improving, guided by the principles of a community marketplace.'],
      },
    ],
  },
  contact: {
    title: 'Contact us',
    subtitle: 'Reach out to us with any questions, suggestions or complaints.',
    sections: [
      {
        h: 'Contact channels',
        p: [
          'General questions: ' + CONTACT_EMAIL,
          'Support (technical help): ' + SUPPORT_EMAIL,
          'Platform: tophand.uz',
        ],
      },
      {
        h: 'Help center',
        p: ['To resolve issues with your account, listing or payments faster, describe the problem and include a link to the relevant listing/profile.'],
      },
    ],
  },
};

const BASE: Record<'uz' | 'ru' | 'en', Record<LegalKind, DocMeta>> = { uz, ru, en };

// uz-Cyrl: uz lotin matnini kirillga transliteratsiya qilamiz (icon'lar o'zgarmaydi).
function translitDoc(doc: DocMeta): DocMeta {
  return {
    title: uzLatnToCyrillic(doc.title),
    subtitle: uzLatnToCyrillic(doc.subtitle),
    sections: doc.sections.map((s) => ({
      h: uzLatnToCyrillic(s.h),
      p: s.p.map(uzLatnToCyrillic),
      list: s.list ? s.list.map(uzLatnToCyrillic) : undefined,
    })),
  };
}

export function getLegalDocs(locale: Locale): Record<LegalKind, DocMeta> {
  if (locale === 'ru' || locale === 'en') return BASE[locale];
  if (locale === 'uz-Cyrl') {
    const out = {} as Record<LegalKind, DocMeta>;
    (Object.keys(uz) as LegalKind[]).forEach((k) => {
      out[k] = translitDoc(uz[k]);
    });
    return out;
  }
  return BASE.uz;
}
