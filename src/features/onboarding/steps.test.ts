import { describe, expect, it } from 'vitest';
import { onboardingSteps, stepAfter, stepBefore, stepNumber } from './steps';

describe('onboardingSteps', () => {
	it('explains the app before the form on the first run', () => {
		expect(onboardingSteps('first-run')).toEqual([
			'welcome',
			'backups',
			'budget',
			'categories',
			'account',
			'done'
		]);
	});

	it('skips the explainers and the closing screen for another budget', () => {
		expect(onboardingSteps('additional')).toEqual(['budget', 'categories', 'account']);
	});
});

describe('stepAfter and stepBefore', () => {
	const steps = onboardingSteps('first-run');

	it('walks the list in both directions', () => {
		expect(stepAfter(steps, 'budget')).toBe('categories');
		expect(stepBefore(steps, 'categories')).toBe('budget');
	});

	it('has nothing past either end', () => {
		expect(stepBefore(steps, 'welcome')).toBeNull();
		expect(stepAfter(steps, 'done')).toBeNull();
	});

	it('ignores steps the mode never shows', () => {
		const additional = onboardingSteps('additional');
		expect(stepBefore(additional, 'budget')).toBeNull();
		expect(stepAfter(additional, 'account')).toBeNull();
		expect(stepAfter(additional, 'welcome')).toBeNull();
	});
});

describe('stepNumber', () => {
	it('counts from one so it can be shown as "step n of m"', () => {
		expect(stepNumber(onboardingSteps('first-run'), 'budget')).toBe(3);
		expect(stepNumber(onboardingSteps('additional'), 'budget')).toBe(1);
	});
});
