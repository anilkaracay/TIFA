import { FastifyRequest } from 'fastify';
import { NETWORKS, DEFAULT_NETWORK } from '@tifa/config';

export function getChainIdFromRequest(req: FastifyRequest): number {
    // Check header 'x-chain-id'
    const header = req.headers['x-chain-id'];
    if (header) {
        const id = Number(header);
        if (!isNaN(id) && id > 0) return id;
    }

    // Check query param 'chainId'
    const query = req.query as any;
    if (query && query.chainId) {
        const id = Number(query.chainId);
        if (!isNaN(id) && id > 0) return id;
    }

    // Default
    return NETWORKS[DEFAULT_NETWORK].chainId;
}
