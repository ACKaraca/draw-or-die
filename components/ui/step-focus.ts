/** Id of the StepRouter wrapper; the header skip link and step-change focus management target it. */
export const STEP_CONTENT_ID = 'step-content';

const STEP_HEADING_SELECTOR = 'h1, h2';

export function listStepHeadings(root: Element): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(STEP_HEADING_SELECTOR));
}

/** First h1/h2 of the rendered step, skipping headings of a step that is still leaving (`stale`). */
export function findStepHeading(root: Element, stale?: ReadonlySet<Element>): HTMLElement | null {
  return listStepHeadings(root).find((heading) => !stale?.has(heading)) ?? null;
}

/** Moves focus to a step heading without adding it to the tab order or scrolling the page. */
export function focusStepHeading(heading: HTMLElement): void {
  if (!heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1');
  heading.setAttribute('data-step-focus-target', '');
  heading.focus({ preventScroll: true });
}

export function focusCurrentStepHeading(): boolean {
  const root = document.getElementById(STEP_CONTENT_ID);
  const heading = root ? findStepHeading(root) : null;
  if (!heading) return false;
  focusStepHeading(heading);
  return true;
}
