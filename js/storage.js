/* ============================================
   STORAGE MODULE
   IndexedDB + Local File Storage
   v2: Added trips store + companions
   ============================================ */

// ===== CONSTANTS =====
const DB_NAME = 'HorasExtraDB';
const DB_VERSION = 2;
const STORE_RECORDS = 'records';
const STORE_SETTINGS = 'settings';
const STORE_TRIPS = 'trips';
const FILE_NAME = 'horas-extra-db.json';

const DEFAULT_SETTINGS = {
    hourlyRate: 10,
    defaultStartTime: '07:00',
    contractHours: 8,
    lunchDuration: 1,
    storageMode: 'indexeddb',
    companions: []
};

// ===== IN-MEMORY CACHE =====
let _cachedRecords = [];
let _cachedSettings = { ...DEFAULT_SETTINGS };
let _cachedTrips = [];
let _dbReady = false;

// ===== INDEXEDDB LAYER =====
function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_RECORDS)) {
                db.createObjectStore(STORE_RECORDS, { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains(STORE_SETTINGS)) {
                db.createObjectStore(STORE_SETTINGS, { keyPath: 'key' });
            }
            if (!db.objectStoreNames.contains(STORE_TRIPS)) {
                db.createObjectStore(STORE_TRIPS, { keyPath: 'id' });
            }
        };
        request.onsuccess = (e) => resolve(e.target.result);
        request.onerror = (e) => reject(e.target.error);
    });
}

async function idbLoadAll() {
    try {
        const db = await openDB();

        // Load records
        const recordsTx = db.transaction(STORE_RECORDS, 'readonly');
        const recordsStore = recordsTx.objectStore(STORE_RECORDS);
        const records = await new Promise((resolve, reject) => {
            const req = recordsStore.getAll();
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });

        // Load settings
        const settingsTx = db.transaction(STORE_SETTINGS, 'readonly');
        const settingsStore = settingsTx.objectStore(STORE_SETTINGS);
        const settingsRow = await new Promise((resolve, reject) => {
            const req = settingsStore.get('app_settings');
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });

        // Load trips
        const tripsTx = db.transaction(STORE_TRIPS, 'readonly');
        const tripsStore = tripsTx.objectStore(STORE_TRIPS);
        const trips = await new Promise((resolve, reject) => {
            const req = tripsStore.getAll();
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });

        _cachedRecords = records || [];
        _cachedTrips = trips || [];
        if (settingsRow && settingsRow.data) {
            _cachedSettings = { ...DEFAULT_SETTINGS, ...settingsRow.data };
        }
        // Ensure companions array exists
        if (!Array.isArray(_cachedSettings.companions)) {
            _cachedSettings.companions = [];
        }

        db.close();
        _dbReady = true;

        // Migrate from localStorage if first time
        if (_cachedRecords.length === 0) {
            const lsRecords = localStorage.getItem('overtime_records');
            if (lsRecords) {
                _cachedRecords = JSON.parse(lsRecords);
                await idbSaveRecords();
            }
        }
        if (!settingsRow) {
            const lsSettings = localStorage.getItem('overtime_settings');
            if (lsSettings) {
                _cachedSettings = { ...DEFAULT_SETTINGS, ...JSON.parse(lsSettings) };
                await idbSaveSettings();
            }
        }

        // Migrate old records (add title field)
        let changed = false;
        _cachedRecords.forEach(r => {
            if (r.title === undefined) { r.title = ''; changed = true; }
        });
        if (changed) await idbSaveRecords();

    } catch (err) {
        console.error('IndexedDB load error, falling back to localStorage:', err);
        _cachedRecords = JSON.parse(localStorage.getItem('overtime_records') || '[]');
        _cachedSettings = { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem('overtime_settings') || '{}') };
        _cachedTrips = [];
    }
}

async function idbSaveRecords() {
    try {
        const db = await openDB();
        const tx = db.transaction(STORE_RECORDS, 'readwrite');
        const store = tx.objectStore(STORE_RECORDS);
        store.clear();
        _cachedRecords.forEach(r => store.put(r));
        await new Promise((resolve, reject) => {
            tx.oncomplete = resolve;
            tx.onerror = () => reject(tx.error);
        });
        db.close();
    } catch (err) {
        console.error('IndexedDB save error:', err);
    }
}

async function idbSaveSettings() {
    try {
        const db = await openDB();
        const tx = db.transaction(STORE_SETTINGS, 'readwrite');
        const store = tx.objectStore(STORE_SETTINGS);
        store.put({ key: 'app_settings', data: _cachedSettings });
        await new Promise((resolve, reject) => {
            tx.oncomplete = resolve;
            tx.onerror = () => reject(tx.error);
        });
        db.close();
    } catch (err) {
        console.error('IndexedDB settings save error:', err);
    }
}

async function idbSaveTrips() {
    try {
        const db = await openDB();
        const tx = db.transaction(STORE_TRIPS, 'readwrite');
        const store = tx.objectStore(STORE_TRIPS);
        store.clear();
        _cachedTrips.forEach(t => store.put(t));
        await new Promise((resolve, reject) => {
            tx.oncomplete = resolve;
            tx.onerror = () => reject(tx.error);
        });
        db.close();
    } catch (err) {
        console.error('IndexedDB trips save error:', err);
    }
}

