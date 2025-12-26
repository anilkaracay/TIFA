"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import Layout from "./Layout";

export default function ConditionalLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const [mounted, setMounted] = useState(false);
    
    useEffect(() => {
        setMounted(true);
    }, []);
    
    // Pages that have their own full-screen layout with navbar
    const fullScreenPages = ["/overview", "/invoices", "/", "/lp", "/analytics", "/agent", "/x402"];
    const isFullScreenPage = pathname && (fullScreenPages.includes(pathname) || pathname.startsWith("/invoices/"));
    
    // During SSR, always render children directly (Providers is already in root layout)
    // This ensures WagmiProvider is available for all pages
    if (!mounted) {
        // SSR: Render children directly - Providers is already wrapping in root layout
        return <>{children}</>;
    }
    
    // Client-side: For full-screen pages, render children directly
    // For other pages, use the standard Layout with sidebar
    if (isFullScreenPage) {
        return <>{children}</>;
    }
    
    // For all other pages, use the standard Layout
    return <Layout>{children}</Layout>;
}

