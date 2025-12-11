import { GraphQLClient, gql } from "graphql-request";

const SUBGRAPH_URL =
    process.env.NEXT_PUBLIC_SUBGRAPH_URL || "http://localhost:8000/subgraphs/name/tifa";

export const client = new GraphQLClient(SUBGRAPH_URL);

// Metrics query
export const METRICS_QUERY = gql`
  query AnalyticsMetrics {
    invoices {
      id
      status
      amount
      createdAt
    }
    financed: collateralPositions {
      id
      invoice {
        id
      }
      timestamp
    }
    events: invoiceEvents(orderBy: timestamp, orderDirection: desc, first: 15) {
      id
      eventType
      invoiceId
      tokenId
      amount
      timestamp
      txHash
    }
  }
`;

export async function fetchAnalytics() {
    return client.request(METRICS_QUERY);
}
