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
