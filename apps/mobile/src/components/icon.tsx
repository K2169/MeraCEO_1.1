import {
  Award, Bell, Bookmark, Briefcase, Building2, Calendar, Camera, Check, ChevronDown, ChevronRight, CircleCheck, CircleMinus,
  CircleUser, CircleX, CloudUpload, Compass, Download, Eye, EyeOff, GraduationCap, Image, Info, Lock, LogOut, MapPin, Mail, ArrowLeft, Video,
  ArrowRight, Phone, Plus, Search, Send, Settings, ShieldCheck, SlidersHorizontal, Sparkles, SquarePen, Star, Store, Target, Trash2, TrendingUp, User, Users,
} from 'lucide-react-native';
import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import type { ComponentType } from 'react';

// Every icon in the app comes from this one file, so the whole app has one consistent line style (Lucide).
// To change an icon, change it here. Screens only use the short names below.
const ICONS = {
  add: Plus,
  'arrow-back': ArrowLeft,
  'arrow-forward': ArrowRight,
  'briefcase-outline': Briefcase,
  bookmark: Bookmark,
  business: Building2,
  'calendar-outline': Calendar,
  'call-outline': Phone,
  camera: Camera,
  checkmark: Check,
  'checkmark-circle': CircleCheck,
  'checkmark-circle-outline': CircleCheck,
  'chevron-down': ChevronDown,
  'chevron-forward': ChevronRight,
  'close-circle': CircleX,
  'close-circle-outline': CircleX,
  'cloud-upload': CloudUpload,
  'compass-outline': Compass,
  'create-outline': SquarePen,
  'download-outline': Download,
  'eye-outline': Eye,
  'eye-off-outline': EyeOff,
  'image-outline': Image,
  'information-circle-outline': Info,
  'lock-closed-outline': Lock,
  'location-outline': MapPin,
  'log-out-outline': LogOut,
  'mail-outline': Mail,
  'mail-unread-outline': Mail,
  notifications: Bell,
  'notifications-outline': Bell,
  'options-outline': SlidersHorizontal,
  'paper-plane-outline': Send,
  person: User,
  'person-circle-outline': CircleUser,
  'person-outline': User,
  'remove-circle-outline': CircleMinus,
  'ribbon-outline': Award,
  'school-outline': GraduationCap,
  star: Star,
  storefront: Store,
  target: Target,
  'trending-up': TrendingUp,
  'videocam-outline': Video,
  users: Users,
  search: Search,
  'search-outline': Search,
  'settings-outline': Settings,
  'shield-checkmark-outline': ShieldCheck,
  'sparkles-outline': Sparkles,
  'trash-outline': Trash2,
} as const;

export type IconName = keyof typeof ICONS;

// Font Awesome 6 solid glyphs are used where the design calls for a true filled icon.
// This avoids faking a fill on Lucide's stroke-only paths.
const SOLID_ICONS: Partial<Record<IconName, string>> = {
  'calendar-outline': 'calendar-days',
  person: 'user',
  'person-outline': 'user',
  star: 'star',
  storefront: 'store',
  target: 'bullseye',
  'trending-up': 'chart-line',
  users: 'users',
};

interface IconProps {
  name: IconName;
  size?: number;
  color: string;
  strokeWidth?: number; // line thickness; the selected tab uses a thicker line
  filled?: boolean; // fill the shape with its colour (used for the unread bell)
}

// One icon. Size and colour work like text: pass a size in points and a theme colour.
export function Icon({ name, size = 24, color, strokeWidth = 2, filled = false }: IconProps) {
  const solidName = filled ? SOLID_ICONS[name] : undefined;
  if (solidName) {
    return <FontAwesome6 name={solidName} size={size} color={color} solid />;
  }

  const Glyph = ICONS[name] as ComponentType<{ size: number; color: string; strokeWidth: number; fill?: string }>;
  return <Glyph size={size} color={color} strokeWidth={strokeWidth} fill={filled ? color : 'none'} />;
}
