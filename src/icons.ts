// 90+ curated Lucide icon names for habits
export const HABIT_ICONS = [
  // Fitness & Sports
  'Dumbbell', 'Footprints', 'Bike', 'Activity', 'HeartPulse', 'Flame',
  'Zap', 'Mountain', 'Waves', 'Wind', 'PersonStanding', 'Timer',
  'Swords', 'Medal', 'Trophy', 'Volleyball', 'Sword', 'Shield',

  // Health & Body
  'Heart', 'Thermometer', 'Pill', 'Apple', 'Salad', 'Stethoscope',
  'Droplets', 'GlassWater', 'UtensilsCrossed', 'Leaf', 'Sprout', 'Syringe',
  'BedDouble', 'Moon', 'Sun', 'Sunrise', 'Sunset', 'CloudSun',

  // Mind & Wellness
  'Brain', 'Eye', 'Smile', 'Frown', 'Sparkles', 'Star',
  'TreePine', 'Flower', 'Flower2', 'Feather', 'Gem', 'Infinity',

  // Productivity & Focus
  'Target', 'CheckCircle', 'Clock', 'AlarmClock', 'CalendarCheck', 'ListTodo',
  'ListChecks', 'ClipboardCheck', 'Rocket', 'Flag', 'Crosshair', 'Focus',

  // Work & Career
  'Briefcase', 'Laptop', 'Monitor', 'FileText', 'PenLine', 'Presentation',
  'Lightbulb', 'Building', 'TrendingUp', 'BarChart3', 'PieChart', 'LineChart',

  // Learning & Skills
  'BookOpen', 'GraduationCap', 'Library', 'Notebook', 'Highlighter', 'Languages',
  'Code', 'Terminal', 'Puzzle', 'Wrench', 'Palette', 'Pen',

  // Finance
  'Wallet', 'PiggyBank', 'BadgeDollarSign', 'CreditCard', 'Calculator', 'Banknote',

  // Social & Relationships
  'Users', 'UserPlus', 'MessageCircle', 'Phone', 'Video', 'Gift',
  'Handshake', 'HeartHandshake', 'Mail', 'Send',

  // Lifestyle & Habits
  'Coffee', 'Cigarette', 'Ban', 'Camera', 'Music', 'Headphones',
  'Mic', 'Film', 'Plane', 'Map', 'Compass', 'Tent',
  'Dog', 'Gamepad2', 'Guitar', 'Anchor', 'Bike', 'Car',

  // Spiritual & Abstract
  'Gem', 'Crown', 'Award', 'CircleDot', 'Radio', 'Wifi',
] as const;

// Deduplicate
const deduped = [...new Set(HABIT_ICONS as unknown as string[])] as string[];
export const UNIQUE_HABIT_ICONS: string[] = deduped;

export type HabitIconName = string;

export const ICON_CATEGORIES: Record<string, string[]> = {
  'Fitness': ['Dumbbell', 'Footprints', 'Bike', 'Activity', 'HeartPulse', 'Flame', 'Zap', 'Mountain', 'Waves', 'Wind', 'PersonStanding', 'Timer', 'Medal', 'Trophy', 'Shield', 'Swords'],
  'Health': ['Heart', 'Thermometer', 'Pill', 'Apple', 'Salad', 'Stethoscope', 'Droplets', 'GlassWater', 'UtensilsCrossed', 'Leaf', 'Sprout', 'BedDouble'],
  'Mind': ['Brain', 'Eye', 'Smile', 'Sparkles', 'Star', 'TreePine', 'Flower2', 'Feather', 'Moon', 'Sun', 'Sunrise', 'Sunset', 'Infinity'],
  'Productivity': ['Target', 'CheckCircle', 'Clock', 'AlarmClock', 'CalendarCheck', 'ListTodo', 'ListChecks', 'ClipboardCheck', 'Rocket', 'Flag', 'Crosshair', 'Focus'],
  'Work': ['Briefcase', 'Laptop', 'Monitor', 'FileText', 'PenLine', 'Presentation', 'Lightbulb', 'Building', 'TrendingUp', 'BarChart3', 'PieChart', 'LineChart'],
  'Learning': ['BookOpen', 'GraduationCap', 'Library', 'Notebook', 'Highlighter', 'Languages', 'Code', 'Terminal', 'Puzzle', 'Wrench', 'Palette', 'Pen'],
  'Finance': ['Wallet', 'PiggyBank', 'BadgeDollarSign', 'CreditCard', 'Calculator', 'Banknote'],
  'Social': ['Users', 'UserPlus', 'MessageCircle', 'Phone', 'Video', 'Gift', 'Handshake', 'HeartHandshake', 'Mail', 'Send'],
  'Lifestyle': ['Coffee', 'Camera', 'Music', 'Headphones', 'Film', 'Plane', 'Map', 'Compass', 'Tent', 'Dog', 'Guitar', 'Gamepad2'],
};
