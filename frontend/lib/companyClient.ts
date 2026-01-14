const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";

export type Company = {
    id: string;
    externalId: string | null;
    name: string | null;
    createdAt: string;
    updatedAt: string;
};

export async function fetchCompanies(): Promise<Company[]> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

    try {
        const res = await fetch(`${BACKEND_URL}/companies`, {
            next: { revalidate: 30 },
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        if (!res.ok) {
            const errorText = await res.text();
            console.error('[CompanyClient] Failed to fetch companies:', res.status, errorText);
            throw new Error(`Failed to fetch companies: ${res.status} ${res.statusText}`);
        }
        const data = await res.json();
        return data;
    } catch (error: any) {
        clearTimeout(timeoutId);
        console.error('[CompanyClient] Error fetching companies:', error);
        throw error;
    }
}

export type CashflowBucket = {
    date: string;
    expectedInflow: string;
    expectedOutflow: string;
    net: string;
};

export type CashflowResponse = {
    companyId: string;
    horizonDays: number;
    generatedAt: string;
    buckets: CashflowBucket[];
    summary: {
        totalExpectedInflow: string;
        totalExpectedOutflow: string;
        totalNet: string;
    };
};

export async function fetchCashflow(companyId: string): Promise<CashflowResponse> {
    const res = await fetch(`${BACKEND_URL}/companies/${companyId}/cashflow`, {
        next: { revalidate: 10 },
    });
    if (!res.ok) throw new Error("Failed to fetch cashflow");
    return res.json();
}
