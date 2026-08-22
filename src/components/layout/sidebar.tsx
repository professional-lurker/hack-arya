"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard, Key, FolderOpen, FlaskConical,
  BarChart3, BookOpen, Settings, Shield, Zap,
  LogOut, ChevronRight, Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/keys", label: "API Keys", icon: Key },
  { href: "/projects", label: "Projects", icon: FolderOpen },
  { href: "/playground", label: "Playground", icon: FlaskConical },
  { href: "/comparison", label: "Compare", icon: BarChart3 },
  { href: "/requests", label: "Request Log", icon: Activity },
  { href: "/docs", label: "API Docs", icon: BookOpen },
];

const bottomItems = [
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/admin", label: "Admin", icon: Shield },
];

interface SidebarProps {
  user?: { name?: string; email?: string; role?: string };
}

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 h-screen w-60 flex flex-col border-r bg-[hsl(var(--sidebar))] border-[hsl(var(--sidebar-border))] z-40">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 py-5 border-b border-[hsl(var(--sidebar-border))]">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center">
          <Zap className="w-4 h-4 text-white" />
        </div>
        <div>
          <span className="font-semibold text-sm text-white">AI Sandbox</span>
          <span className="block text-[10px] text-[hsl(var(--muted-foreground))]">Dev Testing Platform</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))] px-2 mb-2">
          Workspace
        </p>
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn("sidebar-link", pathname.startsWith(href) && "active")}
          >
            <Icon className="w-4 h-4 shrink-0" />
            {label}
            {pathname.startsWith(href) && (
              <ChevronRight className="w-3 h-3 ml-auto opacity-60" />
            )}
          </Link>
        ))}

        <p className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))] px-2 mt-5 mb-2">
          Account
        </p>
        {bottomItems
          .filter((item) => item.href !== "/admin" || user?.role === "ADMIN" || user?.role === "SUPER_ADMIN")
          .map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn("sidebar-link", pathname.startsWith(href) && "active")}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </Link>
          ))}
      </nav>

      {/* User section */}
      <div className="px-3 py-3 border-t border-[hsl(var(--sidebar-border))]">
        <div className="flex items-center gap-2.5 px-2 py-2 rounded-lg">
          <Avatar className="w-7 h-7">
            <AvatarFallback className="bg-gradient-to-br from-blue-500 to-violet-600 text-white text-xs">
              {user?.name?.charAt(0).toUpperCase() ?? "U"}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-white truncate">{user?.name ?? "User"}</p>
            <p className="text-[10px] text-[hsl(var(--muted-foreground))] truncate">{user?.email}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="w-6 h-6 text-[hsl(var(--muted-foreground))] hover:text-white"
            onClick={() => signOut({ callbackUrl: "/login" })}
            title="Sign out"
          >
            <LogOut className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </aside>
  );
}
