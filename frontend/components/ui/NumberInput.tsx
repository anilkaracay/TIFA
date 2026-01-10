"use client";

import React, { useState, useRef, useEffect } from "react";

interface NumberInputProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    disabled?: boolean;
    error?: boolean;
    min?: number;
    max?: number;
    step?: number;
    className?: string;
    style?: React.CSSProperties;
}

const styles = {
    container: {
        position: "relative" as const,
        width: "100%",
    },
    inputWrapper: {
        position: "relative" as const,
        display: "flex",
        alignItems: "center" as const,
    },
    input: {
        width: "100%",
        padding: "10px 56px 10px 16px",
        fontSize: "14px",
        lineHeight: "20px",
        fontWeight: 500,
        color: "#0f172a",
        background: "rgba(255, 255, 255, 0.98)",
        border: "1px solid rgba(0, 0, 0, 0.06)",
        borderRadius: "8px",
        transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
        boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.02)",
        letterSpacing: "-0.01em",
        fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        appearance: "textfield" as const,
    },
    inputHover: {
        borderColor: "rgba(37, 99, 235, 0.3)",
        boxShadow: "0 2px 6px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.04)",
    },
    inputFocus: {
        borderColor: "#2563eb",
        boxShadow: "0 0 0 3px rgba(37, 99, 235, 0.1), 0 2px 6px rgba(0, 0, 0, 0.08)",
        outline: "none",
    },
    inputDisabled: {
        opacity: 0.5,
        cursor: "not-allowed",
        background: "#f9fafb",
    },
    inputError: {
        borderColor: "#dc2626",
        boxShadow: "0 0 0 3px rgba(220, 38, 38, 0.1)",
    },
    stepperContainer: {
        position: "absolute" as const,
        right: "8px",
        top: "50%",
        transform: "translateY(-50%)",
        display: "flex",
        flexDirection: "column" as const,
        gap: "2px",
        zIndex: 1,
    },
    stepperButton: {
        width: "20px",
        height: "14px",
        display: "flex",
        alignItems: "center" as const,
        justifyContent: "center" as const,
        background: "rgba(255, 255, 255, 0.98)",
        border: "1px solid rgba(0, 0, 0, 0.06)",
        borderRadius: "4px",
        cursor: "pointer",
        transition: "all 0.15s cubic-bezier(0.4, 0, 0.2, 1)",
        padding: 0,
        margin: 0,
    },
    stepperButtonHover: {
        background: "rgba(15, 23, 42, 0.04)",
        borderColor: "rgba(37, 99, 235, 0.3)",
    },
    stepperButtonActive: {
        background: "rgba(37, 99, 235, 0.1)",
        borderColor: "#2563eb",
        transform: "scale(0.95)",
    },
    stepperButtonDisabled: {
        opacity: 0.3,
        cursor: "not-allowed",
    },
    stepperIcon: {
        width: "10px",
        height: "10px",
        stroke: "#64748b",
        strokeWidth: "2",
        strokeLinecap: "round" as const,
        strokeLinejoin: "round" as const,
        fill: "none",
    },
};

