import { prisma } from '../db';
import { Role } from '../auth/roles';

export class KycService {

    /**
     * Get or create a KYC profile for a subject (Issuer=CompanyId, LP=Wallet)
     */
    async getProfile(subjectId: string, subjectType: 'ISSUER' | 'LP') {
        const where = subjectType === 'ISSUER'
            ? { companyId: subjectId }
            : { wallet: subjectId };

        let profile = await prisma.kycProfile.findFirst({ where });

        if (!profile) {
            // Return a stub for UI consistency
            return {
                id: 'stub_' + subjectId,
                subjectType,
                status: 'NOT_STARTED',
                companyId: subjectType === 'ISSUER' ? subjectId : null,
                wallet: subjectType === 'LP' ? subjectId : null,
                // Empty fields
                legalName: null,
                registrationNumber: null,
                country: null,
                contactName: null,
                contactEmail: null,
                submittedAt: null,
                reviewedAt: null,
                reviewerId: null,
                rejectionReason: null,
                createdAt: new Date(),
                updatedAt: new Date(),
            } as any; // Cast as partial mock
        }
        return profile;
    }

    /**
     * Submit KYC data
     */
    async submitProfile(subjectId: string, subjectType: 'ISSUER' | 'LP', data: any) {
        const where = subjectType === 'ISSUER'
            ? { companyId: subjectId }
            : { wallet: subjectId };

        const existing = await prisma.kycProfile.findFirst({ where });

        // Auto-Approver Logic (Mock)
        // If country includes "Sanctioned", reject. Else approve immediately for demo flow.
        const isSanctioned = data.country && ['North Korea', 'Iran', 'Syria', 'Cuba', 'Russia'].some(c => data.country.includes(c));
        const autoStatus = isSanctioned ? 'REJECTED' : 'APPROVED';
        const rejectionReason = isSanctioned ? 'Sanctioned Country Policy' : undefined;

        const payload = {
            subjectType,
            status: autoStatus, // AUTO VERDICT
            legalName: data.legalName,
            registrationNumber: data.registrationNumber,
            country: data.country,
            contactName: data.contactName,
            contactEmail: data.contactEmail,
            metadata: data.metadata ? JSON.stringify(data.metadata) : undefined,
            submittedAt: new Date(),
            reviewedAt: new Date(), // Auto-reviewed
            reviewerId: 'SYSTEM_AUTO_VERIFIER',
            rejectionReason,
            // Link fields
            companyId: subjectType === 'ISSUER' ? subjectId : undefined,
            wallet: subjectType === 'LP' ? subjectId : undefined,
        };

        let profile;
        if (existing) {
            profile = await prisma.kycProfile.update({
                where: { id: existing.id },
                data: payload
            });
        } else {
            profile = await prisma.kycProfile.create({
                data: payload
            });
        }

        // Audit Log
        await prisma.complianceAuditLog.create({
            data: {
                action: isSanctioned ? 'KYC_REJECTED' : 'KYC_APPROVED',
                actorType: 'SYSTEM',
                actorId: 'AUTO_VERIFIER',
                targetId: profile.id,
                metadata: JSON.stringify({ reason: 'Auto-Verdict applied', inputs: { country: data.country } })
            }
        });

        return profile;
    }

    /**
     * List pending profiles for admin
     */
    async listPendingProfiles() {
        return prisma.kycProfile.findMany({
            where: { status: 'PENDING' },
            orderBy: { submittedAt: 'desc' },
            include: { company: true }
        });
    }

    /**
     * Approve Profile
     */
    async approveProfile(profileId: string, adminId: string) {
        const profile = await prisma.kycProfile.update({
            where: { id: profileId },
            data: {
                status: 'APPROVED',
                reviewedAt: new Date(),
                reviewerId: adminId
            }
        });

        await prisma.complianceAuditLog.create({
            data: {
                action: 'KYC_APPROVED',
                actorType: 'ADMIN',
                actorId: adminId,
                targetId: profileId,
            }
        });

        return profile;
    }

    /**
     * Reject Profile
     */
    async rejectProfile(profileId: string, reason: string, adminId: string) {
        const profile = await prisma.kycProfile.update({
            where: { id: profileId },
            data: {
                status: 'REJECTED',
                rejectionReason: reason,
                reviewedAt: new Date(),
                reviewerId: adminId
            }
        });

        await prisma.complianceAuditLog.create({
            data: {
                action: 'KYC_REJECTED',
                actorType: 'ADMIN',
                actorId: adminId,
                targetId: profileId,
                metadata: JSON.stringify({ reason })
            }
        });

        return profile;
    }
}

export const kycService = new KycService();
