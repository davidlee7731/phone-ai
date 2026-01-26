'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Phone,
  ShoppingBag,
  Calendar,
  Settings,
  Menu as MenuIcon,
  DollarSign,
} from 'lucide-react';
import clsx from 'clsx';

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Calls', href: '/calls', icon: Phone },
  { name: 'Orders', href: '/orders', icon: ShoppingBag },
  { name: 'Reservations', href: '/reservations', icon: Calendar },
  { name: 'Revenue', href: '/revenue', icon: DollarSign },
  { name: 'Menu', href: '/menu', icon: MenuIcon },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
      <div className="p-6 border-b border-gray-200">
        <h1 className="text-xl font-bold text-gray-900">Phone Agent AI</h1>
        <p className="text-sm text-gray-500 mt-1">Restaurant Dashboard</p>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {navigation.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.name}
              href={item.href}
              className={clsx(
                'flex items-center gap-3 px-3 py-2 rounded-lg transition-colors',
                isActive
                  ? 'bg-primary-50 text-primary-700 font-medium'
                  : 'text-gray-700 hover:bg-gray-100'
              )}
            >
              <Icon className="w-5 h-5" />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-gray-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-semibold">
            DR
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900">Demo Restaurant</p>
            <p className="text-xs text-gray-500">+1 (555) 123-4567</p>
          </div>
        </div>
      </div>
    </div>
  );
}
