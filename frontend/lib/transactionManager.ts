import { useState, useCallback, useEffect } from 'react';
import { usePublicClient } from 'wagmi';

export interface TransactionState {
    hash: string;
    status: 'pending' | 'confirming' | 'success' | 'error';
    error?: string;
    timestamp: number;
}

class TransactionManager {
    private transactions: Map<string, TransactionState> = new Map();
    private listeners: Set<(txs: TransactionState[]) => void> = new Set();

    addTransaction(hash: string) {
        this.transactions.set(hash, {
            hash,
            status: 'pending',
            timestamp: Date.now(),
        });
        this.notifyListeners();
    }

    updateTransaction(hash: string, updates: Partial<TransactionState>) {
        const tx = this.transactions.get(hash);
        if (tx) {
            this.transactions.set(hash, { ...tx, ...updates });
            this.notifyListeners();
        }
    }

    setConfirming(hash: string) {
        this.updateTransaction(hash, { status: 'confirming' });
    }

    setSuccess(hash: string) {
        this.updateTransaction(hash, { status: 'success' });
        // Remove after 10 seconds
        setTimeout(() => {
            this.transactions.delete(hash);
            this.notifyListeners();
        }, 10000);
    }

    setError(hash: string, error: string) {
        this.updateTransaction(hash, { status: 'error', error });
        // Remove after 30 seconds
        setTimeout(() => {
            this.transactions.delete(hash);
            this.notifyListeners();
        }, 30000);
    }

    getTransaction(hash: string): TransactionState | undefined {
        return this.transactions.get(hash);
    }

    getAllTransactions(): TransactionState[] {
        return Array.from(this.transactions.values()).sort((a, b) => b.timestamp - a.timestamp);
    }

    getPendingTransactions(): TransactionState[] {
        return this.getAllTransactions().filter(tx => 
            tx.status === 'pending' || tx.status === 'confirming'
        );
    }

    subscribe(listener: (txs: TransactionState[]) => void) {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }

    private notifyListeners() {
        const txs = this.getAllTransactions();
        this.listeners.forEach(listener => {
            try {
                listener(txs);
            } catch (error) {
                console.error('[TransactionManager] Error in listener:', error);
            }
        });
    }
}

// Singleton instance
export const transactionManager = new TransactionManager();

/**
 * React hook for managing transactions
 */
export function useTransactionManager() {
    const publicClient = usePublicClient();
    const [transactions, setTransactions] = useState<TransactionState[]>([]);

    useEffect(() => {
        const unsubscribe = transactionManager.subscribe(setTransactions);
        return unsubscribe;
    }, []);

    const trackTransaction = useCallback(async (hash: string) => {
        transactionManager.addTransaction(hash);
        transactionManager.setConfirming(hash);

        if (publicClient) {
            try {
                const receipt = await publicClient.waitForTransactionReceipt({ hash: hash as `0x${string}` });
                if (receipt.status === 'success') {
                    transactionManager.setSuccess(hash);
                } else {
                    transactionManager.setError(hash, 'Transaction reverted');
                }
            } catch (error: any) {
                transactionManager.setError(hash, error.message || 'Transaction failed');
            }
        }
    }, [publicClient]);

    return {
        transactions,
        pendingTransactions: transactions.filter(tx => 
            tx.status === 'pending' || tx.status === 'confirming'
        ),
        trackTransaction,
    };
}








