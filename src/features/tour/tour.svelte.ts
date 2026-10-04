/**
 * The tour's place: the index in `TOUR_STEPS` while it shows, `null` otherwise. `replay` asks
 * for it once more, from Settings, without touching what this device remembers about it.
 */
export const tour = $state<{ step: number | null; replay: boolean }>({ step: null, replay: false });
