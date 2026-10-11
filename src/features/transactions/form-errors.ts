import { formatAmountInput, type MoneyFormat } from '$domain/money';
import { m } from '$i18n/paraglide/messages';
import type { FormError } from './form';

/** The inline message for each transaction form error, with an example in the budget format. */
export function formErrorMessage(error: FormError, money: MoneyFormat): string {
	if (error === 'AMOUNT_INVALID')
		return m.form_error_amount_invalid({ example: formatAmountInput(1250, money) });
	return FORM_ERRORS[error]();
}

export const FORM_ERRORS: Record<Exclude<FormError, 'AMOUNT_INVALID'>, () => string> = {
	ACCOUNT_REQUIRED: m.form_error_account_required,
	DATE_INVALID: m.form_error_date_invalid,
	CATEGORY_REQUIRED: m.error_category_required,
	SPLIT_LINE_INVALID: m.form_error_split_line_invalid,
	SPLIT_TOO_FEW_LINES: m.error_split_too_few_lines,
	SPLIT_SUM_MISMATCH: m.error_split_sum_mismatch,
	INSTALLMENTS_INVALID: m.form_error_installments_invalid
};
