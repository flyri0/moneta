import type { Table } from './connection';

export interface CallRequest {
	id: number;
	method: string; // 'namespace.name', e.g. 'accounts.create' or 'system.open'
	args: unknown[];
}

export interface RpcErrorPayload {
	code: string;
	message: string;
	details?: unknown;
}

export type CallResponse =
	| { id: number; ok: true; data: unknown; changed: Table[] }
	| { id: number; ok: false; error: RpcErrorPayload };

/** The buffer under `value` when `value` is bytes that fill it, so it can be handed over whole. */
function ownBuffer(value: unknown): ArrayBuffer | null {
	if (!(value instanceof Uint8Array)) return null;
	const { buffer } = value;
	const whole = value.byteOffset === 0 && value.byteLength === buffer.byteLength;
	return whole && buffer instanceof ArrayBuffer ? buffer : null;
}

/**
 * Buffers a response can hand to the page instead of copying: the bytes a call returns, alone or
 * as `bytes` (a backup). Only buffers the bytes fill are handed over, never a view into a larger
 * one such as WebAssembly memory. The worker never touches a result again once it is sent.
 */
export function transferablesOf(res: CallResponse): ArrayBuffer[] {
	if (!res.ok) return [];
	const own = ownBuffer(res.data) ?? ownBuffer((res.data as { bytes?: unknown } | null)?.bytes);
	return own ? [own] : [];
}
