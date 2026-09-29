import React from 'react';
import {
  Sparkles,
  Paintbrush,
  Hammer,
  Wrench,
  PartyPopper,
  Briefcase,
  HeartHandshake,
  Cog,
  Laptop,
  Trash2,
  GraduationCap,
  Car,
  Megaphone,
  Code,
  Truck,
  Home,
  Languages,
  Trees,
  ShieldAlert,
  Boxes,
  ShieldCheck,
  Bus,
  MoreHorizontal,
  Layers,
  HelpCircle,
} from 'lucide-react';

const ICON_MAP: Record<string, React.ElementType> = {
  Sparkles,
  Paintbrush,
  Hammer,
  Wrench,
  Sparkle: Sparkles,
  PartyPopper,
  Briefcase,
  HeartHandshake,
  Cog,
  Laptop,
  Trash2,
  GraduationCap,
  Car,
  Megaphone,
  Code,
  Truck,
  Home,
  Languages,
  Trees,
  ShieldAlert,
  Boxes,
  ShieldCheck,
  Bus,
  MoreHorizontal,
  Layers,
};

interface CategoryIconProps {
  name?: string;
  className?: string;
  size?: number;
}

export const CategoryIcon: React.FC<CategoryIconProps> = ({
  name = 'Layers',
  className = 'w-4 h-4',
  size,
}) => {
  const IconComponent = (name && ICON_MAP[name]) || Layers;
  return <IconComponent className={className} size={size} />;
};
