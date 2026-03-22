'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  HomeIcon,
  UsersIcon,
  CalendarDaysIcon,
  TrophyIcon,
  ExclamationTriangleIcon,
  ArrowDownTrayIcon,
  FolderIcon,
  RocketLaunchIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline';

interface SidebarItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const navigation: SidebarItem[] = [
  { name: 'Dashboard', href: '/', icon: HomeIcon },
];

const files: SidebarItem[] = [
  { name: 'participants-status.json', href: '/participants-status', icon: UsersIcon },
  { name: 'bbb26.json', href: '/bbb26', icon: CalendarDaysIcon },
  { name: 'paredao-results.json', href: '/paredao-results', icon: TrophyIcon },
  { name: 'followers-status.json', href: '/followers', icon: UsersIcon },
  { name: 'products-status.json', href: '/products', icon: UsersIcon },
];

const tools: SidebarItem[] = [
  { name: '📊 Queridômetro', href: '/queridometro', icon: ChartBarIcon },
  { name: '👥 Resumo do Jogo', href: '/resumodojogo', icon: UsersIcon },
  { name: 'Problemas', href: '/issues', icon: ExclamationTriangleIcon },
  { name: 'Exportar', href: '/export', icon: ArrowDownTrayIcon },
  { name: 'Backups', href: '/backups', icon: FolderIcon },
];

function isActivePath(pathname: string, href: string) {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

// Centraliza a decisão de prefetch (evita engano por seção)
function shouldPrefetch(href: string) {
  // Ex: desabilitar em telas pesadas
  if (href === '/bbb26') return false;
  return true;
}

function NavSection({
  items,
  pathname,
  sectionTitle,
}: {
  items: SidebarItem[];
  pathname: string;
  sectionTitle?: string;
}) {
  return (
    <li>
      {sectionTitle ? (
        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-2">
          {sectionTitle}
        </div>
      ) : null}

      <ul role="list" className={['-mx-2 space-y-1', sectionTitle ? 'mt-2' : ''].join(' ')}>
        {items.map((item) => {
          const active = isActivePath(pathname, item.href);
          const isPublish = item.href === '/publish';

          const base =
            'group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2';

          const linkClass = [
            base,
            isPublish
              ? 'bg-indigo-600 text-white hover:bg-indigo-500'
              : active
                ? 'bg-indigo-50 text-indigo-600'
                : 'text-gray-700 hover:text-indigo-600 hover:bg-gray-50',
          ].join(' ');

          const iconClass = [
            'h-6 w-6 shrink-0',
            isPublish
              ? 'text-white'
              : active
                ? 'text-indigo-600'
                : 'text-gray-400 group-hover:text-indigo-600',
          ].join(' ');

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                prefetch={shouldPrefetch(item.href)}
                aria-current={active ? 'page' : undefined}
                className={linkClass}
              >
                <item.icon className={iconClass} aria-hidden="true" />
                <span className="truncate">{item.name}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </li>
  );
}

export const Sidebar: React.FC = () => {
  const pathname = usePathname();

  return (
    <div className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-72 lg:flex-col">
      <div className="flex grow flex-col gap-y-5 overflow-y-auto bg-white px-6 pb-4 border-r border-gray-200">
        {/* Logo */}
        <div className="flex h-16 shrink-0 items-center">
          <h1 className="text-xl font-bold text-gray-900">Admin BBB26</h1>
        </div>

        {/* Navigation */}
        <nav className="flex flex-1 flex-col" aria-label="Navegação lateral">
          <ul role="list" className="flex flex-1 flex-col gap-y-7">
            <NavSection items={navigation} pathname={pathname} />
            <NavSection items={files} pathname={pathname} sectionTitle="Arquivos" />
            <NavSection items={tools} pathname={pathname} sectionTitle="Ferramentas" />
          </ul>
        </nav>

        {/* Footer */}
        <div className="mt-auto">
          <div className="text-xs text-gray-500 text-center">
            <p>Teclas rápidas:</p>
            <p>
              <kbd className="px-1 py-0.5 bg-gray-100 rounded text-xs">/</kbd> Busca
            </p>
            <p>
              <kbd className="px-1 py-0.5 bg-gray-100 rounded text-xs">Ctrl+S</kbd> Salvar
            </p>
            <p>
              <kbd className="px-1 py-0.5 bg-gray-100 rounded text-xs">Ctrl+Enter</kbd> Exportar
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};