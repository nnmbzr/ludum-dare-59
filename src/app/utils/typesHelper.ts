/**
 * Extracts the union type of all values from a const object.
 *
 * @example
 * const BonfireAnimation = { IDLE: 'idle', FIRE_ON: 'fire_on' } as const;
 * type BonfireAnimationType = ValuesOf<typeof BonfireAnimation>; // 'idle' | 'fire_on'
 */
export type ValuesOf<T> = T[keyof T];
