import { ListingType, PriceType, SalaryType, ContactTime } from '../types/index.ts';
import { translate as tf, getActiveLocale, INTL_LOCALE } from '../i18n/core.ts';

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
  return new Intl.NumberFormat(INTL_LOCALE[getActiveLocale()]).format(amount).replace(/,/g, ' ');
}

export function formatPrice(priceType: PriceType, min?: number | null, max?: number | null, currency = 'UZS'): string {
  switch (priceType) {
    case 'FREE':
      return tf('price.free');
    case 'NEGOTIABLE':
      return tf('price.negotiable');
    case 'FIXED':
      return min ? `${formatCurrency(min)} ${currency}` : tf('price.negotiable');
    case 'FROM':
      return min ? `${formatCurrency(min)} ${currency} ${tf('price.fromWord')}` : tf('price.negotiable');
    case 'RANGE':
      if (min && max) {
        return `${formatCurrency(min)} – ${formatCurrency(max)} ${currency}`;
      }
      return min ? `${formatCurrency(min)} ${currency} ${tf('price.fromWord')}` : tf('price.negotiable');
    default:
      return tf('price.negotiable');
  }
}

export function formatSalary(salaryType?: SalaryType | null, min?: number | null, max?: number | null): string {
  if (!salaryType || salaryType === 'SALARY_NEGOTIABLE') {
    return tf('price.salaryNegotiable');
  }

  if (salaryType === 'SALARY_FIXED' && min) {
    return `${formatCurrency(min)} UZS ${tf('price.perMonth')}`;
  }

  if (salaryType === 'SALARY_RANGE') {
    if (min && max) {
      return `${formatCurrency(min)} – ${formatCurrency(max)} UZS ${tf('price.perMonth')}`;
    }
    if (min) {
      return `${formatCurrency(min)} UZS ${tf('price.fromWord')} ${tf('price.perMonth')}`;
    }
  }

  return tf('price.salaryNegotiable');
}

export function getListingTypeLabel(type: ListingType): string {
  const s = tf(`listingType.${type}`);
  return s === `listingType.${type}` ? type : s;
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
  if (time === 'CUSTOM') return customText || tf('contactTime.CUSTOM');
  const s = tf(`contactTime.${time}`);
  return s === `contactTime.${time}` ? tf('contactTime.ANY_TIME_SHORT') : s;
}

export function formatDateAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffSec < 60) return tf('timeAgo.now');
  if (diffSec < 3600) return tf('timeAgo.minutesAgo', { n: Math.floor(diffSec / 60) });
  if (diffSec < 86400) return tf('timeAgo.hoursAgo', { n: Math.floor(diffSec / 3600) });
  if (diffSec < 86400 * 2) return tf('timeAgo.yesterday');
  if (diffSec < 86400 * 7) return tf('timeAgo.daysAgo', { n: Math.floor(diffSec / 86400) });

  return date.toLocaleDateString(INTL_LOCALE[getActiveLocale()], { day: 'numeric', month: 'short' });
}
