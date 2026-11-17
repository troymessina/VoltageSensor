/**
 * Trace.ts
 *
 * The recorded run: voltage sampled on the recorder's fixed clock, held as two
 * index-aligned series so the graph and the table can read either column
 * without rebuilding anything.
 */

export class Trace {
  /** Sample times, in seconds — exact multiples of the run's sample period. */
  private readonly times: number[] = [];

  /** Voltages, in volts, index-aligned with {@link times}. */
  private readonly voltages: number[] = [];

  public get length(): number {
    return this.times.length;
  }

  public get isEmpty(): boolean {
    return this.times.length === 0;
  }

  public add(time: number, voltage: number): void {
    this.times.push(time);
    this.voltages.push(voltage);
  }

  public clear(): void {
    this.times.length = 0;
    this.voltages.length = 0;
  }

  public getTimes(): readonly number[] {
    return this.times;
  }

  public getVoltages(): readonly number[] {
    return this.voltages;
  }
}
