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
  label: string;
  href: string;
  icon: LucideIcon;
}

export interface NavGroup {
  key: string;
  label: string;
  items: NavItem[];
}

const MAIN: NavItem[] = [
  { key: "dashboard", label: "Dashboard", href: "/", icon: LayoutDashboard },
  { key: "leads", label: "Leads", href: "/leads", icon: FileText },
  { key: "targets", label: "Targets", href: "/targets", icon: Target },
  { key: "reports", label: "Reports", href: "/reports", icon: BarChart3 },
  { key: "prospects", label: "Prospects", href: "/prospects", icon: Users },
];

const SALESMEN: NavItem = { key: "salesmen", label: "Salesmen", href: "/salesmen", icon: UserCog };
const SETTINGS: NavItem = { key: "settings", label: "Settings", href: "/settings", icon: Settings };

export function navFor(role: string | undefined): NavGroup[] {
  const groups: NavGroup[] = [{ key: "main", label: "Main", items: MAIN }];
  if (role === "admin") groups.push({ key: "admin", label: "Administration", items: [SALESMEN, SETTINGS] });
  else if (role === "manager") groups.push({ key: "admin", label: "Administration", items: [SALESMEN] });
  return groups;
}

export function activeHref(groups: NavGroup[], pathname: string): string | undefined {
  const all = groups.flatMap((g) => g.items);
  if (pathname === "/") return "/";
  return all.find((item) => item.href !== "/" && pathname.startsWith(item.href))?.href;
}
