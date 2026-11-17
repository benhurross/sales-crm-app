import {
  BarChart3,
  FileText,
  LayoutDashboard,
  Settings,
  Target,
  UserCog,
  Users,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  key: string;
  href: string;
  icon: LucideIcon;
}

export interface NavGroup {
  key: string;
  items: NavItem[];
}

const MAIN: NavItem[] = [
  { key: "dashboard", href: "/", icon: LayoutDashboard },
  { key: "leads", href: "/leads", icon: FileText },
  { key: "targets", href: "/targets", icon: Target },
  { key: "reports", href: "/reports", icon: BarChart3 },
  { key: "prospects", href: "/prospects", icon: Users },
];

const SALESMEN: NavItem = { key: "salesmen", href: "/salesmen", icon: UserCog };
const SETTINGS: NavItem = { key: "settings", href: "/settings", icon: Settings };

export function navFor(role: string | undefined): NavGroup[] {
  const groups: NavGroup[] = [{ key: "main", items: MAIN }];
  if (role === "admin") groups.push({ key: "admin", items: [SALESMEN, SETTINGS] });
  else if (role === "manager") groups.push({ key: "admin", items: [SALESMEN] });
  return groups;
}

export function activeHref(groups: NavGroup[], pathname: string): string | undefined {
  const all = groups.flatMap((g) => g.items);
  if (pathname === "/") return "/";
  return all.find((item) => item.href !== "/" && pathname.startsWith(item.href))?.href;
}
