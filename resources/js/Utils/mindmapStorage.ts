/**
 * Talawire Mindmap Local IndexedDB & Export/Import Storage Manager (TypeScript)
 */

const DB_NAME = 'TalawireDB';
const DB_VERSION = 1;
const STORE_NAME = 'mindmaps';

let dbInstance: IDBDatabase | null = null;

export const initDB = (): Promise<IDBDatabase | null> => {
    return new Promise((resolve) => {
        if (dbInstance) {
            return resolve(dbInstance);
        }

        if (typeof window === 'undefined' || !window.indexedDB) {
            console.warn('[TalawireDB] IndexedDB is not supported in this environment.');
            return resolve(null);
        }

        const request = window.indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                store.createIndex('updated_at', 'updated_at', { unique: false });
                store.createIndex('synced', 'synced', { unique: false });
            }
        };

        request.onsuccess = (event: Event) => {
            dbInstance = (event.target as IDBOpenDBRequest).result;
            resolve(dbInstance);
        };

        request.onerror = (event: Event) => {
            console.error('[TalawireDB] Failed to open IndexedDB:', (event.target as IDBOpenDBRequest).error);
            resolve(null);
        };
    });
};

const sanitizeNodes = (nodes: any[]): any[] => {
    if (!Array.isArray(nodes)) return [];
    return nodes.map(n => {
        const rawData = n.data ? { ...n.data } : {};
        delete rawData.onAddChild;
        delete rawData.onAddSibling;
        delete rawData.onDeleteNode;
        return {
            id: String(n.id),
            type: n.type || 'custom',
            position: n.position ? { x: Number(n.position.x) || 0, y: Number(n.position.y) || 0 } : { x: 0, y: 0 },
            zIndex: n.zIndex || 0,
            style: n.style ? JSON.parse(JSON.stringify(n.style)) : undefined,
            data: JSON.parse(JSON.stringify(rawData))
        };
    });
};

const sanitizeEdges = (edges: any[]): any[] => {
    if (!Array.isArray(edges)) return [];
    return edges.map(e => ({
        id: String(e.id),
        source: String(e.source),
        target: String(e.target),
        sourceHandle: e.sourceHandle,
        targetHandle: e.targetHandle,
        type: e.type,
        animated: !!e.animated,
        style: e.style ? JSON.parse(JSON.stringify(e.style)) : undefined,
        className: e.className || e.class,
        markerEnd: e.markerEnd,
        markerStart: e.markerStart,
        data: e.data ? JSON.parse(JSON.stringify(e.data)) : undefined,
        label: e.label
    }));
};

/**
 * Save a mindmap snapshot into local IndexedDB
 */
export const saveLocalMindmap = async (mindmapId: string | number, data: any, synced = false): Promise<boolean> => {
    try {
        const db = await initDB();
        if (!db) return false;

        return new Promise((resolve) => {
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);

            const record = {
                id: String(mindmapId),
                name: String(data.name || 'Untitled Mindmap'),
                nodes: sanitizeNodes(data.nodes),
                edges: sanitizeEdges(data.edges),
                settings: data.settings ? JSON.parse(JSON.stringify(data.settings)) : {},
                updated_at: Date.now(),
                synced: !!synced
            };

            const request = store.put(record);

            request.onsuccess = () => resolve(true);
            request.onerror = (err) => {
                console.error('[TalawireDB] Error saving to IndexedDB:', err);
                resolve(false);
            };
        });
    } catch (e) {
        console.error('[TalawireDB] Exception in saveLocalMindmap:', e);
        return false;
    }
};

/**
 * Retrieve a mindmap snapshot from local IndexedDB
 */
export const getLocalMindmap = async (mindmapId: string | number): Promise<any | null> => {
    try {
        const db = await initDB();
        if (!db) return null;

        return new Promise((resolve) => {
            const transaction = db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get(String(mindmapId));

            request.onsuccess = (event: Event) => {
                resolve((event.target as IDBRequest).result || null);
            };

            request.onerror = () => resolve(null);
        });
    } catch (e) {
        console.error('[TalawireDB] Exception in getLocalMindmap:', e);
        return null;
    }
};

/**
 * List all locally stored mindmaps
 */
export const getAllLocalMindmaps = async (): Promise<any[]> => {
    try {
        const db = await initDB();
        if (!db) return [];

        return new Promise((resolve) => {
            const transaction = db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.getAll();

            request.onsuccess = (event: Event) => {
                resolve((event.target as IDBRequest).result || []);
            };

            request.onerror = () => resolve([]);
        });
    } catch (e) {
        console.error('[TalawireDB] Exception in getAllLocalMindmaps:', e);
        return [];
    }
};

/**
 * Delete a mindmap from local IndexedDB
 */
export const deleteLocalMindmap = async (mindmapId: string | number): Promise<boolean> => {
    try {
        const db = await initDB();
        if (!db) return false;

        return new Promise((resolve) => {
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.delete(String(mindmapId));

            request.onsuccess = () => resolve(true);
            request.onerror = () => resolve(false);
        });
    } catch (e) {
        console.error('[TalawireDB] Exception in deleteLocalMindmap:', e);
        return false;
    }
};

/**
 * Export current mindmap to a downloadable .talawire (JSON) file
 */
export const exportMindmapToFile = (mindmapData: any, filename: string | null = null): void => {
    const title = mindmapData.name || 'mindmap';
    const cleanFilename = (filename || `${title.toLowerCase().replace(/[^a-z0-9_-]/gi, '_')}.talawire`);

    const exportPayload = {
        app: 'Talawire Mindmap',
        version: '2.0.0',
        exported_at: new Date().toISOString(),
        mindmap: {
            name: mindmapData.name || 'Untitled Mindmap',
            nodes: mindmapData.nodes || [],
            edges: mindmapData.edges || [],
            settings: mindmapData.settings || {}
        }
    };

    const jsonStr = JSON.stringify(exportPayload, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = cleanFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

/**
 * Import a .talawire or .json file and validate its content
 */
export const importMindmapFromFile = (file: File): Promise<any> => {
    return new Promise((resolve, reject) => {
        if (!file) {
            return reject(new Error('No file selected'));
        }

        const reader = new FileReader();
        reader.onload = (e: ProgressEvent<FileReader>) => {
            try {
                const content = e.target?.result as string;
                const parsed = JSON.parse(content);
                if (parsed.mindmap) {
                    resolve(parsed.mindmap);
                } else if (parsed.nodes && Array.isArray(parsed.nodes)) {
                    resolve(parsed);
                } else {
                    reject(new Error('Invalid Talawire mindmap file format.'));
                }
            } catch (err: any) {
                reject(new Error('Failed to parse JSON file: ' + err.message));
            }
        };

        reader.onerror = () => reject(new Error('Error reading file.'));
        reader.readAsText(file);
    });
};
