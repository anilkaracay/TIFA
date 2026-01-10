export interface NetworkConfig {
    chainId: number;
    name: string;
    rpcUrl: string;
    explorerBaseUrl: string;
    nativeCurrencySymbol: string;
    x402Recipient?: string;
    key: string;
}

export const NETWORKS: Record<string, NetworkConfig> = {
    base_testnet: {
        key: 'base_testnet',
        chainId: 84532,
        name: 'Base Sepolia',
        rpcUrl: process.env.BASE_SEPOLIA_RPC || 'https://sepolia.base.org',
        explorerBaseUrl: 'https://sepolia.basescan.org',
        nativeCurrencySymbol: 'ETH',
    },
    mantle_testnet: {
        key: 'mantle_testnet',
        chainId: 5003,
        name: 'Mantle Sepolia',
        rpcUrl: process.env.MANTLE_TESTNET_RPC || 'https://rpc.sepolia.mantle.xyz',
        explorerBaseUrl: 'https://sepolia.mantlescan.xyz',
        nativeCurrencySymbol: 'MNT',
    }
};

export const DEFAULT_NETWORK = process.env.DEFAULT_NETWORK || 'base_testnet';

export function getNetwork(key?: string): NetworkConfig {
    const k = key || DEFAULT_NETWORK;
    const net = NETWORKS[k];
    if (!net) {
        throw new Error(`Network ${k} not found`);
    }
    return net;
}

export function getNetworkByChainId(chainId: number): NetworkConfig | undefined {
    return Object.values(NETWORKS).find(n => n.chainId === chainId);
}
