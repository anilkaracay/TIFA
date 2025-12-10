import {
    InvoiceMinted,
    InvoiceStatusUpdated
} from "../generated/InvoiceToken/InvoiceToken"
import { Invoice, InvoiceLifecycleEvent } from "../generated/schema"
import { BigInt, Bytes } from "@graphprotocol/graph-ts"

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

export function handleInvoiceMinted(event: InvoiceMinted): void {
    let entity = new Invoice(event.params.invoiceId.toHex())

    entity.tokenId = event.params.tokenId
    entity.tokenAddress = event.address

    entity.issuer = event.params.issuer
    entity.debtor = event.params.debtor
    entity.amount = event.params.amount
    entity.dueDate = event.params.dueDate
    entity.currency = event.params.currency

    entity.status = "ISSUED"
    entity.cumulativePaid = BigInt.fromI32(0)
    entity.isFinanced = false
    entity.createdAt = event.block.timestamp
    entity.updatedAt = event.block.timestamp

    entity.save()
}

export function handleInvoiceStatusUpdated(event: InvoiceStatusUpdated): void {
    let id = event.params.invoiceId.toHex()
    let entity = Invoice.load(id)

    if (entity) {
        let oldStatus = getStatusString(event.params.oldStatus)
        let newStatus = getStatusString(event.params.newStatus)

        entity.status = newStatus
        entity.updatedAt = event.block.timestamp
        entity.save()

        // Create Lifecycle Event
        let eventId = event.transaction.hash.toHex() + "-" + event.logIndex.toString()
        let lifecycleEvent = new InvoiceLifecycleEvent(eventId)
        lifecycleEvent.invoice = id
        lifecycleEvent.oldStatus = oldStatus
        lifecycleEvent.newStatus = newStatus
        lifecycleEvent.timestamp = event.block.timestamp
        lifecycleEvent.txHash = event.transaction.hash
        lifecycleEvent.save()
    }
}
