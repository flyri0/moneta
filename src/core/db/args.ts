import { DomainError } from '$domain/errors';

/** The shape of one RPC argument, checked at the worker boundary. */
export type ArgKind = 'string' | 'number' | 'boolean' | 'object' | 'array' | 'bytes';

type KindOf<T> = T extends Uint8Array
	? 'bytes'
	: T extends readonly unknown[]
		? 'array'
		: T extends string
			? 'string'
			: T extends number
				? 'number'
				: T extends boolean
					? 'boolean'
					: T extends object
						? 'object'
						: never;

/** One kind per parameter, with a trailing `?` for optional ones, e.g. `['string', 'string?']`. */
export type ArgSpec<A extends unknown[]> = number extends A['length']
	? never
	: A extends []
		? []
		: A extends [infer H, ...infer R]
			? [KindOf<H>, ...ArgSpec<R>]
			: A extends [(infer H)?, ...infer R]
				? [`${KindOf<Exclude<H, undefined>>}?`, ...ArgSpec<R>]
				: never;

function matches(kind: ArgKind, value: unknown): boolean {
	switch (kind) {
		case 'array':
			return Array.isArray(value);
		case 'bytes':
			return value instanceof Uint8Array;
		case 'object':
			return (
				typeof value === 'object' &&
				value !== null &&
				!Array.isArray(value) &&
				!(value instanceof Uint8Array)
			);
		default:
			return typeof value === kind;
	}
}

/**
 * Checks each argument's top-level shape against `spec` and throws INVALID_INPUT on a mismatch.
 * Field-level checks stay in the repos.
 */
export function checkArgs(
	method: string,
	spec: readonly string[],
	args: unknown
): asserts args is unknown[] {
	if (!Array.isArray(args) || args.length > spec.length)
		throw new DomainError('INVALID_INPUT', `${method}: wrong number of arguments`);
	spec.forEach((entry, i) => {
		const optional = entry.endsWith('?');
		if (optional && args[i] === undefined) return;
		const kind = (optional ? entry.slice(0, -1) : entry) as ArgKind;
		if (!matches(kind, args[i]))
			throw new DomainError('INVALID_INPUT', `${method}: argument ${i + 1} must be ${kind}`);
	});
}
