export interface BackLayer {
	close: () => void;
	/** Read at the time of the gesture, rather than captured when the layer opens. */
	back?: () => (() => void) | undefined;
}

interface LayerHistory {
	push: (id: string) => void;
	back: () => void;
	settle: () => Promise<void>;
}

/** One disposable history entry protects the stack of open mobile layers. */
export class MobileBack {
	private layers: BackLayer[] = [];
	private mobile = false;
	private entry: string | null = null;
	private removing = false;
	private processing = false;
	private waiters: (() => void)[] = [];

	constructor(private history: LayerHistory) {}

	get protected(): boolean {
		return this.entry !== null || this.removing || this.processing;
	}

	owns(id: string | undefined): boolean {
		return id !== undefined && id === this.entry;
	}

	register(layer: BackLayer): () => void {
		this.layers.push(layer);
		this.sync();
		return () => {
			this.layers = this.layers.filter((item) => item !== layer);
			this.sync();
		};
	}

	setMobile(mobile: boolean): void {
		this.mobile = mobile;
		this.sync();
	}

	private sync(): void {
		if (this.processing || this.removing) return;
		if (this.mobile && this.layers.length) {
			if (!this.entry) {
				this.entry = crypto.randomUUID();
				this.history.push(this.entry);
			}
		} else if (this.entry) {
			this.removing = true;
			this.history.back();
		}
	}

	/** Called after the router has applied the shallow popstate. */
	async pop(): Promise<void> {
		if (this.processing || !this.entry) return;
		this.entry = null;
		this.processing = true;
		try {
			if (!this.removing && this.mobile) {
				const layer = this.layers.at(-1);
				const back = layer?.back?.();
				if (back) back();
				else layer?.close();
			}
			await this.history.settle();
		} finally {
			this.processing = false;
			this.removing = false;
			this.sync();
			for (const resolve of this.waiters.splice(0)) resolve();
		}
	}

	/** Explicit navigation closes the layers and waits for any pending history cleanup. */
	clear(): Promise<void> {
		const layers = this.layers;
		this.layers = [];
		for (const layer of layers.toReversed()) layer.close();
		this.sync();
		if (!this.protected) return Promise.resolve();
		return new Promise((resolve) => this.waiters.push(resolve));
	}
}
