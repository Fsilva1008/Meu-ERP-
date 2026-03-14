import type {Metadata} from 'next';
import './globals.css'; // Global styles
import Layout from '@/components/Layout';

export const metadata: Metadata = {
  title: 'NexGen ERP - Sistema de Gestão',
  description: 'Sistema ERP moderno com PDV e Gestão de Produtos',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="pt-BR">
      <body suppressHydrationWarning>
        <Layout>{children}</Layout>
      </body>
    </html>
  );
}
