# Test Invoice Summary

## Oluşturulan Test Invoice'ları

Toplam **22 test invoice'ı** oluşturuldu ve farklı status'lere taşındı.

### 📊 Status Dağılımı

- **ISSUED**: 13 invoice
- **TOKENIZED**: 3 invoice
- **FINANCED**: 3 invoice
- **PARTIALLY_PAID**: 1 invoice
- **DEFAULTED**: 2 invoice

### 🎯 Test Senaryoları

#### 1. x402 Payment Test Invoices

| External ID | Status | Amount | Debtor | Test Amaç |
|------------|--------|--------|--------|-----------|
| TEST-X402-SMALL | FINANCED | 50,000 USDC | COMP-DEBTOR-003 | Küçük tutarlı x402 ödeme |
| TEST-X402-MEDIUM | TOKENIZED | 200,000 USDC | COMP-DEBTOR-003 | Orta tutarlı x402 ödeme |
| TEST-X402-LARGE | TOKENIZED | 1,000,000 USDC | COMP-DEBTOR-003 | Büyük tutarlı x402 ödeme |

**Test Adımları:**
1. x402 Payments sayfasına git: http://localhost:3000/x402
2. Invoice'ı seç
3. Payment request al
4. Mock txHash ile confirm et
5. Status'un güncellendiğini kontrol et

#### 2. Agent Auto-Payment Test Invoices

| External ID | Status | Amount | Debtor | Test Amaç |
|------------|--------|--------|--------|-----------|
| TEST-AGENT-AUTO-1 | FINANCED | 300,000 USDC | COMP-DEBTOR-003 | ✅ Agent otomatik ödeme yapmalı |
| TEST-AGENT-BLOCKED | ISSUED | 400,000 TRY | COMP-DEBTOR-003 | ❌ Currency block (TRY not allowed) |
| TEST-AGENT-LIMIT-EXCEED | ISSUED | 2,000,000 USDC | COMP-DEBTOR-003 | ❌ Amount limit exceeded |

**Test Adımları:**
1. Agent authorization'ın aktif olduğunu kontrol et
2. 60 saniye bekle (agent cycle)
3. Payment History'de agent-executed payment'ı kontrol et
4. Execution history'de BLOCKED durumlarını kontrol et

#### 3. Risk Score Test Invoices

| External ID | Status | Amount | Due Date | Risk Beklentisi |
|------------|--------|--------|----------|-----------------|
| TEST-RISK-HIGH | ISSUED | 5,000,000 USDC | 5 gün önce | 🔴 Yüksek (overdue + büyük) |
| TEST-RISK-LOW | ISSUED | 10,000 USDC | 30 gün sonra | 🟢 Düşük (gelecek + küçük) |
| TEST-RISK-MEDIUM | ISSUED | 500,000 USDC | 7 gün sonra | 🟡 Orta |

**Test Adımları:**
1. Agent Console'a git: http://localhost:3000/agent
2. Risk skorlarını kontrol et
3. Agent'ın risk bazlı kararlarını gözlemle

#### 4. Status Transition Test Invoices

| External ID | Status | Amount | Test Amaç |
|------------|--------|--------|-----------|
| TEST-STATUS-TOKENIZED | TOKENIZED | 150,000 USDC | Tokenization akışı |
| TEST-STATUS-FINANCED | FINANCED | 250,000 USDC | Financing akışı |
| TEST-STATUS-PARTIAL | PARTIALLY_PAID | 600,000 USDC (300k paid) | Kısmi ödeme akışı |

#### 5. Edge Cases

| External ID | Status | Amount | Currency | Test Amaç |
|------------|--------|--------|----------|-----------|
| TEST-EDGE-SMALL | ISSUED | 1,000 USDC | USDC | Minimum tutar |
| TEST-EDGE-LARGE | ISSUED | 10,000,000 USDC | USDC | Maksimum tutar |
| TEST-EDGE-CURRENCY | ISSUED | 300,000 TRY | TRY | Farklı currency |

## 🧪 Hızlı Test Komutları

