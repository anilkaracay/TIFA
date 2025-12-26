import { env } from '../env';

export interface X402Config {
  enabled: boolean;
  chain: string;
  currency: string;
  recipient: string;
  ttlSeconds: number;
}

export const x402Config: X402Config = {
  enabled: process.env.X402_ENABLED === 'true',
  chain: process.env.X402_CHAIN || 'base',
  currency: process.env.X402_CURRENCY || 'USDC',
  recipient: process.env.X402_RECIPIENT || '',
  ttlSeconds: Number(process.env.X402_TTL_SECONDS || '300'),
};

export function validateX402Config(): void {
  if (x402Config.enabled) {
    if (!x402Config.recipient || !x402Config.recipient.match(/^0x[a-fA-F0-9]{40}$/)) {
      throw new Error('X402_ENABLED=true requires valid X402_RECIPIENT (Ethereum address)');
    }
    if (x402Config.ttlSeconds < 60 || x402Config.ttlSeconds > 3600) {
      throw new Error('X402_TTL_SECONDS must be between 60 and 3600 seconds');
    }
  }
}

