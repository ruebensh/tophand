import { ListingType, PriceType, SalaryType, ContactTime } from '../types/index.ts';

/**
 * The official TopHand account(s). Admin / super-admin roles are rendered with a
 * distinct royal-gold badge so they stand apart from ordinary verified users.
 */
export function isOfficialAccount(entity?: { role?: string | null; owner_role?: string | null } | null): boolean {
  const role = entity?.role ?? entity?.owner_role;
  return role === 'ADMIN' || role === 'SUPER_ADMIN';
}

/**
 * TopHand staff (moderation team). Rendered with a distinct indigo-violet shield
 * badge so moderators stand apart from ordinary verified users, but below the
 * royal-gold official/admin seal.
 */
export function isStaffAccount(entity?: { role?: string | null; owner_role?: string | null } | null): boolean {
  const role = entity?.role ?? entity?.owner_role;
  return role === 'INTERN_MOD' || role === 'MODERATOR' || role === 'LEAD_MOD';
}

export function formatCurrency(amount?: number | null): string {
  if (amount === undefined || amount === null || isNaN(amount)) return '';
  return new Intl.NumberFormat('uz-UZ').format(amount).replace(/,/g, ' ');
}

export function formatPrice(priceType: PriceType, min?: number | null, max?: number | null, currency = 'UZS'): string {
  switch (priceType) {
    case 'FREE':
      return 'Bepul';
    case 'NEGOTIABLE':
      return 'Kelishiladi';
    case 'FIXED':
      return min ? `${formatCurrency(min)} ${currency}` : 'Kelishiladi';
    case 'FROM':
      return min ? `${formatCurrency(min)} ${currency} dan` : 'Kelishiladi';
    case 'RANGE':
      if (min && max) {
        return `${formatCurrency(min)} – ${formatCurrency(max)} ${currency}`;
      }
      return min ? `${formatCurrency(min)} ${currency} dan` : 'Kelishiladi';
    default:
      return 'Kelishiladi';
  }
}

export function formatSalary(salaryType?: SalaryType | null, min?: number | null, max?: number | null): string {
  if (!salaryType || salaryType === 'SALARY_NEGOTIABLE') {
    return 'Maosh: Kelishiladi';
  }

  if (salaryType === 'SALARY_FIXED' && min) {
    return `${formatCurrency(min)} UZS / oy`;
  }

  if (salaryType === 'SALARY_RANGE') {
    if (min && max) {
      return `${formatCurrency(min)} – ${formatCurrency(max)} UZS / oy`;
    }
    if (min) {
      return `${formatCurrency(min)} UZS dan / oy`;
    }
  }

  return 'Maosh: Kelishiladi';
}

export function getListingTypeLabel(type: ListingType): string {
  switch (type) {
    case 'SERVICE_OFFER':
      return 'Xizmat taklif qilaman';
    case 'SERVICE_REQUEST':
      return 'Xizmat kerak';
    case 'JOB_OPENING':
      return 'Ishchi qidiraman';
    case 'JOB_SEEKER':
      return 'Ish qidiraman';
    case 'SELL':
      return 'Sotaman';
    case 'WANTED':
      return 'Qidiraman';
    case 'RENT_OUT':
      return 'Ijaraga beraman';
    case 'RENT_WANTED':
      return 'Ijaraga olaman';
    default:
      return type;
  }
}

export function getListingTypeBadgeColors(type: ListingType) {
  switch (type) {
    case 'SERVICE_OFFER':
      return {
        bg: 'bg-blue-50 text-blue-700 border-blue-200',
        dot: 'bg-blue-600',
        tabActive: 'bg-blue-600 text-white',
      };
    case 'SERVICE_REQUEST':
      return {
        bg: 'bg-amber-50 text-amber-700 border-amber-200',
        dot: 'bg-amber-600',
        tabActive: 'bg-amber-600 text-white',
      };
    case 'JOB_OPENING':
      return {
        bg: 'bg-purple-50 text-purple-700 border-purple-200',
        dot: 'bg-purple-600',
        tabActive: 'bg-purple-600 text-white',
      };
    case 'JOB_SEEKER':
      return {
        bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        dot: 'bg-emerald-600',
        tabActive: 'bg-emerald-600 text-white',
      };
    case 'SELL':
      return {
        bg: 'bg-sky-50 text-sky-700 border-sky-200',
        dot: 'bg-sky-600',
        tabActive: 'bg-sky-600 text-white',
      };
    case 'WANTED':
      return {
        bg: 'bg-rose-50 text-rose-700 border-rose-200',
        dot: 'bg-rose-600',
        tabActive: 'bg-rose-600 text-white',
      };
    case 'RENT_OUT':
      return {
        bg: 'bg-teal-50 text-teal-700 border-teal-200',
        dot: 'bg-teal-600',
        tabActive: 'bg-teal-600 text-white',
      };
    case 'RENT_WANTED':
      return {
        bg: 'bg-orange-50 text-orange-700 border-orange-200',
        dot: 'bg-orange-600',
        tabActive: 'bg-orange-600 text-white',
      };
    default:
      return {
        bg: 'bg-gray-50 text-gray-700 border-gray-200',
        dot: 'bg-gray-600',
        tabActive: 'bg-gray-600 text-white',
      };
  }
}

export function getContactTimeLabel(time: ContactTime, customText?: string): string {
  switch (time) {
    case 'ANY_TIME':
      return 'Istalgan vaqtda aloqaga chiqish mumkin';
    case 'MORNING':
      return 'Ertalab (09:00 – 13:00)';
    case 'AFTERNOON':
      return 'Kunduzi (13:00 – 18:00)';
    case 'EVENING':
      return 'Kechqurun (18:00 – 21:00)';
    case 'CUSTOM':
      return customText || 'Kelishilgan vaqtda';
    default:
      return 'Istalgan vaqtda';
  }
}

export function formatDateAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffSec < 60) return 'Hozirgina';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} daqiqa oldin`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} soat oldin`;
  if (diffSec < 86400 * 2) return 'Kecha';
  if (diffSec < 86400 * 7) return `${Math.floor(diffSec / 86400)} kun oldin`;

  return date.toLocaleDateString('uz-UZ', { day: 'numeric', month: 'short' });
}
