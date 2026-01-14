import React from 'react';
import InvoicesClient from './InvoicesClient';
import { fetchInvoices, fetchPoolLimits, fetchPoolOverview } from '../../lib/backendClient';
import { fetchCompanies } from '../../lib/companyClient';

// Force dynamic rendering since we are fetching real-time data
export const dynamic = 'force-dynamic';

export default async function InvoicesPage() {
    // Fetch data in parallel
    const [invoices, companies, poolLimits, poolOverview] = await Promise.all([
        fetchInvoices().catch(err => {
            console.error("Failed to fetch invoices:", err);
            return [];
        }),
        fetchCompanies().catch(err => {
            console.error("Failed to fetch companies:", err);
            return [];
        }),
        fetchPoolLimits().catch(err => {
            console.error("Failed to fetch pool limits:", err);
            return undefined;
        }),
        fetchPoolOverview().catch(err => {
            console.error("Failed to fetch pool overview:", err);
            return undefined;
        })
    ]);

    return (
        <InvoicesClient
            initialInvoices={invoices}
            initialCompanies={companies}
            initialPoolLimits={poolLimits}
            initialPoolOverview={poolOverview}
        />
    );
}
