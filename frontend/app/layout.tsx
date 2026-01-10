import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import "../styles/globals.css";
import ConditionalLayout from "../components/ConditionalLayout";
import { ScrollPreservation } from "../components/ScrollPreservation";

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
    title: 'Trade Invoice Finance Agent',
    description: 'AI-Native RWA Finance Platform',
}

import { Providers } from "./providers";

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="en">
            <body className={inter.className}>
                <ScrollPreservation />
                <Providers>
                    <ConditionalLayout>{children}</ConditionalLayout>
                </Providers>
            </body>
        </html>
    )
}
