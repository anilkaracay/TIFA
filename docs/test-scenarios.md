# Test Scenarios for TIFA System

Bu dokümantasyon, sistemin farklı durumlarını test etmek için oluşturulan test invoice'larını ve senaryolarını açıklar.

## Test Invoice Kategorileri

### 1. x402 Payment Test Invoices

Bu invoice'lar x402 ödeme akışını test etmek için hazırlanmıştır.

#### TEST-X402-SMALL
- **Status**: FINANCED
- **Amount**: 50,000 USDC
- **Debtor**: COMP-DEBTOR-003
- **Test**: Küçük tutarlı x402 ödeme testi

#### TEST-X402-MEDIUM
- **Status**: TOKENIZED
- **Amount**: 200,000 USDC
- **Debtor**: COMP-DEBTOR-003
- **Test**: Orta tutarlı x402 ödeme testi

#### TEST-X402-LARGE
- **Status**: TOKENIZED
- **Amount**: 1,000,000 USDC
- **Debtor**: COMP-DEBTOR-003
- **Test**: Büyük tutarlı x402 ödeme testi

### 2. Agent Authorization Test Invoices

Bu invoice'lar agent-authorized payment özelliğini test etmek için hazırlanmıştır.

#### TEST-AGENT-AUTO-1
- **Status**: FINANCED
- **Amount**: 300,000 USDC
- **Debtor**: COMP-DEBTOR-003 (authorization var)
- **Test**: Agent'ın otomatik ödeme yapması beklenir

#### TEST-AGENT-BLOCKED
- **Status**: ISSUED
- **Amount**: 400,000 TRY
- **Debtor**: COMP-DEBTOR-003
- **Test**: Currency (TRY) authorization'da yok, agent ödeme yapmamalı

#### TEST-AGENT-LIMIT-EXCEED
- **Status**: ISSUED
- **Amount**: 2,000,000 USDC
- **Debtor**: COMP-DEBTOR-003
- **Test**: Amount limit'i (1,000,000) aşıyor, agent ödeme yapmamalı

### 3. Risk Score Test Invoices

Bu invoice'lar risk skorlama sistemini test etmek için hazırlanmıştır.

#### TEST-RISK-HIGH
- **Status**: ISSUED
- **Amount**: 5,000,000 USDC
- **Due Date**: 5 gün önce (overdue)
- **Test**: Yüksek risk skoru beklenir (overdue + büyük tutar)

#### TEST-RISK-LOW
- **Status**: ISSUED
- **Amount**: 10,000 USDC
- **Due Date**: 30 gün sonra
- **Test**: Düşük risk skoru beklenir (gelecek tarih + küçük tutar)

#### TEST-RISK-MEDIUM
- **Status**: ISSUED
- **Amount**: 500,000 USDC
- **Due Date**: 7 gün sonra
- **Test**: Orta risk skoru beklenir

### 4. Status Transition Test Invoices

Bu invoice'lar status geçişlerini test etmek için hazırlanmıştır.

#### TEST-STATUS-TOKENIZED
- **Status**: TOKENIZED
- **Amount**: 150,000 USDC
- **Test**: Tokenization akışı testi

#### TEST-STATUS-FINANCED
- **Status**: FINANCED
- **Amount**: 250,000 USDC
- **Test**: Financing akışı testi

#### TEST-STATUS-PARTIAL
- **Status**: PARTIALLY_PAID
- **Amount**: 600,000 USDC
- **Cumulative Paid**: 300,000 USDC
- **Test**: Kısmi ödeme akışı testi

### 5. Edge Cases

Bu invoice'lar edge case'leri test etmek için hazırlanmıştır.

#### TEST-EDGE-SMALL
- **Status**: ISSUED
- **Amount**: 1,000 USDC (çok küçük)
- **Test**: Minimum tutar testi

#### TEST-EDGE-LARGE
- **Status**: ISSUED
- **Amount**: 10,000,000 USDC (çok büyük)
- **Test**: Maksimum tutar testi

#### TEST-EDGE-CURRENCY
- **Status**: ISSUED
- **Amount**: 300,000 TRY
- **Test**: Farklı currency testi

## Test Senaryoları

### Senaryo 1: x402 Payment Flow

1. **TOKENIZED Invoice ile x402 Payment**
   - Invoice: TEST-X402-MEDIUM veya TEST-X402-LARGE
   - Adımlar:
     1. x402 Payments sayfasına git
     2. Invoice'ı seç
     3. Payment request al
     4. Mock txHash ile confirm et
     5. Invoice status'unun PARTIALLY_PAID veya PAID olduğunu kontrol et

