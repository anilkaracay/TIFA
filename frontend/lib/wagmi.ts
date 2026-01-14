import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { baseSepolia, mantleSepoliaTestnet } from 'wagmi/chains';

export const config = getDefaultConfig({
    appName: 'Finance Platform',
    projectId: 'YOUR_PROJECT_ID',
    chains: [mantleSepoliaTestnet, baseSepolia],
    ssr: true,
});
