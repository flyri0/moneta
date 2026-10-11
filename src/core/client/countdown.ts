/**
 * The wait before a destructive confirmation: the first tap arms it, the button stays disabled
 * for `delay` seconds, then a second tap confirms. `onChange` hears every change, for a component
 * to mirror into its state.
 */
export class Countdown {
	#armed = false;
	#seconds = 0;
	#timer: ReturnType<typeof setInterval> | undefined;

	constructor(
		private readonly delay: number,
		private readonly onChange: (state: { armed: boolean; seconds: number }) => void
	) {}

	get armed(): boolean {
		return this.#armed;
	}

	get seconds(): number {
		return this.#seconds;
	}

	get ready(): boolean {
		return this.#armed && this.#seconds === 0;
	}

	arm(): void {
		this.#stop();
		this.#armed = true;
		this.#seconds = this.delay;
		this.#emit();
		this.#timer = setInterval(() => {
			this.#seconds--;
			if (this.#seconds <= 0) this.#stop();
			this.#emit();
		}, 1000);
	}

	reset(): void {
		this.#stop();
		this.#armed = false;
		this.#seconds = 0;
		this.#emit();
	}

	#stop(): void {
		if (this.#timer !== undefined) clearInterval(this.#timer);
		this.#timer = undefined;
	}

	#emit(): void {
		this.onChange({ armed: this.#armed, seconds: this.#seconds });
	}
}
