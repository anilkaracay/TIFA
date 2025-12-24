import { FastifyInstance } from 'fastify';
import websocket from '@fastify/websocket';

export interface WebSocketEvent {
    type: string;
    payload: any;
    timestamp: string;
}

class WebSocketManager {
    private connections: Map<string, Set<any>> = new Map();
    private eventEmitter: Map<string, ((event: WebSocketEvent) => void)[]> = new Map();

    /**
     * Subscribe to a room (e.g., 'invoice:123', 'wallet:0x...', 'global')
     */
    subscribe(room: string, connection: any) {
        if (!this.connections.has(room)) {
            this.connections.set(room, new Set());
        }
        this.connections.get(room)!.add(connection);

        // Send connection confirmation
        connection.socket.send(JSON.stringify({
            type: 'connected',
            room,
            timestamp: new Date().toISOString(),
        }));

        // Handle disconnect
        connection.socket.on('close', () => {
            this.unsubscribe(room, connection);
        });
    }

    /**
     * Unsubscribe from a room
     */
    unsubscribe(room: string, connection: any) {
        const roomConnections = this.connections.get(room);
        if (roomConnections) {
            roomConnections.delete(connection);
            if (roomConnections.size === 0) {
                this.connections.delete(room);
            }
        }
    }

    /**
     * Broadcast event to a specific room
     */
    broadcast(room: string, event: WebSocketEvent) {
        const roomConnections = this.connections.get(room);
        if (roomConnections) {
            const message = JSON.stringify(event);
            roomConnections.forEach((connection) => {
                try {
                    if (connection.socket.readyState === 1) { // OPEN
                        connection.socket.send(message);
                    }
                } catch (error) {
                    console.error(`Error sending WebSocket message to room ${room}:`, error);
                    this.unsubscribe(room, connection);
                }
            });
        }
    }

    /**
     * Broadcast to all rooms (global broadcast)
     */
    broadcastGlobal(event: WebSocketEvent) {
        this.connections.forEach((_, room) => {
            this.broadcast(room, event);
        });
    }

    /**
     * Get connection count for a room
     */
    getConnectionCount(room: string): number {
        return this.connections.get(room)?.size || 0;
    }

    /**
     * Get total connection count
     */
    getTotalConnections(): number {
        let total = 0;
        this.connections.forEach((connections) => {
            total += connections.size;
        });
        return total;
    }
}

// Singleton instance
export const wsManager = new WebSocketManager();

/**
 * Register WebSocket server with Fastify
 */
export async function registerWebSocketServer(app: FastifyInstance) {
    await app.register(websocket);

    app.get('/ws', { websocket: true }, (connection, req) => {
        const url = new URL(req.url || '', `http://${req.headers.host || 'localhost:4000'}`);
        const room = url.searchParams.get('room') || 'global';

        wsManager.subscribe(room, connection);

        connection.socket.on('message', (message: Buffer) => {
            try {
                const data = JSON.parse(message.toString());
                if (data.type === 'ping') {
                    connection.socket.send(JSON.stringify({
                        type: 'pong',
                        timestamp: new Date().toISOString(),
                    }));
                }
            } catch (error) {
                console.error('Error parsing WebSocket message:', error);
            }
        });
    });

    console.log('WebSocket server registered at /ws');
}

/**
 * Helper functions to emit events
 */
export const emitInvoiceEvent = (invoiceId: string, event: Omit<WebSocketEvent, 'timestamp'>) => {
    wsManager.broadcast(`invoice:${invoiceId}`, {
        ...event,
        timestamp: new Date().toISOString(),
    });
    wsManager.broadcast('global', {
        ...event,
        timestamp: new Date().toISOString(),
    });
};

export const emitPoolEvent = (event: Omit<WebSocketEvent, 'timestamp'>) => {
    wsManager.broadcastGlobal({
        ...event,
        timestamp: new Date().toISOString(),
    });
};

export const emitLPEvent = (wallet: string, event: Omit<WebSocketEvent, 'timestamp'>) => {
    wsManager.broadcast(`wallet:${wallet.toLowerCase()}`, {
        ...event,
        timestamp: new Date().toISOString(),
    });
    wsManager.broadcast('global', {
        ...event,
        timestamp: new Date().toISOString(),
    });
};

export const emitAgentEvent = (event: Omit<WebSocketEvent, 'timestamp'>) => {
    wsManager.broadcast('agent', {
        ...event,
        timestamp: new Date().toISOString(),
    });
    wsManager.broadcast('global', {
        ...event,
        timestamp: new Date().toISOString(),
    });
};

