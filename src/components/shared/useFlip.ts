import { useLayoutEffect, useRef } from 'react';

// FLIP reordering with plain CSS transforms — no animation library. Positions
// are captured after every render; when a row's position changes, it is offset
// back to where it was and transitioned to zero, so rows visibly slide to their
// new rank instead of snapping.
export function useFlip(enabled = true) {
  const nodes = useRef(new Map<string, HTMLElement>());
  const positions = useRef(new Map<string, number>());

  useLayoutEffect(() => {
    if (!enabled) return;
    nodes.current.forEach((el, id) => {
      const top = el.getBoundingClientRect().top;
      const prev = positions.current.get(id);
      if (prev !== undefined && Math.abs(prev - top) > 1) {
        el.style.transition = 'none';
        el.style.transform = `translateY(${prev - top}px)`;
        requestAnimationFrame(() => {
          el.style.transition = 'transform 480ms cubic-bezier(0.2, 0.8, 0.2, 1)';
          el.style.transform = '';
        });
      }
      positions.current.set(id, top);
    });
    // Forget rows that have left, so a returning row animates in fresh.
    for (const id of [...positions.current.keys()]) {
      if (!nodes.current.has(id)) positions.current.delete(id);
    }
  });

  return (id: string) => (el: HTMLElement | null) => {
    if (el) nodes.current.set(id, el);
    else nodes.current.delete(id);
  };
}
