import { z } from 'zod';

export const InvoiceCreateSchema = z.object({
    externalId: z.string(),
    companyId: z.string(),
    debtorId: z.string(),
    currency: z.string(),
    amount: z.string(),
    dueDate: z.string(), // ISO date string
    autoTokenize: z.boolean().optional(),
    meta: z.record(z.any()).optional(),
});

export const InvoiceUpdateSchema = z.object({
    dueDate: z.string().optional(),
    status: z.string().optional(),
});

export const PaymentNotificationSchema = z.object({
    transactionId: z.string(),
    amount: z.string(),
    currency: z.string(),
    paidAt: z.string(),
    psp: z.string().optional(),
    rawPayload: z.record(z.any()).optional(),
});

export const FinancingRequestSchema = z.object({
    targetLtvBps: z.number().int().optional(),
    amount: z.string().optional(),
});

export const RecoursePaymentSchema = z.object({
    amount: z.string(),
    currency: z.string().default('TRY'),
    paidAt: z.string().datetime().optional(),
    txHash: z.string().optional(),
});

export const DefaultDeclarationSchema = z.object({
    reason: z.string().optional(),
    lossAmount: z.string().optional(), // Calculated if not provided
});

export type InvoiceCreate = z.infer<typeof InvoiceCreateSchema>;
export type InvoiceUpdate = z.infer<typeof InvoiceUpdateSchema>;
export type PaymentNotification = z.infer<typeof PaymentNotificationSchema>;
export type FinancingRequest = z.infer<typeof FinancingRequestSchema>;
export type RecoursePayment = z.infer<typeof RecoursePaymentSchema>;
export type DefaultDeclaration = z.infer<typeof DefaultDeclarationSchema>;
