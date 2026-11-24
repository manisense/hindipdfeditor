/**
 * Motion tokens for the homepage. Three durations, one easing:
 * UI responses (menus, accordion) 180ms, section entries 400ms, the hero and its
 * pointer box 600ms. Times are in seconds, the unit motion/react expects.
 */
export const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];

export const UI = { duration: 0.18, ease: EASE_OUT } as const;
export const ENTER = { duration: 0.4, ease: EASE_OUT } as const;
export const HERO = { duration: 0.6, ease: EASE_OUT } as const;

/** Delay between siblings entering one after another, in seconds. */
export const STAGGER = 0.08;