export function NumberInput({
    value,
    onChange,
    placeholder = "0",
    disabled = false,
    error = false,
    min,
    max,
    step = 1,
    className = "",
    style = {},
}: NumberInputProps) {
    const [isHovered, setIsHovered] = useState(false);
    const [isFocused, setIsFocused] = useState(false);
    const [isIncrementing, setIsIncrementing] = useState(false);
    const [isDecrementing, setIsDecrementing] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    const numValue = parseFloat(value) || 0;
    const canIncrement = max === undefined || numValue < max;
    const canDecrement = min === undefined || numValue > min;

    const handleIncrement = () => {
        if (disabled || !canIncrement) return;
        const newValue = numValue + step;
        const finalValue = max !== undefined ? Math.min(newValue, max) : newValue;
        onChange(finalValue.toString());
    };

    const handleDecrement = () => {
        if (disabled || !canDecrement) return;
        const newValue = numValue - step;
        const finalValue = min !== undefined ? Math.max(newValue, min) : newValue;
        onChange(finalValue.toString());
    };

    const startIncrement = () => {
        if (disabled || !canIncrement) return;
        setIsIncrementing(true);
        handleIncrement();
        intervalRef.current = setInterval(() => {
            handleIncrement();
        }, 100);
    };

    const startDecrement = () => {
        if (disabled || !canDecrement) return;
        setIsDecrementing(true);
        handleDecrement();
        intervalRef.current = setInterval(() => {
            handleDecrement();
        }, 100);
    };

    const stopStepper = () => {
        setIsIncrementing(false);
        setIsDecrementing(false);
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
    };

    useEffect(() => {
        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, []);

    const inputStyle = {
        ...styles.input,
        ...(isHovered && !disabled ? styles.inputHover : {}),
        ...(isFocused && !disabled ? styles.inputFocus : {}),
        ...(disabled ? styles.inputDisabled : {}),
        ...(error ? styles.inputError : {}),
        ...style,
    };

    return (
        <div className={className} style={styles.container}>
            <div style={styles.inputWrapper}>
                <input
                    ref={inputRef}
                    type="number"
                    value={value}
                    onChange={(e) => {
                        const newValue = e.target.value;
                        if (newValue === "" || newValue === "-") {
                            onChange(newValue);
                            return;
                        }
                        const num = parseFloat(newValue);
                        if (isNaN(num)) {
                            onChange("");
                            return;
                        }
                        let finalValue = num;
                        if (min !== undefined && finalValue < min) finalValue = min;
                        if (max !== undefined && finalValue > max) finalValue = max;
                        onChange(finalValue.toString());
                    }}
                    placeholder={placeholder}
                    disabled={disabled}
                    min={min}
                    max={max}
                    step={step}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    onMouseEnter={() => setIsHovered(true)}
                    onMouseLeave={() => setIsHovered(false)}
                    style={inputStyle}
                />
                <div style={styles.stepperContainer}>
                    <button
                        type="button"
                        onClick={handleIncrement}
                        onMouseDown={startIncrement}
                        onMouseUp={stopStepper}
                        disabled={disabled || !canIncrement}
                        style={{
                            ...styles.stepperButton,
                            ...(isIncrementing ? styles.stepperButtonActive : {}),
                            ...(disabled || !canIncrement ? styles.stepperButtonDisabled : {}),
                        }}
                        onMouseEnter={(e) => {
                            if (!disabled && canIncrement) {
                                Object.assign(e.currentTarget.style, styles.stepperButtonHover);
                            }
                        }}
                        onMouseLeave={(e) => {
                            stopStepper();
                            if (!isIncrementing) {
                                e.currentTarget.style.background = "rgba(255, 255, 255, 0.98)";
                                e.currentTarget.style.borderColor = "rgba(0, 0, 0, 0.06)";
                            }
                        }}
                    >
                        <svg style={styles.stepperIcon} viewBox="0 0 12 12">
                            <path d="M6 3L6 9M3 6L9 6" />
                        </svg>
                    </button>
                    <button
                        type="button"
                        onClick={handleDecrement}
                        onMouseDown={startDecrement}
                        onMouseUp={stopStepper}
                        disabled={disabled || !canDecrement}
                        style={{
                            ...styles.stepperButton,
                            ...(isDecrementing ? styles.stepperButtonActive : {}),
                            ...(disabled || !canDecrement ? styles.stepperButtonDisabled : {}),
                        }}
                        onMouseEnter={(e) => {
                            if (!disabled && canDecrement) {
                                Object.assign(e.currentTarget.style, styles.stepperButtonHover);
                            }
                        }}
                        onMouseLeave={(e) => {
                            stopStepper();
                            if (!isDecrementing) {
                                e.currentTarget.style.background = "rgba(255, 255, 255, 0.98)";
                                e.currentTarget.style.borderColor = "rgba(0, 0, 0, 0.06)";
                            }
                        }}
                    >
                        <svg style={styles.stepperIcon} viewBox="0 0 12 12">
                            <path d="M3 6L9 6" />
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    );
}

