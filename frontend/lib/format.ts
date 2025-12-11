export function formatAmount(amount: string, currency = "TRY") {
    try {
        const num = Number(amount);
        if (Number.isNaN(num)) return amount;
        return new Intl.NumberFormat("tr-TR", {
            style: "currency",
            currency,
        }).format(num);
    } catch {
        return amount;
    }
}

export function formatDate(date: string) {
    try {
        return new Date(date).toLocaleDateString("tr-TR", {
            year: "numeric",
            month: "short",
            day: "numeric",
        });
    } catch {
        return date;
    }
}

export function statusColor(status: string): string {
    switch (status) {
        case "ISSUED":
            return "#0ea5e9"; // Sky 500
        case "TOKENIZED":
            return "#a855f7"; // Purple 500
        case "FINANCED":
            return "#22c55e"; // Green 500
        case "PARTIALLY_PAID":
            return "#f97316"; // Orange 500
        case "PAID":
            return "#16a34a"; // Green 600
        case "DEFAULTED":
            return "#ef4444"; // Red 500
        default:
            return "#6b7280"; // Gray 500
    }
}
