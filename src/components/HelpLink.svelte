<script lang="ts">
	import CircleHelpIcon from '@lucide/svelte/icons/circle-help';
	import { guideTopicPath, type GuideTopic } from '$client/guide';
	import { m } from '$i18n/paraglide/messages';
	import { getLocale } from '$i18n/paraglide/runtime';
	import { cn } from '$utils';

	/**
	 * A link to the section of the user guide that explains `topic`, in a new tab. The guide is
	 * served by the host and never precached, so it needs a connection. Icon only, unless `text`.
	 */
	let {
		topic,
		text = false,
		class: className
	}: { topic: GuideTopic; text?: boolean; class?: string } = $props();
</script>

<!-- The guide is plain pages from the host, outside the app: resolve() only knows the app's routes. -->
<!-- eslint-disable svelte/no-navigation-without-resolve -->
<a
	href={guideTopicPath(getLocale(), topic)}
	target="_blank"
	rel="noopener"
	aria-label={text ? undefined : m.help_link()}
	title={text ? undefined : m.help_link()}
	data-testid="help-link"
	class={cn(
		'inline-flex shrink-0 items-center gap-1.5 rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-hidden',
		text ? 'text-xs underline-offset-2 hover:underline' : 'size-8 justify-center',
		className
	)}
>
	<CircleHelpIcon class="size-4" aria-hidden="true" />
	{#if text}{m.help_link()}{/if}
</a>
<!-- eslint-enable svelte/no-navigation-without-resolve -->
