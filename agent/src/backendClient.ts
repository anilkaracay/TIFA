import { env } from './env';
import { fetch } from 'undici';

export async function updateInvoiceStatus(invoiceId: string, status: string) {
    try {
        const res = await fetch(`${env.BACKEND_URL}/invoices/${invoiceId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status }),
        });

        if (!res.ok) {
            throw new Error(`Failed to update status: ${res.statusText}`);
        }

        return await res.json();
    } catch (e) {
        console.error(`Backend error (updateStatus):`, e);
        return null;
    }
}

export async function requestFinancing(invoiceId: string, amount?: string) {
    try {
        const res = await fetch(`${env.BACKEND_URL}/invoices/${invoiceId}/finance`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ amount }),
        });

        if (!res.ok) {
            // Don't throw for financing reqs (might be already financed), just log
            const err = await res.json() as any;
            console.warn(`Financing req failed for ${invoiceId}: ${err?.error || res.statusText}`);
            return null;
        }

        return await res.json();
    } catch (e) {
        console.error(`Backend error (requestFinancing):`, e);
        return null;
    }
}
