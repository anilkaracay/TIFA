import { GraphQLClient, gql } from 'graphql-request';
import { env } from './env';

const client = new GraphQLClient(env.SUBGRAPH_URL);

const ACTIVE_INVOICES_QUERY = gql`
  query ActiveInvoices {
    invoices(where: { status_not: "PAID" }, first: 200) {
      id
      invoiceIdOnChain: id
      externalId: id
      tokenId
      tokenAddress
      amount
      cumulativePaid
      dueDate
      status
      isFinanced
      issuer
      debtor
    }
  }
`;

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
    const data = await client.request<{ invoices: SubgraphInvoice[] }>(ACTIVE_INVOICES_QUERY);
    return data.invoices;
  } catch (error) {
    console.error("Error fetching from subgraph:", error);
    return [];
  }
}
