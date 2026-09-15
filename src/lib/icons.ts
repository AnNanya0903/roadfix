import type { ReportCategory } from './types';
import {
  CircleDashed,
  Construction,
  Droplets,
  Signpost,
  Lightbulb,
  AlertTriangle,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const ICON_MAP: Record<ReportCategory, LucideIcon> = {
  pothole: CircleDashed,
  broken_road: Construction,
  waterlogging: Droplets,
  signage: Signpost,
  streetlight: Lightbulb,
  other: AlertTriangle,
};

export function getCategoryIcon(category: ReportCategory): LucideIcon {
  return ICON_MAP[category] || AlertTriangle;
}
