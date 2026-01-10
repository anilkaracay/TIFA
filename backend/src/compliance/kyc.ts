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
            // Return a stub if strictly needed or just null. 
            // Better to return structure matching UI expectations.
            return null;
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

        const payload = {
            subjectType,
            status: 'PENDING',
            legalName: data.legalName,
            registrationNumber: data.registrationNumber,
            country: data.country,
            contactName: data.contactName,
            contactEmail: data.contactEmail,
            metadata: data.metadata ? JSON.stringify(data.metadata) : undefined,
            submittedAt: new Date(),
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
                action: 'KYC_SUBMITTED',
                actorType: 'USER',
                actorId: subjectId,
                targetId: profile.id,
                metadata: JSON.stringify({ status: 'PENDING' })
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
