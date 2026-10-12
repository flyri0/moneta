/// <reference types="vite-plugin-pwa/client" />
// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	interface ImportMetaEnv {
		/** The Google OAuth client id for backups to Google Drive; without it, Drive is hidden. */
		readonly VITE_GOOGLE_CLIENT_ID?: string;
	}

	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		interface PageState {
			/** Disposable protection for open mobile layers; never restores UI. */
			mobileLayer?: string;
		}
		// interface Platform {}
	}
}

export {};
