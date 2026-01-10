import { env } from '../env';
import { kycService } from './kyc';

export class ComplianceGateService {

    /**
     * Check if an action is allowed for a subject
     */
    async checkGate(
        subjectId: string,
        subjectType: 'LP' | 'ISSUER',
        action: 'DEPOSIT' | 'CLAIM_YIELD' | 'TOKENIZE'
    ): Promise<{ allowed: boolean; reason?: string }> {

        // 1. Check feature flag
        if (!env.COMPLIANCE_ENABLED) {
            return { allowed: true };
        }

        // 2. Check specific requirement flags
        let required = false;
        if (subjectType === 'LP' && (action === 'DEPOSIT' || action === 'CLAIM_YIELD') && env.KYC_REQUIRED_FOR_LP) {
            required = true;
        }
        if (subjectType === 'ISSUER' && action === 'TOKENIZE' && env.KYC_REQUIRED_FOR_ISSUER) {
            required = true;
        }

        if (!required) {
            return { allowed: true };
        }

        // 3. Check KYC Status
        const profile = await kycService.getProfile(subjectId, subjectType);

        if (!profile || profile.status !== 'APPROVED') {
            return {
                allowed: false,
                reason: `Compliance restriction: ${subjectType} KYC must be APPROVED. Current status: ${profile?.status || 'NOT_STARTED'}`
            };
        }

        return { allowed: true };
    }
}

export const complianceGate = new ComplianceGateService();
