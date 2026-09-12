import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../services/api';

export const usePhoneGPS = (defaultVehicleCode = 'NER-V001') => {
  const [isTracking, setIsTracking] = useState(false);
  const [coords, setCoords] = useState(null);
  const [speed, setSpeed] = useState(0);
  const [heading, setHeading] = useState(null);
  const [altitude, setAltitude] = useState(null);
  const [error, setError] = useState(null);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [activeVehicleCode, setActiveVehicleCode] = useState(defaultVehicleCode);

  const watchIdRef = useRef(null);
  const lastPostTimeRef = useRef(0);

  const sendTelemetry = useCallback(async (position, vehicleCode) => {
    const now = Date.now();
    // Throttle to at most 1 update every 2.5 seconds to conserve battery and bandwidth
    if (now - lastPostTimeRef.current < 2500) {
      return;
    }
    lastPostTimeRef.current = now;

    const lat = position.coords.latitude;
    const lng = position.coords.longitude;
    const spdKmh = position.coords.speed !== null && position.coords.speed >= 0 ? Math.round(position.coords.speed * 3.6) : 0;
    const hdg = position.coords.heading !== null && !isNaN(position.coords.heading) ? position.coords.heading : null;
    const alt = position.coords.altitude !== null ? position.coords.altitude : 0;

    setCoords({ lat, lng });
    setSpeed(spdKmh);
    setHeading(hdg);
    setAltitude(alt);

    try {
      await api.post('/telemetry/phone-gps', {
        vehicle_code: vehicleCode || activeVehicleCode,
        latitude: lat,
        longitude: lng,
        speed_kmh: spdKmh,
        heading_deg: hdg,
        altitude_m: alt,
        ignition_status: spdKmh > 0 ? 'ON' : 'IDLE',
        satellites_connected: 12,
        telemetry_source: 'PHONE_GPS_LIVE',
        timestamp: new Date().toISOString()
      });
      setLastSyncTime(new Date().toLocaleTimeString());
      setError(null);
    } catch (err) {
      console.warn('[PhoneGPS] Failed to send telemetry packet:', err);
      setError(err.response?.data?.detail || 'Telemetry transmission issue');
    }
  }, [activeVehicleCode]);

  const startTracking = useCallback((vehicleCode = 'NER-V001') => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser or device.');
      return;
    }

    setActiveVehicleCode(vehicleCode);
    setError(null);
    setIsTracking(true);

    // Initial position fetch
    navigator.geolocation.getCurrentPosition(
      (pos) => sendTelemetry(pos, vehicleCode),
      (err) => {
        console.warn('[PhoneGPS] Initial location error:', err);
        setError(`GPS Error: ${err.message}`);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );

    // Continuous watch
    const watchId = navigator.geolocation.watchPosition(
      (pos) => sendTelemetry(pos, vehicleCode),
      (err) => {
        console.warn('[PhoneGPS] Watch error:', err);
        setError(`GPS Error: ${err.message}`);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 2000 }
    );

    watchIdRef.current = watchId;
  }, [sendTelemetry]);

  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsTracking(false);
  }, []);

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  return {
    isTracking,
    startTracking,
    stopTracking,
    coords,
    speed,
    heading,
    altitude,
    error,
    lastSyncTime,
    activeVehicleCode
  };
};
