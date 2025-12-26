"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import useSWR from "swr";
import {
    fetchActiveInvoices,
    fetchAgentDecisions,
    fetchPoolState,
} from "../../lib/ai-analytics-api";
import { aggregateAILifecycleData, AILifecycleData } from "../../lib/ai-analytics";
import { UtilizationPoint } from "../../lib/ai-analytics-types";
import SlideLifecycleFlow from "./slides/SlideLifecycleFlow";
import SlideRiskLandscape from "./slides/SlideRiskLandscape";
import SlideFinancingIntelligence from "./slides/SlideFinancingIntelligence";
import SlidePoolStress from "./slides/SlidePoolStress";
import SlideDecisionVelocity from "./slides/SlideDecisionVelocity";
import CardBackgroundOverlay from "./CardBackgroundOverlay";

interface AILifecycleSliderProps {
    activeAgents?: number;
}

const SLIDE_COUNT = 5;

export default function AILifecycleSlider({ activeAgents = 0 }: AILifecycleSliderProps) {
    const STORAGE_KEY = "ai-lifecycle-slider-current-slide";

    // Initialize state from localStorage
    const [currentSlide, setCurrentSlide] = useState(() => {
        if (typeof window !== "undefined") {
            const saved = localStorage.getItem(STORAGE_KEY);
            return saved ? parseInt(saved, 10) : 0;
        }
        return 0;
    });

    const utilizationSeriesRef = useRef<UtilizationPoint[]>([]);
    const containerRef = useRef<HTMLDivElement>(null);

    // Persist currentSlide to localStorage whenever it changes
    useEffect(() => {
        if (typeof window !== "undefined") {
            localStorage.setItem(STORAGE_KEY, currentSlide.toString());
        }
    }, [currentSlide]);

    const { data: invoices } = useSWR("ai-analytics-invoices", fetchActiveInvoices, {
        shouldRetryOnError: false,
        revalidateOnFocus: false,
        dedupingInterval: 5000,
    });

    const { data: decisions } = useSWR("ai-analytics-decisions", () => fetchAgentDecisions(200), {
        shouldRetryOnError: false,
        revalidateOnFocus: false,
        dedupingInterval: 5000,
    });

    const { data: poolState } = useSWR("ai-analytics-pool", fetchPoolState, {
        shouldRetryOnError: false,
        revalidateOnFocus: false,
        dedupingInterval: 5000,
    });

    useEffect(() => {
        if (poolState) {
            const now = Date.now() / 1000;
            utilizationSeriesRef.current = [
                ...utilizationSeriesRef.current,
                { timestamp: now, value: poolState.utilizationPct },
            ].slice(-60);
        }
    }, [poolState]);

    const aggregatedData = useMemo<AILifecycleData | null>(() => {
        if (!invoices || !decisions || !poolState) return null;
        return aggregateAILifecycleData(invoices, decisions, poolState, utilizationSeriesRef.current, activeAgents);
    }, [invoices, decisions, poolState, activeAgents]);

    const goToSlide = (index: number, e: React.MouseEvent<HTMLButtonElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setCurrentSlide(index);
    };

    const nextSlide = (e: React.MouseEvent<HTMLButtonElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setCurrentSlide((prev) => (prev + 1) % SLIDE_COUNT);
    };

    const prevSlide = (e: React.MouseEvent<HTMLButtonElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setCurrentSlide((prev) => (prev - 1 + SLIDE_COUNT) % SLIDE_COUNT);
    };

    if (!aggregatedData) {
        return (
            <div style={{ padding: "40px", textAlign: "center", color: "#9ca3af", minHeight: "400px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div>
                    <div style={{ fontSize: "14px", marginBottom: "8px" }}>Loading AI analytics...</div>
                    <div style={{ fontSize: "12px", opacity: 0.7 }}>Fetching real-time data</div>
                </div>
            </div>
        );
    }

    const slides = [
        <SlideLifecycleFlow key="lifecycle" metrics={aggregatedData.lifecycle} />,
        <SlideRiskLandscape key="risk" metrics={aggregatedData.risk} />,
        <SlideFinancingIntelligence key="financing" metrics={aggregatedData.financing} />,
        <SlidePoolStress key="pool" metrics={aggregatedData.poolStress} />,
        <SlideDecisionVelocity key="velocity" metrics={aggregatedData.decisionVelocity} />,
    ];

    return (
        <div ref={containerRef} style={{ position: "relative", minHeight: "500px" }}>
            <CardBackgroundOverlay />
            <div style={{ position: "relative", zIndex: 2, padding: "0 50px 50px 50px", minHeight: "450px" }}>
                {slides[currentSlide]}
            </div>

            <button
                type="button"
                onClick={prevSlide}
                style={{
                    position: "absolute", left: "8px", top: "50%", transform: "translateY(-50%)", zIndex: 5,
                    background: "rgba(255, 255, 255, 0.95)", border: "1px solid #e5e7eb", borderRadius: "50%",
                    width: "36px", height: "36px", display: "flex", alignItems: "center", justifyContent: "center",
                    cursor: "pointer", fontSize: "16px", color: "#64748b", boxShadow: "0 2px 4px rgba(0, 0, 0, 0.08)",
                }}
                aria-label="Previous slide"
            >
                ‹
            </button>

            <button
                type="button"
                onClick={nextSlide}
                style={{
                    position: "absolute", right: "8px", top: "50%", transform: "translateY(-50%)", zIndex: 5,
                    background: "rgba(255, 255, 255, 0.95)", border: "1px solid #e5e7eb", borderRadius: "50%",
                    width: "36px", height: "36px", display: "flex", alignItems: "center", justifyContent: "center",
                    cursor: "pointer", fontSize: "16px", color: "#64748b", boxShadow: "0 2px 4px rgba(0, 0, 0, 0.08)",
                }}
                aria-label="Next slide"
            >
                ›
            </button>

            <div style={{
                position: "absolute", bottom: "12px", left: "50%", transform: "translateX(-50%)",
                display: "flex", gap: "8px", zIndex: 5, padding: "4px 8px",
                background: "rgba(255, 255, 255, 0.9)", borderRadius: "20px",
            }}>
                {Array.from({ length: SLIDE_COUNT }).map((_, idx) => (
                    <button
                        key={idx}
                        type="button"
                        onClick={(e) => goToSlide(idx, e)}
                        style={{
                            width: currentSlide === idx ? "24px" : "8px", height: "8px", borderRadius: "4px",
                            background: currentSlide === idx ? "#2563eb" : "#cbd5e1", border: "none",
                            cursor: "pointer", transition: "all 0.3s ease",
                        }}
                        aria-label={`Go to slide ${idx + 1}`}
                    />
                ))}
            </div>
        </div>
    );
}
