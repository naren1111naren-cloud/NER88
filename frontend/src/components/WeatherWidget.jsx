import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
} from 'react';

import { motion, AnimatePresence } from 'framer-motion';
import {
  CloudRain,
  Wind,
  Droplets,
  AlertTriangle,
  RefreshCw,
  MapPin,
  Clock,
  Zap,
  Search,
  Crosshair,
  Sun,
  Cloud,
  CloudSun,
  CloudLightning,
  CloudFog,
  CloudDrizzle,
  CloudSnow,
  Gauge,
  Eye,
  Sunset,
  Sunrise,
  Activity,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

import { API_BASE_URL } from '../services/api';

const NER_PRESETS = [
  { name: 'Guwahati', state: 'Assam', lat: 26.1445, lng: 91.7362 },
  { name: 'Shillong', state: 'Meghalaya', lat: 25.5788, lng: 91.8933 },
  { name: 'Silchar', state: 'Assam', lat: 24.8333, lng: 92.7789 },
  { name: 'Imphal', state: 'Manipur', lat: 24.8170, lng: 93.9368 },
  { name: 'Senapati', state: 'Manipur', lat: 25.2676, lng: 94.0210 },
  { name: 'Kohima', state: 'Nagaland', lat: 25.6751, lng: 94.1086 },
  { name: 'Gangtok', state: 'Sikkim', lat: 27.3389, lng: 88.6065 },
  { name: 'Aizawl', state: 'Mizoram', lat: 23.7271, lng: 92.7176 },
  { name: 'Itanagar', state: 'Arunachal Pradesh', lat: 27.0844, lng: 93.6053 },
  { name: 'Agartala', state: 'Tripura', lat: 23.8315, lng: 91.2868 },
  { name: 'Cherrapunji', state: 'Meghalaya', lat: 25.2700, lng: 91.7300 },
  { name: 'Tawang', state: 'Arunachal Pradesh', lat: 27.5861, lng: 91.8594 },
];

const getNumber = (value) => {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const displayValue = (value, suffix = '') => {
  const number = getNumber(value);

  if (number === null) {
    return 'N/A';
  }

  return `${number}${suffix}`;
};

const formatTime = (value) => {
  if (!value) return 'N/A';

  try {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      if (typeof value === 'string' && value.includes('T')) {
        return value.split('T')[1]?.slice(0, 5) || value;
      }

      return value;
    }

    return date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return value;
  }
};

export const WeatherWidget = ({
  selectedCoordinates,
  onLocationChange,
}) => {
  const [locationName, setLocationName] = useState('Guwahati');
  const [coords, setCoords] = useState({
    lat: 26.1445,
    lng: 91.7362,
  });

  const [weatherData, setWeatherData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const [activeTab, setActiveTab] = useState('current');

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);

  const [lastUpdatedTime, setLastUpdatedTime] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const [retryCountdown, setRetryCountdown] = useState(0);

  const searchDebounceRef = useRef(null);
  const autoRefreshTimerRef = useRef(null);
  const retryTimerRef = useRef(null);
  const countdownIntervalRef = useRef(null);
  const abortControllerRef = useRef(null);

  const clearPendingRetries = useCallback(() => {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    setRetryCountdown(0);
  }, []);

  const getWeatherIcon = (
    code,
    className = 'w-5 h-5'
  ) => {
    const weatherCode = getNumber(code);

    if (weatherCode === null) {
      return (
        <CloudSun
          className={`${className} text-slate-500`}
        />
      );
    }

    if (weatherCode === 0) {
      return (
        <Sun
          className={`${className} text-amber-500`}
        />
      );
    }

    if (weatherCode === 1 || weatherCode === 2) {
      return (
        <CloudSun
          className={`${className} text-amber-400`}
        />
      );
    }

    if (weatherCode === 3) {
      return (
        <Cloud
          className={`${className} text-slate-500`}
        />
      );
    }

    if (weatherCode === 45 || weatherCode === 48) {
      return (
        <CloudFog
          className={`${className} text-slate-400`}
        />
      );
    }

    if (weatherCode >= 51 && weatherCode <= 57) {
      return (
        <CloudDrizzle
          className={`${className} text-blue-400`}
        />
      );
    }

    if (weatherCode >= 61 && weatherCode <= 67) {
      return (
        <CloudRain
          className={`${className} text-emerald-600`}
        />
      );
    }

    if (weatherCode >= 71 && weatherCode <= 77) {
      return (
        <CloudSnow
          className={`${className} text-indigo-400`}
        />
      );
    }

    if (weatherCode >= 80 && weatherCode <= 82) {
      return (
        <CloudRain
          className={`${className} text-emerald-700`}
        />
      );
    }

    if (weatherCode >= 85 && weatherCode <= 86) {
      return (
        <CloudSnow
          className={`${className} text-indigo-500`}
        />
      );
    }

    if (weatherCode >= 95) {
      return (
        <CloudLightning
          className={`${className} text-purple-600`}
        />
      );
    }

    return (
      <CloudSun
        className={`${className} text-slate-500`}
      />
    );
  };

  const getWindDirection = (degrees) => {
    const deg = getNumber(degrees);

    if (deg === null) {
      return 'N/A';
    }

    const directions = [
      'N',
      'NNE',
      'NE',
      'ENE',
      'E',
      'ESE',
      'SE',
      'SSE',
      'S',
      'SSW',
      'SW',
      'WSW',
      'W',
      'WNW',
      'NW',
      'NNW',
    ];

    const index =
      Math.round(((deg % 360) + 360) % 360 / 22.5) % 16;

    return `${directions[index]} (${Math.round(deg)}°)`;
  };

  const getRiskStyle = (category, score) => {
    const numericScore = getNumber(score);

    if (
      numericScore !== null &&
      numericScore >= 80
    ) {
      return {
        bg: 'bg-rose-50',
        border: 'border-rose-300',
        text: 'text-rose-700',
        badge: 'bg-rose-600 text-white',
        bar: 'bg-rose-600',
        label: 'CRITICAL',
      };
    }

    if (
      numericScore !== null &&
      numericScore >= 60
    ) {
      return {
        bg: 'bg-orange-50',
        border: 'border-orange-300',
        text: 'text-orange-700',
        badge: 'bg-orange-600 text-white',
        bar: 'bg-orange-500',
        label: 'HIGH',
      };
    }

    if (
      numericScore !== null &&
      numericScore >= 40
    ) {
      return {
        bg: 'bg-amber-50',
        border: 'border-amber-300',
        text: 'text-amber-700',
        badge: 'bg-amber-600 text-white',
        bar: 'bg-amber-500',
        label: 'MODERATE',
      };
    }

    if (
      numericScore !== null &&
      numericScore >= 20
    ) {
      return {
        bg: 'bg-emerald-50',
        border: 'border-emerald-300',
        text: 'text-emerald-700',
        badge: 'bg-emerald-600 text-white',
        bar: 'bg-emerald-500',
        label: 'LOW',
      };
    }

    if (category) {
      const normalized = String(category).toUpperCase();

      if (normalized === 'CRITICAL') {
        return {
          bg: 'bg-rose-50',
          border: 'border-rose-300',
          text: 'text-rose-700',
          badge: 'bg-rose-600 text-white',
          bar: 'bg-rose-600',
          label: 'CRITICAL',
        };
      }

      if (normalized === 'HIGH') {
        return {
          bg: 'bg-orange-50',
          border: 'border-orange-300',
          text: 'text-orange-700',
          badge: 'bg-orange-600 text-white',
          bar: 'bg-orange-500',
          label: 'HIGH',
        };
      }

      if (normalized === 'MODERATE') {
        return {
          bg: 'bg-amber-50',
          border: 'border-amber-300',
          text: 'text-amber-700',
          badge: 'bg-amber-600 text-white',
          bar: 'bg-amber-500',
          label: 'MODERATE',
        };
      }
    }

    return {
      bg: 'bg-slate-50',
      border: 'border-slate-200',
      text: 'text-slate-700',
      badge: 'bg-slate-600 text-white',
      bar: 'bg-slate-500',
      label: category
        ? String(category).toUpperCase()
        : 'UNKNOWN',
    };
  };

  const fetchWeather = useCallback(
    async (
      targetLat,
      targetLng,
      targetName,
      isBackground = false,
      attemptNumber = 0
    ) => {
      const lat = getNumber(targetLat);
      const lng = getNumber(targetLng);

      if (
        lat === null ||
        lng === null ||
        lat < -90 ||
        lat > 90 ||
        lng < -180 ||
        lng > 180
      ) {
        setError('Invalid weather coordinates.');
        setLoading(false);
        setIsRefreshing(false);
        return;
      }

      // Abort previous in-flight weather request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      const controller = new AbortController();
      abortControllerRef.current = controller;
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

      if (isBackground) {
        setIsRefreshing(true);
      } else {
        setLoading(true);
      }

      if (attemptNumber === 0) {
        setError(null);
      }

      try {
        const params = new URLSearchParams({
          lat: String(lat),
          lng: String(lng),
          days: '7',
        });

        if (targetName) {
          params.set(
            'location_name',
            targetName
          );
        }

        const url =
          `${API_BASE_URL}/weather/forecast?${params.toString()}`;

        console.log(
          `[WeatherWidget] Requesting (attempt ${attemptNumber + 1}):`,
          url
        );

        const response = await fetch(url, {
          method: 'GET',
          headers: {
            Accept: 'application/json',
          },
          signal: controller.signal,
          cache: 'no-store',
        });

        clearTimeout(timeoutId);

        let responseData = null;

        try {
          responseData = await response.json();
        } catch {
          responseData = null;
        }

        if (!response.ok) {
          const backendMessage =
            responseData?.detail ||
            responseData?.message ||
            `Weather API returned HTTP ${response.status}`;

          throw new Error(backendMessage);
        }

        if (!responseData) {
          throw new Error(
            'Weather API returned an empty response.'
          );
        }

        if (!responseData.current) {
          throw new Error(
            'Weather API response does not contain current weather data.'
          );
        }

        console.log(
          '[WeatherWidget] Live weather received:',
          responseData
        );

        // Success - reset all retry state
        clearPendingRetries();
        setRetryCount(0);
        setError(null);
        setWeatherData(responseData);
        setLastUpdatedTime(new Date());

        if (onLocationChange) {
          onLocationChange(responseData);
        }
      } catch (err) {
        clearTimeout(timeoutId);

        if (err.name === 'AbortError' && !controller.signal.aborted) {
          // Ignore cancellation
          return;
        }

        console.error(
          `[WeatherWidget] Weather request failed (attempt ${attemptNumber + 1}):`,
          err
        );

        let errorTitle = 'Unable to retrieve live Open-Meteo weather data';
        let message = 'Unable to retrieve live Open-Meteo weather data.';

        if (
          err.name === 'AbortError' ||
          err instanceof TypeError ||
          String(err?.message || '').toLowerCase().includes('failed to fetch') ||
          String(err?.message || '').toLowerCase().includes('networkerror')
        ) {
          errorTitle = 'Weather service temporarily unavailable';
          message =
            `Cannot connect to backend at ${API_BASE_URL}. ` +
            'Make sure FastAPI is running on port 8000.';
        } else if (err?.message) {
          message = err.message;
          if (
            message.toLowerCase().includes('temporarily unreachable') ||
            message.toLowerCase().includes('unavailable')
          ) {
            errorTitle = 'Weather service temporarily unavailable';
          }
        }

        setError({ title: errorTitle, message });

        // Phase 6: Exponential Backoff Retry (Max 3 retries: 1s, 2s, 4s)
        const MAX_RETRIES = 3;
        if (attemptNumber < MAX_RETRIES && !isBackground) {
          const nextAttempt = attemptNumber + 1;
          const delayMs = Math.pow(2, attemptNumber) * 1000;
          const delaySec = Math.round(delayMs / 1000);

          setRetryCount(nextAttempt);
          setRetryCountdown(delaySec);

          clearPendingRetries();

          let remaining = delaySec;
          countdownIntervalRef.current = setInterval(() => {
            remaining -= 1;
            setRetryCountdown(Math.max(0, remaining));
            if (remaining <= 0) {
              clearInterval(countdownIntervalRef.current);
              countdownIntervalRef.current = null;
            }
          }, 1000);

          retryTimerRef.current = setTimeout(() => {
            fetchWeather(lat, lng, targetName, false, nextAttempt);
          }, delayMs);
        } else {
          setRetryCount(0);
          setRetryCountdown(0);
        }
      } finally {
        setLoading(false);
        setIsRefreshing(false);
      }
    },
    [onLocationChange, clearPendingRetries]
  );

  useEffect(() => {
    if (
      selectedCoordinates &&
      getNumber(selectedCoordinates.lat) !== null &&
      getNumber(selectedCoordinates.lng) !== null
    ) {
      const lat = Number(selectedCoordinates.lat);
      const lng = Number(selectedCoordinates.lng);

      const name =
        selectedCoordinates.name ||
        `${lat.toFixed(3)}°N, ${lng.toFixed(3)}°E`;

      setCoords({
        lat,
        lng,
      });

      setLocationName(name);

      fetchWeather(
        lat,
        lng,
        selectedCoordinates.name || name
      );
    }
  }, [
    selectedCoordinates,
    fetchWeather,
  ]);

  useEffect(() => {
    fetchWeather(
      coords.lat,
      coords.lng,
      locationName
    );

    autoRefreshTimerRef.current =
      setInterval(() => {
        fetchWeather(
          coords.lat,
          coords.lng,
          locationName,
          true
        );
      }, 300000);

    return () => {
      if (autoRefreshTimerRef.current) {
        clearInterval(
          autoRefreshTimerRef.current
        );
      }
    };
  }, [
    coords.lat,
    coords.lng,
    locationName,
    fetchWeather,
  ]);

  useEffect(() => {
    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(
          searchDebounceRef.current
        );
      }

      if (autoRefreshTimerRef.current) {
        clearInterval(
          autoRefreshTimerRef.current
        );
      }
    };
  }, []);

  const handleSearchChange = (event) => {
    const value = event.target.value;

    setSearchQuery(value);

    if (searchDebounceRef.current) {
      clearTimeout(
        searchDebounceRef.current
      );
    }

    if (!value.trim() || value.trim().length < 2) {
      setSearchResults([]);
      setShowSearchDropdown(false);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);

    searchDebounceRef.current =
      setTimeout(async () => {
        try {
          const params = new URLSearchParams({
            q: value.trim(),
            count: '8',
          });

          const response = await fetch(
            `${API_BASE_URL}/weather/search?${params.toString()}`,
            {
              headers: {
                Accept: 'application/json',
              },
              cache: 'no-store',
            }
          );

          if (!response.ok) {
            throw new Error(
              `Search failed: HTTP ${response.status}`
            );
          }

          const data =
            await response.json();

          setSearchResults(
            Array.isArray(data) ? data : []
          );

          setShowSearchDropdown(true);
        } catch (err) {
          console.error(
            '[WeatherWidget] Location search failed:',
            err
          );

          setSearchResults([]);
          setShowSearchDropdown(false);
        } finally {
          setIsSearching(false);
        }
      }, 350);
  };

  const handleSelectSearchResult = (
    item
  ) => {
    const lat = getNumber(item.latitude);
    const lng = getNumber(item.longitude);

    if (lat === null || lng === null) {
      return;
    }

    const displayName = item.admin1
      ? `${item.name}, ${item.admin1}`
      : item.name;

    setLocationName(displayName);
    setCoords({
      lat,
      lng,
    });

    setSearchQuery('');
    setShowSearchDropdown(false);

    fetchWeather(
      lat,
      lng,
      displayName
    );
  };

  const handlePresetSelect = (
    preset
  ) => {
    setLocationName(
      `${preset.name}, ${preset.state}`
    );

    setCoords({
      lat: preset.lat,
      lng: preset.lng,
    });

    fetchWeather(
      preset.lat,
      preset.lng,
      preset.name
    );
  };

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      setError(
        'Geolocation is not supported by this browser.'
      );
      return;
    }

    setLoading(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat =
          position.coords.latitude;

        const lng =
          position.coords.longitude;

        const name =
          `My Location (${lat.toFixed(
            3
          )}°, ${lng.toFixed(3)}°)`;

        setCoords({
          lat,
          lng,
        });

        setLocationName(name);

        fetchWeather(
          lat,
          lng,
          name
        );
      },
      (geoError) => {
        setLoading(false);

        setError(
          `Unable to access device location: ${geoError.message}`
        );
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  const current =
    weatherData?.current;

  const risk =
    current?.weather_risk ||
    weatherData?.weather_risk ||
    null;

  const riskScore =
    getNumber(
      risk?.total_score ??
      risk?.score
    );

  const riskStyle =
    getRiskStyle(
      risk?.category,
      riskScore
    );

  const isStale =
    Boolean(current?.is_stale) ||
    String(
      current?.data_source || ''
    ).toLowerCase().includes('cached');

  const hourly =
    Array.isArray(weatherData?.hourly)
      ? weatherData.hourly.slice(0, 24)
      : [];

  const daily =
    Array.isArray(weatherData?.daily)
      ? weatherData.daily
      : [];

  return (
    <div className="bg-white border border-[#D5E4DB] rounded-xl shadow-xs overflow-hidden text-[#13261D]">

      {/* HEADER */}
      <div className="p-4 border-b border-[#D5E4DB] bg-[#F8FAFC] flex flex-wrap items-center justify-between gap-3">

        <div className="flex items-center gap-3">

          <div className="w-10 h-10 rounded-lg bg-[#EAF7EE] border border-[#BBF7D0] flex items-center justify-center text-[#15803D] shrink-0 shadow-xs">
            <CloudRain className="w-5 h-5" />
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap">

              <h2 className="text-sm font-bold text-[#0B3B24] tracking-wide uppercase">
                METEOROLOGICAL & CORRIDOR WEATHER MONITOR
              </h2>

              <span
                className={`px-2 py-0.5 rounded border text-[11px] font-bold tracking-wider uppercase flex items-center gap-1.5 ${isStale
                  ? 'bg-amber-50 text-amber-800 border-amber-300'
                  : 'bg-emerald-50 text-emerald-800 border-emerald-300'
                  }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${isStale
                    ? 'bg-amber-500'
                    : 'bg-emerald-600'
                    }`}
                />

                {isStale
                  ? 'STALE CACHED'
                  : 'LIVE OPEN-METEO'}
              </span>

              {lastUpdatedTime && (
                <span className="text-xs text-[#3E5649] font-mono">
                  Updated{' '}
                  {lastUpdatedTime.toLocaleTimeString(
                    [],
                    {
                      hour: '2-digit',
                      minute: '2-digit',
                    }
                  )}
                </span>
              )}

            </div>

            <p className="text-xs text-[#3E5649] mt-0.5">
              Live weather telemetry and logistics vulnerability indexing for Northeast India corridors.
            </p>
          </div>
        </div>

        {/* SEARCH + ACTIONS */}
        <div className="flex items-center gap-2 w-full lg:w-auto">

          <div className="relative flex-1 lg:w-64">

            <Search className="w-3.5 h-3.5 text-[#3E5649] absolute left-3 top-2.5 pointer-events-none" />

            <input
              type="text"
              placeholder="Search corridor or district..."
              value={searchQuery}
              onChange={handleSearchChange}
              onFocus={() =>
                searchResults.length > 0 &&
                setShowSearchDropdown(true)
              }
              className="w-full pl-9 pr-7 py-1.5 bg-white border border-[#D5E4DB] rounded-lg text-xs font-semibold text-[#13261D] placeholder-[#627B6E] focus:outline-none focus:border-[#15803D] focus:ring-1 focus:ring-[#15803D]"
            />

            {isSearching && (
              <RefreshCw className="w-3.5 h-3.5 text-[#15803D] animate-spin absolute right-2.5 top-2.5" />
            )}

            {searchQuery &&
              !isSearching && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setShowSearchDropdown(
                      false
                    );
                  }}
                  className="text-[#627B6E] hover:text-[#13261D] absolute right-2.5 top-2.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}

            {showSearchDropdown &&
              searchResults.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-[#D5E4DB] rounded-lg shadow-lg z-50 max-h-56 overflow-y-auto divide-y divide-[#EEF5F1] text-xs">

                  {searchResults.map(
                    (item, index) => (
                      <button
                        key={`${item.id || index}-${item.latitude}`}
                        onClick={() =>
                          handleSelectSearchResult(
                            item
                          )
                        }
                        className="w-full px-3 py-2 text-left hover:bg-[#F7FAF8] flex items-center justify-between gap-2"
                      >
                        <div>
                          <div className="font-bold text-[#13261D]">
                            {item.name}
                          </div>

                          <div className="text-xs text-[#3E5649]">
                            {[
                              item.admin2,
                              item.admin1,
                              item.country,
                            ]
                              .filter(Boolean)
                              .join(', ')}
                          </div>
                        </div>

                        <span className="text-xs font-mono text-[#3E5649]">
                          [
                          {getNumber(
                            item.latitude
                          )?.toFixed(2)}
                          ,
                          {getNumber(
                            item.longitude
                          )?.toFixed(2)}
                          ]
                        </span>
                      </button>
                    )
                  )}

                </div>
              )}
          </div>

          <button
            onClick={handleUseMyLocation}
            disabled={loading}
            className="px-3 py-1.5 bg-[#EEF5F1] hover:bg-[#E2EFE7] border border-[#D5E4DB] rounded-lg text-[#0B3B24] font-bold text-xs flex items-center gap-1.5 transition active:scale-95"
          >
            <Crosshair className="w-3.5 h-3.5 text-[#15803D]" />
            <span className="hidden sm:inline">
              My Location
            </span>
          </button>

          <button
            onClick={() =>
              fetchWeather(
                coords.lat,
                coords.lng,
                locationName
              )
            }
            disabled={
              loading || isRefreshing
            }
            className="p-1.5 bg-white border border-[#D5E4DB] rounded-lg text-[#3E5649] hover:text-[#15803D] hover:bg-[#F7FAF8] transition"
            title="Refresh Live Weather"
          >
            <RefreshCw
              className={`w-4 h-4 ${loading || isRefreshing
                ? 'animate-spin text-[#15803D]'
                : ''
                }`}
            />
          </button>

        </div>
      </div>

      {/* NER HUBS: Framer Motion animated pills (no horizontal scrollbar) */}
      <div className="px-4 py-2 border-b border-[#D5E4DB] bg-[#F8FAFC] flex flex-wrap items-center gap-1.5 text-xs">
        <span className="font-bold text-[#3E5649] shrink-0 mr-1 flex items-center gap-1 text-xs">
          <MapPin className="w-3.5 h-3.5 text-[#15803D]" />
          Regional Strategic Hubs:
        </span>

        {NER_PRESETS.map((preset) => {
          const selected = locationName.includes(preset.name);
          return (
            <motion.button
              key={preset.name}
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => handlePresetSelect(preset)}
              className={`relative px-2.5 py-1 rounded-md font-bold text-xs shrink-0 transition cursor-pointer ${
                selected
                  ? 'bg-[#0B3B24] text-white shadow-xs'
                  : 'bg-white border border-[#D5E4DB] text-[#13261D] hover:border-[#15803D]'
              }`}
            >
              {preset.name}
            </motion.button>
          );
        })}
      </div>

      {/* TABS: Framer Motion layoutId animated underline without horizontal scroll */}
      <div className="flex flex-wrap border-b border-[#D5E4DB] px-4 bg-[#F8FAFC] text-xs">
        {[
          ['current', 'CURRENT CONDITIONS'],
          ['hourly', 'HOURLY FORECAST'],
          ['daily', '7-DAY FORECAST'],
          ['factors', 'RISK FACTORS'],
        ].map(([key, label]) => {
          const isActive = activeTab === key;
          return (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`relative py-2.5 px-3 font-bold whitespace-nowrap text-xs transition cursor-pointer ${
                isActive
                  ? 'text-[#0B3B24] bg-white'
                  : 'text-[#3E5649] hover:text-[#13261D]'
              }`}
            >
              <span className="relative z-10">{label}</span>
              {isActive && (
                <motion.div
                  layoutId="activeWeatherTabUnderline"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#15803D] z-20"
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* LOADING */}
      {loading && !weatherData && (
        <div className="p-10 text-center text-xs text-[#3E5649] flex flex-col items-center gap-3">

          <RefreshCw className="w-6 h-6 animate-spin text-[#15803D]" />

          <div className="font-bold text-sm text-[#13261D]">
            Fetching live Open-Meteo weather data...
          </div>

          <div className="text-xs text-[#627B6E] font-mono">
            Coordinates: [
            {coords.lat.toFixed(4)},
            {' '}
            {coords.lng.toFixed(4)}
            ]
          </div>

        </div>
      )}

      {/* ERROR */}
      {!loading &&
        error &&
        !weatherData && (
          <div className="p-5 m-4 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-900 space-y-3">

            <div className="flex items-center gap-2 font-bold text-sm text-rose-900">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />

              <span>
                {typeof error === 'object' && error.title
                  ? error.title
                  : 'Unable to retrieve live Open-Meteo weather data'}
              </span>
            </div>

            <p className="text-xs text-rose-800">
              {typeof error === 'object' && error.message
                ? error.message
                : String(error)}
            </p>

            <p className="text-xs font-mono break-all text-[#627B6E]">
              Backend Endpoint: {API_BASE_URL}
            </p>

            {retryCountdown > 0 && (
              <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-xs flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-600" />
                  <span>
                    Auto-retrying in <strong className="font-bold">{retryCountdown}s</strong> (Attempt {retryCount} of 3)...
                  </span>
                </div>
                <button
                  onClick={() => {
                    clearPendingRetries();
                    fetchWeather(coords.lat, coords.lng, locationName, false, 0);
                  }}
                  className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-md text-xs font-bold transition"
                >
                  Retry Now
                </button>
              </div>
            )}

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  clearPendingRetries();
                  fetchWeather(
                    coords.lat,
                    coords.lng,
                    locationName,
                    false,
                    0
                  );
                }}
                disabled={loading}
                className="px-3.5 py-1.5 bg-[#15803D] hover:bg-[#0B3B24] disabled:opacity-50 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 shadow-xs transition active:scale-95"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                <span>{loading ? 'Connecting...' : 'Retry Weather Request'}</span>
              </button>
            </div>

          </div>
        )}

      {/* DATA */}
      {weatherData &&
        current && (
          <div className="p-4 space-y-4">

            {/* CURRENT */}
            {activeTab === 'current' && (
              <div className="space-y-4">

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">

                  {/* CURRENT WEATHER */}
                  <div className="p-4 bg-[#F8FAFC] border border-[#D5E4DB] rounded-lg space-y-3">

                    <div className="flex items-center justify-between gap-2">

                      <span className="text-xs font-bold uppercase flex items-center gap-1.5 truncate text-[#0B3B24]">

                        <MapPin className="w-3.5 h-3.5 text-[#15803D]" />

                        {current.location_name ||
                          locationName}

                      </span>

                      <span className="text-xs text-[#3E5649] font-mono whitespace-nowrap">
                        {getNumber(
                          current.latitude
                        )?.toFixed(2)}
                        °
                        {' '}
                        {getNumber(
                          current.longitude
                        )?.toFixed(2)}
                        °
                      </span>

                    </div>

                    <div className="flex items-center gap-3">

                      {getWeatherIcon(
                        current.weather_code,
                        'w-10 h-10'
                      )}

                      <div>

                        <div className="text-3xl font-bold text-[#13261D] tracking-tight">
                          {displayValue(
                            current.temperature_c,
                            '°C'
                          )}
                        </div>

                        <div className="text-xs font-semibold text-[#15803D]">
                          {current.weather_condition ||
                            'Light Drizzle'}
                        </div>

                      </div>

                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs text-[#3E5649] pt-2 border-t border-[#D5E4DB]">

                      <div>
                        Feels like:
                        {' '}
                        <strong className="text-[#13261D] font-bold">
                          {displayValue(
                            current.feels_like_c ??
                            current.apparent_temperature_c,
                            '°C'
                          )}
                        </strong>
                      </div>

                      <div>
                        Humidity:
                        {' '}
                        <strong className="text-[#13261D] font-bold">
                          {displayValue(
                            current.relative_humidity_percent ??
                            current.humidity_percent,
                            '%'
                          )}
                        </strong>
                      </div>

                    </div>

                  </div>

                  {/* RISK */}
                  <div
                    className={`p-4 rounded-lg border ${riskStyle.bg} ${riskStyle.border} space-y-3`}
                  >

                    <div className="flex items-center justify-between">

                      <span className="text-xs font-bold uppercase flex items-center gap-1.5 text-[#13261D]">

                        <Zap className="w-3.5 h-3.5 text-amber-500" />

                        Weather Risk
                      </span>

                      <span
                        className={`px-2 py-0.5 rounded text-xs font-bold ${riskStyle.badge}`}
                      >
                        {riskStyle.label}
                      </span>

                    </div>

                    <div className="flex items-baseline gap-2">

                      <span className="text-3xl font-bold text-[#13261D] tracking-tight">
                        {riskScore !== null
                          ? riskScore
                          : 'N/A'}
                      </span>

                      <span className="text-xs text-[#627B6E] font-normal">
                        / 100
                      </span>

                    </div>

                    {riskScore !== null && (
                      <div className="w-full bg-black/10 rounded-full h-2 overflow-hidden">

                        <div
                          className={`h-full ${riskStyle.bar}`}
                          style={{
                            width: `${Math.min(
                              100,
                              Math.max(
                                0,
                                riskScore
                              )
                            )}%`,
                          }}
                        />

                      </div>
                    )}

                    <div className="text-xs text-[#3E5649]">
                      {riskScore < 40 
                        ? 'Current conditions are favorable for road transport.' 
                        : `Primary Threat: ${risk?.primary_threat || 'Mountain Weather Risk'}`}
                    </div>

                  </div>

                  {/* PRECIPITATION / RAIN */}
                  <div className="p-4 bg-[#F8FAFC] border border-[#D5E4DB] rounded-lg space-y-3">

                    <div className="flex items-center justify-between">

                      <span className="text-xs font-bold uppercase text-[#0B3B24]">
                        Rainfall
                      </span>

                      <span className="text-xs font-mono text-[#15803D] bg-[#EAF7EE] border border-[#BBF7D0] px-2 py-0.5 rounded font-bold">
                        LIVE
                      </span>

                    </div>

                    <div className="flex items-baseline gap-2">

                      <span className="text-3xl font-bold text-[#13261D] tracking-tight">
                        {displayValue(
                          current.precipitation_mm,
                          ' mm'
                        )}
                      </span>

                    </div>

                    <div className="text-xs text-[#3E5649]">
                      Reported precipitation rate across sector
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs text-[#3E5649] pt-2 border-t border-[#D5E4DB]">

                      <div>
                        Rain:
                        {' '}
                        <strong className="text-[#13261D] font-bold">
                          {displayValue(
                            current.rain_mm,
                            ' mm'
                          )}
                        </strong>
                      </div>

                      <div>
                        Snow:
                        {' '}
                        <strong className="text-[#13261D] font-bold">
                          {displayValue(
                            current.snowfall_cm,
                            ' cm'
                          )}
                        </strong>
                      </div>

                    </div>

                  </div>

                </div>

                {/* ATMOSPHERIC METRICS */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 text-xs">

                  <Metric
                    icon={<Wind className="w-3.5 h-3.5 text-[#15803D]" />}
                    title="WIND"
                    value={displayValue(
                      current.wind_speed_kmh ??
                      current.wind_kmh,
                      ' km/h'
                    )}
                    subtitle={getWindDirection(
                      current.wind_direction_deg
                    )}
                  />

                  <Metric
                    icon={<Wind className="w-3.5 h-3.5 text-orange-600" />}
                    title="GUSTS"
                    value={displayValue(
                      current.wind_gusts_kmh,
                      ' km/h'
                    )}
                    subtitle="Peak gust velocity"
                  />

                  <Metric
                    icon={<Eye className="w-3.5 h-3.5 text-[#0D9488]" />}
                    title="VISIBILITY"
                    value={displayValue(
                      current.visibility_km,
                      ' km'
                    )}
                    subtitle="Corridor visibility"
                  />

                  <Metric
                    icon={<Cloud className="w-3.5 h-3.5 text-[#3E5649]" />}
                    title="CLOUD COVER"
                    value={displayValue(
                      current.cloud_cover_percent,
                      '%'
                    )}
                    subtitle="Overhead coverage"
                  />

                  <Metric
                    icon={<Gauge className="w-3.5 h-3.5 text-[#0B3B24]" />}
                    title="PRESSURE"
                    value={displayValue(
                      current.pressure_msl_hpa,
                      ' hPa'
                    )}
                    subtitle="Sea-level pressure"
                  />

                  <Metric
                    icon={<Activity className="w-3.5 h-3.5 text-emerald-600" />}
                    title="ACCESSIBILITY"
                    value={
                      riskScore !== null
                        ? `${Math.max(
                          0,
                          Math.round(
                            100 -
                            riskScore
                          )
                        )} / 100`
                        : 'N/A'
                    }
                    subtitle="Weather accessibility"
                  />

                </div>

                {/* PRECAUTIONS (CRITICAL REQUIREMENT) */}
                <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-lg space-y-2">
                  <div className="flex items-center gap-2 text-amber-900 font-bold text-xs uppercase tracking-wider">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    OPERATIONAL PRECAUTIONS & ADVISORY
                  </div>
                  <ul className="text-xs text-amber-950 space-y-1 pl-5 list-disc font-medium">
                    {riskScore >= 60 ? (
                      <>
                        <li><strong>High Terrain Alert:</strong> Reduced visibility and slippery road surface expected along mountain corridors.</li>
                        <li><strong>Route Advisory:</strong> Avoid vulnerable bypass routes and monitor real-time landslide warnings.</li>
                        <li><strong>Logistics Operations:</strong> Mandate speed limits and inspect heavy vehicle traction before departure.</li>
                      </>
                    ) : riskScore >= 30 ? (
                      <>
                        <li><strong>Moderate Conditions:</strong> Rain expected along hill sections; maintain safe stopping distances.</li>
                        <li><strong>Corridor Check:</strong> Monitor NH highway updates for localized waterlogging or minor delays.</li>
                        <li><strong>Fleet Notice:</strong> Ensure GPS tracking is active on all dispatched consignments.</li>
                      </>
                    ) : (
                      <>
                        <li><strong>Clear Corridors:</strong> Road conditions favorable for standard logistics and transit operations.</li>
                        <li><strong>Standard Routine:</strong> Regular freight schedules proceed without weather-induced delays.</li>
                        <li><strong>Monitoring:</strong> Automatic 30-minute meteorological sweep active for downstream passes.</li>
                      </>
                    )}
                  </ul>
                  {risk?.logistics_impact && (
                    <div className="pt-2 border-t border-amber-200/60 text-xs text-amber-900">
                      <strong>Impact Summary:</strong> {risk.logistics_impact}
                    </div>
                  )}
                </div>

              </div>
            )}

            {/* HOURLY */}
            {activeTab === 'hourly' && (
              <div className="space-y-3">

                <div className="flex items-center justify-between text-xs">
                  <div className="font-bold text-sm text-[#0B3B24] flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-[#15803D]" />
                    <span>Next 24 Hours Forecast</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-[#3E5649] hidden sm:inline">
                      Open-Meteo Hourly
                    </span>
                    <div className="flex items-center gap-1">
                      <motion.button
                        type="button"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.92 }}
                        onClick={() => {
                          const el = document.getElementById('hourly-carousel-container');
                          if (el) el.scrollBy({ left: -240, behavior: 'smooth' });
                        }}
                        className="p-1.5 rounded-md bg-white hover:bg-[#F6F8FA] border border-[#D5E4DB] text-[#3E5649] hover:text-[#0B3B24] shadow-2xs transition cursor-pointer"
                        title="Previous Hours"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </motion.button>
                      <motion.button
                        type="button"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.92 }}
                        onClick={() => {
                          const el = document.getElementById('hourly-carousel-container');
                          if (el) el.scrollBy({ left: 240, behavior: 'smooth' });
                        }}
                        className="p-1.5 rounded-md bg-white hover:bg-[#F6F8FA] border border-[#D5E4DB] text-[#3E5649] hover:text-[#0B3B24] shadow-2xs transition cursor-pointer"
                        title="Next Hours"
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                      </motion.button>
                    </div>
                  </div>
                </div>

                {hourly.length === 0 ? (
                  <EmptyState text="Hourly forecast data is unavailable." />
                ) : (
                  <div 
                    id="hourly-carousel-container"
                    className="flex gap-2 overflow-x-auto no-scrollbar pb-2 scroll-smooth"
                  >
                    {hourly.map((hour, index) => {
                      const style = getRiskStyle(
                        hour.hourly_risk_category,
                        hour.hourly_risk_score
                      );

                      return (
                        <motion.div
                          key={hour.time || index}
                          whileHover={{ y: -3, scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          transition={{ type: "spring", stiffness: 400, damping: 25 }}
                          className={`p-3 rounded-lg border min-w-[110px] text-center space-y-1.5 shrink-0 shadow-2xs transition-colors cursor-pointer ${style.bg} ${style.border}`}
                        >

                            <div className="text-xs font-bold uppercase text-[#3E5649]">
                              {index === 0
                                ? 'NOW'
                                : formatTime(
                                  hour.time
                                )}
                            </div>

                            {getWeatherIcon(
                              hour.weather_code,
                              'w-6 h-6 mx-auto'
                            )}

                            <div className="text-sm font-bold text-[#13261D]">
                              {displayValue(
                                hour.temperature_c,
                                '°C'
                              )}
                            </div>

                            <div className="text-xs text-[#15803D] font-bold">
                              {displayValue(
                                hour.precipitation_probability,
                                '%'
                              )}
                            </div>

                            <div className="text-xs text-[#3E5649]">
                              {displayValue(
                                hour.precipitation_mm,
                                ' mm'
                              )}
                            </div>

                            <div className="text-xs text-teal-800 font-semibold">
                              {displayValue(
                                hour.wind_speed_kmh,
                                ' km/h'
                              )}
                            </div>

                            {hour.hourly_risk_score !==
                              undefined && (
                                <div
                                  className={`text-xs font-bold uppercase px-1.5 py-0.5 rounded ${style.badge}`}
                                >
                                  {style.label}
                                </div>
                              )}

                          </motion.div>
                        );
                      }
                    )}

                  </div>
                )}

              </div>
            )}

            {/* DAILY */}
            {activeTab === 'daily' && (
              <div className="space-y-3">

                <div className="flex items-center justify-between text-xs">

                  <div className="font-bold text-sm text-[#0B3B24] flex items-center gap-1.5">
                    <Sun className="w-4 h-4 text-amber-500" />
                    7-Day Weather Outlook
                  </div>

                  <span className="text-xs font-mono text-[#3E5649]">
                    Open-Meteo Daily
                  </span>

                </div>

                {daily.length === 0 ? (
                  <EmptyState text="Daily forecast data is unavailable." />
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-2.5">

                    {daily.map(
                      (day, index) => (
                        <div
                          key={
                            day.date ||
                            index
                          }
                          className="p-3 rounded-lg border border-[#D5E4DB] bg-[#F8FAFC] space-y-2 text-center"
                        >

                          <div>
                            <div className="font-bold text-xs text-[#13261D]">
                              {index === 0
                                ? 'Today'
                                : index === 1
                                  ? 'Tomorrow'
                                  : day.date}
                            </div>
                          </div>

                          {getWeatherIcon(
                            day.weather_code,
                            'w-7 h-7 mx-auto'
                          )}

                          <div className="text-xs font-semibold text-[#3E5649]">
                            {day.weather_condition ||
                              'N/A'}
                          </div>

                          <div className="text-xs font-bold text-[#13261D]">

                            {displayValue(
                              day.temperature_max_c,
                              '°'
                            )}

                            {' / '}

                            {displayValue(
                              day.temperature_min_c,
                              '°'
                            )}

                          </div>

                          <div className="pt-1 border-t border-[#D5E4DB] text-xs text-[#3E5649] space-y-1">

                            <div className="flex justify-between">
                              <span>Rain:</span>
                              <strong className="text-[#13261D] font-bold">
                                {displayValue(
                                  day.precipitation_probability_max,
                                  '%'
                                )}
                              </strong>
                            </div>

                            <div className="flex justify-between">
                              <span>Rain Sum:</span>
                              <strong className="text-[#13261D] font-bold">
                                {displayValue(
                                  day.precipitation_sum_mm,
                                  ' mm'
                                )}
                              </strong>
                            </div>

                            <div className="flex justify-between">
                              <span>Max Wind:</span>
                              <strong className="text-[#13261D] font-bold">
                                {displayValue(
                                  day.max_wind_speed_kmh,
                                  ' km/h'
                                )}
                              </strong>
                            </div>

                          </div>

                          {day.sunrise &&
                            day.sunset && (
                              <div className="pt-1 border-t border-[#D5E4DB] flex justify-between text-xs text-[#3E5649]">

                                <span className="flex items-center gap-0.5">
                                  <Sunrise className="w-3 h-3 text-amber-500" />
                                  {formatTime(
                                    day.sunrise
                                  )}
                                </span>

                                <span className="flex items-center gap-0.5">
                                  <Sunset className="w-3 h-3 text-orange-500" />
                                  {formatTime(
                                    day.sunset
                                  )}
                                </span>

                              </div>
                            )}

                        </div>
                      )
                    )}

                  </div>
                )}

              </div>
            )}

            {/* FACTORS */}
            {activeTab === 'factors' && (
              <div className="space-y-3">

                <div className="text-xs text-[#3E5649]">
                  Operational weather risk calculated from live meteorological inputs.
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">

                  <RiskFactor
                    title="Rain Intensity"
                    value={risk?.precipitation_risk}
                    max="35"
                    current={current?.precipitation_mm}
                    unit=" mm"
                  />

                  <RiskFactor
                    title="Rain Probability"
                    value={risk?.probability_risk}
                    max="20"
                    current={current?.precipitation_probability}
                    unit="%"
                  />

                  <RiskFactor
                    title="Mountain Wind"
                    value={risk?.wind_risk}
                    max="15"
                    current={current?.wind_speed_kmh}
                    unit=" km/h"
                  />

                  <RiskFactor
                    title="Severe Weather"
                    value={risk?.severe_weather_risk}
                    max="20"
                    current={current?.weather_code}
                    unit=""
                  />

                  <RiskFactor
                    title="Temperature"
                    value={risk?.temperature_risk}
                    max="10"
                    current={current?.temperature_c}
                    unit="°C"
                  />

                  <RiskFactor
                    title="6h Persistence"
                    value={risk?.persistence_risk}
                    max="10"
                    current={risk?.persistence_risk}
                    unit=" pts"
                  />

                </div>

              </div>
            )}

            {/* SOURCE */}
            <div className="pt-2 border-t border-[#D5E4DB] flex flex-wrap items-center justify-between gap-2 text-xs text-[#3E5649]">

              <div>
                Data Source:
                {' '}
                <span className="font-bold text-[#0B3B24]">
                  Open-Meteo High-Resolution Regional Model
                </span>
              </div>

              <div className="font-mono">
                {coords.lat.toFixed(4)}
                ,
                {' '}
                {coords.lng.toFixed(4)}
                {' • '}
                {weatherData?.timezone ||
                  'N/A'}
              </div>

            </div>

          </div>
        )}

    </div>
  );
};

const Metric = ({
  icon,
  title,
  value,
  subtitle,
}) => (
  <div className="p-3 bg-white border border-[#D5E4DB] rounded-lg shadow-2xs space-y-1">

    <div className="text-xs font-bold text-[#3E5649] uppercase flex items-center gap-1">
      {icon}
      {title}
    </div>

    <div className="text-lg font-bold text-[#13261D] tracking-tight">
      {value}
    </div>

    <div className="text-xs text-[#3E5649]">
      {subtitle}
    </div>

  </div>
);

const RiskFactor = ({
  title,
  value,
  max,
  current,
  unit,
}) => (
  <div className="p-3.5 bg-[#F8FAFC] border border-[#D5E4DB] rounded-lg space-y-1.5">

    <div className="flex justify-between items-center font-bold text-[#13261D]">

      <span>
        {title}
      </span>

      <span className="font-mono text-[#15803D] font-bold">
        {getNumber(value) !== null
          ? `${value} / ${max}`
          : 'N/A'}
      </span>

    </div>

    <div className="text-xs text-[#3E5649]">
      Current:
      {' '}
      <strong className="text-[#13261D] font-bold">
        {displayValue(
          current,
          unit
        )}
      </strong>
    </div>

  </div>
);

const EmptyState = ({
  text,
}) => (
  <div className="p-8 text-center border border-dashed border-[#D5E4DB] rounded-lg text-xs text-[#3E5649]">
    {text}
  </div>
);

export default WeatherWidget;