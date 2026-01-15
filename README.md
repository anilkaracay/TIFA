<div align="center">

  # TIFA - Tokenized Invoice Finance Agent
  ### Autonomous Infrastructure for Invoice & Cash-Flow Finance

  <p align="center">
    <b>Turning Corporate Invoices into Programmable Financial Primitives.</b>
  </p>

  [![Mantle Network](https://img.shields.io/badge/Built%20On-Mantle%20Network-black?style=for-the-badge&logo=ethereum)](https://www.mantle.xyz/)
  [![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](./LICENSE)
  [![Status](https://img.shields.io/badge/Status-Live%20Demo-blue?style=for-the-badge)](https://tifa-finance.vercel.app)
  [![Deck](https://img.shields.io/badge/Pitch%20Deck-View%20Slides-orange?style=for-the-badge)](https://docsend.com/v/dn22h/tifa)

  <p align="center">
    <a href="#the-trillion-dollar-gap">Problem</a> •
    <a href="#solution-programmable-cash-flow">Solution</a> •
    <a href="#technical-architecture">Architecture</a> •
    <a href="#autonomous-agent-system">Agents</a> •
    <a href="#compliance-and-security-framework">Compliance</a> •
    <a href="https://youtu.be/ZauPGmckJ1k">Watch Demo</a>
  </p>
</div>

---

## Executive Summary: The One Pager

> **📄 [View Full Pitch Deck (DocSend)](https://docsend.com/v/dn22h/tifa)**
<p/>

> **[View DEMO (Youtube)](https://youtu.be/ZauPGmckJ1k)**

<div align="center">
  <img src="https://github.com/anilkaracay/TIFA/blob/main/frontend/public/one-pager.png?raw=true" alt="TIFA One Pager" width="100%" />
</div>

---

## The Trillion-Dollar Gap

For modern enterprises, the supply chain is real-time, but finance remains stuck in legacy infrastructure.

*   **Locked Capital:** Billions of dollars in accounts receivable sit as "idle" assets on balance sheets, trapped for 30 to 90 days.
*   **Manual Friction:** Invoice financing allows companies to unlock this cash, but the process is manual, opaque, and heavily fragmented.
*   **The Result:** Companies face liquidity crunches despite being profitable on paper.

**TIFA envisions a future where invoices are no longer just accounting records—they are financial building blocks.**

---

## Solution: Programmable Cash Flow

TIFA is an **AI-Native RWA (Real World Asset) Platform** that builds a bridge between corporate ERP systems and decentralized liquidity. We transform cash flow into a digital primitive that is:

1.  **Tokenized:** Every invoice is minted as a standardized **ERC-721 NFT** on the Mantle Network.
2.  **Autonomous:** AI Agents replace manual treasury operations—monitoring risk, executing financing, and managing repayment 24/7.
3.  **Compliant:** KYC/KYB and regulatory checks are enforced continuously at the smart contract level.
4.  **Liquid:** Instant settlement using stablecoins (MNT/USDC) through permissioned liquidity pools.

### Business Use Case Flow

<div align="center">
  <img src="https://github.com/anilkaracay/TIFA/blob/main/frontend/public/user-flow.png?raw=true" alt="TIFA Business Flow" width="100%" />
</div>

---

## Technical Architecture

TIFA operates as a hybrid system, combining the deterministic security of the **Mantle Blockchain** with the dynamic reasoning of **Off-Chain AI Agents**.

<div align="center">
  <img src="https://github.com/anilkaracay/TIFA/blob/main/frontend/public/arch-diagram.png?raw=true" alt="TIFA System Architecture" width="100%" />
</div>

### Technology Stack

| Layer | Technologies Used |
|:---|:---|
| **Blockchain** | **Mantle Network** (L2), Solidity, Hardhat, OpenZeppelin |
| **Backend API** | Node.js, Express, **PostgreSQL**, Prisma ORM |
| **Indexer** | **The Graph** (Custom Subgraph for Events) |
| **Frontend** | **Next.js 14**, TypeScript, Tailwind CSS, Shadcn/UI |
| **Web3 Client** | Viem, Wagmi, ConnectKit |
| **AI Agents** | TypeScript Custom Agents, OpenAI API (Risk Analysis) |
| **DevOps** | Docker, Docker Compose, Vercel |

---

## Autonomous Agent System

The core differentiation of TIFA is its fleet of autonomous agents. Unlike traditional automation scripts, these agents possess distinct roles and contextual "reasoning" capabilities.

### Agent Authorization Flow
TIFA employs an "Autonomy with Consent" model. Users define the scope and limits, and agents execute within those boundaries.

<div align="center">
  <img src="https://github.com/anilkaracay/TIFA/blob/main/frontend/public/agent-auth-flow.png?raw=true" alt="Agent Authorization Flow" width="80%" />
</div>

| Agent Name | Role & Logic |
|:---|:---|
| **Risk Scoring Agent** | Monitors every invoice in real-time. Calculates a dynamic `Risk Score (0-100)` based on overdue days, historical repayment behavior, and issuer creditworthiness. |
| **Auto-Financing Agent** | Watches for eligible invoices. If `Risk Score < 50` AND `LTV < 80%`, it **automatically** initiates a blockchain transaction to draw funds from the pool. |
| **Safety Guard Agent** | The "Supervisor". It constantly monitors pool health. If `Pool Utilization > 90%` or `Issuer Exposure > 20%`, it overrides other agents and **blocks financing** to protect LPs. |
| **Status Agent** | Listens to on-chain events (e.g., `Repaid`, `Defaulted`) and synchronizes the state back to the off-chain ERP view. |

---

## Compliance and Security Framework

TIFA is built for the regulated world. We enforce strict compliance standards at both the protocol and application layers.

<div align="center">
  <img src="https://github.com/anilkaracay/TIFA/blob/main/frontend/public/compliance-flow-final.png?raw=true" alt="Compliance Flow Final" width="100%" />
</div>

### 1. Identity Verification (KYC/KYB)
We utilize a strict **Permissioned Access** model. 
*   **IdentityRegistry Smart Contract:** This contract maintains an on-chain whitelist of approved addresses.
*   **Enforcement:** Every function in the `FinancingPool` and `InvoiceNFT` contracts includes an `onlyVerified` modifier. A wallet cannot mint an invoice or provide liquidity without a valid, non-expired KYC token.

### 2. Digital Custody: Omnibus Model
TIFA employs an **Omnibus Custody Architecture** to ensure asset safety and seamless liquidity.
*   **Pooled On-Chain Vault:** Assets are held in a secure, pooled smart contract vault (`OmnibusLedger`), separating platform funds from user funds.
*   **Shadow Ledger:** Individual ownership is tracked through a private, cryptographically verifiable "shadow ledger" off-chain.
*   **Auditability:** Users can verify their balances against the on-chain vault at any time, ensuring total transparency.

### 3. Compliant Yield (Real World Assets)
The yield generated on TIFA is **Real Yield**, derived from economic activity, not inflationary token emissions.
*   **Source:** Yield comes directly from the financing fee (discount rate) paid by the invoice issuer.
*   **Sustainability:** This model ensures that APY is sustainable and backed by legally binding debt obligations (invoices).

---

## Getting Started

We provide a comprehensive startup script to launch the full ecosystem locally.

### Prerequisites
Before running the project, ensure you have the following installed:
*   **Node.js** (v18 or higher)
*   **Docker Desktop** (Must be running for DB and Graph Node)
*   **pnpm** (`npm install -g pnpm`)

### Installation & Run

1.  **Clone the Repository**
    ```bash
    git clone https://github.com/anilkaracay/TIFA.git
    cd TIFA
    ```

2.  **Install Dependencies**
    ```bash
    pnpm install
    ```

3.  **Environment Setup**
    ```bash
    # Copy example environment files
    cp .env.example .env
    cp backend/.env.example backend/.env
    cp frontend/.env.example frontend/.env
    ```

4.  **Start the Ecosystem (One-Click)**
    We have prepared a master script that resets the database, deploys smart contracts to the local hardhat node, updates the ABI files, and starts the backend, frontend, and agents.

    > **Important:** Ensure Docker Desktop is running before executing the script.

    ```bash
    chmod +x clean_restart.sh
    ./clean_restart.sh
    ```
    
    > **Note:** This script will output the deployed contract addresses. Keep the terminal open to see logs from the Backend and Agents.

4.  **Access the Platform**
    *   **Frontend Dashboard:** [http://localhost:3001](http://localhost:3001)
    *   **Backend documentation:** [http://localhost:4000/docs](http://localhost:4000/docs)
    *   **Agent Console:** [http://localhost:3001/agent](http://localhost:3001/agent)

### Manual Setup (Optional)
If you prefer to run services individually:
1.  **Start Hardhat Node:** `cd contract && npx hardhat node`
2.  **Deploy Contracts:** `cd contract && npx hardhat run scripts/deploy.ts --network localhost`
3.  **Start Database:** `docker-compose up -d`
4.  **Run Backend:** `cd backend && pnpm dev`
5.  **Run Frontend:** `cd frontend && pnpm dev`
6.  **Run Agents:** `cd agent && pnpm dev`

---

## Team

**TIFA is a product of Cayvox Labs.**

<div align="left">
  
| Name | Role |
|:---|:---|
| **Anil Karacay** | Founder of Cayvox Labs |
| **Ceren Sahin** | Full Stack Developer at Cayvox Labs |

</div>

**Contact:**
*   📧 [info@cayvox.com](mailto:info@cayvox.com)
*   📧 [anilkaracayy@gmail.com](mailto:anilkaracayy@gmail.com)

---
*License: MIT*
