import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { MIGRATIONS } from './migrate';

/**
 * SHA-256 of every migration as released. An applied migration must never change: a budget that
 * already ran it would keep the old schema while a new one gets the edited one. Fix a mistake with
 * a new numbered migration; add each new one here.
 */
const FROZEN = [
	'ff229307f1e2e674d7c055a92eb1e71dcdc6e7ebfaa14b717a57dd4662776f09',
	'147f7f54ce8ccbacfa35354ef1f6583301e81ababbecf044397ee3ac2c90ab26',
	'46deeb49a2e7197c2b451b97e3b162f048b72213f3bda03c40f17c16f9593486',
	'032fc101d570111aa4793109386345ce7cf625e21f57c23d092fcbf6902c2ade',
	'b16b0b07883eb4e277b2b03482bf8c45750df3f61a6352c26e3430a3aba7b408',
	'0305ccd10b80f98728a47aa4c87cabe19d08db124c6c70f47e1f259d18be44a7',
	'810b9bedbe0ee76231f1c7f31283339b913e0e513c7e2f62f01729171598b5b2',
	'c9e817bc993f8276fcc9a10a7fcea1b9867e47e58789bbe227e52f401cb49135',
	'bd0d006f04c24f386d5b94ce24e32a3e0d88c5bbdc6bb672467997bc02e7bcd2',
	'953b494e8adbaef1525315f13900f32d6a18779a67f15db39b75b1bcb341b03c',
	'6157ec1ef9bfba995c1ad6fc8422728eb778eaabdf7c4ae7b40af09431d5efa7'
];

describe('migrations', () => {
	it('are never edited once released', () => {
		const hashes = MIGRATIONS.map((sql) => createHash('sha256').update(sql).digest('hex'));
		expect(hashes).toEqual(FROZEN);
	});
});
