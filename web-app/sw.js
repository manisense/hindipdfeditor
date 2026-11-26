// Hindi PDF Editor service worker. It does one thing: receive files shared to the installed app
// (Android share sheet, Web Share Target) and hand them to the /share/ page. It caches nothing,
// so an installed app always loads the current site.
//
// The shared files are kept in IndexedDB under the names below until a tool opens them; keep
// them in step with editor/src/lib/sharedFiles.ts.
const DB_NAME = "hpe-shared-files";
const STORE = "shares";
const KEY = "latest";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method === "POST" && url.pathname === "/share-target/") {
    event.respondWith(receiveShare(event.request));
  }
});

async function receiveShare(request) {
  try {
    const form = await request.formData();
    const files = form.getAll("file").filter((value) => value instanceof File && value.size > 0);
    await saveShare(files);
    return Response.redirect(`/share/?files=${files.length}`, 303);
  } catch {
    return Response.redirect("/share/?error=receive", 303);
  }
}

function saveShare(files) {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(DB_NAME, 1);
    open.onupgradeneeded = () => open.result.createObjectStore(STORE);
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put({ savedAt: Date.now(), files }, KEY);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    };
  });
}
