"use client";

import { useEffect } from 'react';

export function ScrollPreservation() {
    useEffect(() => {
        // Disable all scroll restoration at global level
        if (typeof window !== 'undefined') {
            // Disable browser scroll restoration
            if ('scrollRestoration' in window.history) {
                window.history.scrollRestoration = 'manual';
            }

            // Save scroll position globally
            let scrollY = 0;
            let scrollX = 0;
            let ticking = false;

            const saveScrollPosition = () => {
                scrollY = window.scrollY || window.pageYOffset;
                scrollX = window.scrollX || window.pageXOffset;
            };

            const handleScroll = () => {
                if (!ticking) {
                    window.requestAnimationFrame(() => {
                        saveScrollPosition();
                        ticking = false;
                    });
                    ticking = true;
                }
            };

            // Aggressive scroll preservation on any DOM change
            const observer = new MutationObserver(() => {
                const currentY = window.scrollY || window.pageYOffset;
                const currentX = window.scrollX || window.pageXOffset;

                // If scroll changed unexpectedly, restore it
                if (Math.abs(currentY - scrollY) > 5 || Math.abs(currentX - scrollX) > 5) {
                    window.scrollTo({ left: scrollX, top: scrollY, behavior: 'auto' });
                }
            });

            observer.observe(document.body, {
                childList: true,
                subtree: true,
                attributes: true,
                characterData: true,
            });

            window.addEventListener('scroll', handleScroll, { passive: true });

            // Prevent focus-based scrolling
            const preventFocusScroll = (e: FocusEvent) => {
                const target = e.target as HTMLElement;
                if (target && typeof target.scrollIntoView === 'function') {
                    e.preventDefault();
                }
            };

            window.addEventListener('focus', preventFocusScroll, { capture: true });

            return () => {
                observer.disconnect();
                window.removeEventListener('scroll', handleScroll);
                window.removeEventListener('focus', preventFocusScroll, { capture: true });
            };
        }
        return; // Explicit return for SSR
    }, []);

    return null;
}