2. **FINANCED Invoice ile x402 Payment**
   - Invoice: TEST-X402-SMALL
   - Adımlar: Yukarıdakiyle aynı

3. **PARTIALLY_PAID Invoice ile x402 Payment**
   - Invoice: TEST-STATUS-PARTIAL
   - Adımlar: Kalan tutarı öde

### Senaryo 2: Agent Auto-Payment

1. **Başarılı Agent Payment**
   - Invoice: TEST-AGENT-AUTO-1
   - Beklenen: Agent 60 saniye içinde otomatik ödeme yapmalı
   - Kontrol: Payment History'de "Agent" badge'i görünmeli

2. **Currency Block**
   - Invoice: TEST-AGENT-BLOCKED
   - Beklenen: Agent ödeme yapmamalı (TRY not allowed)
   - Kontrol: AgentPaymentExecution'da BLOCKED status

3. **Limit Exceed Block**
   - Invoice: TEST-AGENT-LIMIT-EXCEED (tokenize edilmeli)
   - Beklenen: Agent ödeme yapmamalı (amount > maxAmountPerInvoice)
   - Kontrol: AgentPaymentExecution'da BLOCKED status

### Senaryo 3: Risk Scoring

1. **High Risk Invoice**
   - Invoice: TEST-RISK-HIGH
   - Beklenen: Risk skoru yüksek olmalı (overdue + büyük tutar)
   - Kontrol: Agent Console'da risk skorunu kontrol et

2. **Low Risk Invoice**
   - Invoice: TEST-RISK-LOW
   - Beklenen: Risk skoru düşük olmalı
   - Kontrol: Agent Console'da risk skorunu kontrol et

### Senaryo 4: Status Transitions

1. **ISSUED → TOKENIZED**
   - Invoice: TEST-STATUS-TOKENIZED (zaten tokenized)
   - Test: Yeni bir invoice oluştur ve tokenize et

2. **TOKENIZED → FINANCED**
   - Invoice: TEST-STATUS-FINANCED (zaten financed)
   - Test: Tokenized bir invoice'ı finance et

3. **FINANCED → PARTIALLY_PAID**
   - Invoice: TEST-STATUS-PARTIAL
   - Test: Partial payment yap

4. **PARTIALLY_PAID → PAID**
   - Invoice: TEST-STATUS-PARTIAL
   - Test: Kalan tutarı öde

## Test Komutları

### Invoice Oluşturma
```bash
bash scripts/create-test-invoices.sh
```

### Invoice Status Setup
```bash
bash scripts/setup-test-invoices.sh
```

### Invoice Listesi
```bash
curl "http://localhost:4000/invoices?status=all" | jq '.[] | select(.externalId | startswith("TEST-"))'
```

### x402 Payment Test
```bash
# Request payment
curl -X POST "http://localhost:4000/invoices/{invoiceId}/pay" \
  -H "x-wallet-address: 0x..."

# Confirm payment
curl -X POST "http://localhost:4000/invoices/{invoiceId}/pay/confirm" \
  -H "Content-Type: application/json" \
  -H "x-wallet-address: 0x..." \
  -d '{"sessionId": "...", "txHash": "0x..."}'
```

## Beklenen Sonuçlar

### x402 Payments
- ✅ TOKENIZED, FINANCED, PARTIALLY_PAID invoice'lar ödenebilmeli
- ✅ Payment History'de görünmeli
- ✅ Invoice status güncellenmeli

### Agent Auto-Payment
- ✅ COMP-DEBTOR-003 için authorized invoice'lar otomatik ödenmeli
- ✅ Limit aşan invoice'lar block edilmeli
- ✅ Currency mismatch block edilmeli
- ✅ Execution history'de görünmeli

### Risk Scoring
- ✅ Overdue invoice'lar yüksek risk almalı
- ✅ Future due date'ler düşük risk almalı
- ✅ Büyük tutarlar riski artırmalı

## Troubleshooting

### Agent ödeme yapmıyor
1. Authorization'ın aktif olduğunu kontrol et
2. Invoice'ın COMP-DEBTOR-003'e ait olduğunu kontrol et
3. Invoice status'unun FINANCED veya TOKENIZED olduğunu kontrol et
4. Agent log'larını kontrol et: `tail -f agent.log`

### x402 payment çalışmıyor
1. X402_ENABLED=true olduğunu kontrol et
2. Invoice status'unun ödenebilir olduğunu kontrol et
3. Backend log'larını kontrol et

### Risk skorları beklenmiyor
1. Agent'ın çalıştığını kontrol et
2. Invoice'ın subgraph'te göründüğünü kontrol et
3. Due date'in doğru olduğunu kontrol et






