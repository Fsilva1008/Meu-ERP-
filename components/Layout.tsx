'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { LogIn, LogOut, Package, ShoppingCart, LayoutDashboard, User as UserIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import { User } from '@supabase/supabase-js';

export default function Layout({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();

  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
      setLoading(false);
    };

    getSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    });
  };

  const logout = async () => {
    await supabase.auth.signOut();
  };

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
        <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 p-8 shadow-xl border border-slate-200 dark:border-slate-800">
          <div className="flex flex-col items-center gap-6">
            <div className="rounded-2xl bg-primary/10 p-4 text-primary">
              <Package size={48} />
            </div>
            <div className="text-center">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">NexGen ERP</h1>
              <p className="text-slate-500 dark:text-slate-400 mt-2">Entre com sua conta para acessar o sistema</p>
            </div>
            <button
              onClick={signInWithGoogle}
              className="flex w-full items-center justify-center gap-3 rounded-xl bg-primary px-6 py-3 font-bold text-white transition-all hover:bg-blue-700 active:scale-95"
            >
              <LogIn size={20} />
              Entrar com Google
            </button>
          </div>
        </div>
      </div>
    );
  }

  const navItems = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'PDV', href: '/pos', icon: ShoppingCart },
    { name: 'Produtos', href: '/products', icon: Package },
  ];

  const userPhoto = user.user_metadata?.avatar_url;
  const userName = user.user_metadata?.full_name || user.email;

  return (
    <div className="flex h-screen w-full flex-col bg-slate-50 dark:bg-slate-950 overflow-hidden">
      <header className="flex h-16 items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 shrink-0">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2 text-primary">
            <Package size={28} />
            <span className="text-xl font-bold text-slate-900 dark:text-white">NexGen ERP</span>
          </Link>
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  pathname === item.href
                    ? 'bg-primary/10 text-primary'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <item.icon size={18} />
                {item.name}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 rounded-full bg-slate-100 dark:bg-slate-800 px-3 py-1.5">
            <div className="h-6 w-6 rounded-full bg-primary/20 text-primary flex items-center justify-center overflow-hidden relative">
              {userPhoto ? (
                <Image src={userPhoto} alt={userName || ''} width={24} height={24} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <UserIcon size={14} />
              )}
            </div>
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 hidden sm:block">
              {userName?.split(' ')[0]}
            </span>
          </div>
          <button
            onClick={logout}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-600 dark:text-slate-400 dark:hover:bg-red-900/20 transition-colors"
            title="Sair"
          >
            <LogOut size={20} />
          </button>
        </div>
      </header>
      <main className="flex-1 overflow-hidden">
        {children}
      </main>
    </div>
  );
}
