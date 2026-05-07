'use client';

import React from 'react';
import { Sidebar } from './Sidebar';
import { MobileAdminNav } from './MobileAdminNav';

export function AdminChrome({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Sidebar />
      <MobileAdminNav />
      <div className="min-h-screen lg:pl-72">{children}</div>
    </>
  );
}
