import {
  Award, Bell, Bookmark, Briefcase, Building2, Calendar, Camera, Check, ChevronDown, ChevronRight, CircleCheck, CircleMinus,
  CircleUser, CircleX, CloudUpload, Compass, Download, GraduationCap, Image, Info, Lock, LogOut, MapPin, Mail, ArrowLeft,
  ArrowRight, Phone, Plus, Search, Send, Settings, ShieldCheck, SlidersHorizontal, Sparkles, SquarePen, Trash2, User,
} from 'lucide-react-native';
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
  search: Search,
  'search-outline': Search,
  'settings-outline': Settings,
  'shield-checkmark-outline': ShieldCheck,
  'sparkles-outline': Sparkles,
  'trash-outline': Trash2,
} as const;

export type IconName = keyof typeof ICONS;

interface IconProps {
  name: IconName;
  size?: number;
  color: string;
  strokeWidth?: number; // line thickness; the selected tab uses a thicker line
  filled?: boolean; // fill the shape with its colour (used for the unread bell)
}

// One icon. Size and colour work like text: pass a size in points and a theme colour.
export function Icon({ name, size = 24, color, strokeWidth = 2, filled = false }: IconProps) {
  const Glyph = ICONS[name] as ComponentType<{ size: number; color: string; strokeWidth: number; fill?: string }>;
  return <Glyph size={size} color={color} strokeWidth={strokeWidth} fill={filled ? color : 'none'} />;
}
