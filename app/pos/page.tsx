'use client';

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Search, Plus, Minus, Trash2, CreditCard, Banknote, CheckCircle, XCircle, ShoppingCart, Package, User } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Image from 'next/image';

interface Product {
  id: string;
  name: string;
  sku: string;
  price: number;
  stock: number;
  image_url?: string;
}

interface CartItem extends Product {
  quantity: number;
}

export default function POSPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'cash'>('card');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [user, setUser] = useState<any>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchProducts();
    
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
    });

    const channel = supabase
      .channel('products_pos')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => {
        fetchProducts();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchProducts = async () => {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('name', { ascending: true });
    
    if (error) {
      console.error('Error fetching products:', error);
      return;
    }
    setProducts(data || []);
  };

  const addToCart = (product: Product) => {
    if (product.stock <= 0) {
      alert('Produto sem estoque!');
      return;
    }

    setCart((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) {
          alert('Estoque insuficiente!');
          return prev;
        }
        return prev.map((item) =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { ...product, quantity: 1 }];
    });
    setSearchTerm('');
    searchInputRef.current?.focus();
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const newQty = Math.max(1, item.quantity + delta);
          const product = products.find((p) => p.id === id);
          if (product && newQty > product.stock) {
            alert('Estoque insuficiente!');
            return item;
          }
          return { ...item, quantity: newQty };
        }
        return item;
      })
    );
  };

  const removeFromCart = (id: string) => {
    setCart((prev) => prev.filter((item) => item.id !== id));
  };

  const subtotal = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);
  const tax = subtotal * 0.08;
  const discount = 0;
  const total = subtotal + tax - discount;

  const finalizeSale = async () => {
    if (cart.length === 0) return;
    setIsProcessing(true);

    try {
      // 1. Create Sale record
      const { data: saleData, error: saleError } = await supabase
        .from('sales')
        .insert([{
          subtotal,
          tax,
          discount,
          total,
          payment_method: paymentMethod,
          operator: user?.user_metadata?.full_name || user?.email || 'Unknown',
        }])
        .select()
        .single();

      if (saleError) throw saleError;

      // 2. Create Sale Items
      const saleItems = cart.map((item) => ({
        sale_id: saleData.id,
        product_id: item.id,
        name: item.name,
        qty: item.quantity,
        price: item.price,
        total: item.price * item.quantity,
      }));

      const { error: itemsError } = await supabase
        .from('sale_items')
        .insert(saleItems);

      if (itemsError) throw itemsError;

      // 3. Update Stock for each product
      for (const item of cart) {
        const { error: stockError } = await supabase
          .from('products')
          .update({ stock: item.stock - item.quantity })
          .eq('id', item.id);
        
        if (stockError) throw stockError;
      }

      setCart([]);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (error) {
      console.error('Error finalizing sale:', error);
      alert('Erro ao finalizar venda.');
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredProducts = searchTerm
    ? products.filter(
        (p) =>
          p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          p.sku.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : [];

  return (
    <div className="flex h-full gap-6 p-6 overflow-hidden">
      {/* Left Side: Cart & Search */}
      <div className="flex flex-1 flex-col gap-6 overflow-hidden">
        <div className="relative shrink-0">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={24} />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Escaneie o código ou busque produtos (Alt+S)..."
            className="w-full rounded-2xl border border-slate-200 bg-white py-4 pl-12 pr-4 text-lg outline-none focus:ring-2 focus:ring-primary dark:border-slate-800 dark:bg-slate-900 dark:text-white transition-all shadow-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          
          {/* Search Results Dropdown */}
          <AnimatePresence>
            {searchTerm && filteredProducts.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="absolute left-0 right-0 top-full z-50 mt-2 max-h-96 overflow-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl dark:border-slate-800 dark:bg-slate-900"
              >
                {filteredProducts.map((product) => (
                  <button
                    key={product.id}
                    onClick={() => addToCart(product)}
                    className="flex w-full items-center justify-between rounded-xl p-3 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 overflow-hidden relative">
                        {product.image_url ? (
                          <Image src={product.image_url} alt={product.name} fill className="object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <Package size={24} />
                        )}
                      </div>
                      <div className="text-left">
                        <p className="font-bold text-slate-900 dark:text-white">{product.name}</p>
                        <p className="text-xs text-slate-500 font-mono">{product.sku}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-primary">R$ {product.price.toFixed(2)}</p>
                      <p className={`text-xs ${product.stock < 10 ? 'text-red-500' : 'text-slate-500'}`}>
                        Estoque: {product.stock}
                      </p>
                    </div>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex-1 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 shadow-sm flex flex-col">
          <div className="flex-1 overflow-auto">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4 w-16"></th>
                  <th className="px-6 py-4">Descrição do Item</th>
                  <th className="px-6 py-4 text-center">Qtd</th>
                  <th className="px-6 py-4 text-right">Preço</th>
                  <th className="px-6 py-4 text-right">Total</th>
                  <th className="px-6 py-4 text-center w-16"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {cart.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="h-12 w-12 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 overflow-hidden relative">
                        {item.image_url ? (
                          <Image src={item.image_url} alt={item.name} fill className="object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <Package size={20} />
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-900 dark:text-white">{item.name}</div>
                      <div className="text-xs text-slate-400 italic">SKU: {item.sku}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-3">
                        <button
                          onClick={() => updateQuantity(item.id, -1)}
                          className="h-8 w-8 rounded-full border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-primary hover:text-white transition-all dark:border-slate-700"
                        >
                          <Minus size={14} />
                        </button>
                        <span className="w-8 text-center font-bold text-slate-900 dark:text-white">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.id, 1)}
                          className="h-8 w-8 rounded-full border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-primary hover:text-white transition-all dark:border-slate-700"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right font-medium text-slate-600 dark:text-slate-400">
                      R$ {item.price.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-slate-900 dark:text-white">
                      R$ {(item.price * item.quantity).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => removeFromCart(item.id)}
                        className="text-slate-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
                {cart.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-20 text-center">
                      <div className="flex flex-col items-center gap-4 text-slate-400">
                        <ShoppingCart size={48} strokeWidth={1.5} />
                        <p className="text-lg font-medium">Carrinho vazio</p>
                        <p className="text-sm">Busque produtos acima para começar a venda</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Right Side: Summary & Checkout */}
      <div className="w-96 flex flex-col gap-6 shrink-0">
        <div className="flex flex-col rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 dark:border-slate-800">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6">Resumo da Venda</h3>
            <div className="space-y-4">
              <div className="flex justify-between text-slate-500 dark:text-slate-400">
                <span>Subtotal</span>
                <span className="font-medium">R$ {subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-500 dark:text-slate-400">
                <span>Imposto (8%)</span>
                <span className="font-medium">R$ {tax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-emerald-500">
                <span>Desconto</span>
                <span className="font-medium">-R$ {discount.toFixed(2)}</span>
              </div>
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-between items-end">
                <span className="text-slate-900 dark:text-white font-bold text-sm uppercase tracking-wider">Total a Pagar</span>
                <span className="text-primary font-black text-4xl">R$ {total.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div className="p-6">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Método de Pagamento</p>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => setPaymentMethod('card')}
                className={`flex h-20 flex-col items-center justify-center gap-2 rounded-2xl border-2 transition-all ${
                  paymentMethod === 'card'
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-slate-100 bg-slate-50 text-slate-400 hover:border-slate-200 dark:border-slate-800 dark:bg-slate-950'
                }`}
              >
                <CreditCard size={24} />
                <span className="text-xs font-bold uppercase">Cartão</span>
              </button>
              <button
                onClick={() => setPaymentMethod('cash')}
                className={`flex h-20 flex-col items-center justify-center gap-2 rounded-2xl border-2 transition-all ${
                  paymentMethod === 'cash'
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-slate-100 bg-slate-50 text-slate-400 hover:border-slate-200 dark:border-slate-800 dark:bg-slate-950'
                }`}
              >
                <Banknote size={24} />
                <span className="text-xs font-bold uppercase">Dinheiro</span>
              </button>
            </div>
          </div>

          <div className="p-6 bg-slate-50 dark:bg-slate-800/50 space-y-4">
            <button
              onClick={finalizeSale}
              disabled={cart.length === 0 || isProcessing}
              className="flex w-full h-16 items-center justify-center gap-3 rounded-2xl bg-primary text-xl font-bold text-white shadow-lg shadow-primary/20 transition-all hover:bg-blue-700 active:scale-95 disabled:opacity-50 disabled:grayscale"
            >
              {isProcessing ? (
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
              ) : (
                <>
                  <CheckCircle size={24} />
                  Finalizar Venda
                </>
              )}
            </button>
            
            <button
              onClick={() => setCart([])}
              disabled={cart.length === 0 || isProcessing}
              className="flex w-full h-12 items-center justify-center gap-2 rounded-xl bg-red-50 text-red-600 font-bold hover:bg-red-100 dark:bg-red-900/10 dark:text-red-400 transition-all disabled:opacity-50"
            >
              <XCircle size={18} />
              Cancelar Transação
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-dashed border-slate-300 p-4 dark:border-slate-700">
          <div className="flex items-center gap-2 text-slate-500 mb-3">
            <User size={16} />
            <span className="text-xs font-bold uppercase tracking-wider">Operador</span>
          </div>
          <p className="text-sm font-semibold text-slate-900 dark:text-white">
            {user?.user_metadata?.full_name || user?.email || 'Alex Chen'}
          </p>
          <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-tighter">Terminal #042 - Store Main</p>
        </div>
      </div>

      {/* Success Overlay */}
      <AnimatePresence>
        {showSuccess && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-primary/90 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="flex flex-col items-center gap-6 text-white text-center"
            >
              <div className="rounded-full bg-white p-6 text-primary shadow-2xl">
                <CheckCircle size={80} />
              </div>
              <div>
                <h2 className="text-4xl font-black uppercase tracking-tighter">Venda Finalizada!</h2>
                <p className="text-xl opacity-80 mt-2">O estoque foi atualizado com sucesso.</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
