import { useEffect, type RefObject } from 'react';

/** Elements carrying this attribute (e.g. a toast live region) stay reachable while a modal is open. */
export const INERT_EXEMPT_ATTRIBUTE = 'data-inert-exempt';

/**
 * Marks everything outside the modal container as `inert` while it is active, so assistive tech and
 * pointer/keyboard users cannot reach the page behind an `aria-modal` dialog. Walks from the container up
 * to `<body>` and inerts each ancestor's siblings; only attributes this hook added are removed again.
 */
export function useInertBackground(containerRef: RefObject<HTMLElement | null>, isActive: boolean): void {
  useEffect(() => {
    const container = containerRef.current;
    if (!isActive || !container) return undefined;

    const inerted: HTMLElement[] = [];
    let node: HTMLElement = container;
    while (node !== document.body && node.parentElement) {
      const parent: HTMLElement = node.parentElement;
      for (const sibling of Array.from(parent.children)) {
        if (sibling === node || !(sibling instanceof HTMLElement)) continue;
        if (sibling.hasAttribute('inert') || sibling.hasAttribute(INERT_EXEMPT_ATTRIBUTE)) continue;
        if (sibling.tagName === 'SCRIPT' || sibling.tagName === 'STYLE') continue;
        sibling.setAttribute('inert', '');
        inerted.push(sibling);
      }
      node = parent;
    }

    return () => {
      for (const element of inerted) element.removeAttribute('inert');
    };
  }, [containerRef, isActive]);
}
