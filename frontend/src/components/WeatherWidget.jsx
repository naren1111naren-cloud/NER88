import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
} from 'react';

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
          className={`${className} text-blue-600`}
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
          className={`${className} text-blue-700`}
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
    <div className="bg-white border border-[#D9DEE7] rounded-lg shadow-xs overflow-hidden">

      {/* HEADER */}
      <div className="p-4 border-b border-[#D9DEE7] bg-[#F8FAFC] flex flex-wrap items-center justify-between gap-3">

        <div className="flex items-center gap-3">

          <div className="w-9 h-9 rounded-lg bg-purple-100 border border-purple-200 flex items-center justify-center text-[#6D28D9] shrink-0">
            <CloudRain className="w-5 h-5" />
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap">

              <h2 className="text-sm font-bold text-[#172033] uppercase tracking-wider">
                WEATHER CONDITIONS & ACCESSIBILITY
              </h2>

              <span
                className={`px-2 py-0.5 rounded-md border text-xs font-bold uppercase tracking-wider flex items-center gap-1 ${isStale
                  ? 'bg-amber-50 text-amber-800 border-amber-300'
                  : 'bg-emerald-50 text-[#047857] border-emerald-300'
                  }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${isStale
                    ? 'bg-amber-500'
                    : 'bg-emerald-500 animate-pulse'
                    }`}
                />

                {isStale
                  ? 'STALE DATA'
                  : 'LIVE OPEN-METEO'}
              </span>

              {lastUpdatedTime && (
                <span className="text-xs text-[#667085] font-mono">
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

            <p className="text-xs text-[#475467] mt-0.5 font-normal">
              Current meteorological conditions and live impact on regional logistics corridors
            </p>
          </div>
        </div>

        {/* SEARCH + ACTIONS */}
        <div className="flex items-center gap-2 w-full lg:w-auto">

          <div className="relative flex-1 lg:w-64">

            <Search className="w-3.5 h-3.5 text-[#667085] absolute left-3 top-2.5 pointer-events-none" />

            <input
              type="text"
              placeholder="Search corridor or district..."
              value={searchQuery}
              onChange={handleSearchChange}
              onFocus={() =>
                searchResults.length > 0 &&
                setShowSearchDropdown(true)
              }
              className="w-full pl-9 pr-7 py-1.5 bg-white border border-[#D9DEE7] rounded-md text-xs font-semibold text-[#172033] placeholder-[#667085] focus:outline-none focus:border-[#6D28D9]"
            />

            {isSearching && (
              <RefreshCw className="w-3.5 h-3.5 text-[#6D28D9] animate-spin absolute right-2.5 top-2.5" />
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
                  className="text-[#667085] hover:text-[#172033] absolute right-2.5 top-2.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}

            {showSearchDropdown &&
              searchResults.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-[#D9DEE7] rounded-md shadow-lg z-50 max-h-56 overflow-y-auto divide-y divide-[#E2E8F0] text-xs">

                  {searchResults.map(
                    (item, index) => (
                      <button
                        key={`${item.id || index}-${item.latitude}`}
                        onClick={() =>
                          handleSelectSearchResult(
                            item
                          )
                        }
                        className="w-full px-3 py-2 text-left hover:bg-purple-50 flex items-center justify-between gap-2"
                      >
                        <div>
                          <div className="font-bold text-[#172033]">
                            {item.name}
                          </div>

                          <div className="text-xs text-[#475467]">
                            {[
                              item.admin2,
                              item.admin1,
                              item.country,
                            ]
                              .filter(Boolean)
                              .join(', ')}
                          </div>
                        </div>

                        <span className="text-xs font-mono text-[#667085]">
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
            className="px-3 py-1.5 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-md text-[#6D28D9] font-bold text-xs flex items-center gap-1.5 transition active:scale-95"
          >
            <Crosshair className="w-3.5 h-3.5" />
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
            className="p-1.5 bg-white border border-[#D9DEE7] rounded-md text-[#475467] hover:text-[#6D28D9] hover:bg-[#F8FAFC] transition"
            title="Refresh Live Weather"
          >
            <RefreshCw
              className={`w-4 h-4 ${loading || isRefreshing
                ? 'animate-spin text-[#6D28D9]'
                : ''
                }`}
            />
          </button>

        </div>
      </div>

      {/* NER HUBS */}
      <div className="px-4 py-2 border-b border-[#D9DEE7] bg-[#F8FAFC] flex items-center gap-1.5 overflow-x-auto text-xs">

        <span className="font-bold text-[#475467] shrink-0 mr-1 flex items-center gap-1 text-xs">
          <MapPin className="w-3.5 h-3.5 text-[#6D28D9]" />
          Strategic Hubs:
        </span>

        {NER_PRESETS.map(
          (preset) => {
            const selected =
              locationName.includes(
                preset.name
              );

            return (
              <button
                key={preset.name}
                onClick={() =>
                  handlePresetSelect(
                    preset
                  )
                }
                className={`px-2.5 py-1 rounded-md font-bold text-xs shrink-0 transition ${selected
                  ? 'bg-[#6D28D9] text-white shadow-xs'
                  : 'bg-white border border-[#D9DEE7] text-[#172033] hover:border-purple-300'
                  }`}
              >
                {preset.name}
              </button>
            );
          }
        )}
      </div>

      {/* TABS */}
      <div className="flex border-b border-[#D9DEE7] px-4 bg-[#F8FAFC] text-xs overflow-x-auto">

        {[
          ['current', 'CURRENT CONDITIONS'],
          ['hourly', 'HOURLY FORECAST'],
          ['daily', '7-DAY FORECAST'],
          ['factors', 'RISK FACTORS'],
        ].map(([key, label]) => (
          <button
            key={key}
            onClick={() =>
              setActiveTab(key)
            }
            className={`py-2.5 px-3 font-bold border-b-2 whitespace-nowrap text-xs transition ${activeTab === key
              ? 'border-[#6D28D9] text-[#6D28D9] bg-white'
              : 'border-transparent text-[#475467] hover:text-[#172033]'
              }`}
          >
            {label}
          </button>
        ))}

      </div>

      {/* LOADING */}
      {loading && !weatherData && (
        <div className="p-10 text-center text-xs text-[#475467] flex flex-col items-center gap-3">

          <RefreshCw className="w-6 h-6 animate-spin text-[#6D28D9]" />

          <div className="font-bold text-sm text-[#172033]">
            Fetching live Open-Meteo weather data...
          </div>

          <div className="text-xs text-[#667085] font-mono">
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
          <div className="p-5 m-4 bg-rose-50 border border-rose-200 rounded-md text-xs text-rose-900 space-y-3">

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

            <p className="text-xs font-mono break-all text-[#667085]">
              Backend Endpoint: {API_BASE_URL}
            </p>

            {retryCountdown > 0 && (
              <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-md text-amber-900 text-xs flex items-center justify-between gap-2">
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
                className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-md font-bold text-xs flex items-center gap-1.5 shadow-xs transition active:scale-95"
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
                  <div className="p-4 bg-[#F8FAFC] border border-[#D9DEE7] rounded-md space-y-3">

                    <div className="flex items-center justify-between gap-2">

                      <span className="text-xs font-bold uppercase flex items-center gap-1.5 truncate text-[#172033]">

                        <MapPin className="w-3.5 h-3.5 text-[#6D28D9]" />

                        {current.location_name ||
                          locationName}

                      </span>

                      <span className="text-xs text-[#667085] font-mono whitespace-nowrap">
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

                        <div className="text-3xl font-bold text-[#172033] tracking-tight">
                          {displayValue(
                            current.temperature_c,
                            '°C'
                          )}
                        </div>

                        <div className="text-xs font-semibold text-[#6D28D9]">
                          {current.weather_condition ||
                            'Light Drizzle'}
                        </div>

                      </div>

                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs text-[#475467] pt-2 border-t border-[#E2E8F0]">

                      <div>
                        Feels like:
                        {' '}
                        <strong className="text-[#172033] font-bold">
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
                        <strong className="text-[#172033] font-bold">
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
                    className={`p-4 rounded-md border ${riskStyle.bg} ${riskStyle.border} space-y-3`}
                  >

                    <div className="flex items-center justify-between">

                      <span className="text-xs font-bold uppercase flex items-center gap-1.5 text-[#172033]">

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

                      <span className="text-3xl font-bold text-[#172033] tracking-tight">
                        {riskScore !== null
                          ? riskScore
                          : 'N/A'}
                      </span>

                      <span className="text-xs text-[#667085] font-normal">
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

                    <div className="text-xs text-[#475467]">
                      {riskScore < 40 
                        ? 'Current conditions are favorable for road transport.' 
                        : `Primary Threat: ${risk?.primary_threat || 'Mountain Weather Risk'}`}
                    </div>

                  </div>

                  {/* PRECIPITATION / RAIN */}
                  <div className="p-4 bg-[#F8FAFC] border border-[#D9DEE7] rounded-md space-y-3">

                    <div className="flex items-center justify-between">

                      <span className="text-xs font-bold uppercase text-[#172033]">
                        Rainfall
                      </span>

                      <span className="text-xs font-mono text-[#1D4ED8] bg-blue-50 border border-blue-200 px-2 py-0.5 rounded font-bold">
                        LIVE
                      </span>

                    </div>

                    <div className="flex items-baseline gap-2">

                      <span className="text-3xl font-bold text-[#172033] tracking-tight">
                        {displayValue(
                          current.precipitation_mm,
                          ' mm'
                        )}
                      </span>

                    </div>

                    <div className="text-xs text-[#475467]">
                      Reported precipitation rate across sector
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs text-[#475467] pt-2 border-t border-[#E2E8F0]">

                      <div>
                        Rain:
                        {' '}
                        <strong className="text-[#172033] font-bold">
                          {displayValue(
                            current.rain_mm,
                            ' mm'
                          )}
                        </strong>
                      </div>

                      <div>
                        Snow:
                        {' '}
                        <strong className="text-[#172033] font-bold">
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
                    icon={<Wind className="w-3.5 h-3.5 text-teal-600" />}
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
                    icon={<Eye className="w-3.5 h-3.5 text-blue-600" />}
                    title="VISIBILITY"
                    value={displayValue(
                      current.visibility_km,
                      ' km'
                    )}
                    subtitle="Corridor visibility"
                  />

                  <Metric
                    icon={<Cloud className="w-3.5 h-3.5 text-slate-600" />}
                    title="CLOUD COVER"
                    value={displayValue(
                      current.cloud_cover_percent,
                      '%'
                    )}
                    subtitle="Overhead coverage"
                  />

                  <Metric
                    icon={<Gauge className="w-3.5 h-3.5 text-[#6D28D9]" />}
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

                {/* ADVISORY */}
                <div className="p-3.5 bg-[#F8FAFC] border border-[#D9DEE7] rounded-md flex items-start gap-2.5">

                  <Zap className="w-4 h-4 text-[#6D28D9] shrink-0 mt-0.5" />

                  <div className="text-xs">

                    <span className="font-bold text-[#172033] uppercase tracking-wider text-xs">
                      LOGISTICS ADVISORY:
                      {' '}
                    </span>

                    <span className="text-[#475467]">
                      {risk?.logistics_impact ||
                        'Low weather-related transport risk based on current conditions.'}
                    </span>

                  </div>

                </div>

              </div>
            )}

            {/* HOURLY */}
            {activeTab === 'hourly' && (
              <div className="space-y-3">

                <div className="flex items-center justify-between text-xs">

                  <div className="font-bold text-sm text-[#172033] flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-[#6D28D9]" />
                    Next 24 Hours
                  </div>

                  <span className="text-xs font-mono text-[#667085]">
                    Open-Meteo Hourly
                  </span>

                </div>

                {hourly.length === 0 ? (
                  <EmptyState text="Hourly forecast data is unavailable." />
                ) : (
                  <div className="flex gap-2 overflow-x-auto pb-2">

                    {hourly.map(
                      (hour, index) => {
                        const style =
                          getRiskStyle(
                            hour.hourly_risk_category,
                            hour.hourly_risk_score
                          );

                        return (
                          <div
                            key={
                              hour.time ||
                              index
                            }
                            className={`p-3 rounded-md border min-w-[110px] text-center space-y-1.5 shrink-0 ${style.bg} ${style.border}`}
                          >

                            <div className="text-xs font-bold uppercase text-[#667085]">
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

                            <div className="text-sm font-bold text-[#172033]">
                              {displayValue(
                                hour.temperature_c,
                                '°C'
                              )}
                            </div>

                            <div className="text-xs text-[#1D4ED8] font-bold">
                              {displayValue(
                                hour.precipitation_probability,
                                '%'
                              )}
                            </div>

                            <div className="text-xs text-[#475467]">
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

                          </div>
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

                  <div className="font-bold text-sm text-[#172033] flex items-center gap-1.5">
                    <Sun className="w-4 h-4 text-amber-500" />
                    7-Day Forecast
                  </div>

                  <span className="text-xs font-mono text-[#667085]">
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
                          className="p-3 rounded-md border border-[#D9DEE7] bg-[#F8FAFC] space-y-2 text-center"
                        >

                          <div>
                            <div className="font-bold text-xs text-[#172033]">
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

                          <div className="text-xs font-semibold text-[#475467]">
                            {day.weather_condition ||
                              'N/A'}
                          </div>

                          <div className="text-xs font-bold text-[#172033]">

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

                          <div className="pt-1 border-t border-[#E2E8F0] text-xs text-[#475467] space-y-1">

                            <div className="flex justify-between">
                              <span>Rain:</span>
                              <strong className="text-[#172033] font-bold">
                                {displayValue(
                                  day.precipitation_probability_max,
                                  '%'
                                )}
                              </strong>
                            </div>

                            <div className="flex justify-between">
                              <span>Rain Sum:</span>
                              <strong className="text-[#172033] font-bold">
                                {displayValue(
                                  day.precipitation_sum_mm,
                                  ' mm'
                                )}
                              </strong>
                            </div>

                            <div className="flex justify-between">
                              <span>Max Wind:</span>
                              <strong className="text-[#172033] font-bold">
                                {displayValue(
                                  day.max_wind_speed_kmh,
                                  ' km/h'
                                )}
                              </strong>
                            </div>

                          </div>

                          {day.sunrise &&
                            day.sunset && (
                              <div className="pt-1 border-t border-[#E2E8F0] flex justify-between text-xs text-[#667085]">

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

                <div className="text-xs text-[#475467]">
                  Weather risk calculated from live meteorological inputs.
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
            <div className="pt-2 border-t border-[#E2E8F0] flex flex-wrap items-center justify-between gap-2 text-xs text-[#667085]">

              <div>
                Weather Data Source:
                {' '}
                <span className="font-bold text-[#6D28D9]">
                  Open-Meteo
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
  <div className="p-3 bg-white border border-[#D9DEE7] rounded-md shadow-2xs space-y-1">

    <div className="text-xs font-bold text-[#475467] uppercase flex items-center gap-1">
      {icon}
      {title}
    </div>

    <div className="text-lg font-bold text-[#172033] tracking-tight">
      {value}
    </div>

    <div className="text-xs text-[#667085]">
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
  <div className="p-3.5 bg-[#F8FAFC] border border-[#D9DEE7] rounded-md space-y-1.5">

    <div className="flex justify-between items-center font-bold text-[#172033]">

      <span>
        {title}
      </span>

      <span className="font-mono text-[#6D28D9] font-bold">
        {getNumber(value) !== null
          ? `${value} / ${max}`
          : 'N/A'}
      </span>

    </div>

    <div className="text-xs text-[#475467]">
      Current:
      {' '}
      <strong className="text-[#172033] font-bold">
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
  <div className="p-8 text-center border border-dashed border-[#D9DEE7] rounded-md text-xs text-[#475467]">
    {text}
  </div>
);

export default WeatherWidget;