import { m } from '$i18n/paraglide/messages';
import type { FormError } from './form';

/** The inline message for each transaction form error. */
export const FORM_ERRORS: Record<FormError, () => string> = {
	ACCOUNT_REQUIRED: m.form_error_account_required,
	DATE_INVALID: m.form_error_date_invalid,
	AMOUNT_INVALID: m.form_error_amount_invalid,
	CATEGORY_REQUIRED: m.error_category_required,
	SPLIT_LINE_INVALID: m.form_error_split_line_invalid,
	SPLIT_TOO_FEW_LINES: m.error_split_too_few_lines,
	SPLIT_SUM_MISMATCH: m.error_split_sum_mismatch
};
