"use client";

export default function InvoicesLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    // Return children without wrapping in Layout component
    // This allows Invoices page to have its own full-screen layout
    return <>{children}</>;
}









