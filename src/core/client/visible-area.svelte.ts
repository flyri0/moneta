import { createSubscriber } from 'svelte/reactivity';
import { visibleArea, type Area } from './visible-area';

/** The part of the page the user can see, kept current as a phone's keyboard comes and goes. */
export class VisibleArea {
	#subscribe = createSubscriber((update) => {
		const viewport = window.visualViewport;
		if (!viewport) {
			window.addEventListener('resize', update);
			return () => window.removeEventListener('resize', update);
		}
		viewport.addEventListener('resize', update);
		viewport.addEventListener('scroll', update);
		return () => {
			viewport.removeEventListener('resize', update);
			viewport.removeEventListener('scroll', update);
		};
	});

	get current(): Area {
		this.#subscribe();
		return visibleArea(window);
	}
}
