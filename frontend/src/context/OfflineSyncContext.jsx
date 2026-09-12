import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { saveOfflinePhoto, getOfflinePhoto, deleteOfflinePhoto, clearAllOfflinePhotos } from '../utils/offlineDb';

const OfflineSyncContext = createContext();

export const OfflineSyncProvider = ({ children }) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingQueue, setPendingQueue] = useState(() => {
    try {
      const saved = localStorage.getItem('link_x8_field_queue') || localStorage.getItem('ner_logiai_field_queue');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [syncStatus, setSyncStatus] = useState('SYNCED'); // SYNCED, PENDING_SYNC, SYNCING, FAILED
  const [lastSyncTime, setLastSyncTime] = useState(null);

  const syncPendingReports = useCallback(async () => {
    const rawQueue = JSON.parse(localStorage.getItem('link_x8_field_queue') || localStorage.getItem('ner_logiai_field_queue') || '[]');
    if (rawQueue.length === 0) {
      setSyncStatus('SYNCED');
      return { success: true, count: 0 };
    }

    setSyncStatus('SYNCING');
    try {
      // Hydrate photos from IndexedDB if stored separately
      const hydratedReports = await Promise.all(
        rawQueue.map(async (report) => {
          if (report.has_offline_photo) {
            const photoBlob = await getOfflinePhoto(report.report_code);
            return {
              ...report,
              photo_url: photoBlob || report.photo_url || null
            };
          }
          return report;
        })
      );

      const res = await api.post('/field-reports/sync', { reports: hydratedReports });
      
      // Cleanup synced photos from IndexedDB
      for (const r of rawQueue) {
        if (r.has_offline_photo) {
          await deleteOfflinePhoto(r.report_code);
        }
      }

      setPendingQueue([]);
      localStorage.removeItem('link_x8_field_queue');
      localStorage.removeItem('ner_logiai_field_queue');
      setSyncStatus('SYNCED');
      setLastSyncTime(new Date().toISOString());
      window.dispatchEvent(new CustomEvent('sih_demo_triggered'));
      return { success: true, count: rawQueue.length, data: res.data };
    } catch (err) {
      console.error('Failed to sync offline field reports:', err);
      setSyncStatus('FAILED');
      return { success: false, error: err.message };
    }
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Auto-trigger sync when connectivity returns
      const queue = JSON.parse(localStorage.getItem('link_x8_field_queue') || localStorage.getItem('ner_logiai_field_queue') || '[]');
      if (queue.length > 0) {
        console.log('[OfflineSync] Network restored. Triggering automatic background synchronization...');
        syncPendingReports();
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [syncPendingReports]);

  const addOfflineReport = async (reportData) => {
    const reportCode = `FLD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    let photoData = reportData.photo_url || null;
    let hasOfflinePhoto = false;

    // Save large photo in IndexedDB to avoid localStorage 5MB quota exhaustion
    if (photoData && photoData.startsWith('data:')) {
      await saveOfflinePhoto(reportCode, photoData);
      hasOfflinePhoto = true;
      photoData = null; // Do not bloat localStorage
    }

    const report = {
      ...reportData,
      report_code: reportCode,
      photo_url: photoData,
      has_offline_photo: hasOfflinePhoto,
      sync_status: 'PENDING_SYNC',
      reported_at: new Date().toISOString()
    };
    const updated = [report, ...pendingQueue];
    setPendingQueue(updated);
    localStorage.setItem('link_x8_field_queue', JSON.stringify(updated));
    setSyncStatus('PENDING_SYNC');

    // If online, immediately try to sync
    if (navigator.onLine) {
      setTimeout(() => {
        syncPendingReports();
      }, 300);
    }

    return report;
  };

  const removePendingReport = async (reportCode) => {
    await deleteOfflinePhoto(reportCode);
    const updated = pendingQueue.filter((r) => r.report_code !== reportCode);
    setPendingQueue(updated);
    localStorage.setItem('link_x8_field_queue', JSON.stringify(updated));
    if (updated.length === 0) setSyncStatus('SYNCED');
  };

  const clearQueue = async () => {
    await clearAllOfflinePhotos();
    setPendingQueue([]);
    localStorage.removeItem('link_x8_field_queue');
    localStorage.removeItem('ner_logiai_field_queue');
    setSyncStatus('SYNCED');
  };

  return (
    <OfflineSyncContext.Provider value={{
      isOnline,
      pendingQueue,
      syncStatus,
      lastSyncTime,
      addOfflineReport,
      syncPendingReports,
      removePendingReport,
      clearQueue
    }}>
      {children}
    </OfflineSyncContext.Provider>
  );
};

export const useOfflineSync = () => useContext(OfflineSyncContext);

