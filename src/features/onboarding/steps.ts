export type OnboardingStep = 'welcome' | 'backups' | 'budget' | 'categories' | 'account' | 'done';

/** First run explains the app; adding another budget from Settings goes straight to the form. */
export type OnboardingMode = 'first-run' | 'additional';

const FIRST_RUN: readonly OnboardingStep[] = [
	'welcome',
	'backups',
	'budget',
	'categories',
	'account',
	'done'
];

const ADDITIONAL: readonly OnboardingStep[] = ['budget', 'categories', 'account'];

/** The steps shown for `mode`, in order. */
export function onboardingSteps(mode: OnboardingMode): OnboardingStep[] {
	return [...(mode === 'first-run' ? FIRST_RUN : ADDITIONAL)];
}

function neighbour(
	steps: readonly OnboardingStep[],
	step: OnboardingStep,
	offset: number
): OnboardingStep | null {
	const index = steps.indexOf(step);
	if (index === -1) return null;
	return steps[index + offset] ?? null;
}

export function stepAfter(
	steps: readonly OnboardingStep[],
	step: OnboardingStep
): OnboardingStep | null {
	return neighbour(steps, step, 1);
}

export function stepBefore(
	steps: readonly OnboardingStep[],
	step: OnboardingStep
): OnboardingStep | null {
	return neighbour(steps, step, -1);
}

/** The step's 1-based position, for "Step {current} of {total}". */
export function stepNumber(steps: readonly OnboardingStep[], step: OnboardingStep): number {
	return steps.indexOf(step) + 1;
}
