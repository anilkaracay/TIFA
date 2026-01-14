'use client';

import '@rainbow-me/rainbowkit/styles.css';
import {
    RainbowKitProvider,
    lightTheme,
} from '@rainbow-me/rainbowkit';
import { WagmiProvider } from 'wagmi';
import { mantleSepoliaTestnet } from 'wagmi/chains';
import {
    QueryClientProvider,
    QueryClient,
} from "@tanstack/react-query";
import { ToastProvider } from '../components/Toast';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { config } from '../lib/wagmi';

const queryClient = new QueryClient();

// Custom theme for RainbowKit ConnectButton - Modern gradient style
const customTheme = lightTheme({
    accentColor: '#2563eb',
    accentColorForeground: 'white',
    borderRadius: 'medium',
    fontStack: 'system',
    overlayBlur: 'small',
});

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <ErrorBoundary>
            <WagmiProvider config={config}>
                <QueryClientProvider client={queryClient}>
                    <RainbowKitProvider theme={customTheme} initialChain={mantleSepoliaTestnet}>
                        <ToastProvider>
                            {children}
                        </ToastProvider>
                    </RainbowKitProvider>
                </QueryClientProvider>
            </WagmiProvider>
        </ErrorBoundary>
    );
}
