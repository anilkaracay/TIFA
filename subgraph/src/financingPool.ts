import {
    CollateralLocked,
    CreditDrawn,
    CreditRepaid,
    CollateralReleased,
    CollateralLiquidated,
    InterestAccrued,
    InterestPaid,
    SharePriceUpdated,
    ProtocolFeesWithdrawn
} from "../generated/FinancingPool/FinancingPool"
import { CollateralPosition, Invoice, PoolMetrics } from "../generated/schema"
import { BigInt } from "@graphprotocol/graph-ts"

export function handleCollateralLocked(event: CollateralLocked): void {
    let invoiceId = event.params.invoiceId.toHex()

    let entity = new CollateralPosition(invoiceId)
    entity.invoice = invoiceId
    entity.tokenId = event.params.tokenId
    entity.company = event.params.company
    entity.maxCreditLine = event.params.creditLine
    entity.usedCredit = BigInt.fromI32(0)
    entity.ltvBps = event.params.ltvBps.toI32()
    entity.liquidated = false
    entity.createdAt = event.block.timestamp
    entity.updatedAt = event.block.timestamp

    entity.save()

    // Update invoice isFinanced flag
    let invoice = Invoice.load(invoiceId)
    if (invoice) {
        invoice.isFinanced = true
        invoice.updatedAt = event.block.timestamp
        invoice.save()
    }
}

export function handleCreditDrawn(event: CreditDrawn): void {
    let invoiceId = event.params.invoiceId.toHex()
    let entity = CollateralPosition.load(invoiceId)

    if (entity) {
        entity.usedCredit = entity.usedCredit.plus(event.params.amount)
        entity.updatedAt = event.block.timestamp
        entity.save()
    }
}

export function handleCreditRepaid(event: CreditRepaid): void {
    let invoiceId = event.params.invoiceId.toHex()
    let entity = CollateralPosition.load(invoiceId)

    if (entity) {
        entity.usedCredit = event.params.remainingDebt
        entity.updatedAt = event.block.timestamp
        entity.save()
    }
}

export function handleCollateralReleased(event: CollateralReleased): void {
    let invoiceId = event.params.invoiceId.toHex()
    let entity = CollateralPosition.load(invoiceId)

    if (entity) {
        // Optionally remove entity: store.remove('CollateralPosition', invoiceId)
        // Or just mark it somehow. For now, we leave it but usage implies it's done if usedCredit is 0 or logic dictates.
        entity.updatedAt = event.block.timestamp
        entity.save()
    }

    let invoice = Invoice.load(invoiceId)
    if (invoice) {
        invoice.isFinanced = false
        invoice.updatedAt = event.block.timestamp
        invoice.save()
    }
}

export function handleCollateralLiquidated(event: CollateralLiquidated): void {
    let invoiceId = event.params.invoiceId.toHex()
    let entity = CollateralPosition.load(invoiceId)

    if (entity) {
        entity.liquidated = true
        entity.updatedAt = event.block.timestamp
        entity.save()
    }
}

function getOrCreatePoolMetrics(): PoolMetrics {
    let metrics = PoolMetrics.load("1")
    if (metrics == null) {
        metrics = new PoolMetrics("1")
        metrics.nav = BigInt.fromI32(0)
        metrics.sharePriceWad = BigInt.fromI32(0)
        metrics.totalPrincipalOutstanding = BigInt.fromI32(0)
        metrics.totalInterestAccrued = BigInt.fromI32(0)
        metrics.totalLosses = BigInt.fromI32(0)
        metrics.protocolFeesAccrued = BigInt.fromI32(0)
        metrics.utilization = BigInt.fromI32(0)
        metrics.totalInterestPaidToLP = BigInt.fromI32(0)
        metrics.poolStartTime = event.block.timestamp
        metrics.timestamp = event.block.timestamp
    }
    return metrics as PoolMetrics
}

export function handleInterestAccrued(event: InterestAccrued): void {
    let metrics = getOrCreatePoolMetrics(event)
    metrics.totalInterestAccrued = event.params.totalInterestAccrued
    metrics.timestamp = event.block.timestamp
    metrics.save()
}

export function handleInterestPaid(event: InterestPaid): void {
    let metrics = getOrCreatePoolMetrics(event)
    // LP interest = interestPaid - protocolFee
    let lpInterest = event.params.interestPaid.minus(event.params.protocolFee)
    metrics.totalInterestPaidToLP = metrics.totalInterestPaidToLP.plus(lpInterest)
    metrics.protocolFeesAccrued = metrics.protocolFeesAccrued.plus(event.params.protocolFee)
    metrics.totalInterestAccrued = metrics.totalInterestAccrued.minus(event.params.interestPaid)
    metrics.timestamp = event.block.timestamp
    metrics.save()
}

export function handleSharePriceUpdated(event: SharePriceUpdated): void {
    let metrics = getOrCreatePoolMetrics(event)
    metrics.nav = event.params.nav
    metrics.sharePriceWad = event.params.sharePriceWad
    metrics.timestamp = event.block.timestamp
    metrics.save()
}

export function handleProtocolFeesWithdrawn(event: ProtocolFeesWithdrawn): void {
    let metrics = getOrCreatePoolMetrics(event)
    metrics.protocolFeesAccrued = metrics.protocolFeesAccrued.minus(event.params.amount)
    metrics.timestamp = event.block.timestamp
    metrics.save()
}
