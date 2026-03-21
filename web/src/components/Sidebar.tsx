"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Mic, History, Settings, BookOpen } from "lucide-react";

const navItems = [
  { href: "/", label: "Dictate", icon: Mic },
  { href: "/history", label: "History", icon: History },
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/settings#dictionary", label: "Dictionary", icon: BookOpen },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-16 lg:w-56 bg-gray-950 border-r border-gray-800 flex flex-col items-center lg:items-stretch py-6 px-2 lg:px-4 shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-2 mb-8 px-2">
        <div className="w-8 h-8 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-lg flex items-center justify-center">
          <Mic className="w-4 h-4 text-white" />
        </div>
        <span className="hidden lg:block text-lg font-bold text-white">
          OpenWhisper
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex flex-col gap-1 flex-1">
        {navItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href.split("#")[0]);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors
                ${
                  isActive
                    ? "bg-cyan-500/10 text-cyan-400"
                    : "text-gray-400 hover:text-gray-200 hover:bg-gray-800/50"
                }
              `}
            >
              <Icon className="w-5 h-5 shrink-0" />
              <span className="hidden lg:block text-sm font-medium">
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="hidden lg:block text-xs text-gray-600 px-2">
        Open source &middot; MIT License
      </div>
    </aside>
  );
}
