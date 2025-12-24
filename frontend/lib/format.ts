export function formatAmount(amount: string | number | bigint, currency = "TRY") {
    try {
        // Safely convert BigInt, number, or string to number
        let num: number;
        if (typeof amount === 'bigint') {
            num = Number(amount);
        } else if (typeof amount === 'number') {
            num = amount;
        } else {
            num = Number(amount);
        }
        
        if (Number.isNaN(num)) return String(amount);
        
        // Format with appropriate decimal places
        // For currency, use 2 decimals, but preserve significant digits
        const formatted = new Intl.NumberFormat("tr-TR", {
            style: "currency",
            currency,
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(num);
        
        return formatted;
    } catch {
        return String(amount);
    }
}

export function formatDate(date: string | Date, includeTime = false) {
    try {
        const dateObj = typeof date === "string" ? new Date(date) : date;
        if (includeTime) {
            return dateObj.toLocaleString("en-US", {
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
            }) + " UTC";
        }
        return dateObj.toLocaleDateString("tr-TR", {
            year: "numeric",
            month: "short",
            day: "numeric",
        });
    } catch {
        return typeof date === "string" ? date : date.toString();
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
