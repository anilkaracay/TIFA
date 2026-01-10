"use client";

import React, { useState, useRef, useEffect } from "react";

interface SelectOption {
    value: string;
    label: string;
    disabled?: boolean;
}

interface SelectProps {
    value: string;
    onChange: (value: string) => void;
    options: SelectOption[];
    placeholder?: string;
    disabled?: boolean;
    error?: boolean;
    className?: string;
    style?: React.CSSProperties;
}

const styles = {
    selectContainer: {
        position: "relative" as const,
        width: "100%",
    },
    selectButton: {
        width: "100%",
        padding: "10px 40px 10px 16px",
        fontSize: "14px",
        fontWeight: 500,
        color: "#0f172a",
        background: "rgba(255, 255, 255, 0.98)",
        border: "1px solid rgba(0, 0, 0, 0.06)",
        borderRadius: "8px",
        cursor: "pointer",
        transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
        boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.02)",
        display: "flex",
        alignItems: "center" as const,
        justifyContent: "space-between" as const,
        letterSpacing: "-0.01em",
        lineHeight: "20px",
        fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    },
    selectButtonHover: {
        borderColor: "rgba(37, 99, 235, 0.3)",
        boxShadow: "0 2px 6px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.04)",
    },
    selectButtonFocus: {
        borderColor: "#2563eb",
        boxShadow: "0 0 0 3px rgba(37, 99, 235, 0.1), 0 2px 6px rgba(0, 0, 0, 0.08)",
        outline: "none",
    },
    selectButtonDisabled: {
        opacity: 0.5,
        cursor: "not-allowed",
        background: "#f9fafb",
    },
    selectButtonError: {
        borderColor: "#dc2626",
        boxShadow: "0 0 0 3px rgba(220, 38, 38, 0.1)",
    },
    selectValue: {
        flex: 1,
        textAlign: "left" as const,
        color: "#0f172a",
    },
    selectPlaceholder: {
        color: "#9ca3af",
        fontWeight: 400,
    },
    selectArrow: {
        width: "12px",
        height: "12px",
        transition: "transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
        flexShrink: 0,
        marginLeft: "12px",
    },
    selectArrowOpen: {
        transform: "rotate(180deg)",
    },
    dropdown: {
        position: "absolute" as const,
        top: "calc(100% + 4px)",
        left: 0,
        right: 0,
        background: "#ffffff",
        border: "1px solid rgba(0, 0, 0, 0.06)",
        borderRadius: "8px",
        boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
        zIndex: 1000,
        maxHeight: "300px",
        overflowY: "auto" as const,
        overflowX: "hidden" as const,
        opacity: 0,
        transform: "translateY(-8px)",
        transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
        pointerEvents: "none" as const,
        // Custom scrollbar
        scrollbarWidth: "thin" as const,
        scrollbarColor: "rgba(100, 116, 139, 0.3) transparent",
    },
    dropdownOpen: {
        opacity: 1,
        transform: "translateY(0)",
        pointerEvents: "auto" as const,
    },
    option: {
        padding: "12px 16px",
        fontSize: "14px",
        fontWeight: 500,
        color: "#0f172a",
        cursor: "pointer",
        transition: "all 0.15s cubic-bezier(0.4, 0, 0.2, 1)",
        display: "flex",
        alignItems: "center" as const,
        gap: "8px",
        borderBottom: "1px solid rgba(0, 0, 0, 0.04)",
    },
    optionFirst: {
        borderTopLeftRadius: "8px",
        borderTopRightRadius: "8px",
    },
    optionLast: {
        borderBottom: "none",
        borderBottomLeftRadius: "8px",
        borderBottomRightRadius: "8px",
    },
    optionHover: {
        background: "rgba(15, 23, 42, 0.04)",
    },
    optionSelected: {
        background: "linear-gradient(135deg, rgba(37, 99, 235, 0.1) 0%, rgba(99, 102, 241, 0.1) 100%)",
        color: "#2563eb",
        fontWeight: 600,
    },
    optionDisabled: {
        opacity: 0.5,
        cursor: "not-allowed",
        color: "#9ca3af",
        fontStyle: "italic",
    },
    checkmark: {
        width: "16px",
        height: "16px",
        display: "flex",
        alignItems: "center" as const,
        justifyContent: "center" as const,
        flexShrink: 0,
    },
    emptyState: {
        padding: "16px",
        fontSize: "14px",
        color: "#9ca3af",
        textAlign: "center" as const,
        fontStyle: "italic",
    },
};

