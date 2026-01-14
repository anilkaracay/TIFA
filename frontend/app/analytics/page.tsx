import React from 'react';
import PortfolioAnalyticsClient from './PortfolioAnalyticsClient';
import { fetchPortfolioAnalytics } from '../../lib/backendClient';

// Force dynamic rendering since we are fetching real-time data
export const dynamic = 'force-dynamic';

export default async function AnalyticsPage() {
    // Fetch data
    const data = await fetchPortfolioAnalytics().catch(err => {
        console.error("Failed to fetch portfolio analytics:", err);
        return undefined;
    });

    return (
        <PortfolioAnalyticsClient
            initialData={data}
        />
    );
}