// ===== UNIFIED DATA API =====
function getSettings() {
    return { ..._cachedSettings };
}

function saveSettings(settings) {
    _cachedSettings = { ...settings };
    idbSaveSettings();
    autoSaveFile();
}

function getRecords() {
    return [..._cachedRecords];
}

function saveRecords(records) {
    _cachedRecords = [...records];
    idbSaveRecords();
}

function addRecord(record) {
    record.id = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
    _cachedRecords.push(record);
    _cachedRecords.sort((a, b) => new Date(a.date + 'T00:00:00') - new Date(b.date + 'T00:00:00'));
    idbSaveRecords();
    autoSaveFile();
    return record;
}

function updateRecord(id, updatedData) {
    const idx = _cachedRecords.findIndex(r => r.id === id);
    if (idx !== -1) {
        _cachedRecords[idx] = { ..._cachedRecords[idx], ...updatedData };
        _cachedRecords.sort((a, b) => new Date(a.date + 'T00:00:00') - new Date(b.date + 'T00:00:00'));
        idbSaveRecords();
        autoSaveFile();
    }
}

function deleteRecord(id) {
    _cachedRecords = _cachedRecords.filter(r => r.id !== id);
    idbSaveRecords();
    autoSaveFile();
}

// ===== TRIPS API =====
function getTrips() {
    return [..._cachedTrips];
}

function addTrip(trip) {
    trip.id = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
    trip.createdAt = new Date().toISOString();
    _cachedTrips.push(trip);
    _cachedTrips.sort((a, b) => new Date(a.dateStart + 'T00:00:00') - new Date(b.dateStart + 'T00:00:00'));
    idbSaveTrips();
    autoSaveFile();
    return trip;
}

function updateTrip(id, updatedData) {
    const idx = _cachedTrips.findIndex(t => t.id === id);
    if (idx !== -1) {
        _cachedTrips[idx] = { ..._cachedTrips[idx], ...updatedData };
        _cachedTrips.sort((a, b) => new Date(a.dateStart + 'T00:00:00') - new Date(b.dateStart + 'T00:00:00'));
        idbSaveTrips();
        autoSaveFile();
    }
}

function deleteTrip(id) {
    _cachedTrips = _cachedTrips.filter(t => t.id !== id);
    idbSaveTrips();
    autoSaveFile();
}

function getUpcomingTrips(limit) {
    const today = formatInputDate(new Date());
    const upcoming = _cachedTrips
        .filter(t => t.dateStart >= today || t.dateEnd >= today)
        .sort((a, b) => new Date(a.dateStart + 'T00:00:00') - new Date(b.dateStart + 'T00:00:00'));
    return limit ? upcoming.slice(0, limit) : upcoming;
}

function getPastTrips(limit) {
    const today = formatInputDate(new Date());
    const past = _cachedTrips
        .filter(t => t.dateEnd < today)
        .sort((a, b) => new Date(b.dateStart + 'T00:00:00') - new Date(a.dateStart + 'T00:00:00'));
    return limit ? past.slice(0, limit) : past;
}

function getMonthTrips(year, month) {
    return _cachedTrips.filter(t => {
        const start = new Date(t.dateStart + 'T00:00:00');
        const end = new Date(t.dateEnd + 'T00:00:00');
        const monthStart = new Date(year, month, 1);
        const monthEnd = new Date(year, month + 1, 0);
        return start <= monthEnd && end >= monthStart;
    });
}

// ===== LOCAL FILE MODE =====
function autoSaveFile() {
    if (_cachedSettings.storageMode !== 'file') return;
    downloadDataFile();
}

function downloadDataFile() {
    const data = {
        settings: {
            hourlyRate: _cachedSettings.hourlyRate,
            defaultStartTime: _cachedSettings.defaultStartTime,
            contractHours: _cachedSettings.contractHours,
            lunchDuration: _cachedSettings.lunchDuration,
            companions: _cachedSettings.companions || []
        },
        records: _cachedRecords,
        trips: _cachedTrips,
        lastSaved: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = FILE_NAME;
    a.click();
    URL.revokeObjectURL(url);
    showFileStatus('Archivo guardado: ' + new Date().toLocaleTimeString('es-ES'));
}

function loadDataFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                if (data.records) {
                    _cachedRecords = data.records;
                    _cachedRecords.forEach(r => { if (r.title === undefined) r.title = ''; });
                    idbSaveRecords();
                }
                if (data.trips) {
                    _cachedTrips = data.trips;
                    idbSaveTrips();
                }
                if (data.settings) {
                    _cachedSettings = { ..._cachedSettings, ...data.settings, storageMode: _cachedSettings.storageMode };
                    idbSaveSettings();
                }
                resolve(true);
            } catch (err) {
                reject(err);
            }
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsText(file);
    });
}

function showFileStatus(text) {
    const statusEl = document.getElementById('file-status');
    const statusText = document.getElementById('file-status-text');
    if (statusEl && statusText) {
        statusText.textContent = text;
        statusEl.style.display = 'flex';
    }
}
