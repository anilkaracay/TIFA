import {
    InvoiceRegistered,
    InvoiceLifecycleUpdated,
    PaymentRecorded
} from "../generated/InvoiceRegistry/InvoiceRegistry"
import { Invoice, InvoiceLifecycleEvent, InvoicePayment } from "../generated/schema"
import { BigInt, Bytes } from "@graphprotocol/graph-ts"

// Helper function duplicate from invoiceToken.ts (shared lib possible but keeping simple)
function getStatusString(status: i32): string {
    if (status == 0) return "NONE"
    if (status == 1) return "ISSUED"
    if (status == 2) return "TOKENIZED"
    if (status == 3) return "FINANCED"
    if (status == 4) return "PARTIALLY_PAID"
    if (status == 5) return "PAID"
    if (status == 6) return "DEFAULTED"
    return "UNKNOWN"
}

export function handleInvoiceRegistered(event: InvoiceRegistered): void {
    let id = event.params.invoiceId.toHex()
    let entity = Invoice.load(id)

    // Invoice should already exist from minting, but be safe
    if (entity) {
        entity.tokenId = event.params.tokenId
        entity.updatedAt = event.block.timestamp
        entity.save()
    } else {
        // Edge case if registry event seen before mint event (rare/impossible if ordered correctly)
        // Create barebones
        entity = new Invoice(id)
        entity.tokenId = event.params.tokenId
        entity.issuer = event.params.issuer
        entity.debtor = event.params.debtor
        entity.amount = BigInt.fromI32(0)
        entity.currency = Bytes.empty()
        entity.dueDate = BigInt.fromI32(0)
        entity.status = "ISSUED"
        entity.cumulativePaid = BigInt.fromI32(0)
        entity.isFinanced = false
        entity.createdAt = event.block.timestamp
        entity.updatedAt = event.block.timestamp
        entity.save()
    }
}

export function handleInvoiceLifecycleUpdated(event: InvoiceLifecycleUpdated): void {
    let id = event.params.invoiceId.toHex()
    let entity = Invoice.load(id)

    if (entity) {
        let oldStatus = getStatusString(event.params.oldStatus)
        let newStatus = getStatusString(event.params.newStatus)

        entity.status = newStatus
        entity.updatedAt = event.params.blockTimestamp
        entity.save()

        let eventId = event.transaction.hash.toHex() + "-" + event.logIndex.toString()
        let lifecycleEvent = new InvoiceLifecycleEvent(eventId)
        lifecycleEvent.invoice = id
        lifecycleEvent.oldStatus = oldStatus
        lifecycleEvent.newStatus = newStatus
        lifecycleEvent.timestamp = event.params.blockTimestamp
        lifecycleEvent.txHash = event.transaction.hash
        lifecycleEvent.save()
    }
}

export function handlePaymentRecorded(event: PaymentRecorded): void {
    let id = event.params.invoiceId.toHex()
    let entity = Invoice.load(id)

    if (entity) {
        entity.cumulativePaid = event.params.cumulativePaid
        entity.updatedAt = event.params.blockTimestamp
        entity.save()

        let paymentId = event.transaction.hash.toHex() + "-" + event.logIndex.toString()
        let payment = new InvoicePayment(paymentId)
        payment.invoice = id
        payment.amount = event.params.amount
        payment.cumulativePaid = event.params.cumulativePaid
        payment.timestamp = event.params.blockTimestamp
        payment.txHash = event.transaction.hash
        payment.save()
    }
}
