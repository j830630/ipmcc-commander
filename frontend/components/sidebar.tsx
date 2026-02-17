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
  Zap,
  GraduationCap,
  Bug,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/lib/store';

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
  badge?: string;
}

interface NavSection {
  title?: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    items: [
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
    ],
  },
  {
    title: '0-DTE Trading',
    items: [
      {
        name: '0-DTE Dashboard',
        href: '/zero-dte',
        icon: Zap,
        badge: 'NEW',
      },
      {
        name: 'Trade Scanner',
        href: '/zero-dte/scanner',
        icon: Search,
      },
      {
        name: 'Command Center',
        href: '/zero-dte/audit',
        icon: Bug,
      },
      {
        name: 'Trade Builder',
        href: '/zero-dte/trade',
        icon: Target,
      },
      {
        name: 'Kill Switch',
        href: '/zero-dte/monitor',
        icon: Shield,
      },
      {
        name: '0-DTE Guide',
        href: '/zero-dte/guide',
        icon: GraduationCap,
      },
    ],
  },
  {
    title: 'Resources',
    items: [
      {
        name: 'IPMCC Guide',
        href: '/guide',
        icon: BookOpen,
      },
      {
        name: 'Changelog',
        href: '/changelog',
        icon: ScrollText,
      },
      {
        name: 'Settings',
        href: '/settings',
        icon: Settings,
      },
    ],
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
        sidebarCollapsed ? 'w-16' : 'w-56'
      )}
    >
      {/* Logo */}
      <div className="flex items-center h-14 px-4 border-b border-[var(--border-subtle)]">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-white" />
          </div>
          {!sidebarCollapsed && (
            <span className="font-semibold text-[var(--text-primary)]">IPMCC</span>
          )}
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
        {navSections.map((section, sectionIndex) => (
          <div key={sectionIndex} className={sectionIndex > 0 ? 'mt-4 pt-4 border-t border-[var(--border-subtle)]' : ''}>
            {section.title && !sidebarCollapsed && (
              <h3 className="px-3 mb-2 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                {section.title}
              </h3>
            )}
            {section.items.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 rounded-lg transition-colors',
                    'hover:bg-[var(--bg-elevated)]',
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
                    sidebarCollapsed && 'justify-center'
                  )}
                  title={sidebarCollapsed ? item.name : undefined}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  {!sidebarCollapsed && (
                    <span className="text-sm flex-1">{item.name}</span>
                  )}
                  {!sidebarCollapsed && item.badge && (
                    <span className="text-xs px-1.5 py-0.5 bg-yellow-500/20 text-yellow-500 rounded font-medium">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Collapse Toggle */}
      <div className="p-2 border-t border-[var(--border-subtle)]">
        <button
          onClick={toggleSidebar}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors',
            'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]',
            sidebarCollapsed && 'justify-center'
          )}
        >
          <ChevronLeft
            className={cn(
              'w-5 h-5 transition-transform',
              sidebarCollapsed && 'rotate-180'
            )}
          />
          {!sidebarCollapsed && <span className="text-sm">Collapse</span>}
        </button>
      </div>
    </aside>
  );
}
