import type { LucideIcon } from "lucide-react";
import {
  Activity,
  BarChart3,
  BookOpen,
  Building2,
  CalendarDays,
  CalendarRange,
  ClipboardCheck,
  ClipboardList,
  CreditCard,
  Database,
  FileCheck2,
  FileText,
  FolderOpen,
  Globe,
  GraduationCap,
  Heart,
  HelpCircle,
  Home,
  KeyRound,
  Megaphone,
  Receipt,
  Send,
  Settings,
  Shield,
  ShieldAlert,
  Sliders,
  Tag,
  Terminal,
  UserCheck,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import type { NavIconName } from "@/config/navigation";

const NAV_ICON_MAP: Record<NavIconName, LucideIcon> = {
  home: Home,
  "building-2": Building2,
  "file-text": FileText,
  "credit-card": CreditCard,
  wallet: Wallet,
  receipt: Receipt,
  "bar-chart-3": BarChart3,
  users: Users,
  "user-check": UserCheck,
  "user-plus": UserPlus,
  "help-circle": HelpCircle,
  megaphone: Megaphone,
  shield: Shield,
  "shield-alert": ShieldAlert,
  sliders: Sliders,
  activity: Activity,
  globe: Globe,
  terminal: Terminal,
  database: Database,
  "calendar-days": CalendarDays,
  "book-open": BookOpen,
  "clipboard-check": ClipboardCheck,
  "graduation-cap": GraduationCap,
  "file-check-2": FileCheck2,
  "folder-open": FolderOpen,
  "calendar-range": CalendarRange,
  send: Send,
  heart: Heart,
  "key-round": KeyRound,
  tag: Tag,
  "clipboard-list": ClipboardList,
  settings: Settings,
};

export function NavIcon({
  name,
  className,
}: {
  name: NavIconName;
  className?: string;
}) {
  const Icon = NAV_ICON_MAP[name] || Home;
  return <Icon className={className} aria-hidden="true" />;
}
