"use client";

import React, { useState } from "react";
import { requestX402Payment, confirmX402Payment, X402PaymentRequest } from "../../lib/x402Client";
import { useToast } from "../Toast";

interface X402PaymentButtonProps {
  invoiceId: string;
  invoiceStatus: string;
  onPaymentConfirmed?: () => void;
}

export function X402PaymentButton({ invoiceId, invoiceStatus, onPaymentConfirmed }: X402PaymentButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [paymentRequest, setPaymentRequest] = useState<X402PaymentRequest | null>(null);
  const [txHash, setTxHash] = useState("");
  const [isConfirming, setIsConfirming] = useState(false);
  const { showToast } = useToast();

  const isPayable = ['TOKENIZED', 'FINANCED', 'PARTIALLY_PAID'].includes(invoiceStatus);
  const isPaid = invoiceStatus === 'PAID';

  const handleRequestPayment = async () => {
    setIsLoading(true);
    try {
      const response = await requestX402Payment(invoiceId);
      
      if ('x402' in response && response.x402) {
        setPaymentRequest(response as X402PaymentRequest);
        showToast('info', 'Payment request created. Please send the payment and enter the transaction hash.');
      } else {
        showToast('info', response.message || 'x402 payment is not available for this invoice');
      }
    } catch (error: any) {
      showToast('error', error.message || 'Failed to request payment');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmPayment = async () => {
    if (!paymentRequest || !txHash.trim()) {
      showToast('error', 'Please enter a transaction hash');
      return;
    }

    if (!txHash.match(/^0x[a-fA-F0-9]{64}$/)) {
      showToast('error', 'Invalid transaction hash format');
      return;
    }

    setIsConfirming(true);
    try {
      const result = await confirmX402Payment(invoiceId, {
        sessionId: paymentRequest.sessionId,
        txHash: txHash.trim(),
      });

      showToast('success', 'Payment confirmed successfully!');
      setPaymentRequest(null);
      setTxHash("");
      if (onPaymentConfirmed) {
        onPaymentConfirmed();
      }
    } catch (error: any) {
      showToast('error', error.message || 'Failed to confirm payment');
    } finally {
      setIsConfirming(false);
    }
  };

  const handleCancel = () => {
    setPaymentRequest(null);
    setTxHash("");
  };

  if (isPaid) {
    return null;
  }

  if (!isPayable) {
    return null;
  }

  if (paymentRequest) {
    return (
      <div style={{
        padding: "20px",
        border: "1px solid #e2e8f0",
        borderRadius: "8px",
        backgroundColor: "#f8fafc",
        marginTop: "16px",
      }}>
        <h3 style={{ marginTop: 0, marginBottom: "16px", fontSize: "16px", fontWeight: 600 }}>
          Pay with x402
        </h3>
        
        <div style={{ marginBottom: "16px" }}>
          <div style={{ marginBottom: "8px", fontSize: "14px", color: "#64748b" }}>
            <strong>Amount:</strong> {paymentRequest.payment.amount} {paymentRequest.payment.currency}
          </div>
          <div style={{ marginBottom: "8px", fontSize: "14px", color: "#64748b" }}>
            <strong>Chain:</strong> {paymentRequest.payment.chain}
          </div>
          <div style={{ marginBottom: "8px", fontSize: "14px", color: "#64748b", wordBreak: "break-all" }}>
            <strong>Recipient:</strong> {paymentRequest.payment.recipient}
          </div>
          <div style={{ marginBottom: "8px", fontSize: "14px", color: "#64748b" }}>
            <strong>Reference:</strong> {paymentRequest.payment.reference}
          </div>
          <div style={{ marginBottom: "8px", fontSize: "12px", color: "#94a3b8" }}>
            <strong>Expires:</strong> {new Date(paymentRequest.expiresAt).toLocaleString()}
          </div>
        </div>

        <div style={{ marginBottom: "16px" }}>
          <label style={{ display: "block", marginBottom: "8px", fontSize: "14px", fontWeight: 500 }}>
            Transaction Hash:
          </label>
          <input
            type="text"
            value={txHash}
            onChange={(e) => setTxHash(e.target.value)}
            placeholder="0x..."
            style={{
              width: "100%",
              padding: "10px",
              border: "1px solid #cbd5e1",
              borderRadius: "6px",
              fontSize: "14px",
              fontFamily: "monospace",
            }}
          />
        </div>

        <div style={{ display: "flex", gap: "8px" }}>
          <button
            onClick={handleConfirmPayment}
            disabled={isConfirming || !txHash.trim()}
            style={{
              padding: "10px 20px",
              backgroundColor: "#2563eb",
              color: "white",
              border: "none",
              borderRadius: "6px",
              fontSize: "14px",
              fontWeight: 500,
              cursor: isConfirming || !txHash.trim() ? "not-allowed" : "pointer",
              opacity: isConfirming || !txHash.trim() ? 0.6 : 1,
            }}
          >
            {isConfirming ? "Confirming..." : "Confirm Payment"}
          </button>
          <button
            onClick={handleCancel}
            disabled={isConfirming}
            style={{
              padding: "10px 20px",
              backgroundColor: "#f1f5f9",
              color: "#475569",
              border: "1px solid #cbd5e1",
              borderRadius: "6px",
              fontSize: "14px",
              fontWeight: 500,
              cursor: isConfirming ? "not-allowed" : "pointer",
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={handleRequestPayment}
      disabled={isLoading}
      style={{
        padding: "10px 20px",
        backgroundColor: "#2563eb",
        color: "white",
        border: "none",
        borderRadius: "6px",
        fontSize: "14px",
        fontWeight: 500,
        cursor: isLoading ? "not-allowed" : "pointer",
        opacity: isLoading ? 0.6 : 1,
      }}
    >
      {isLoading ? "Loading..." : "Pay with x402"}
    </button>
  );
}

