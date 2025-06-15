'use client';

import { ReactNode } from 'react';
import { SidebarProvider } from '@/components/ui/sidebar';
import { PlateEditor } from './editor/plate-editor';
import { ThemeProvider } from 'next-themes';

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >


      {children}

    </ThemeProvider>
  );
}
