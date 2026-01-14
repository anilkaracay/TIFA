import useSWR from 'swr';
import { fetchKycProfile } from '../lib/backendClient';
import { useAccount } from 'wagmi';

export function useKyc(subjectType: 'LP' | 'ISSUER' = 'LP') {
    const { address } = useAccount();

    const { data: profile, error, mutate, isLoading } = useSWR(
        address ? `kyc-profile-${subjectType}-${address}` : null,
        () => fetchKycProfile(subjectType),
        {
            refreshInterval: 30000, // Refresh every 30s
            shouldRetryOnError: false
        }
    );

    const isApproved = profile?.status === 'APPROVED';
    const isPending = profile?.status === 'PENDING' || profile?.status === 'PENDING_REVIEW';
    const isRejected = profile?.status === 'REJECTED';
    const isNotStarted = !profile || profile.status === 'NOT_STARTED';

    return {
        profile,
        loading: isLoading,
        error,
        refreshKyc: mutate,
        isApproved,
        isPending,
        isRejected,
        isNotStarted
    };
}
