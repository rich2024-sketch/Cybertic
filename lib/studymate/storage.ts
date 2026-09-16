import { initialStore } from "./demo";
import type { Store } from "./types";
const STORE_KEY = "studymate-v1";
export function readStore(): Store {
 const raw = localStorage.getItem(STORE_KEY);
 if (!raw) return initialStore();
 const data = JSON.parse(raw);
 if (data.version !== 1 || !Array.isArray(data.students) || !Array.isArray(data.lectures) || data.students.length === 0) throw new Error("Saved data could not be read. Your existing data has not been overwritten.");
 return data;
}
export function writeStore(data: Store) {
 try { localStorage.setItem(STORE_KEY, JSON.stringify(data)); }
 catch { throw new Error("Your browser could not save changes. Free some storage and try again; keep this tab open."); }
}
function audioDB(): Promise<IDBDatabase> {
 return new Promise((resolve, reject) => {
  const request = indexedDB.open("studymate-audio", 1);
  request.onupgradeneeded = () => request.result.createObjectStore("recordings");
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(new Error("Audio storage is unavailable in this browser."));
 });
}
export async function saveAudio(id: string, blob: Blob) {
 const db = await audioDB();
 try { await new Promise<void>((resolve, reject) => {
  const tx = db.transaction("recordings", "readwrite");
  tx.objectStore("recordings").put(blob, id);
  tx.oncomplete = () => resolve();
  tx.onerror = () => reject(new Error("The recording could not be saved. Download it before leaving this page."));
  tx.onabort = () => reject(new Error("Saving the recording was interrupted."));
 }); } finally { db.close(); }
}
export async function readAudio(id: string): Promise<Blob | null> {
 const db = await audioDB();
 try { return await new Promise((resolve, reject) => {
  const req = db.transaction("recordings", "readonly").objectStore("recordings").get(id);
  req.onsuccess = () => resolve(req.result ?? null);
  req.onerror = () => reject(new Error("Could not load this recording."));
 }); } finally { db.close(); }
}