### Tüm Testleri Çalıştır
```bash
bash scripts/run-all-tests.sh
```

### x402 Payment Test
```bash
bash scripts/test-x402-payment.sh
```

### Agent Payment Test
```bash
bash scripts/test-agent-payment.sh
```

### Invoice Listesi
```bash
curl "http://localhost:4000/invoices?status=all" | jq '[.[] | select(.externalId | startswith("TEST-"))]'
```

### COMP-DEBTOR-003 Invoice'ları (Agent Auto-Payment için)
```bash
curl "http://localhost:4000/invoices?status=all" | jq '[.[] | select(.debtorId == "COMP-DEBTOR-003") | select(.externalId | startswith("TEST-"))]'
```

## 📝 Test Senaryoları Detayları

### Senaryo 1: x402 Payment - TOKENIZED Invoice
1. Invoice: TEST-X402-MEDIUM veya TEST-X402-LARGE
2. x402 Payments sayfasında invoice'ı seç
3. Payment request al (HTTP 402)
4. Mock txHash ile confirm et
5. Invoice status'unun güncellendiğini kontrol et

### Senaryo 2: x402 Payment - FINANCED Invoice
1. Invoice: TEST-X402-SMALL
2. Aynı adımları takip et

### Senaryo 3: x402 Payment - PARTIALLY_PAID Invoice
1. Invoice: TEST-STATUS-PARTIAL
2. Kalan tutarı (300,000) öde
3. Status'un PAID olduğunu kontrol et

### Senaryo 4: Agent Auto-Payment - Başarılı
1. Invoice: TEST-AGENT-AUTO-1 (FINANCED, COMP-DEBTOR-003)
2. 60 saniye bekle
3. Payment History'de "Agent" badge'ini kontrol et
4. Execution history'de EXECUTED status'unu kontrol et

### Senaryo 5: Agent Auto-Payment - Currency Block
1. Invoice: TEST-AGENT-BLOCKED (TRY currency)
2. 60 saniye bekle
3. Execution history'de BLOCKED status'unu kontrol et
4. Reason: "Currency TRY not allowed" olmalı

### Senaryo 6: Agent Auto-Payment - Limit Exceed
1. Invoice: TEST-AGENT-LIMIT-EXCEED'ı tokenize et
2. 60 saniye bekle
3. Execution history'de BLOCKED status'unu kontrol et
4. Reason: "Amount exceeds per-invoice limit" olmalı

## ✅ Beklenen Sonuçlar

### x402 Payments
- ✅ TOKENIZED invoice'lar ödenebilmeli
- ✅ FINANCED invoice'lar ödenebilmeli
- ✅ PARTIALLY_PAID invoice'lar ödenebilmeli
- ✅ Payment History'de görünmeli
- ✅ Invoice status güncellenmeli

### Agent Auto-Payment
- ✅ COMP-DEBTOR-003 FINANCED invoice'lar otomatik ödenmeli
- ✅ Currency mismatch block edilmeli
- ✅ Amount limit aşımı block edilmeli
- ✅ Execution history'de kayıt görünmeli

### Risk Scoring
- ✅ Overdue invoice'lar yüksek risk almalı
- ✅ Future due date'ler düşük risk almalı
- ✅ Agent Console'da risk skorları görünmeli

## 🔍 Debugging

### Agent ödeme yapmıyor
```bash
# Agent log'larını kontrol et
tail -f agent.log | grep -i "agent\|invoice\|payment"

# Execution history'yi kontrol et
curl "http://localhost:4000/payment-authorization/cmjmyweou0001ygl5cuoia8ml/executions" | jq '.'
```

### x402 payment çalışmıyor
```bash
# Backend log'larını kontrol et
tail -f /tmp/backend.log | grep -i "x402\|payment"

# Invoice status'unu kontrol et
curl "http://localhost:4000/invoices/{invoiceId}" | jq '.status'
```

### Invoice'lar görünmüyor
```bash
# Tüm test invoice'larını listele
curl "http://localhost:4000/invoices?status=all" | jq '[.[] | select(.externalId | startswith("TEST-"))] | length'
```






