import { useEffect, useRef, useState, useCallback } from 'react';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';
const WS_URL = BACKEND_URL.replace(/^http/, 'ws') + '/ws';

export interface WebSocketEvent {
    type: string;
    payload: any;
    timestamp: string;
}

export type EventHandler = (event: WebSocketEvent) => void;

class WebSocketManager {
    private ws: WebSocket | null = null;
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 10;
    private reconnectDelay = 1000;
    private reconnectTimer: NodeJS.Timeout | null = null;
    private eventHandlers: Map<string, Set<EventHandler>> = new Map();
    private messageQueue: WebSocketEvent[] = [];
    private isConnecting = false;
    private room: string = 'global';

    connect(room: string = 'global') {
        if (this.ws?.readyState === WebSocket.OPEN || this.isConnecting) {
            return;
        }

        this.room = room;
        this.isConnecting = true;

        try {
            const url = `${WS_URL}?room=${encodeURIComponent(room)}`;
            this.ws = new WebSocket(url);

            this.ws.onopen = () => {
                console.log('[WebSocket] Connected to', room);
                this.isConnecting = false;
                this.reconnectAttempts = 0;
                
                // Send queued messages
                while (this.messageQueue.length > 0) {
                    const event = this.messageQueue.shift();
                    if (event && this.ws?.readyState === WebSocket.OPEN) {
                        this.ws.send(JSON.stringify(event));
                    }
                }
            };

            this.ws.onmessage = (message) => {
                try {
                    const event: WebSocketEvent = JSON.parse(message.data);
                    
                    // Handle ping/pong
                    if (event.type === 'pong') {
                        return;
                    }

                    // Call all handlers for this event type
                    const handlers = this.eventHandlers.get(event.type);
                    if (handlers) {
                        handlers.forEach(handler => {
                            try {
                                handler(event);
                            } catch (error) {
                                console.error(`[WebSocket] Error in handler for ${event.type}:`, error);
                            }
                        });
                    }

                    // Call wildcard handlers
                    const wildcardHandlers = this.eventHandlers.get('*');
                    if (wildcardHandlers) {
                        wildcardHandlers.forEach(handler => {
                            try {
                                handler(event);
                            } catch (error) {
                                console.error(`[WebSocket] Error in wildcard handler:`, error);
                            }
                        });
                    }
                } catch (error) {
                    console.error('[WebSocket] Error parsing message:', error);
                }
            };

            this.ws.onerror = (error) => {
                console.error('[WebSocket] Error:', error);
                this.isConnecting = false;
            };

            this.ws.onclose = () => {
                console.log('[WebSocket] Disconnected');
                this.isConnecting = false;
                this.ws = null;
                this.scheduleReconnect();
            };
        } catch (error) {
            console.error('[WebSocket] Connection error:', error);
            this.isConnecting = false;
            this.scheduleReconnect();
        }
    }

    private scheduleReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('[WebSocket] Max reconnect attempts reached');
            return;
        }

        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
        }

        this.reconnectAttempts++;
        const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1), 30000);
        
        console.log(`[WebSocket] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
        
        this.reconnectTimer = setTimeout(() => {
            this.connect(this.room);
        }, delay);
    }

    disconnect() {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        
        this.reconnectAttempts = 0;
    }

    subscribe(eventType: string, handler: EventHandler) {
        if (!this.eventHandlers.has(eventType)) {
            this.eventHandlers.set(eventType, new Set());
        }
        this.eventHandlers.get(eventType)!.add(handler);

        return () => {
            const handlers = this.eventHandlers.get(eventType);
            if (handlers) {
                handlers.delete(handler);
                if (handlers.size === 0) {
                    this.eventHandlers.delete(eventType);
                }
            }
        };
    }

    send(event: WebSocketEvent) {
        if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(event));
        } else {
            // Queue message for when connection is established
            this.messageQueue.push(event);
        }
    }

    getReadyState(): number {
        return this.ws?.readyState ?? WebSocket.CLOSED;
    }

    isConnected(): boolean {
        return this.ws?.readyState === WebSocket.OPEN;
    }
}

// Singleton instance
const wsManager = new WebSocketManager();

/**
 * React hook for WebSocket connection
 */
export function useWebSocket(room: string = 'global', autoConnect: boolean = true) {
    const [isConnected, setIsConnected] = useState(false);
    const [lastEvent, setLastEvent] = useState<WebSocketEvent | null>(null);
    const handlersRef = useRef<Map<string, EventHandler>>(new Map());

    useEffect(() => {
        if (autoConnect) {
            wsManager.connect(room);
        }

        // Update connection status
        const checkConnection = () => {
            setIsConnected(wsManager.isConnected());
        };

        const interval = setInterval(checkConnection, 1000);
        checkConnection();

        return () => {
            clearInterval(interval);
            // Don't disconnect on unmount - keep connection alive for other components
        };
    }, [room, autoConnect]);

    const subscribe = useCallback((eventType: string, handler: EventHandler) => {
        const wrappedHandler: EventHandler = (event) => {
            handler(event);
            setLastEvent(event);
        };

        handlersRef.current.set(eventType, wrappedHandler);
        return wsManager.subscribe(eventType, wrappedHandler);
    }, []);

    const send = useCallback((event: WebSocketEvent) => {
        wsManager.send(event);
    }, []);

    return {
        isConnected,
        lastEvent,
        subscribe,
        send,
        connect: () => wsManager.connect(room),
        disconnect: () => wsManager.disconnect(),
    };
}

/**
 * Hook for subscribing to specific invoice events
 */
export function useInvoiceWebSocket(invoiceId: string | null) {
    return useWebSocket(invoiceId ? `invoice:${invoiceId}` : 'global', !!invoiceId);
}

/**
 * Hook for subscribing to wallet-specific events
 */
export function useWalletWebSocket(wallet: string | null) {
    return useWebSocket(wallet ? `wallet:${wallet.toLowerCase()}` : 'global', !!wallet);
}


