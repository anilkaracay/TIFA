"use client";

import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { CashflowResponse } from '../lib/companyClient';

ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend
);

export function CashflowChart({ data }: { data: CashflowResponse }) {
    const chartData = {
        labels: data.buckets.map(b => b.date),
        datasets: [
            {
                label: 'Expected Inflow',
                data: data.buckets.map(b => Number(b.expectedInflow)),
                backgroundColor: 'rgba(52, 211, 153, 0.6)', // Greenish
            }
        ],
    };

    const options = {
        responsive: true,
        plugins: {
            legend: {
                position: 'top' as const,
                labels: { color: '#94a3b8' }
            },
            title: {
                display: false,
            },
        },
        scales: {
            x: {
                ticks: { color: '#94a3b8' },
                grid: { color: '#334155' }
            },
            y: {
                ticks: { color: '#94a3b8' },
                grid: { color: '#334155' }
            }
        }
    };

    return <Bar options={options} data={chartData} />;
}
