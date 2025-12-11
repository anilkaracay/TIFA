import { env } from './env';

// We reuse the interface but fetch from backend REST now
export interface SubgraphInvoice {
  id: string;
  invoiceIdOnChain: string;
  externalId: string;
  tokenId: string;
  tokenAddress: string;
  amount: string;
  cumulativePaid: string;
  dueDate: string;
  status: string;
  isFinanced: boolean;
  issuer: string;
  debtor: string;
}

export async function fetchActiveInvoices(): Promise<SubgraphInvoice[]> {
  try {
    // Fetch from Backend API
    const res = await fetch(`${env.BACKEND_URL || 'http://localhost:4000'}/invoices?status=all&limit=200`);
    const invoices = await res.json() as SubgraphInvoice[];

    // Backend returns "isFinanced" as boolean, ensuring types match if needed
    // Filter locally if needed, but backend status=all returns all. 
    // Agent logic filters for active ones usually. 
    // Let's filter out PAID ones just in case backend returns them.
    return invoices.filter((i: any) => i.status !== 'PAID');

  } catch (error) {
    console.error("Error fetching invoices from backend:", error);
    return [];
  }
}