export function Select({
    value,
    onChange,
    options,
    placeholder = "Select an option...",
    disabled = false,
    error = false,
    className = "",
    style = {},
}: SelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const selectedOption = options.find(opt => opt.value === value);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        }

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [isOpen]);

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (!isOpen) return;

            const enabledOptions = options.filter(opt => !opt.disabled);
            const currentIndex = enabledOptions.findIndex(opt => opt.value === value);

            switch (event.key) {
                case "ArrowDown":
                    event.preventDefault();
                    const nextIndex = currentIndex < enabledOptions.length - 1 ? currentIndex + 1 : 0;
                    onChange(enabledOptions[nextIndex].value);
                    break;
                case "ArrowUp":
                    event.preventDefault();
                    const prevIndex = currentIndex > 0 ? currentIndex - 1 : enabledOptions.length - 1;
                    onChange(enabledOptions[prevIndex].value);
                    break;
                case "Enter":
                    event.preventDefault();
                    setIsOpen(false);
                    break;
                case "Escape":
                    event.preventDefault();
                    setIsOpen(false);
                    break;
            }
        };

        if (isOpen) {
            window.addEventListener("keydown", handleKeyDown);
        }

        return () => {
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [isOpen, options, value, onChange]);

    const handleSelect = (optionValue: string) => {
        if (options.find(opt => opt.value === optionValue)?.disabled) return;
        onChange(optionValue);
        setIsOpen(false);
    };

    const buttonStyle = {
        ...styles.selectButton,
        ...(isOpen ? styles.selectButtonFocus : {}),
        ...(disabled ? styles.selectButtonDisabled : {}),
        ...(error ? styles.selectButtonError : {}),
        ...style,
    };

    return (
        <div ref={containerRef} className={className} style={styles.selectContainer}>
            <button
                type="button"
                onClick={() => !disabled && setIsOpen(!isOpen)}
                disabled={disabled}
                style={buttonStyle}
                onMouseEnter={(e) => {
                    if (!disabled && !isOpen) {
                        Object.assign(e.currentTarget.style, styles.selectButtonHover);
                    }
                }}
                onMouseLeave={(e) => {
                    if (!isOpen) {
                        e.currentTarget.style.borderColor = error ? "#dc2626" : "rgba(0, 0, 0, 0.06)";
                        e.currentTarget.style.boxShadow = error
                            ? "0 0 0 3px rgba(220, 38, 38, 0.1)"
                            : "0 1px 3px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.02)";
                    }
                }}
            >
                <span style={{
                    ...styles.selectValue,
                    ...(selectedOption ? {} : styles.selectPlaceholder)
                }}>
                    {selectedOption ? selectedOption.label : placeholder}
                </span>
                <svg
                    style={{
                        ...styles.selectArrow,
                        ...(isOpen ? styles.selectArrowOpen : {})
                    }}
                    viewBox="0 0 12 12"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                >
                    <path
                        d="M2 4L6 8L10 4"
                        stroke="#64748b"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                </svg>
            </button>

            <div
                ref={dropdownRef}
                className="modern-dropdown"
                style={{
                    ...styles.dropdown,
                    ...(isOpen ? styles.dropdownOpen : {})
                }}
            >
                {options.length === 0 ? (
                    <div style={styles.emptyState}>No options available</div>
                ) : (
                    options.map((option, index) => {
                        const isSelected = option.value === value;
                        const isHovered = hoveredIndex === index;
                        const isFirst = index === 0;
                        const isLast = index === options.length - 1;

                        return (
                            <div
                                key={option.value}
                                onClick={() => handleSelect(option.value)}
                                onMouseEnter={() => !option.disabled && setHoveredIndex(index)}
                                onMouseLeave={() => setHoveredIndex(null)}
                                style={{
                                    ...styles.option,
                                    ...(isFirst ? styles.optionFirst : {}),
                                    ...(isLast ? styles.optionLast : {}),
                                    ...(isHovered && !option.disabled ? styles.optionHover : {}),
                                    ...(isSelected ? styles.optionSelected : {}),
                                    ...(option.disabled ? styles.optionDisabled : {}),
                                }}
                            >
                                {isSelected && (
                                    <div style={styles.checkmark}>
                                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                            <path
                                                d="M13.3333 4L6 11.3333L2.66667 8"
                                                stroke="#2563eb"
                                                strokeWidth="2"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                            />
                                        </svg>
                                    </div>
                                )}
                                <span style={{ flex: 1 }}>{option.label}</span>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}

