import React from 'react';
import OverviewClient from './OverviewClient';
import { fetchInvoices, fetchPoolOverview, fetchPoolLimits } from '../../lib/backendClient';

// Force dynamic rendering since we are fetching real-time data
export const dynamic = 'force-dynamic';

export default async function OverviewPage() {
    // Fetch data in parallel
    const [invoices, poolOverview, poolLimits] = await Promise.all([
        fetchInvoices().catch(err => {
            console.error("Failed to fetch invoices:", err);
            return [];
        }),
        fetchPoolOverview().catch(err => {
            console.error("Failed to fetch pool overview:", err);
            return undefined;
        }),
        fetchPoolLimits().catch(err => {
            console.error("Failed to fetch pool limits:", err);
            return undefined;
        })
    ]);

    return (
        <OverviewClient
            initialInvoices={invoices}
            initialPoolOverview={poolOverview}
            initialPoolLimits={poolLimits}
        />
    );
}
