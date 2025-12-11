import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import "../styles/globals.css";
import Layout from "../components/Layout";

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
    title: 'TIFA - Trade Invoice Finance Agent',
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
                <Providers>
                    <Layout>{children}</Layout>
                </Providers>
            </body>
        </html>
    )
}
