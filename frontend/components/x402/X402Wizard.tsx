"use client";

import React, { useState } from "react";
import InvoiceSelector from "./InvoiceSelector";
import PaymentRequest from "./PaymentRequest";
import PaymentConfirmation from "./PaymentConfirmation";
import PaymentComplete from "./PaymentComplete";
import { Invoice } from "../../lib/backendClient";
import { X402PaymentRequest } from "../../lib/x402Client";

const styles = {
    card: {
        background: "#ffffff",
        borderRadius: "6px",
        border: "1px solid #e5e7eb",
        boxShadow: "0 1px 2px rgba(0, 0, 0, 0.04)",
        padding: "0",
        overflow: "hidden" as "hidden",
    },
    stepper: {
        background: "#f9fafb",
        borderBottom: "1px solid #e5e7eb",
        padding: "24px 32px",
    },
    stepperContent: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        position: "relative" as "relative",
        maxWidth: "600px",
        margin: "0 auto",
    },
    step: {
        display: "flex",
        flexDirection: "column" as "column",
        alignItems: "center",
        position: "relative" as "relative",
        flex: 1,
    },
    stepLine: {
        position: "absolute" as "absolute",
        top: "12px",
        left: "50%",
        right: "-50%",
        height: "1px",
        background: "#e5e7eb",
        zIndex: 0,
    },
    stepLineActive: {
        background: "#475569",
    },
    stepNumber: {
        width: "24px",
        height: "24px",
        borderRadius: "50%",
        background: "#ffffff",
        border: "1px solid #d1d5db",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "12px",
        fontWeight: 500,
        color: "#9ca3af",
        position: "relative" as "relative",
        zIndex: 1,
        transition: "all 0.2s ease",
    },
    stepNumberActive: {
        background: "#111827",
        borderColor: "#111827",
        color: "#ffffff",
    },
    stepNumberCompleted: {
        background: "#111827",
        borderColor: "#111827",
        color: "#ffffff",
    },
    stepLabel: {
        marginTop: "8px",
        fontSize: "12px",
        fontWeight: 500,
        color: "#9ca3af",
        textAlign: "center" as "center",
    },
    stepLabelActive: {
        color: "#111827",
        fontWeight: 600,
    },
    stepContent: {
        padding: "40px 32px",
        minHeight: "400px",
    },
};

interface X402WizardProps {
    onPaymentComplete: () => void;
}

type WizardStep = 1 | 2 | 3 | 4;

export default function X402Wizard({ onPaymentComplete }: X402WizardProps) {
    const [currentStep, setCurrentStep] = useState<WizardStep>(1);
    const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
    const [paymentRequest, setPaymentRequest] = useState<X402PaymentRequest | null>(null);
    const [confirmationResult, setConfirmationResult] = useState<any>(null);

    const handleInvoiceSelect = (invoice: Invoice) => {
        setSelectedInvoice(invoice);
        setCurrentStep(2);
    };

    const handlePaymentRequested = (request: X402PaymentRequest) => {
        setPaymentRequest(request);
        setCurrentStep(3);
    };

    const handlePaymentConfirmed = (result: any) => {
        setConfirmationResult(result);
        setCurrentStep(4);
        onPaymentComplete();
    };

    const handleStartOver = () => {
        setCurrentStep(1);
        setSelectedInvoice(null);
        setPaymentRequest(null);
        setConfirmationResult(null);
    };

    const steps = [
        { number: 1, label: "Select Invoice" },
        { number: 2, label: "Payment Details" },
        { number: 3, label: "Confirm Payment" },
        { number: 4, label: "Complete" },
    ];

    return (
        <div style={styles.card}>
            {/* Stepper */}
            <div style={styles.stepper}>
                <div style={styles.stepperContent}>
                    {steps.map((step, index) => (
                        <div key={step.number} style={styles.step}>
                            {index < steps.length - 1 && (
                                <div
                                    style={{
                                        ...styles.stepLine,
                                        ...(currentStep > step.number ? styles.stepLineActive : {}),
                                    }}
                                />
                            )}
                            <div
                                style={{
                                    ...styles.stepNumber,
                                    ...(currentStep === step.number ? styles.stepNumberActive : {}),
                                    ...(currentStep > step.number ? styles.stepNumberCompleted : {}),
                                }}
                            >
                                {currentStep > step.number ? "✓" : step.number}
                            </div>
                            <div
                                style={{
                                    ...styles.stepLabel,
                                    ...(currentStep === step.number ? styles.stepLabelActive : {}),
                                }}
                            >
                                {step.label}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Step Content */}
            <div style={styles.stepContent}>
                {currentStep === 1 && (
                    <InvoiceSelector
                        onInvoiceSelect={handleInvoiceSelect}
                        onPaymentRequested={handlePaymentRequested}
                    />
                )}
                {currentStep === 2 && selectedInvoice && paymentRequest && (
                    <PaymentRequest
                        invoice={selectedInvoice}
                        paymentRequest={paymentRequest}
                        onPaymentSent={() => setCurrentStep(3)}
                        onBack={() => setCurrentStep(1)}
                    />
                )}
                {currentStep === 3 && selectedInvoice && paymentRequest && (
                    <PaymentConfirmation
                        invoice={selectedInvoice}
                        paymentRequest={paymentRequest}
                        onPaymentConfirmed={handlePaymentConfirmed}
                        onBack={() => setCurrentStep(2)}
                    />
                )}
                {currentStep === 4 && confirmationResult && (
                    <PaymentComplete
                        result={confirmationResult}
                        invoice={selectedInvoice!}
                        onStartOver={handleStartOver}
                    />
                )}
            </div>
        </div>
    );
}
