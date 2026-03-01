import * as LucideIcons from 'lucide-react';
import { memo } from 'react';

interface IconProps {
  name: string;
  size?: number;
  className?: string;
  strokeWidth?: number;
}

const Icon = memo(function Icon({ name, size = 20, className = '', strokeWidth = 2 }: IconProps) {
  const LucideIcon = (LucideIcons as Record<string, any>)[name];
  if (!LucideIcon) {
    // Fallback to CircleDot if icon not found
    const Fallback = (LucideIcons as Record<string, any>)['CircleDot'];
    return <Fallback size={size} className={className} strokeWidth={strokeWidth} />;
  }
  return <LucideIcon size={size} className={className} strokeWidth={strokeWidth} />;
});

export default Icon;
