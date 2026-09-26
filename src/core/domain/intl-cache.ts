/**
 * Intl formatters, built once per locale and options. Building one costs far more than using it,
 * and lists and charts format hundreds of values per render.
 */
const numbers = new Map<string, Intl.NumberFormat>();
const dates = new Map<string, Intl.DateTimeFormat>();

function cached<F>(cache: Map<string, F>, key: string, create: () => F): F {
	let format = cache.get(key);
	if (!format) {
		format = create();
		cache.set(key, format);
	}
	return format;
}

/** `new Intl.NumberFormat(locale, options)`, shared. */
export function numberFormat(locale: string, options: Intl.NumberFormatOptions = {}) {
	return cached(numbers, `${locale}|${JSON.stringify(options)}`, () => {
		return new Intl.NumberFormat(locale, options);
	});
}

/** `new Intl.DateTimeFormat(locale, options)`, shared. */
export function dateTimeFormat(locale: string, options: Intl.DateTimeFormatOptions = {}) {
	return cached(dates, `${locale}|${JSON.stringify(options)}`, () => {
		return new Intl.DateTimeFormat(locale, options);
	});
}
