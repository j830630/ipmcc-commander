'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  FolderOpen,
  FlaskConical,
  BookOpen,
  Settings,
  TrendingUp,
  ChevronLeft,
  Search,
  Calendar,
  FileText,
  Target,
  GitBranch,
  BarChart3,
  Shield,
  Plug,
  Calculator,
  ClipboardList,
  ScrollText,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/lib/store';

const navItems = [
  {
    name: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    name: 'Trade Lab',
    href: '/trade-lab',
    icon: FlaskConical,
  },
  {
    name: 'Scanner',
    href: '/scanner',
    icon: Search,
  },
  {
    name: 'Trade Journal',
    href: '/trades',
    icon: ClipboardList,
  },
  {
    name: 'Analytics',
    href: '/analytics',
    icon: BarChart3,
  },
  {
    name: 'Risk Monitor',
    href: '/risk',
    icon: Shield,
  },
  {
    name: 'Calculator',
    href: '/calculator',
    icon: Calculator,
  },
  {
    name: 'Positions',
    href: '/positions',
    icon: FolderOpen,
  },
  {
    name: 'Calendar',
    href: '/calendar',
    icon: Calendar,
  },
  {
    name: 'Changelog',
    href: '/changelog',
    icon: ScrollText,
  },
  {
    name: 'Guide',
    href: '/guide',
    icon: BookOpen,
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { sidebarCollapsed, toggleSidebar } = useUIStore();

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 h-screen flex flex-col transition-all duration-300 z-50',
        'bg-[var(--bg-surface)] border-r border-[var(--border-subtle)]',
        sidebarCollapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Logo */}
      <div className="flex items-center h-16 px-4 border-b border-[var(--border-subtle)]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-white" />
          </div>
          {!sidebarCollapsed && (
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-[var(--text-primary)]">
                IPMCC
              </span>
              <span className="text-xs text-[var(--text-muted)]">
                Commander
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href || 
              (item.href !== '/' && pathname.startsWith(item.href));
            
            return (
              <li key={item.name}>
                <Link
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 mx-2 px-3 py-2.5 rounded-lg transition-all duration-150',
                    'text-sm font-medium',
                    isActive
                      ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]'
                  )}
                >
                  <item.icon className={cn('w-5 h-5', sidebarCollapsed && 'mx-auto')} />
                  {!sidebarCollapsed && <span>{item.name}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Bottom section */}
      <div className="border-t border-[var(--border-subtle)] p-4">
        <Link
          href="/settings"
          className={cn(
            'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150',
            'text-sm font-medium text-[var(--text-secondary)]',
            'hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]',
            pathname === '/settings' && 'bg-[var(--bg-elevated)] text-[var(--text-primary)]'
          )}
        >
          <Settings className={cn('w-5 h-5', sidebarCollapsed && 'mx-auto')} />
          {!sidebarCollapsed && <span>Settings</span>}
        </Link>

        {/* Collapse toggle */}
        <button
          onClick={toggleSidebar}
          className={cn(
            'mt-2 w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg',
            'text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)]',
            'hover:bg-[var(--bg-elevated)] transition-all duration-150'
          )}
        >
          <ChevronLeft
            className={cn(
              'w-4 h-4 transition-transform duration-300',
              sidebarCollapsed && 'rotate-180'
            )}
          />
          {!sidebarCollapsed && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  );
}
