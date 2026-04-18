import { gsap } from 'gsap';

/** Pause the code for a certain amount of time, in seconds */
export async function waitFor(delayInSecs = 1): Promise<void> {
  await gsap.delayedCall(delayInSecs, () => {});
}
