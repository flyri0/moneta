import type { Attachment } from 'svelte/attachments';
import { edgeScrollSpeed } from './sortable';

/** What is being dragged. */
export interface DragItem {
	kind: 'group' | 'category' | 'card';
	id: string;
	label: string;
}

interface DragCallbacks {
	/** The drag began; `handle` is the grip it started from. */
	onStart?: (item: DragItem, handle: HTMLElement) => void;
	/** The pointer moved, or the page scrolled under it. */
	onMove: (x: number, y: number) => void;
	/** Escape or a cancelled pointer: undo the drag. */
	onCancel: () => void;
}

/** The visible band of the page, between the fixed bars marked with `data-scroll-inset`. */
function scrollLimits(): { top: number; bottom: number } {
	const inset = (side: 'top' | 'bottom') => {
		const rect = document.querySelector(`[data-scroll-inset="${side}"]`)?.getBoundingClientRect();
		return rect && rect.height > 0 ? rect : null;
	};
	return {
		top: inset('top')?.bottom ?? 0,
		bottom: inset('bottom')?.top ?? window.innerHeight
	};
}

/**
 * Pointer-driven drag for sortable lists: the same path for mouse and touch. A drag starts from
 * a grip (`handle`), follows the pointer on `window` (the dragged row may be moved or re-created
 * while it reorders) and scrolls the page near the top and bottom edges.
 */
export class DragController {
	active = $state<DragItem | null>(null);
	pointer = $state({ x: 0, y: 0 });

	#callbacks: DragCallbacks;
	#pointerId: number | null = null;
	#frame = 0;

	constructor(callbacks: DragCallbacks) {
		this.#callbacks = callbacks;
	}

	/** An attachment for a grip that starts dragging `item`. */
	handle(item: DragItem): Attachment<HTMLElement> {
		return (node) => {
			node.style.touchAction = 'none';
			const down = (event: PointerEvent) => {
				if (this.active || !event.isPrimary || event.button !== 0) return;
				event.preventDefault();
				this.#start(item, node, event);
			};
			node.addEventListener('pointerdown', down);
			return () => node.removeEventListener('pointerdown', down);
		};
	}

	/** Ends any drag in progress without undoing it. */
	destroy() {
		this.#stop();
	}

	#start(item: DragItem, handle: HTMLElement, event: PointerEvent) {
		this.active = item;
		this.#pointerId = event.pointerId;
		this.pointer = { x: event.clientX, y: event.clientY };
		document.documentElement.classList.add('select-none');
		window.addEventListener('pointermove', this.#move);
		window.addEventListener('pointerup', this.#up);
		window.addEventListener('pointercancel', this.#cancel);
		window.addEventListener('keydown', this.#key);
		this.#callbacks.onStart?.(item, handle);
		this.#frame = requestAnimationFrame(this.#scroll);
	}

	#stop() {
		if (!this.active) return;
		this.active = null;
		this.#pointerId = null;
		cancelAnimationFrame(this.#frame);
		document.documentElement.classList.remove('select-none');
		window.removeEventListener('pointermove', this.#move);
		window.removeEventListener('pointerup', this.#up);
		window.removeEventListener('pointercancel', this.#cancel);
		window.removeEventListener('keydown', this.#key);
	}

	#move = (event: PointerEvent) => {
		if (event.pointerId !== this.#pointerId) return;
		event.preventDefault();
		this.pointer = { x: event.clientX, y: event.clientY };
		this.#callbacks.onMove(event.clientX, event.clientY);
	};

	#up = (event: PointerEvent) => {
		if (event.pointerId === this.#pointerId) this.#stop();
	};

	#cancel = (event: PointerEvent) => {
		if (event.pointerId !== this.#pointerId) return;
		this.#stop();
		this.#callbacks.onCancel();
	};

	#key = (event: KeyboardEvent) => {
		if (event.key !== 'Escape') return;
		event.preventDefault();
		this.#stop();
		this.#callbacks.onCancel();
	};

	#scroll = () => {
		if (!this.active) return;
		const { top, bottom } = scrollLimits();
		const speed = edgeScrollSpeed(this.pointer.y, top, bottom);
		if (speed !== 0) {
			const before = window.scrollY;
			window.scrollBy({ top: speed, behavior: 'instant' });
			// The rows moved under a pointer that stayed still.
			if (window.scrollY !== before) this.#callbacks.onMove(this.pointer.x, this.pointer.y);
		}
		this.#frame = requestAnimationFrame(this.#scroll);
	};
}
