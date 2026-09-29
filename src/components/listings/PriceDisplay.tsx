import React from 'react';
import { PriceType, SalaryType } from '../../types/index.ts';
import { formatPrice, formatSalary } from '../../lib/utils.ts';

interface PriceDisplayProps {
  priceType: PriceType;
  priceMin?: number | null;
  priceMax?: number | null;
  currency?: string;
  salaryType?: SalaryType | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  className?: string;
  isJob?: boolean;
}

export const PriceDisplay: React.FC<PriceDisplayProps> = ({
  priceType,
  priceMin,
  priceMax,
  currency = 'UZS',
  salaryType,
  salaryMin,
  salaryMax,
  className = '',
  isJob = false,
}) => {
  if (isJob || salaryType) {
    const text = formatSalary(salaryType, salaryMin, salaryMax);
    return <span className={`font-bold text-gray-900 tracking-tight ${className}`}>{text}</span>;
  }

  const text = formatPrice(priceType, priceMin, priceMax, currency);
  return <span className={`font-bold text-blue-900 tracking-tight ${className}`}>{text}</span>;
};
