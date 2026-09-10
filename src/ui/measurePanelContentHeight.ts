/** A computed length in CSS pixels, or 0 when the browser has nothing to say about it. */
const px = (value: string): number => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const isElement = (node: Node): node is HTMLElement => node instanceof HTMLElement;

/** A box whose own height is decided by flex rather than by what is inside it. */
const isStretched = (style: CSSStyleDeclaration): boolean => px(style.flexGrow) > 0;

/** A box that scrolls its overflow, so `scrollHeight` is the whole truth about its content. */
const isScroller = (style: CSSStyleDeclaration): boolean =>
  style.overflowY === 'auto' || style.overflowY === 'scroll';

/** A box that hides its overflow, so its own height may be smaller than its content's. */
const isClipped = (style: CSSStyleDeclaration): boolean => style.overflowY === 'hidden';

/**
 * A box with a deliberate `max-height` of its own — `.setup__preview` is capped at 130px and
 * scrolls on purpose, because the JSON it shows is unbounded. Its box height *is* its answer;
 * reading `scrollHeight` there would ask the window to grow to fit a whole settings file.
 */
const isCapped = (style: CSSStyleDeclaration): boolean =>
  style.maxHeight !== 'none' && style.maxHeight !== '';

/**
 * The height an element would take if nothing constrained it, in CSS pixels.
 *
 * Four cases, and **the order is the whole design**:
 *
 * - **A capped box** answers with its own box: it was given a `max-height` because its content
 *   is unbounded, and that decision outranks everything below.
 * - **A stretched or clipped box** knows nothing useful about what it wants — `flex: 1` makes it
 *   as tall as the window and `overflow: hidden` lets it be shorter than its content — so it is
 *   rebuilt from its children, plus its own padding, borders and row gaps. This has to come
 *   *before* the scroll-container case, because `.setup__scroll` is both: it stretches **and**
 *   it scrolls, so its `scrollHeight` equals its stretched box whenever the content is shorter
 *   than the window. Asking it first would mean the setup view could grow and never shrink.
 * - **A scroll container** that is none of the above already knows: `scrollHeight` is its content
 *   plus its padding, whatever height its box has been squeezed to.
 * - **Anything else** is already at its natural height.
 *
 * Margins are added by the element itself rather than by its parent, which is what makes the
 * `.group + .group` separator (a top margin and a hairline border) count exactly once.
 */
const naturalHeight = (element: HTMLElement): number => {
  const style = getComputedStyle(element);
  const margins = px(style.marginTop) + px(style.marginBottom);

  if (isCapped(style)) return element.getBoundingClientRect().height + margins;

  if (isStretched(style) || isClipped(style)) {
    const children = Array.from(element.childNodes).filter(isElement);
    const inner = children.reduce((total, child) => total + naturalHeight(child), 0);
    const gaps = px(style.rowGap) * Math.max(children.length - 1, 0);

    return (
      px(style.paddingTop) +
      px(style.paddingBottom) +
      px(style.borderTopWidth) +
      px(style.borderBottomWidth) +
      inner +
      gaps +
      margins
    );
  }

  if (isScroller(style)) {
    return element.scrollHeight + px(style.borderTopWidth) + px(style.borderBottomWidth) + margins;
  }

  return element.getBoundingClientRect().height + margins;
};

/**
 * How tall the panel wants to be, in CSS pixels, for whatever it is currently showing.
 *
 * Measured from the live DOM on purpose. The alternative — a formula over the session counts,
 * with the row height and every heading and separator as constants — was rejected because those
 * constants exist in `panel.css` already, and a stylesheet this app has just redesigned twice
 * would silently drift away from them. Reading the layout back means auto-height is correct by
 * construction for the session list, the setup view and the empty state alike, and stays correct
 * the next time the design moves (ADR-0015).
 *
 * The result is *logical* pixels; the caller multiplies by the window's scale factor before it
 * goes anywhere near `setSize`, or the panel would come out half height on a Retina display.
 */
export const measurePanelContentHeight = (panel: HTMLElement): number => naturalHeight(panel);
