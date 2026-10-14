(function (global) {
  const DB_NAME = "baize-mvp";
  const DB_VERSION = 1;
  const STORE = "recordings";

  function openDb() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE)) {
          const store = db.createObjectStore(STORE, { keyPath: "id" });
          store.createIndex("locationId", "locationId", { unique: false });
          store.createIndex("createdAt", "createdAt", { unique: false });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  function withStore(mode, fn) {
    return openDb().then(
      (db) =>
        new Promise((resolve, reject) => {
          const tx = db.transaction(STORE, mode);
          const store = tx.objectStore(STORE);
          let result;
          try {
            result = fn(store);
          } catch (err) {
            reject(err);
            return;
          }
          tx.oncomplete = () => {
            db.close();
            resolve(result);
          };
          tx.onerror = () => {
            db.close();
            reject(tx.error);
          };
          tx.onabort = () => {
            db.close();
            reject(tx.error || new Error("事务已中止"));
          };
        })
    );
  }

  function addRecording(record) {
    return withStore("readwrite", (store) => store.put(record));
  }

  function deleteRecording(id) {
    return withStore("readwrite", (store) => store.delete(id));
  }

  function getRecording(id) {
    return openDb().then(
      (db) =>
        new Promise((resolve, reject) => {
          const tx = db.transaction(STORE, "readonly");
          const request = tx.objectStore(STORE).get(id);
          request.onsuccess = () => {
            db.close();
            resolve(request.result || null);
          };
          request.onerror = () => {
            db.close();
            reject(request.error);
          };
        })
    );
  }

  function listByLocation(locationId) {
    return openDb().then(
      (db) =>
        new Promise((resolve, reject) => {
          const tx = db.transaction(STORE, "readonly");
          const index = tx.objectStore(STORE).index("locationId");
          const request = index.getAll(IDBKeyRange.only(locationId));
          request.onsuccess = () => {
            db.close();
            const rows = request.result || [];
            rows.sort((a, b) => b.createdAt - a.createdAt);
            resolve(rows);
          };
          request.onerror = () => {
            db.close();
            reject(request.error);
          };
        })
    );
  }

  global.BaizeDB = {
    addRecording,
    deleteRecording,
    getRecording,
    listByLocation,
  };
})(window);
