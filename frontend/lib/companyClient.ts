const BACKEND_URL = "http://localhost:4000";

export type Company = {
    id: string;
    externalId: string | null;
    name: string | null;
    createdAt: string;
    updatedAt: string;
};

export async function fetchCompanies(): Promise<Company[]> {
    const res = await fetch(`${BACKEND_URL}/companies`, { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to fetch companies");
    return res.json();
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
        cache: "no-store",
    });
    if (!res.ok) throw new Error("Failed to fetch cashflow");
    return res.json();
}
