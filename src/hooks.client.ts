import { ensureLocalStorage } from '$client/storage';

// Runs before any route or layout module is loaded, so everything after it can read localStorage.
ensureLocalStorage(window);
