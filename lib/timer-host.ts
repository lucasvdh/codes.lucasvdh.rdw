/** The timer functions of `this.homey`, injectable so Homey-free code can be tested with fakes. */
export interface TimerHost {
  setTimeout(callback: () => void, ms: number): NodeJS.Timeout;
  clearTimeout(timer: NodeJS.Timeout | undefined): void;
}

export type Log = (...args: unknown[]) => void;
