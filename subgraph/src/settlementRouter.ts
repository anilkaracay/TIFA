import {
    SettlementRuleCreated,
    SettlementExecuted
} from "../generated/SettlementRouter/SettlementRouter"
import { SettlementRule, SettlementExecution } from "../generated/schema"
import { Bytes, BigInt } from "@graphprotocol/graph-ts"

export function handleSettlementRuleCreated(event: SettlementRuleCreated): void {
    let ruleId = event.params.ruleId.toHex()

    let entity = new SettlementRule(ruleId)
    entity.invoice = event.params.invoiceId.toHex()
    entity.payer = event.params.payer
    // Graph-ts conversion for arrays
    // Note: assemblyscript array mapping can be tricky, typically direct assignment works if types match
    // or use map.
    let recipients: Bytes[] = []
    let inputRecipients = event.params.recipients
    for (let i = 0; i < inputRecipients.length; i++) {
        recipients.push(inputRecipients[i])
    }
    entity.recipients = recipients

    let splits: i32[] = []
    let inputSplits = event.params.bpsSplit
    for (let i = 0; i < inputSplits.length; i++) {
        splits.push(inputSplits[i].toI32())
    }
    entity.bpsSplit = splits

    entity.currency = Bytes.empty() // Event didn't have currency indexed or passed? Check ABI/Contract. 
    // Wait, SettlementRouter event `SettlementRuleCreated` has: ruleId, invoiceId, payer, recipients, bpsSplit.
    // The contract function createRule(...) takes currency. 
    // But the event definition in my minimal ABI does NOT have currency.
    // The user prompt in step 194 shows event: SettlementRuleCreated(..., address[] recipients, uint256[] bpsSplit);
    // It missed currency! 
    // I must check if I can add currency to ABI/schema or if I should just use empty for now.
    // The user prompt #231 shows:
    // "event SettlementRuleCreated(bytes32 indexed ruleId, bytes32 indexed invoiceId, address payer, address[] recipients, uint256[] bpsSplit);"
    // So currency is NOT in the event. I will just set default/empty bytes.

    entity.active = true
    entity.createdAt = event.block.timestamp

    entity.save()
}

export function handleSettlementExecuted(event: SettlementExecuted): void {
    let id = event.transaction.hash.toHex() + "-" + event.logIndex.toString()

    let entity = new SettlementExecution(id)
    entity.rule = event.params.ruleId.toHex()
    entity.invoice = event.params.invoiceId.toHex()
    entity.grossAmount = event.params.grossAmount
    entity.timestamp = event.block.timestamp
    entity.txHash = event.transaction.hash

    entity.save()
}
