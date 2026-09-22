/** Waits for `promise` to settle, or for `ms` to pass, whichever comes first. Never rejects. */
export function settleWithin(promise: Promise<unknown>, ms: number): Promise<void> {
	return new Promise((resolve) => {
		const timer = setTimeout(resolve, ms);
		const done = () => {
			clearTimeout(timer);
			resolve();
		};
		promise.then(done, done);
	});
}
