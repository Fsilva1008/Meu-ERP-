'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { ShoppingCart, Package, TrendingUp, Users, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { motion } from 'motion/react';

export default function DashboardPage() {
  const [stats, setStats] = useState({
    totalSales: 0,
    totalProducts: 0,
    revenue: 0,
    lowStock: 0
  });

  const [recentSales, setRecentSales] = useState<any[]>([]);

  const fetchStats = React.useCallback(async () => {
    // Fetch products for total count and low stock
    const { data: products, error: pError } = await supabase
      .from('products')
      .select('stock');
    
    if (!pError && products) {
      setStats(prev => ({
        ...prev,
        totalProducts: products.length,
        lowStock: products.filter(p => p.stock < 10).length
      }));
    }

    // Fetch sales for total count and revenue
    const { data: sales, error: sError } = await supabase
      .from('sales')
      .select('total');
    
    if (!sError && sales) {
      const revenue = sales.reduce((acc, s) => acc + Number(s.total), 0);
      setStats(prev => ({
        ...prev,
        totalSales: sales.length,
        revenue
      }));
    }
  }, []);

  const fetchRecentSales = React.useCallback(async () => {
    const { data, error } = await supabase
      .from('sales')
      .select(`
        id,
        created_at,
        total,
        sale_items (count)
      `)
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (!error && data) {
      setRecentSales(data);
    }
  }, []);

  useEffect(() => {
    const loadData = async () => {
      await fetchStats();
      await fetchRecentSales();
    };
    loadData();

    const productsChannel = supabase
      .channel('dashboard_products')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => {
        fetchStats();
      })
      .subscribe();

    const salesChannel = supabase
      .channel('dashboard_sales')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales' }, () => {
        fetchStats();
        fetchRecentSales();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(productsChannel);
      supabase.removeChannel(salesChannel);
    };
  }, [fetchStats, fetchRecentSales]);

  const cards = [
    { name: 'Vendas Totais', value: stats.totalSales, icon: ShoppingCart, color: 'bg-blue-500', trend: '+12%', up: true },
    { name: 'Produtos em Estoque', value: stats.totalProducts, icon: Package, color: 'bg-purple-500', trend: '+2', up: true },
    { name: 'Receita Total', value: `R$ ${stats.revenue.toFixed(2)}`, icon: TrendingUp, color: 'bg-emerald-500', trend: '+8.4%', up: true },
    { name: 'Estoque Baixo', value: stats.lowStock, icon: Users, color: 'bg-orange-500', trend: '-3', up: false },
  ];

  return (
    <div className="flex h-full flex-col p-6 overflow-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Dashboard Overview</h1>
        <p className="text-slate-500 dark:text-slate-400">Bem-vindo ao NexGen ERP. Aqui está o resumo do seu negócio.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {cards.map((card, i) => (
          <motion.div
            key={card.name}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex items-center justify-between mb-4">
              <div className={`rounded-xl ${card.color} p-3 text-white shadow-lg shadow-current/20`}>
                <card.icon size={24} />
              </div>
              <div className={`flex items-center gap-1 text-xs font-bold ${card.up ? 'text-emerald-500' : 'text-orange-500'}`}>
                {card.trend}
                {card.up ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
              </div>
            </div>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{card.name}</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{card.value}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <h3 className="font-bold text-slate-900 dark:text-white">Vendas Recentes</h3>
            <button className="text-xs font-bold text-primary uppercase tracking-wider hover:underline">Ver Todas</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                <tr>
                  <th className="px-6 py-3">ID Venda</th>
                  <th className="px-6 py-3">Data</th>
                  <th className="px-6 py-3">Itens</th>
                  <th className="px-6 py-3">Total</th>
                  <th className="px-6 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {recentSales.map((sale) => (
                  <tr key={sale.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-6 py-4 font-mono text-xs text-slate-500">#{sale.id.slice(-6).toUpperCase()}</td>
                    <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
                      {new Date(sale.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
                      {sale.sale_items?.[0]?.count || 0} itens
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">
                      R$ {Number(sale.total).toFixed(2)}
                    </td>
                    <td className="px-6 py-4">
                      <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-bold text-emerald-600 uppercase dark:bg-emerald-900/20">
                        Concluída
                      </span>
                    </td>
                  </tr>
                ))}
                {recentSales.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-400 italic">Nenhuma venda registrada ainda.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 shadow-sm p-6">
          <h3 className="font-bold text-slate-900 dark:text-white mb-6">Ações Rápidas</h3>
          <div className="space-y-3">
            <button className="w-full flex items-center gap-4 rounded-xl border border-slate-100 p-4 text-left hover:border-primary hover:bg-primary/5 transition-all dark:border-slate-800">
              <div className="rounded-lg bg-blue-100 p-2 text-blue-600 dark:bg-blue-900/20">
                <ShoppingCart size={20} />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900 dark:text-white">Nova Venda</p>
                <p className="text-xs text-slate-500">Abrir o terminal de PDV</p>
              </div>
            </button>
            <button className="w-full flex items-center gap-4 rounded-xl border border-slate-100 p-4 text-left hover:border-primary hover:bg-primary/5 transition-all dark:border-slate-800">
              <div className="rounded-lg bg-purple-100 p-2 text-purple-600 dark:bg-purple-900/20">
                <Package size={20} />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900 dark:text-white">Cadastrar Produto</p>
                <p className="text-xs text-slate-500">Adicionar item ao estoque</p>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
