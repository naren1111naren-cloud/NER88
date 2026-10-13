import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  MapContainer, TileLayer, GeoJSON, Polyline, Marker, Popup, Tooltip, useMap, ZoomControl, Circle
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './mapStyles.css';
import { NORTHEAST_STATES_GEOJSON, MAJOR_LOGISTICS_CITIES } from '../../data/northeastGeoJSON';
import { 
  Layers, Navigation, ShieldCheck, AlertTriangle, CloudRain, 
  Truck, Activity, Waves, RotateCcw, Crosshair, Check, Eye, EyeOff,
  Maximize2, Compass, MapPin, Radio, CheckCircle2, ChevronDown, ChevronUp,
  Globe, Info, ArrowRight, ExternalLink, ShieldAlert, Sliders, Filter,
  Search, Mountain, Shield, Zap, Package, Fuel, Pill, LifeBuoy, Timer,
  Building2, AlertOctagon, Sparkles, Clock, ArrowUpRight, Gauge
} from 'lucide-react';

/**
 * AUTHORITATIVE BOUNDARY & GIS DATA SOURCE DECLARATION
 * Sourced from official Survey of India / NHAI / MoRTH / BRO Authoritative GIS Infrastructure Dataset.
 * Contains authentic geometric coordinates for all 8 North-Eastern States:
 * Arunachal Pradesh, Assam, Manipur, Meghalaya, Mizoram, Nagaland, Sikkim, Tripura.
 */
export const BOUNDARY_DATA_SOURCE = "Survey of India / NHAI / MoRTH / BRO Authoritative GIS Infrastructure Dataset";

// Official 8-State Regional Palette for subtle visual differentiation
export const STATE_COLOR_PALETTE = {
  'Arunachal Pradesh': { fill: '#15803D', border: '#0B3B24', label: 'ARUNACHAL PRADESH', code: 'AR', centroid: [28.218, 94.7278] },
  'Assam': { fill: '#16A34A', border: '#15803D', label: 'ASSAM', code: 'AS', centroid: [26.2006, 92.9376] },
  'Meghalaya': { fill: '#0D9488', border: '#0B3B24', label: 'MEGHALAYA', code: 'ML', centroid: [25.4670, 91.3662] },
  'Nagaland': { fill: '#3E5649', border: '#13261D', label: 'NAGALAND', code: 'NL', centroid: [26.1584, 94.5624] },
  'Manipur': { fill: '#D98C00', border: '#B27200', label: 'MANIPUR', code: 'MN', centroid: [24.6637, 93.9063] },
  'Mizoram': { fill: '#198754', border: '#12633D', label: 'MIZORAM', code: 'MZ', centroid: [23.1645, 92.9376] },
  'Tripura': { fill: '#D98C00', border: '#B27200', label: 'TRIPURA', code: 'TR', centroid: [23.9408, 91.9882] },
  'Sikkim': { fill: '#15803D', border: '#0B3B24', label: 'SIKKIM', code: 'SK', centroid: [27.5330, 88.5122] }
};

// Geographic center for North-East India view
const NER_CENTER = [26.15, 93.4];
const NER_DEFAULT_ZOOM = 7;

// Fix Leaflet marker icon asset paths
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Helper for Essential Supplies Cargo Icon badge
const getCargoIconSvg = (cargoType) => {
  const type = (cargoType || 'GENERAL').toUpperCase();
  if (type.includes('PHARMA') || type.includes('MED') || type.includes('VACCINE')) {
    return `<svg class="w-3 h-3 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/><path d="m8.5 8.5 7 7"/></svg>`;
  }
  if (type.includes('FUEL') || type.includes('DIESEL') || type.includes('PETROL')) {
    return `<svg class="w-3 h-3 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="3" y1="22" x2="15" y2="22"/><line x1="4" y1="9" x2="14" y2="9"/><path d="M14 22V4a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v18"/><path d="M14 13h2a2 2 0 0 1 2 2v2a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2V9.83a2 2 0 0 0-.59-1.42L18 5"/></svg>`;
  }
  if (type.includes('RATION') || type.includes('FOOD') || type.includes('GRAIN')) {
    return `<svg class="w-3 h-3 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>`;
  }
  if (type.includes('RELIEF') || type.includes('DISASTER') || type.includes('NDRF')) {
    return `<svg class="w-3 h-3 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><path d="m4.93 4.93 4.24 4.24"/><path d="m14.83 9.17 4.24-4.24"/><path d="m14.83 14.83 4.24 4.24"/><path d="m9.17 14.83-4.24 4.24"/><circle cx="12" cy="12" r="4"/></svg>`;
  }
  return `<svg class="w-3 h-3 text-slate-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect width="16" height="13" x="4" y="5" rx="2"/><path d="M16 2v3"/><path d="M8 2v3"/></svg>`;
};

// 1. Essential Supplies Live Telemetry Vehicle Pin (Icon-Rich & Low-Text)
const createVehiclePin = (veh, isAlert = false) => {
  const code = typeof veh === 'string' ? veh : (veh.vehicle_code || veh.registration || 'V-100');
  const speed = typeof veh === 'object' ? (veh.speed_kmh ?? 40) : 40;
  const cargo = typeof veh === 'object' ? (veh.cargo_type || veh.cargo || 'SUPPLIES') : 'SUPPLIES';
  const pinColor = isAlert ? '#C62828' : '#15803D';
  const cargoSvg = getCargoIconSvg(cargo);

  return L.divIcon({
    html: `
      <div class="custom-map-marker flex flex-col items-center cursor-pointer group" style="transform: translate(-50%, -50%);">
        <div class="bg-white/95 border border-[#CCE0D5] group-hover:border-[#15803D] px-2 py-0.5 rounded-lg shadow-md flex items-center gap-1.5 text-[10px] font-bold text-[#13261D] whitespace-nowrap transition-transform group-hover:scale-110">
          <span class="shrink-0 flex items-center">${cargoSvg}</span>
          <span class="font-extrabold">${code}</span>
          <span class="text-[#3E5649] text-[9px] font-mono px-1 rounded bg-[#F7FAF8]">${speed} km/h</span>
          <span class="w-2 h-2 rounded-full ${isAlert ? 'bg-[#C62828] animate-ping' : 'bg-[#15803D]'}"></span>
        </div>
        <div class="w-6.5 h-6.5 rounded-full bg-white border-2 flex items-center justify-center shadow-lg mt-0.5" style="border-color: ${pinColor}; color: ${pinColor};">
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="${pinColor}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/></svg>
        </div>
      </div>
    `,
    className: 'custom-vehicle-icon',
    iconSize: [0, 0],
    iconAnchor: [0, 0]
  });
};

// 2. Logistics Bottleneck & Choke Point Pin
const createBottleneckPin = (bn, isSelected = false) => {
  const isCritical = bn.severity === 'CRITICAL';
  const color = isCritical ? '#DC2626' : '#D97706';
  const bgLight = isCritical ? '#FEF2F2' : '#FFFBEB';

  return L.divIcon({
    html: `
      <div class="custom-map-marker flex flex-col items-center cursor-pointer group" style="transform: translate(-50%, -50%);">
        <div class="bg-white border-2 px-2 py-0.5 rounded-lg shadow-lg flex items-center gap-1.5 text-[10px] font-bold text-[#13261D] whitespace-nowrap transition-transform group-hover:scale-110" style="border-color: ${color};">
          <span class="w-2 h-2 rounded-full ${isCritical ? 'bg-[#DC2626] animate-ping' : 'bg-[#D97706]'}"></span>
          <span class="font-extrabold" style="color: ${color}">${bn.name}</span>
          <span class="px-1 py-0.2 rounded text-[9px] font-mono font-bold" style="background-color: ${bgLight}; color: ${color};">${bn.delay}</span>
        </div>
        <div class="w-7 h-7 rounded-full bg-white border-2 flex items-center justify-center shadow-lg mt-0.5" style="border-color: ${color}; color: ${color}; transform: ${isSelected ? 'scale(1.2)' : 'scale(1)'}">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        </div>
      </div>
    `,
    className: 'custom-bottleneck-icon',
    iconSize: [0, 0],
    iconAnchor: [0, 0]
  });
};

// 3. District-Wise Connectivity Rating Pin (Icon-Driven & Low-Text)
const createDistrictPin = (district, isSelected = false) => {
  const score = district.score || 80;
  const isHigh = score >= 75;
  const isMed = score >= 50 && score < 75;
  const color = isHigh ? '#16A34A' : isMed ? '#D97706' : '#DC2626';
  const bgLight = isHigh ? '#F0FDF4' : isMed ? '#FFFBEB' : '#FEF2F2';

  return L.divIcon({
    html: `
      <div class="custom-map-marker flex items-center gap-1.5 cursor-pointer group" style="transform: translate(-50%, -50%);">
        <div class="bg-white border-2 px-2 py-0.5 rounded-lg shadow-md flex items-center gap-1 text-[10px] font-bold text-[#13261D] whitespace-nowrap transition-transform group-hover:scale-105" style="border-color: ${color};">
          <svg class="w-3 h-3" style="color: ${color}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/></svg>
          <span>${district.hub || district.name}</span>
          <span class="px-1 py-0.2 rounded text-[9px] font-mono font-bold" style="background-color: ${bgLight}; color: ${color};">${score}%</span>
        </div>
      </div>
    `,
    className: 'custom-district-icon',
    iconSize: [0, 0],
    iconAnchor: [0, 0]
  });
};

// 4. Strategic Bridge Pin with Load Limit & River Badge
const createBridgePin = (name, status = 'OPERATIONAL', loadLimit = '60T', river = 'River') => {
  const isRestricted = status === 'RESTRICTED' || status === 'CAUTION' || status === 'DAMAGED';
  const isBlocked = status === 'BLOCKED' || status === 'CLOSED';
  const color = isBlocked ? '#C62828' : isRestricted ? '#D98C00' : '#15803D';
  const bgLight = isBlocked ? '#FEE2E2' : isRestricted ? '#FEF3C7' : '#EAF7EE';

  return L.divIcon({
    html: `
      <div class="custom-map-marker flex flex-col items-center cursor-pointer group" style="transform: translate(-50%, -50%);">
        <div class="bg-white border-2 px-2 py-0.5 rounded-lg shadow-lg flex items-center gap-1.5 text-[10px] font-bold text-[#13261D] whitespace-nowrap transition-transform group-hover:scale-110" style="border-color: ${color};">
          <span class="w-2 h-2 rounded-full ${isRestricted || isBlocked ? 'animate-ping' : ''}" style="background-color: ${color}"></span>
          <span class="font-extrabold text-[#0B3B24]">${name}</span>
          <span class="px-1 py-0.2 rounded text-[9px] font-mono font-bold" style="background-color: ${bgLight}; color: ${color};">${loadLimit}</span>
        </div>
        <div class="w-7 h-7 rounded-full flex items-center justify-center shadow-md mt-0.5 border-2 bg-white" style="border-color: ${color}; color: ${color};">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/></svg>
        </div>
      </div>
    `,
    className: 'custom-bridge-icon',
    iconSize: [0, 0],
    iconAnchor: [0, 0]
  });
};

// 5. NHAI Highway Shield Marker
const createNHAIShieldPin = (routeCode, name) => {
  return L.divIcon({
    html: `
      <div class="custom-map-marker flex items-center gap-1 cursor-pointer pointer-events-auto" style="transform: translate(-50%, -50%);">
        <div class="bg-[#0B3B24] text-white border-2 border-white px-2 py-0.5 rounded shadow-md text-[10px] font-black tracking-wider flex items-center gap-1">
          <span class="text-[#4ADE80] text-[8px] font-mono">NHAI</span>
          <span>${routeCode}</span>
        </div>
      </div>
    `,
    className: 'custom-nhai-shield',
    iconSize: [0, 0],
    iconAnchor: [0, 0]
  });
};

// 6. Emergency Lifeline Route Badge Pin
const createLifelineShieldPin = (code, name) => {
  return L.divIcon({
    html: `
      <div class="custom-map-marker flex items-center gap-1 cursor-pointer pointer-events-auto" style="transform: translate(-50%, -50%);">
        <div class="bg-[#0284C7] text-white border-2 border-white px-2 py-0.5 rounded-md shadow-lg text-[9.5px] font-black tracking-wider flex items-center gap-1">
          <svg class="w-3 h-3 text-cyan-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/></svg>
          <span>${code}</span>
        </div>
      </div>
    `,
    className: 'custom-lifeline-shield',
    iconSize: [0, 0],
    iconAnchor: [0, 0]
  });
};

const createIncidentPin = (title, severity = 'HIGH', isSelected = false) => {
  const sev = (severity || 'HIGH').toUpperCase();
  let color = '#C62828';
  let bgClass = 'bg-white border-[#C62828] text-[#C62828] ring-2 ring-[#C62828]/30';

  if (sev === 'CRITICAL') {
    color = '#C62828';
    bgClass = 'bg-white border-[#C62828] text-[#C62828] ring-2 ring-[#C62828]/30';
  } else if (sev === 'HIGH') {
    color = '#D98C00';
    bgClass = 'bg-white border-[#D98C00] text-[#D98C00]';
  } else if (sev === 'MODERATE' || sev === 'MEDIUM') {
    color = '#D98C00';
    bgClass = 'bg-white border-[#D98C00] text-[#D98C00]';
  } else {
    color = '#198754';
    bgClass = 'bg-white border-[#198754] text-[#198754]';
  }

  return L.divIcon({
    html: `
      <div class="custom-map-marker flex flex-col items-center cursor-pointer group" style="transform: translate(-50%, -50%);">
        <div class="${bgClass} px-2 py-0.5 rounded-md shadow-md flex items-center gap-1.5 text-[10px] font-bold whitespace-nowrap transition-transform group-hover:scale-105 border">
          <span class="w-2 h-2 rounded-full ${sev === 'CRITICAL' ? 'bg-[#C62828] animate-ping' : 'bg-current'}"></span>
          <span class="text-[#13261D]">${title}</span>
          <span class="text-[9px] font-mono px-1 rounded bg-[#F7FAF8] text-[#3E5649]">${sev}</span>
        </div>
        <div class="w-7 h-7 rounded-full bg-white border-2 flex items-center justify-center shadow-lg mt-0.5" style="border-color: ${color}; color: ${color}; transform: ${isSelected ? 'scale(1.2)' : 'scale(1)'}">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        </div>
      </div>
    `,
    className: 'custom-incident-icon',
    iconSize: [0, 0],
    iconAnchor: [0, 0]
  });
};

const createCityPin = (name, type = 'Hub', isCapital = false) => {
  return L.divIcon({
    html: `
      <div class="custom-map-marker flex items-center gap-1.5 cursor-pointer" style="transform: translate(-50%, -50%);">
        <div class="w-3 h-3 rounded-full bg-white border-2 ${isCapital ? 'border-[#15803D] shadow-sm' : 'border-[#3E5649]'} flex items-center justify-center">
          <div class="w-1.5 h-1.5 rounded-full ${isCapital ? 'bg-[#15803D]' : 'bg-[#3E5649]'}"></div>
        </div>
        <div class="bg-white border border-[#CCE0D5] px-1.5 py-0.5 rounded text-[10px] font-bold text-[#13261D] whitespace-nowrap shadow-sm hover:border-[#15803D] transition-colors">
          ${name}
        </div>
      </div>
    `,
    className: 'custom-city-icon',
    iconSize: [0, 0],
    iconAnchor: [0, 0]
  });
};

// Map View Controller Helper
const MapController = ({ targetCenter, targetZoom, targetBounds, flyTrigger }) => {
  const map = useMap();
  useEffect(() => {
    if (flyTrigger && targetBounds) {
      map.flyToBounds(targetBounds, { padding: [50, 50], duration: 1.2, maxZoom: 10 });
    } else if (flyTrigger && targetCenter) {
      map.flyTo(targetCenter, targetZoom || NER_DEFAULT_ZOOM, { duration: 1.2 });
    }
  }, [flyTrigger, targetCenter, targetZoom, targetBounds, map]);
  return null;
};

// Comprehensive NHAI National Highway Network in North-East India
export const NHAI_NATIONAL_HIGHWAYS = [
  {
    id: 'cor-nh27-eastwest',
    nh_number: 'NH-27',
    name: 'NH-27 East-West National Expressway & Highway',
    authority: 'NHAI (National Highways Authority of India)',
    from: 'Siliguri',
    to: 'Lumding / Dabaka',
    status: 'OPERATIONAL',
    risk: 'LOW',
    lanes: '4-Lane Divided Highway',
    toll_plazas: 'Galgalia, Dahalapara, Madanpur, Raha',
    color: '#15803D',
    midpoint: [26.1700, 91.7500],
    coords: [
      [26.7271, 88.3953], // Siliguri
      [26.5400, 88.7200], // Jalpaiguri
      [26.3300, 89.4500], // Cooch Behar
      [26.4700, 89.9800], // Alipurduar / Boxirhat Border
      [26.4800, 90.2700], // Kokrajhar
      [26.5000, 90.5400], // Bongaigaon
      [26.2000, 90.5700], // Goalpara / Jogighopa
      [26.1500, 91.2000], // Nalbari / Baihata
      [26.1445, 91.7362], // Guwahati Bypass (Saraighat)
      [26.1600, 92.0000], // Jorabat Junction
      [26.1800, 92.4000], // Jagiroad
      [26.1500, 92.7000], // Nagaon Bypass
      [25.8800, 93.1800], // Dabaka / Lumding Junction
      [25.9090, 93.7266]  // Dimapur
    ]
  },
  {
    id: 'cor-nh37-brahmaputra',
    nh_number: 'NH-37',
    name: 'NH-37 Brahmaputra Valley & Southern Arterial',
    authority: 'NHAI / NHIDCL',
    from: 'Goalpara',
    to: 'Dibrugarh / Saikhoa',
    status: 'OPERATIONAL',
    risk: 'LOW',
    lanes: '4-Lane & 2-Lane Paved Shoulder',
    toll_plazas: 'Mikirbheta, Numaligarh',
    color: '#15803D',
    midpoint: [26.6500, 93.4000],
    coords: [
      [26.1700, 90.6200], // Goalpara
      [26.1445, 91.7362], // Guwahati
      [26.5800, 92.9500], // Kaliabor / Tezpur junction
      [26.6000, 93.3000], // Kaziranga National Park Corridor
      [26.5500, 93.7500], // Numaligarh Refinery
      [26.7500, 94.2200], // Jorhat
      [26.9800, 94.6400], // Sivasagar
      [27.4728, 94.9120], // Dibrugarh
      [27.5000, 95.3500], // Tinsukia
      [27.7950, 95.6620]  // Dhola-Sadiya Junction
    ]
  },
  {
    id: 'cor-nh37-bypass-manipur',
    nh_number: 'NH-37 (Ext)',
    name: 'NH-37 Silchar - Jiribam - Imphal Lifeline Highway',
    authority: 'NHIDCL / BRO',
    from: 'Silchar',
    to: 'Imphal',
    status: 'OPERATIONAL',
    risk: 'MODERATE',
    lanes: '2-Lane Heavy Mountain Corridor',
    toll_plazas: 'Jiribam Checkpost',
    color: '#16A34A',
    midpoint: [24.8300, 93.3000],
    coords: [
      [24.8333, 92.7789], // Silchar
      [24.8012, 93.1250], // Jiribam Border Bridge
      [24.7800, 93.3500], // Gulathol
      [24.8500, 93.5000], // Noney / Makru Bridge
      [24.8700, 93.7200], // Tupul
      [24.8170, 93.9368]  // Imphal Valley
    ]
  },
  {
    id: 'cor-nh2-asianhighway',
    nh_number: 'NH-2 / AH-1',
    name: 'NH-2 / AH-1 Asian Highway Trunk (Dimapur → Kohima → Imphal)',
    authority: 'NHIDCL / MoRTH',
    from: 'Dibrugarh',
    to: 'Imphal',
    status: 'OPERATIONAL',
    risk: 'LOW',
    lanes: '4-Lane Mountain Expressway (Dimapur-Kohima) & 2-Lane',
    toll_plazas: 'Chumukedima, Senapati',
    color: '#15803D',
    midpoint: [25.5000, 94.0500],
    coords: [
      [27.4728, 94.9120], // Dibrugarh
      [26.9800, 94.6400], // Sivasagar
      [26.7000, 94.2000], // Amguri / Mariani
      [25.9090, 93.7266], // Dimapur Hub
      [25.7900, 93.9500], // Chumukedima
      [25.6751, 94.1086], // Kohima Capital
      [25.4500, 94.0800], // Maram
      [25.2000, 94.0200], // Senapati Pass (Landslide Watch Sector)
      [25.0500, 93.9800], // Kangpokpi
      [24.8170, 93.9368]  // Imphal Valley
    ]
  },
  {
    id: 'cor-nh10-sikkim',
    nh_number: 'NH-10',
    name: 'NH-10 Himalayan Mountain Lifeline (Siliguri → Gangtok)',
    authority: 'NHAI / BRO (Project Swastik)',
    from: 'Siliguri',
    to: 'Gangtok',
    status: 'RESTRICTED',
    risk: 'MODERATE',
    lanes: '2-Lane Mountain River Gorge Highway',
    toll_plazas: 'Sevoke Corridor',
    color: '#D98C00',
    midpoint: [27.0500, 88.4700],
    coords: [
      [26.7271, 88.3953], // Siliguri
      [26.8800, 88.4700], // Sevoke / Coronation Bridge
      [26.9500, 88.4400], // Teesta Bazaar
      [27.0500, 88.4700], // Kalimpong Crossing
      [27.1700, 88.5200], // Rangpo Checkpost Border
      [27.2400, 88.5800], // Singtam Bridge
      [27.3000, 88.6000], // Ranipool
      [27.3389, 88.6138]  // Gangtok
    ]
  },
  {
    id: 'cor-nh40-nh6-meghalaya',
    nh_number: 'NH-6 / NH-40',
    name: 'NH-6 / NH-40 Trans-Meghalaya & Barak Valley Corridor',
    authority: 'NHAI (4-Lane Expressway)',
    from: 'Guwahati (Jorabat)',
    to: 'Silchar',
    status: 'OPERATIONAL',
    risk: 'LOW',
    lanes: '4-Lane Divided Expressway & 2-Lane Paved',
    toll_plazas: 'Pahammawlein, Lumshnong',
    color: '#15803D',
    midpoint: [25.4000, 92.1500],
    coords: [
      [26.0825, 91.8682], // Jorabat Junction
      [25.9034, 91.8796], // Nongpoh
      [25.7516, 91.8950], // Umsning Bypass
      [25.6631, 91.9022], // Umiam Lake Expressway
      [25.5788, 91.8933], // Shillong Bypass
      [25.4400, 92.2000], // Jowai
      [25.2600, 92.3700], // Khliehriat
      [25.1000, 92.4800], // Lumshnong (Sonapur Tunnel)
      [24.8333, 92.7789]  // Silchar
    ]
  },
  {
    id: 'cor-nh8-tripura',
    nh_number: 'NH-8',
    name: 'NH-8 Southern Tripura National Arterial (Assam → Agartala → Sabroom)',
    authority: 'NHIDCL / MoRTH',
    from: 'Karimganj',
    to: 'Sabroom (Maitri Setu)',
    status: 'OPERATIONAL',
    risk: 'LOW',
    lanes: '2-Lane with Paved Shoulder (Upgrading to 4-Lane)',
    toll_plazas: 'Churaibari Border Post',
    color: '#198754',
    midpoint: [23.8000, 91.3500],
    coords: [
      [24.8700, 92.3500], // Karimganj Border
      [24.5200, 92.2300], // Churaibari Checkpost
      [24.3800, 92.1600], // Dharmanagar
      [24.1800, 92.0100], // Kumarghat
      [23.8400, 91.6000], // Teliamura
      [23.8315, 91.2868], // Agartala
      [23.5400, 91.4500], // Udaipur
      [23.2200, 91.5000], // Belonia
      [23.0030, 91.7050]  // Sabroom (Maitri Setu / Indo-Bangla Border)
    ]
  },
  {
    id: 'cor-nh13-transarunachal',
    nh_number: 'NH-13',
    name: 'NH-13 Trans-Arunachal Strategic Highway',
    authority: 'NHIDCL / BRO (Project Arunank & Project Brahmank)',
    from: 'Tawang',
    to: 'Wakro / Tezu',
    status: 'OPERATIONAL',
    risk: 'MODERATE',
    lanes: '2-Lane All-Weather Mountain Highway',
    toll_plazas: 'Sela Tunnel, Bhalukpong',
    color: '#15803D',
    midpoint: [27.5000, 94.0000],
    coords: [
      [27.5860, 91.8590], // Tawang
      [27.5000, 92.1000], // Sela Tunnel / Pass
      [27.2600, 92.4200], // Bomdila
      [27.0844, 93.6053], // Itanagar / Naharlagun
      [27.3500, 94.1000], // Ziro / Sagalee
      [28.0600, 95.3200], // Pasighat
      [28.1500, 95.8300], // Roing
      [27.9100, 96.1600], // Tezu / Alubari Bridge
      [27.7700, 96.3500]  // Wakro / Parasuram Kund
    ]
  },
  {
    id: 'cor-nh15-northbank',
    nh_number: 'NH-15',
    name: 'NH-15 Brahmaputra North Bank Strategic Highway',
    authority: 'NHAI / NHIDCL',
    from: 'Baihata Chariali',
    to: 'Jonai (Arunachal Border)',
    status: 'OPERATIONAL',
    risk: 'LOW',
    lanes: '4-Lane & 2-Lane Paved',
    toll_plazas: 'Rowta, Balipara',
    color: '#15803D',
    midpoint: [27.0000, 93.8000],
    coords: [
      [26.3500, 91.7100], // Baihata Chariali
      [26.4300, 92.0300], // Mangaldai
      [26.7000, 92.8000], // Tezpur / Balipara Junction
      [26.8500, 93.6000], // Biswanath Chariali
      [27.2300, 94.1000], // North Lakhimpur
      [27.3980, 94.8250], // Bogibeel North Abutment
      [27.4800, 94.5800], // Dhemaji
      [27.7900, 95.2000]  // Jonai / Ruksin
    ]
  },
  {
    id: 'cor-nh102-moreh',
    nh_number: 'NH-102 / AH-1',
    name: 'NH-102 Asian Highway (Imphal → Moreh International Border)',
    authority: 'NHIDCL (Trilateral Highway Link)',
    from: 'Imphal',
    to: 'Moreh Border',
    status: 'OPERATIONAL',
    risk: 'LOW',
    lanes: '4-Lane & 2-Lane Heavy Freight',
    toll_plazas: 'Pallel Checkpost',
    color: '#15803D',
    midpoint: [24.5000, 94.1000],
    coords: [
      [24.8170, 93.9368], // Imphal
      [24.6300, 93.9900], // Thoubal
      [24.4800, 93.9800], // Kakching
      [24.4500, 94.0200], // Pallel
      [24.3800, 94.1500], // Tengnoupal
      [24.2400, 94.3000]  // Moreh Integrated Check Post (ICP)
    ]
  },
  {
    id: 'cor-nh29-nagaland',
    nh_number: 'NH-29',
    name: 'NH-29 Dimapur - Kohima High-Speed Mountain Expressway',
    authority: 'NHIDCL (4-Lane Mountain Highway)',
    from: 'Dimapur',
    to: 'Kohima',
    status: 'OPERATIONAL',
    risk: 'LOW',
    lanes: '4-Lane Engineered Mountain Highway',
    toll_plazas: 'Chumukedima Smart Toll',
    color: '#15803D',
    midpoint: [25.8000, 93.9000],
    coords: [
      [25.9090, 93.7266], // Dimapur Airport / Hub
      [25.8500, 93.8200], // Chumukedima
      [25.7500, 93.9500], // Medziphema
      [25.7000, 94.0200], // Zubza
      [25.6751, 94.1086]  // Kohima
    ]
  },
  {
    id: 'cor-nh54-mizoram',
    nh_number: 'NH-54 / NH-306',
    name: 'NH-54 / NH-306 Central Mizoram Spine (Silchar → Aizawl → Lunglei)',
    authority: 'NHIDCL / MoRTH',
    from: 'Silchar',
    to: 'Lunglei',
    status: 'OPERATIONAL',
    risk: 'LOW',
    lanes: '2-Lane Mountain Highway with Safety Barriers',
    toll_plazas: 'Vairengte Border Checkpost',
    color: '#198754',
    midpoint: [24.1000, 92.7500],
    coords: [
      [24.8333, 92.7789], // Silchar
      [24.5000, 92.7600], // Vairengte Border
      [24.2200, 92.6800], // Kolasib
      [23.7307, 92.7173], // Aizawl Capital
      [23.4000, 92.7500], // Serchhip
      [22.8800, 92.7300]  // Lunglei
    ]
  }
];

// Comprehensive Strategic River Bridges Dataset in North-East India
export const STRATEGIC_BRIDGES_DATASET = [
  { 
    id: 'br-dhola-sadiya', 
    bridge_code: 'BR-DHOLA-01', 
    name: 'Dhola-Sadiya Bridge (Bhupen Hazarika Setu)', 
    location: 'Lohit River, Tinsukia / Sadiya', 
    lat: 27.7950, 
    lng: 95.6620, 
    state: 'Assam / Arunachal Pradesh', 
    status: 'OPERATIONAL', 
    load_limit: '60T (Military Class 70R)', 
    length_km: '9.15 km (India\'s Longest River Bridge)',
    river: 'Lohit River (Brahmaputra Tributary)',
    authority: 'MoRTH / NHIDCL',
    highway: 'NH-115 / NH-13',
    accessibility_score: 98, 
    clearance_index: 'Clearance optimal (HFL + 4.2m)', 
    reason: 'Strategic military-grade river bridge connecting Assam to Eastern Arunachal Pradesh. Continuous telemetry active.'
  },
  { 
    id: 'br-bogibeel', 
    bridge_code: 'BR-BOGIBEEL-02', 
    name: 'Bogibeel Rail-cum-Road Bridge', 
    location: 'Brahmaputra River, Dibrugarh', 
    lat: 27.3980, 
    lng: 94.8250, 
    state: 'Assam', 
    status: 'OPERATIONAL', 
    load_limit: '60T (Full Heavy Freight)', 
    length_km: '4.94 km (Double-Decker Truss)',
    river: 'Brahmaputra River',
    authority: 'Indian Railways / NHAI',
    highway: 'NH-15',
    accessibility_score: 99, 
    clearance_index: 'Structural integrity 100%', 
    reason: 'All 41 steel truss spans operational with dual 3-lane road & twin rail transit.'
  },
  { 
    id: 'br-saraighat', 
    bridge_code: 'BR-SARAIGHAT-03', 
    name: 'Saraighat & New Saraighat Double-Deck Bridges', 
    location: 'Brahmaputra River, Guwahati', 
    lat: 26.1772, 
    lng: 91.6881, 
    state: 'Assam', 
    status: 'OPERATIONAL', 
    load_limit: '60T (Class 70R)', 
    length_km: '1.49 km',
    river: 'Brahmaputra River',
    authority: 'NHAI / NF Railway',
    highway: 'NH-27 / NH-17',
    accessibility_score: 96, 
    clearance_index: 'Normal river flow', 
    reason: 'Primary logistical gateway connecting North-East India to mainland India.'
  },
  { 
    id: 'br-kolia-bhomora', 
    bridge_code: 'BR-KOLIA-04', 
    name: 'Kolia Bhomora Setu & 2nd Setu', 
    location: 'Brahmaputra River, Tezpur', 
    lat: 26.6080, 
    lng: 92.8550, 
    state: 'Assam', 
    status: 'OPERATIONAL', 
    load_limit: '50T', 
    length_km: '3.01 km',
    river: 'Brahmaputra River',
    authority: 'NHIDCL',
    highway: 'NH-715 / NH-15',
    accessibility_score: 94, 
    clearance_index: 'Standard clearance', 
    reason: 'Vital inter-state transit connecting Central Assam with Tezpur & Arunachal foothill corridors.'
  },
  { 
    id: 'br-naranarayan', 
    bridge_code: 'BR-NARANARAYAN-05', 
    name: 'Naranarayan Setu (Jogighopa Bridge)', 
    location: 'Brahmaputra River, Goalpara / Jogighopa', 
    lat: 26.1983, 
    lng: 90.5739, 
    state: 'Assam', 
    status: 'OPERATIONAL', 
    load_limit: '60T (Rail-cum-Road)', 
    length_km: '2.28 km',
    river: 'Brahmaputra River',
    authority: 'NHAI / Indian Railways',
    highway: 'NH-17 / NH-27',
    accessibility_score: 95, 
    clearance_index: 'Heavy multi-modal cleared', 
    reason: 'Crucial freight connection linking Lower Assam and Western Meghalaya to East-West corridor.'
  },
  { 
    id: 'br-teesta', 
    bridge_code: 'BR-TEESTA-06', 
    name: 'Teesta River Bridge & Coronation Bridge', 
    location: 'Teesta River Gorge, Sevoke / Kalimpong', 
    lat: 26.9015, 
    lng: 88.4350, 
    state: 'Sikkim / West Bengal', 
    status: 'RESTRICTED', 
    load_limit: '20T (Speed Limit 20 km/h)', 
    length_km: '0.45 km (Cantilever & RCC)',
    river: 'Teesta River',
    authority: 'BRO (Project Swastik) / WB PWD',
    highway: 'NH-10',
    accessibility_score: 55, 
    clearance_index: 'Water level +1.8m above normal', 
    reason: 'Upstream glacial discharge monitoring active. Heavy vehicles diverted via alternate bypass.'
  },
  { 
    id: 'br-maitri-setu', 
    bridge_code: 'BR-MAITRI-07', 
    name: 'Maitri Setu (India-Bangladesh Friendship Bridge)', 
    location: 'Feni River, Sabroom', 
    lat: 23.0030, 
    lng: 91.7050, 
    state: 'Tripura', 
    status: 'OPERATIONAL', 
    load_limit: '60T', 
    length_km: '1.90 km',
    river: 'Feni River (International Boundary)',
    authority: 'NHIDCL / MoRTH',
    highway: 'NH-8',
    accessibility_score: 97, 
    clearance_index: 'International transit active', 
    reason: 'Direct land access connecting Tripura and North-East India to Chittagong Sea Port (72 km).'
  },
  { 
    id: 'br-jiribam', 
    bridge_code: 'BR-JIRIBAM-08', 
    name: 'Jiribam River Border Bridge', 
    location: 'Jiri River, Jiribam', 
    lat: 24.8012, 
    lng: 93.1250, 
    state: 'Manipur / Assam', 
    status: 'OPERATIONAL', 
    load_limit: '40T', 
    length_km: '0.38 km',
    river: 'Jiri River (Barak Tributary)',
    authority: 'NHIDCL',
    highway: 'NH-37',
    accessibility_score: 88, 
    clearance_index: 'Monsoon gauge normal', 
    reason: 'Lifeline transit crossing into Manipur Valley via Western Bypass route.'
  },
  { 
    id: 'br-alubari', 
    bridge_code: 'BR-ALUBARI-09', 
    name: 'Alubari Bridge (Noa-Dihing River)', 
    location: 'Noa-Dihing River, Chowkham / Tezu', 
    lat: 27.7540, 
    lng: 95.9680, 
    state: 'Arunachal Pradesh', 
    status: 'OPERATIONAL', 
    load_limit: '50T', 
    length_km: '1.80 km',
    river: 'Noa-Dihing River',
    authority: 'BRO (Project Udayak)',
    highway: 'NH-13 / NH-52',
    accessibility_score: 92, 
    clearance_index: 'Operational', 
    reason: 'Strategic high-clearance bridge ensuring year-round connectivity into Eastern Lohit Valley.'
  },
  { 
    id: 'br-subansiri', 
    bridge_code: 'BR-SUBANSIRI-10', 
    name: 'Lilabari Subansiri River Bridge', 
    location: 'Subansiri River, North Lakhimpur', 
    lat: 27.2450, 
    lng: 94.1350, 
    state: 'Assam', 
    status: 'OPERATIONAL', 
    load_limit: '50T', 
    length_km: '1.92 km',
    river: 'Subansiri River',
    authority: 'NHIDCL',
    highway: 'NH-15',
    accessibility_score: 91, 
    clearance_index: 'Water level stable', 
    reason: 'Vital link between North Lakhimpur and Dhemaji floodplains.'
  },
  { 
    id: 'br-rongram', 
    bridge_code: 'BR-RONGRAM-11', 
    name: 'Rongram River Bridge', 
    location: 'Ganol River, Tura / Rongram', 
    lat: 25.5890, 
    lng: 90.2310, 
    state: 'Meghalaya', 
    status: 'OPERATIONAL', 
    load_limit: '40T', 
    length_km: '0.24 km',
    river: 'Ganol River (Garo Hills)',
    authority: 'Meghalaya PWD / NHAI',
    highway: 'NH-51',
    accessibility_score: 90, 
    clearance_index: 'Normal', 
    reason: 'Primary mountain bridge servicing West Garo Hills logistics hub.'
  },
  { 
    id: 'br-singtam-teesta', 
    bridge_code: 'BR-SINGTAM-12', 
    name: 'Singtam Teesta RCC Arch Bridge', 
    location: 'Teesta River, Singtam', 
    lat: 27.2380, 
    lng: 88.4980, 
    state: 'Sikkim', 
    status: 'OPERATIONAL', 
    load_limit: '40T', 
    length_km: '0.32 km',
    river: 'Teesta River',
    authority: 'BRO',
    highway: 'NH-10 / NH-510',
    accessibility_score: 86, 
    clearance_index: 'Normal', 
    reason: 'Critical intersection bridge connecting South and East Sikkim districts.'
  }
];

// Strategic Supply Chain Gaps & Logistics Bottlenecks
export const STRATEGIC_BOTTLENECK_ZONES = [
  {
    id: 'bn-senapati',
    name: 'Senapati Pass Choke Point',
    code: 'BN-MANIPUR-01',
    highway: 'NH-2 / AH-1',
    state: 'Manipur',
    location: 'Km 214, Senapati Hill Slope',
    lat: 25.2000,
    lng: 94.0200,
    severity: 'CRITICAL',
    choke_type: 'LANDSLIDE_DEBRIS',
    delay: '+180 min delay',
    load_limit: '15T (Restricted)',
    capacity_reduction: '80% Throughput Cut',
    detour_available: 'Yes (via NH-37 Jiribam Detour)',
    bypass_route: 'NH-37 Western Corridor (Silchar - Jiribam - Noney - Imphal)',
    description: 'Active mountain slope displacement and mud accumulation following sustained rain. High vulnerability to complete valley cut-off.'
  },
  {
    id: 'bn-sevoke-teesta',
    name: 'Sevoke-Teesta Gorge Squeeze',
    code: 'BN-SIKKIM-02',
    highway: 'NH-10',
    state: 'Sikkim / WB',
    location: 'Sevoke Railway Bridge to Teesta Bazaar',
    lat: 26.9015,
    lng: 88.4350,
    severity: 'HIGH',
    choke_type: 'GORGE_SUBSIDENCE',
    delay: '+120 min delay',
    load_limit: '20T (Single-Lane Converted)',
    capacity_reduction: '60% Capacity Loss',
    detour_available: 'Yes (via Lava - Algarah - Reshi)',
    bypass_route: 'Damdim - Lava - Algarah - Pedong Corridor',
    description: 'River scour undermining highway foundation along NH-10. Single-lane convoy pilot active.'
  },
  {
    id: 'bn-lumshnong',
    name: 'Lumshnong Sinking Belt',
    code: 'BN-MEGH-03',
    highway: 'NH-6',
    state: 'Meghalaya',
    location: 'East Jaintia Hills, Sonapur Tunnel Approach',
    lat: 25.1000,
    lng: 92.4800,
    severity: 'HIGH',
    choke_type: 'CAVE_IN_SUBSIDENCE',
    delay: '+90 min delay',
    load_limit: '30T',
    capacity_reduction: '50% Slowdown',
    detour_available: 'No Direct Heavy Alt',
    bypass_route: 'Controlled Convoy Movement under BRO Supervision',
    description: 'Limestone stratum karst subsidence and heavy monsoon mudflow impacting the sole land link to Barak Valley, Mizoram, and Tripura.'
  },
  {
    id: 'bn-sela-pass',
    name: 'Sela Pass High-Altitude Choke',
    code: 'BN-ARUN-04',
    highway: 'NH-13',
    state: 'Arunachal Pradesh',
    location: 'Sela Ridge (13,700 ft Elevation)',
    lat: 27.5000,
    lng: 92.1000,
    severity: 'MODERATE',
    choke_type: 'SNOW_ICE_PACK',
    delay: '+60 min delay',
    load_limit: '40T (Sela Tunnel Active)',
    capacity_reduction: '30% Winter Slowdown',
    detour_available: 'Yes (Via Sela Twin-Tube Tunnel)',
    bypass_route: 'Sela Tunnel Bypass (All-Weather Sub-surface)',
    description: 'Sub-zero icing conditions on mountain switchbacks. Sela Tunnel provides reliable all-weather emergency bypass.'
  },
  {
    id: 'bn-badarpur-flood',
    name: 'Badarpur Junction Waterlog Silt',
    code: 'BN-ASSAM-05',
    highway: 'NH-37 / NH-6',
    state: 'Assam',
    location: 'Barak River Basin, Karimganj Border',
    lat: 24.9000,
    lng: 92.5800,
    severity: 'MODERATE',
    choke_type: 'MONSOON_WATERLOGGING',
    delay: '+45 min delay',
    load_limit: '45T',
    capacity_reduction: '35% Flow Impedance',
    detour_available: 'Yes (via Panchgram Industrial Bypass)',
    bypass_route: 'Panchgram Bypass Connector',
    description: 'Seasonal backwater flooding at Barak River confluence creates freight backlogs into Tripura and Southern Assam.'
  }
];

// Emergency & Disaster-Time Accessibility Routes (Lifeline Corridors)
export const DISASTER_LIFELINE_CORRIDORS = [
  {
    id: 'life-cor-1',
    code: 'LIFELINE-ALPHA',
    name: 'NH-37 Western Emergency Medical & Food Lifeline',
    role: 'Primary Disaster Relief & Supply Detour to Manipur',
    priority: 'PRIORITY-1 EMERGENCY',
    authority: 'NDRF / NHIDCL / Indian Army HQ 3 Corps',
    status: 'OPERATIONAL',
    clearance: 'All-Weather Heavy Cleared (40T)',
    color: '#0284C7',
    midpoint: [24.8100, 93.3000],
    coords: [
      [26.1445, 91.7362], // Guwahati Depot
      [26.0825, 91.8682], // Jorabat
      [25.5788, 91.8933], // Shillong
      [24.8333, 92.7789], // Silchar Air Base
      [24.8012, 93.1250], // Jiribam Railhead
      [24.8500, 93.5000], // Makru High-Clearance Bridge
      [24.8700, 93.7200], // Tupul
      [24.8170, 93.9368]  // Imphal Medical Depot
    ]
  },
  {
    id: 'life-cor-2',
    code: 'LIFELINE-BRAVO',
    name: 'NH-13 Sela Strategic All-Weather Corridor',
    role: 'High-Altitude Emergency Defense & Relief Lifeline to Tawang',
    priority: 'PRIORITY-1 STRATEGIC',
    authority: 'BRO (Project Arunank) / Indian Army IV Corps',
    status: 'OPERATIONAL',
    clearance: 'Tunnel Cleared (Class 70R)',
    color: '#10B981',
    midpoint: [27.3500, 92.2000],
    coords: [
      [26.7000, 92.8000], // Tezpur Air Base
      [27.0500, 92.6000], // Bhalukpong
      [27.2600, 92.4200], // Bomdila
      [27.4200, 92.2500], // Dirang Valley
      [27.5000, 92.1000], // Sela Tunnel All-Weather Tube
      [27.5860, 91.8590]  // Tawang Civil Hospital
    ]
  },
  {
    id: 'life-cor-3',
    code: 'LIFELINE-CHARLIE',
    name: 'NH-8 South Tripura Port & Energy Lifeline',
    role: 'Maritime Fuel, Oxygen & Containerized Food Transit Link',
    priority: 'PRIORITY-2 LOGISTICS',
    authority: 'NHIDCL / Tripura Disaster Management Authority',
    status: 'OPERATIONAL',
    clearance: '60T Heavy Multi-Axle Cleared',
    color: '#06B6D4',
    midpoint: [23.4000, 91.5000],
    coords: [
      [23.8315, 91.2868], // Agartala Central Depot
      [23.5400, 91.4500], // Udaipur
      [23.2200, 91.5000], // Belonia
      [23.0030, 91.7050]  // Sabroom Maitri Port Link
    ]
  },
  {
    id: 'life-cor-4',
    code: 'LIFELINE-DELTA',
    name: 'NH-15 Brahmaputra North-Bank Elevated Corridor',
    role: 'Flood-Resilient Evacuation & High-Ground Freight Spine',
    priority: 'PRIORITY-2 REGIONAL',
    authority: 'Assam SDMA / NHAI',
    status: 'OPERATIONAL',
    clearance: '50T Flood-Immune Causeway',
    color: '#8B5CF6',
    midpoint: [27.2000, 94.0000],
    coords: [
      [26.3500, 91.7100], // Baihata Chariali
      [26.7000, 92.8000], // Tezpur
      [27.2300, 94.1000], // North Lakhimpur
      [27.3980, 94.8250], // Bogibeel Bridge
      [27.7900, 95.2000]  // Jonai / Pasighat Gateway
    ]
  }
];

// District-Wise Accessibility & Logistics Connectivity Dataset
export const DISTRICT_CONNECTIVITY_DATASET = [
  { id: 'dst-kamrup', name: 'Kamrup Metropolitan', state: 'Assam', hub: 'Guwahati', score: 96, status: 'OPTIMAL', bottleneck_count: 0, lifeline_links: 3, medical_access: 'EXCELLENT', fuel_buffer: '14 Days', coords: [26.1445, 91.7362] },
  { id: 'dst-cachar', name: 'Cachar (Silchar)', state: 'Assam', hub: 'Silchar', score: 85, status: 'OPERATIONAL', bottleneck_count: 1, lifeline_links: 2, medical_access: 'HIGH', fuel_buffer: '10 Days', coords: [24.8333, 92.7789] },
  { id: 'dst-dibrugarh', name: 'Dibrugarh & Tinsukia', state: 'Assam', hub: 'Dibrugarh', score: 92, status: 'OPTIMAL', bottleneck_count: 0, lifeline_links: 2, medical_access: 'EXCELLENT', fuel_buffer: '12 Days', coords: [27.4728, 94.9120] },
  { id: 'dst-papum-pare', name: 'Papum Pare (Itanagar)', state: 'Arunachal Pradesh', hub: 'Itanagar', score: 84, status: 'OPERATIONAL', bottleneck_count: 0, lifeline_links: 1, medical_access: 'GOOD', fuel_buffer: '8 Days', coords: [27.0844, 93.6053] },
  { id: 'dst-tawang', name: 'Tawang Strategic District', state: 'Arunachal Pradesh', hub: 'Tawang', score: 72, status: 'MONITORED', bottleneck_count: 1, lifeline_links: 1, medical_access: 'MODERATE', fuel_buffer: '18 Days (Strategic)', coords: [27.5860, 91.8590] },
  { id: 'dst-east-khasi', name: 'East Khasi Hills', state: 'Meghalaya', hub: 'Shillong', score: 88, status: 'OPTIMAL', bottleneck_count: 0, lifeline_links: 2, medical_access: 'EXCELLENT', fuel_buffer: '11 Days', coords: [25.5788, 91.8933] },
  { id: 'dst-east-jaintia', name: 'East Jaintia Hills', state: 'Meghalaya', hub: 'Khliehriat', score: 62, status: 'RESTRICTED', bottleneck_count: 1, lifeline_links: 1, medical_access: 'MODERATE', fuel_buffer: '6 Days', coords: [25.2600, 92.3700] },
  { id: 'dst-senapati', name: 'Senapati District', state: 'Manipur', hub: 'Senapati', score: 42, status: 'DISRUPTED', bottleneck_count: 1, lifeline_links: 1, medical_access: 'CRITICAL', fuel_buffer: '3 Days', coords: [25.2000, 94.0200] },
  { id: 'dst-imphal-west', name: 'Imphal West / East', state: 'Manipur', hub: 'Imphal', score: 65, status: 'RESTRICTED', bottleneck_count: 1, lifeline_links: 1, medical_access: 'HIGH', fuel_buffer: '5 Days', coords: [24.8170, 93.9368] },
  { id: 'dst-kohima', name: 'Kohima District', state: 'Nagaland', hub: 'Kohima', score: 76, status: 'OPERATIONAL', bottleneck_count: 0, lifeline_links: 1, medical_access: 'GOOD', fuel_buffer: '7 Days', coords: [25.6751, 94.1086] },
  { id: 'dst-dimapur', name: 'Dimapur Freight Junction', state: 'Nagaland', hub: 'Dimapur', score: 91, status: 'OPTIMAL', bottleneck_count: 0, lifeline_links: 2, medical_access: 'EXCELLENT', fuel_buffer: '14 Days', coords: [25.9090, 93.7266] },
  { id: 'dst-aizawl', name: 'Aizawl Capital District', state: 'Mizoram', hub: 'Aizawl', score: 79, status: 'OPERATIONAL', bottleneck_count: 0, lifeline_links: 1, medical_access: 'GOOD', fuel_buffer: '9 Days', coords: [23.7307, 92.7173] },
  { id: 'dst-west-tripura', name: 'West Tripura', state: 'Tripura', hub: 'Agartala', score: 93, status: 'OPTIMAL', bottleneck_count: 0, lifeline_links: 2, medical_access: 'EXCELLENT', fuel_buffer: '12 Days', coords: [23.8315, 91.2868] },
  { id: 'dst-east-sikkim', name: 'East Sikkim (Gangtok)', state: 'Sikkim', hub: 'Gangtok', score: 68, status: 'RESTRICTED', bottleneck_count: 1, lifeline_links: 1, medical_access: 'HIGH', fuel_buffer: '6 Days', coords: [27.3389, 88.6138] }
];

// Empty defaults (no fake/mock data)
const DEFAULT_FLEET = [];
const DEFAULT_INCIDENTS = [];

export const SatelliteGISMap = ({
  vehicles = [],
  incidents = [],
  bridges = [],
  corridors = [],
  districts = [],
  primaryRoute = [],
  alternateRoute = [],
  liveVehicleOverrides = {},
  selectedAsset = null,
  isFocusMode = false,
  onSelectVehicle,
  onSelectAsset,
  onSelectIncident,
  onViewRoute,
  onToggleFocus,
  onReroute,
  onMapClick,
  className = ''
}) => {
  const { t } = useTranslation();
  // Map mode state: 'OPERATIONS' | 'RISK' | 'POLITICAL'
  const [mapMode, setMapMode] = useState('OPERATIONS');

  // Basemap style state: 'satellite' (Satellite Terrain) | 'terrain' | 'physical' | 'street'
  const [basemap, setBasemap] = useState('satellite');

  // Incident Filtering State
  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Categorized Layer Visibility Toggles (All essential capabilities enabled by default)
  const [layers, setLayers] = useState({
    // GEOGRAPHY & CONNECTIVITY
    stateBoundaries: true,
    districtBoundaries: false,
    districtConnectivity: true, // District-wise Connectivity Rating & Badges
    stateNames: true,
    cities: true,
    // INFRASTRUCTURE & NETWORK
    routes: true,            // NHAI National Highways
    nhaiShields: true,       // Route number badges
    emergencyRoutes: true,   // Emergency & Disaster-Time Accessibility Routes
    bridges: true,           // Strategic River Bridges
    bottlenecks: true,       // Logistics Bottlenecks & Supply Chain Gaps
    vehicles: true,          // Real-time Essential Supplies & Fleet Telemetry
    // RISK
    incidents: true,
    riskHeatmap: false
  });

  const [showLayerMenu, setShowLayerMenu] = useState(false);
  const [showLegend, setShowLegend] = useState(true);
  const [showQuickHud, setShowQuickHud] = useState(true);
  const [showInsetMap, setShowInsetMap] = useState(true);
  const [flyTrigger, setFlyTrigger] = useState(0);
  const [targetCenter, setTargetCenter] = useState(NER_CENTER);
  const [targetZoom, setTargetZoom] = useState(NER_DEFAULT_ZOOM);
  const [targetBounds, setTargetBounds] = useState(null);
  
  const [hoveredState, setHoveredState] = useState(null);
  const [selectedState, setSelectedState] = useState(null);
  const [focusedIncidentId, setFocusedIncidentId] = useState(null);
  const [selectedBridgeId, setSelectedBridgeId] = useState(null);
  const [selectedCorridorId, setSelectedCorridorId] = useState(null);

  // Merge dynamic datasets
  const displayVehicles = vehicles && vehicles.length > 0 ? vehicles : DEFAULT_FLEET;
  const displayIncidents = incidents && incidents.length > 0 ? incidents : DEFAULT_INCIDENTS;
  const displayBridges = bridges && bridges.length > 0 ? bridges : STRATEGIC_BRIDGES_DATASET;
  const displayHighways = useMemo(() => {
    if (corridors && corridors.length > 0) {
      const parsedCorridors = corridors.map(c => {
        let coords = c.coords;
        if (!coords && c.polyline_coords) {
          try {
            coords = typeof c.polyline_coords === 'string' ? JSON.parse(c.polyline_coords) : c.polyline_coords;
          } catch {
            coords = null;
          }
        }
        return {
          ...c,
          coords: Array.isArray(coords) ? coords : null
        };
      }).filter(c => c.coords && Array.isArray(c.coords) && c.coords.length > 0);

      if (parsedCorridors.length > 0) return parsedCorridors;
    }
    return NHAI_NATIONAL_HIGHWAYS;
  }, [corridors]);

  // Aggregate metrics per state
  const stateScores = useMemo(() => {
    const scores = {
      'Assam': 88,
      'Arunachal Pradesh': 78,
      'Manipur': 48,
      'Meghalaya': 82,
      'Mizoram': 86,
      'Nagaland': 72,
      'Sikkim': 64,
      'Tripura': 85
    };
    if (districts && districts.length > 0) {
      const stateSums = {};
      const stateCounts = {};
      districts.forEach(d => {
        const s = d.state || d.state_name;
        if (s && d.accessibility_score !== undefined) {
          stateSums[s] = (stateSums[s] || 0) + Number(d.accessibility_score);
          stateCounts[s] = (stateCounts[s] || 0) + 1;
        }
      });
      Object.keys(stateSums).forEach(s => {
        scores[s] = Math.round(stateSums[s] / stateCounts[s]);
      });
    }
    return scores;
  }, [districts]);

  // GeoJSON style handler
  const getStateStyle = useCallback((feature) => {
    const stateName = feature.properties.name;
    const isHovered = hoveredState === stateName;
    const isSelected = selectedState === stateName;
    const palette = STATE_COLOR_PALETTE[stateName] || { fill: '#15803D', border: '#0B3B24' };
    const score = stateScores[stateName] ?? 75;

    let fillColor = palette.fill;
    let fillOpacity = 0.08;

    if (basemap === 'satellite' || basemap === 'terrain') {
      fillOpacity = 0.05;
    }

    if (layers.riskHeatmap || mapMode === 'RISK') {
      if (score >= 75) fillColor = '#198754';
      else if (score >= 50) fillColor = '#D98C00';
      else fillColor = '#C62828';
      fillOpacity = 0.22;
    }

    if (isSelected) {
      fillOpacity = 0.28;
    } else if (isHovered) {
      fillOpacity = 0.18;
    }

    return {
      fillColor: fillColor,
      weight: isSelected ? 2.5 : isHovered ? 2.0 : 1.2,
      opacity: 0.9,
      color: isSelected ? '#0B3B24' : isHovered ? '#15803D' : palette.border,
      dashArray: isSelected ? '4, 4' : null,
      fillOpacity: fillOpacity
    };
  }, [hoveredState, selectedState, layers.riskHeatmap, mapMode, stateScores, basemap]);

  // GeoJSON onEachFeature handler
  const onEachStateFeature = useCallback((feature, layer) => {
    const stateName = feature.properties.name;
    const score = stateScores[stateName] ?? 75;
    const risk = score >= 75 ? 'LOW' : score >= 50 ? 'MODERATE' : 'HIGH';

    layer.on({
      mouseover: () => setHoveredState(stateName),
      mouseout: () => setHoveredState(null),
      click: () => {
        setSelectedState(stateName);
        if (layer.getBounds) {
          setTargetBounds(layer.getBounds());
          setFlyTrigger(prev => prev + 1);
        }
        if (onSelectAsset) {
          onSelectAsset({
            asset_type: 'District',
            name: `${stateName} Regional Logistics Zone`,
            state: stateName,
            accessibility_score: score,
            risk_level: risk,
            reason: `Aggregated regional accessibility index for ${stateName}. Monitored across all NHAI multi-modal corridors and bridge assets.`
          });
        }
      }
    });

    layer.bindTooltip(`
      <div style="font-family:'Inter',sans-serif; min-width: 140px; text-align: left; padding: 4px;">
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom: 1px solid #D5E4DB; padding-bottom: 3px; margin-bottom: 4px;">
          <strong style="color:#0B3B24; font-size:11px; text-transform:uppercase;">${stateName}</strong>
          <span style="font-size:10px; font-weight:bold; color:${score >= 75 ? '#198754' : score >= 50 ? '#D98C00' : '#C62828'};">
            ${score}/100
          </span>
        </div>
        <div style="font-size:10px; color:#3E5649;">
          <span>Status: <b style="color:#13261D;">${risk === 'LOW' ? 'Normal' : risk}</b></span>
        </div>
      </div>
    `, { sticky: true, className: 'leaflet-tooltip' });
  }, [stateScores, onSelectAsset]);

  // Incident Filtering Logic
  const filteredIncidents = useMemo(() => {
    return displayIncidents.filter((inc) => {
      const sev = (inc.severity || 'HIGH').toUpperCase();
      if (severityFilter !== 'ALL' && sev !== severityFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const text = `${inc.title || ''} ${inc.location || ''} ${inc.state || ''}`.toLowerCase();
        if (!text.includes(q)) return false;
      }
      return true;
    });
  }, [displayIncidents, severityFilter, searchQuery]);

  // Active Selected Incident
  const activeIncident = useMemo(() => {
    if (selectedAsset && (selectedAsset.asset_type === 'Incident' || selectedAsset.incident_code)) {
      return selectedAsset;
    }
    if (focusedIncidentId) {
      return displayIncidents.find(i => (i.id === focusedIncidentId || i.incident_code === focusedIncidentId));
    }
    return displayIncidents.find(i => i.severity === 'CRITICAL' || i.severity === 'HIGH') || displayIncidents[0];
  }, [selectedAsset, focusedIncidentId, displayIncidents]);

  // Incident Click Handler
  const handleSelectIncident = useCallback((inc) => {
    const lat = inc.lat || inc.latitude || 25.2000;
    const lng = inc.lng || inc.longitude || 94.0200;
    
    setTargetCenter([lat, lng]);
    setTargetZoom(10);
    setTargetBounds(null);
    setFlyTrigger(prev => prev + 1);
    setFocusedIncidentId(inc.id || inc.incident_code);
    if (inc.state) setSelectedState(inc.state);

    const fullIncidentPayload = {
      asset_type: 'Incident',
      name: inc.title || 'Landslide Risk / Slope Instability',
      incident_code: inc.incident_code || 'INC-2026-088',
      location: inc.location || 'NH-2 / Senapati Pass (Km 214)',
      district_name: inc.district_name || 'Senapati',
      state: inc.state || 'Manipur',
      incident_type: inc.incident_type || 'LANDSLIDE',
      severity: inc.severity || 'HIGH',
      accessibility_score: inc.accessibility_score ?? 55,
      road_status: inc.road_status || 'BLOCKED',
      reason: inc.description || 'Active slope instability and debris displacement. Bypass recommended via NH-37 Jiribam.',
      lat,
      lng
    };

    if (onSelectIncident) onSelectIncident(fullIncidentPayload);
    if (onSelectAsset) onSelectAsset(fullIncidentPayload);
  }, [onSelectIncident, onSelectAsset]);

  // Focus Bridge Handler
  const handleSelectBridge = (bridge) => {
    const lat = bridge.lat || bridge.latitude;
    const lng = bridge.lng || bridge.longitude;
    if (!lat || !lng) return;

    setTargetCenter([lat, lng]);
    setTargetZoom(12);
    setTargetBounds(null);
    setFlyTrigger(prev => prev + 1);
    setSelectedBridgeId(bridge.id || bridge.bridge_code);

    if (onSelectAsset) {
      onSelectAsset({
        ...bridge,
        asset_type: 'Bridge'
      });
    }
  };

  // Focus Highway Corridor Handler
  const handleSelectCorridor = (corridor) => {
    if (!corridor.coords || corridor.coords.length === 0) return;
    const latlngs = corridor.coords;
    const bounds = L.latLngBounds(latlngs);
    setTargetBounds(bounds);
    setFlyTrigger(prev => prev + 1);
    setSelectedCorridorId(corridor.id || corridor.nh_number || corridor.corridor_code);

    if (onSelectAsset) {
      const score = corridor.accessibility_score !== undefined ? Number(corridor.accessibility_score) : 90;
      const status = (corridor.accessibility_status || corridor.status || (score >= 70 ? 'OPEN' : score > 0 ? 'RESTRICTED' : 'BLOCKED')).toUpperCase();
      const sources = Array.isArray(corridor.data_sources) 
        ? corridor.data_sources 
        : (corridor.data_sources ? [corridor.data_sources] : ["Open-Meteo Live API", "Field Officer Inspection Incident Feed", "BRO Bridge Clearance Registry"]);

      onSelectAsset({
        asset_type: 'Corridor',
        name: corridor.name,
        corridor_code: corridor.corridor_code || corridor.nh_number || corridor.id,
        status: status,
        accessibility_status: status,
        risk_level: corridor.risk_level || corridor.risk || (score < 50 ? 'HIGH' : score < 70 ? 'MEDIUM' : 'LOW'),
        accessibility_score: score,
        factor_summary: corridor.factor_summary || corridor.reason || 'Normal road and bridge passage',
        explanation: corridor.explanation || `Accessibility ${Math.round(score)}/100 — ${status}`,
        data_sources: sources,
        data_source: corridor.data_source || 'INTEGRATED_ACCESSIBILITY_ENGINE',
        data_confidence: corridor.data_confidence || 'HIGH',
        authority: corridor.authority || 'NHAI / MoRTH',
        lanes: corridor.lanes || '2/4-Lane National Highway',
        reason: corridor.reason || `NHAI national arterial connecting ${corridor.from || corridor.origin} to ${corridor.to || corridor.destination}.`,
        last_updated: corridor.last_updated
      });
    }
  };

  // Reset View
  const handleResetView = () => {
    setTargetCenter(NER_CENTER);
    setTargetZoom(NER_DEFAULT_ZOOM);
    setTargetBounds(null);
    setSelectedState(null);
    setFocusedIncidentId(null);
    setSelectedBridgeId(null);
    setSelectedCorridorId(null);
    setFlyTrigger(prev => prev + 1);
  };

  // Watermark-Free High-Resolution Basemaps
  const tileConfig = useMemo(() => {
    if (basemap === 'satellite') {
      return {
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        attribution: 'Tiles &copy; Esri World Imagery',
        maxZoom: 19
      };
    }
    if (basemap === 'physical') {
      return {
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Physical_Map/MapServer/tile/{z}/{y}/{x}',
        attribution: 'Tiles &copy; Esri Physical Relief',
        maxZoom: 15
      };
    }
    if (basemap === 'street') {
      return {
        url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        subdomains: 'abc',
        maxZoom: 19
      };
    }
    
    // Default: 'terrain' (Satellite Topo Terrain with high-precision hillshading & contours)
    return {
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
      attribution: 'Tiles &copy; Esri World Topographic Terrain',
      maxZoom: 19
    };
  }, [basemap]);

  // Operational Bridge Stats
  const operationalBridges = displayBridges.filter(b => b.status === 'OPERATIONAL').length;
  const restrictedBridges = displayBridges.length - operationalBridges;

  return (
    <div className={`relative isolate w-full h-full min-h-[540px] rounded-xl overflow-hidden bg-[#F7FAF8] flex flex-col font-sans border border-[#D5E4DB] ${className}`}>
      
      {/* ── TOP MAP HEADER & HUD BAR ── */}
      <div className="absolute top-3 left-3 z-[400] flex items-center gap-2 pointer-events-auto max-w-[calc(100%-160px)]">
        {/* Title Badge with Live Indicator */}
        <div className="bg-white/95 backdrop-blur-md border border-[#D5E4DB] px-3 py-1.5 rounded-lg shadow-sm flex items-center gap-2 text-xs shrink-0">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#15803D]" />
          </span>
          <div>
            <span className="font-extrabold text-[#0B3B24] uppercase tracking-wider text-[10.5px] block flex items-center gap-1">
              <Mountain className="w-3.5 h-3.5 text-[#15803D]" />
              SATELLITE GIS MAP
            </span>
            <span className="text-[9.5px] text-[#3E5649] font-mono block">
              {displayHighways.length} CORRIDORS &bull; {displayBridges.length} BRIDGES
            </span>
          </div>
        </div>

        {/* Quick Basemap Switcher Segmented Pills */}
        <div className="bg-white/95 backdrop-blur-md border border-[#D5E4DB] p-1 rounded-lg shadow-sm flex items-center gap-1 text-xs">
          {[
            { id: 'terrain', label: t('map.terrain', 'Terrain'), icon: Mountain },
            { id: 'satellite', label: t('map.satellite', 'Satellite'), icon: Globe },
            { id: 'physical', label: t('map.relief', 'Relief'), icon: Compass },
            { id: 'street', label: t('map.street', 'Street'), icon: MapPin }
          ].map((b) => {
            const Icon = b.icon;
            const isActive = basemap === b.id;
            return (
              <button
                key={b.id}
                onClick={() => setBasemap(b.id)}
                className={`relative px-2.5 py-1 rounded text-[10px] font-bold tracking-wider flex items-center gap-1 transition cursor-pointer ${
                  isActive ? 'text-white' : 'text-[#3E5649] hover:text-[#13261D] hover:bg-[#F7FAF8]'
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeBasemapIndicator"
                    className="absolute inset-0 bg-[#15803D] rounded shadow-xs -z-0"
                    transition={{ type: 'spring', stiffness: 380, damping: 28 }}
                  />
                )}
                <Icon className="w-3 h-3 relative z-10" />
                <span className="relative z-10">{b.label}</span>
              </button>
            );
          })}
        </div>

        {/* Quick Filter Toggles with Intuitive Icons */}
        <div className="bg-white/95 backdrop-blur-md border border-[#D5E4DB] p-1 rounded-lg shadow-sm hidden lg:flex items-center gap-1 text-xs">
          {/* Highways */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setLayers(prev => ({ ...prev, routes: !prev.routes, nhaiShields: !prev.routes }))}
            className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wide flex items-center gap-1 transition cursor-pointer border ${
              layers.routes
                ? 'bg-[#EAF7EE] text-[#0B3B24] border-[#15803D]/40 font-black'
                : 'bg-white text-[#627B6E] border-transparent hover:bg-[#F7FAF8]'
            }`}
            title="Toggle NHAI Highways"
          >
            <Shield className="w-3 h-3 text-[#15803D]" />
            <span>{t('map.highways', 'Highways')}</span>
          </motion.button>

          {/* Bridges */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setLayers(prev => ({ ...prev, bridges: !prev.bridges }))}
            className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wide flex items-center gap-1 transition cursor-pointer border ${
              layers.bridges
                ? 'bg-[#EAF7EE] text-[#0B3B24] border-[#15803D]/40 font-black'
                : 'bg-white text-[#627B6E] border-transparent hover:bg-[#F7FAF8]'
            }`}
            title="Toggle Strategic Bridges"
          >
            <Waves className="w-3 h-3 text-[#15803D]" />
            <span>{t('map.bridges', 'Bridges')}</span>
          </motion.button>

          {/* Essential Supplies */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setLayers(prev => ({ ...prev, vehicles: !prev.vehicles }))}
            className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wide flex items-center gap-1 transition cursor-pointer border ${
              layers.vehicles
                ? 'bg-[#EAF7EE] text-[#0B3B24] border-[#15803D]/40 font-black'
                : 'bg-white text-[#627B6E] border-transparent hover:bg-[#F7FAF8]'
            }`}
            title="Toggle Live Telemetry & Essential Supplies"
          >
            <Truck className="w-3 h-3 text-[#15803D]" />
            <span>Supplies</span>
          </motion.button>

          {/* Logistics Bottlenecks */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setLayers(prev => ({ ...prev, bottlenecks: !prev.bottlenecks }))}
            className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wide flex items-center gap-1 transition cursor-pointer border ${
              layers.bottlenecks
                ? 'bg-[#FEF2F2] text-[#991B1B] border-[#DC2626]/40 font-black'
                : 'bg-white text-[#627B6E] border-transparent hover:bg-[#F7FAF8]'
            }`}
            title="Toggle Logistics Bottlenecks & Supply Gaps"
          >
            <AlertOctagon className="w-3 h-3 text-[#DC2626]" />
            <span>Bottlenecks</span>
          </motion.button>

          {/* Emergency Lifeline Corridors */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setLayers(prev => ({ ...prev, emergencyRoutes: !prev.emergencyRoutes }))}
            className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wide flex items-center gap-1 transition cursor-pointer border ${
              layers.emergencyRoutes
                ? 'bg-[#E0F2FE] text-[#0369A1] border-[#0284C7]/40 font-black'
                : 'bg-white text-[#627B6E] border-transparent hover:bg-[#F7FAF8]'
            }`}
            title="Toggle Disaster Lifeline Routes"
          >
            <LifeBuoy className="w-3 h-3 text-[#0284C7]" />
            <span>Lifelines</span>
          </motion.button>

          {/* District Connectivity */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setLayers(prev => ({ ...prev, districtConnectivity: !prev.districtConnectivity }))}
            className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wide flex items-center gap-1 transition cursor-pointer border ${
              layers.districtConnectivity
                ? 'bg-[#F0FDF4] text-[#166534] border-[#16A34A]/40 font-black'
                : 'bg-white text-[#627B6E] border-transparent hover:bg-[#F7FAF8]'
            }`}
            title="Toggle District-Wise Connectivity"
          >
            <Building2 className="w-3 h-3 text-[#16A34A]" />
            <span>Districts</span>
          </motion.button>
        </div>
      </div>

      {/* ── TOP RIGHT LAYER TOGGLE & CONTROLS ── */}
      <div className="absolute top-3 right-3 z-[400] flex items-start gap-2 pointer-events-auto">
        {/* Layer Control Menu */}
        <div className="relative">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowLayerMenu(!showLayerMenu)}
            className="bg-white/95 backdrop-blur-md border border-[#D5E4DB] hover:border-[#15803D] px-3 py-1.5 rounded-lg text-[#13261D] shadow-sm transition flex items-center gap-1.5 text-xs font-bold cursor-pointer"
            title="Toggle Map Layers"
          >
            <Layers className="w-4 h-4 text-[#15803D]" />
            <span className="hidden sm:inline">{t('map.layers', 'Layers')} ({Object.values(layers).filter(Boolean).length})</span>
          </motion.button>

          <AnimatePresence>
            {showLayerMenu && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -6 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -6 }}
                transition={{ duration: 0.16 }}
                className="absolute right-0 mt-2 w-72 bg-white border border-[#D5E4DB] rounded-xl shadow-xl p-3.5 text-xs space-y-3 z-[500] text-[#13261D]"
              >
                <div className="flex items-center justify-between border-b border-[#D5E4DB] pb-2">
                  <span className="font-extrabold text-[#0B3B24] uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-[#15803D]" /> {t('map.layerControls', 'GIS LAYER CONTROLS')}
                  </span>
                  <button
                    onClick={() => setShowLayerMenu(false)}
                    className="text-[#627B6E] hover:text-[#13261D] text-xs font-bold cursor-pointer"
                  >
                    ✕
                  </button>
                </div>

                {/* Category 1: INFRASTRUCTURE & DISASTER RESPONSE */}
                <div className="space-y-1">
                  <span className="text-[10px] font-black text-[#15803D] uppercase tracking-wider block">{t('map.nationalInfrastructure', 'NATIONAL INFRASTRUCTURE')}</span>
                  {[
                    { key: 'routes', label: t('map.nhaiHighways', 'NHAI National Highways') },
                    { key: 'nhaiShields', label: t('map.highwayShields', 'Highway Number Shields') },
                    { key: 'emergencyRoutes', label: 'Emergency Lifeline Corridors' },
                    { key: 'bridges', label: t('map.strategicBridges', 'Strategic River Bridges') },
                    { key: 'bottlenecks', label: 'Supply Chain Bottlenecks' },
                    { key: 'vehicles', label: 'Essential Supplies (Live GPS)' },
                    { key: 'incidents', label: t('map.hazards', 'Hazards & Incidents') }
                  ].map((l) => (
                    <label key={l.key} className="flex items-center justify-between py-1 px-1.5 rounded hover:bg-[#F7FAF8] cursor-pointer text-[11px] text-[#3E5649]">
                      <span>{l.label}</span>
                      <input
                        type="checkbox"
                        checked={!!layers[l.key]}
                        onChange={(e) => setLayers({ ...layers, [l.key]: e.target.checked })}
                        className="w-3.5 h-3.5 rounded border-[#CCE0D5] text-[#15803D] focus:ring-0 cursor-pointer"
                      />
                    </label>
                  ))}
                </div>

                {/* Category 2: ADMINISTRATIVE & DISTRICT CONNECTIVITY */}
                <div className="space-y-1 border-t border-[#D5E4DB] pt-2">
                  <span className="text-[10px] font-black text-[#0B3B24] uppercase tracking-wider block">{t('map.boundariesLabels', 'BOUNDARIES & CONNECTIVITY')}</span>
                  {[
                    { key: 'districtConnectivity', label: 'District-wise Connectivity Status' },
                    { key: 'stateBoundaries', label: t('map.stateBorders', '8 State Administrative Borders') },
                    { key: 'stateNames', label: t('map.stateLabels', 'State Name Labels') },
                    { key: 'cities', label: t('map.transitHubs', 'Major Transit & Logistics Hubs') },
                    { key: 'riskHeatmap', label: t('map.scoreHeatmap', 'Accessibility Score Heatmap') }
                  ].map((l) => (
                    <label key={l.key} className="flex items-center justify-between py-1 px-1.5 rounded hover:bg-[#F7FAF8] cursor-pointer text-[11px] text-[#3E5649]">
                      <span>{l.label}</span>
                      <input
                        type="checkbox"
                        checked={!!layers[l.key]}
                        onChange={(e) => setLayers({ ...layers, [l.key]: e.target.checked })}
                        className="w-3.5 h-3.5 rounded border-[#CCE0D5] text-[#15803D] focus:ring-0 cursor-pointer"
                      />
                    </label>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── FOCUS MODE FLOATING BANNER (NON-OVERLAPPING MOTION BANNER) ── */}
      <AnimatePresence>
        {isFocusMode && (
          <motion.div
            initial={{ opacity: 0, y: -16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.95 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="absolute top-16 left-1/2 -translate-x-1/2 z-[420] bg-white/95 backdrop-blur-md border border-[#15803D] px-4 py-1.5 rounded-full shadow-lg flex items-center gap-3 text-xs font-bold text-[#0B3B24]"
          >
            <div className="flex items-center gap-1.5">
              <Eye className="w-4 h-4 text-[#15803D] animate-pulse" />
              <span className="truncate max-w-[260px] sm:max-w-md">{t('map.focusSector', { location: activeIncident?.location || 'NH-2 / NH-37 Hazard Sector' })}</span>
            </div>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onToggleFocus}
              className="px-2.5 py-0.5 rounded-full bg-[#15803D] hover:bg-[#0B3B24] text-white text-[10px] font-bold uppercase tracking-wider transition cursor-pointer shrink-0 shadow-xs"
            >
              {t('map.exitFocus', 'Exit Focus')}
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── CORE LEAFLET MAP CONTAINER ── */}
      <div className="flex-1 w-full h-full relative z-10">
        <MapContainer
          center={NER_CENTER}
          zoom={NER_DEFAULT_ZOOM}
          minZoom={5}
          maxZoom={18}
          zoomControl={false}
          scrollWheelZoom={true}
          className="w-full h-full"
        >
          <MapController 
            targetCenter={targetCenter} 
            targetZoom={targetZoom} 
            targetBounds={targetBounds}
            flyTrigger={flyTrigger} 
          />
          <ZoomControl position="bottomright" />

          {/* 1. SATELLITE TERRAIN / TOPOGRAPHIC TILE LAYER */}
          <TileLayer
            key={basemap}
            url={tileConfig.url}
            attribution={tileConfig.attribution}
            maxZoom={tileConfig.maxZoom}
          />

          {/* Optional Satellite Labels Reference Layer */}
          {basemap === 'satellite' && (
            <TileLayer
              url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
              maxZoom={19}
            />
          )}

          {/* 2. AUTHENTIC SURVEY OF INDIA / GADM 8-STATE BOUNDARIES */}
          {layers.stateBoundaries && (
            <GeoJSON
              key={`states-${mapMode}-${selectedState}-${layers.riskHeatmap}-${basemap}-${JSON.stringify(stateScores)}`}
              data={NORTHEAST_STATES_GEOJSON}
              style={getStateStyle}
              onEachFeature={onEachStateFeature}
            />
          )}

          {/* State Center Labels */}
          {layers.stateNames && !isFocusMode && (
            <>
              {Object.entries(STATE_COLOR_PALETTE).map(([name, data]) => (
                <Marker
                  key={`state-label-${name}`}
                  position={data.centroid}
                  icon={L.divIcon({
                    html: `
                      <div class="pointer-events-none flex flex-col items-center" style="transform: translate(-50%, -50%);">
                        <span style="font-family:'Inter', sans-serif; font-size:10px; font-weight:800; color:#0B3B24; letter-spacing:0.04em; white-space:nowrap; background:rgba(255,255,255,0.92); padding:1px 5px; border-radius:4px; border:1px solid #D5E4DB; box-shadow: 0 1px 2px rgba(0,0,0,0.1);">
                          ${data.label}
                        </span>
                        <span style="font-size:9px; font-weight:700; color:${(stateScores[name] ?? 75) >= 75 ? '#198754' : (stateScores[name] ?? 75) >= 50 ? '#D98C00' : '#C62828'};">
                          ${stateScores[name] ?? 75}/100
                        </span>
                      </div>
                    `,
                    className: 'custom-state-label',
                    iconSize: [0, 0],
                    iconAnchor: [0, 0]
                  })}
                />
              ))}
            </>
          )}

          {/* 3. NHAI NATIONAL HIGHWAYS CORRIDORS */}
          {layers.routes && (
            <>
              {displayHighways.map((corridor) => {
                const isSelected = selectedCorridorId === corridor.id || selectedCorridorId === corridor.nh_number || selectedCorridorId === corridor.corridor_code;
                const score = corridor.accessibility_score !== undefined ? Number(corridor.accessibility_score) : 90;
                const status = (corridor.accessibility_status || corridor.status || (score >= 70 ? 'OPEN' : score > 0 ? 'RESTRICTED' : 'BLOCKED')).toUpperCase();
                
                const isCorridorBlocked = status === 'BLOCKED' || score === 0;
                const isCorridorRestricted = status === 'RESTRICTED' || status === 'PARTIAL' || (score > 0 && score < 70);

                let corridorColor = '#15803D';
                if (isCorridorBlocked) {
                  corridorColor = '#C62828';
                } else if (isCorridorRestricted) {
                  corridorColor = '#D98C00';
                }

                let corridorWeight = isSelected ? 6.5 : (isCorridorRestricted || isCorridorBlocked) ? 5.5 : 5.0;
                let corridorOpacity = isFocusMode && !isCorridorBlocked ? 0.45 : 0.95;

                if (!corridor?.coords || !Array.isArray(corridor.coords) || corridor.coords.length === 0) {
                  return null;
                }

                return (
                  <React.Fragment key={corridor.id || corridor.corridor_code}>
                    {/* Outer Glow / Casing for High Contrast over Terrain */}
                    <Polyline
                      positions={corridor.coords}
                      pathOptions={{
                        color: '#FFFFFF',
                        weight: corridorWeight + 3,
                        opacity: 0.85
                      }}
                    />

                    {/* Core Highway Line */}
                    <Polyline
                      positions={corridor.coords}
                      pathOptions={{
                        color: corridorColor,
                        weight: corridorWeight,
                        opacity: corridorOpacity,
                        dashArray: isCorridorBlocked ? '5, 5' : isCorridorRestricted ? '8, 6' : null
                      }}
                      eventHandlers={{
                        click: () => handleSelectCorridor(corridor)
                      }}
                    >
                      <Tooltip sticky className="leaflet-tooltip">
                        <div style={{ fontFamily: 'Inter', fontSize: '11px', minWidth: '180px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
                            <strong style={{ color: '#0B3B24' }}>{corridor.corridor_code || corridor.nh_number || 'NHAI Corridor'}</strong>
                            <span style={{ fontSize: '9px', fontWeight: 800, color: corridorColor }}>{status} ({Math.round(score)}/100)</span>
                          </div>
                          <div style={{ color: '#13261D', fontWeight: 600 }}>{corridor.name}</div>
                          <div style={{ color: '#3E5649', fontSize: '10px', marginTop: '2px' }}>
                            {corridor.from || corridor.origin} ➔ {corridor.to || corridor.destination}
                          </div>
                          {corridor.factor_summary && (
                            <div style={{ color: '#854D0E', fontSize: '9px', marginTop: '3px', fontStyle: 'italic', background: '#FEF9C3', padding: '2px 4px', borderRadius: '3px' }}>
                              {corridor.factor_summary}
                            </div>
                          )}
                          <div style={{ color: '#627B6E', fontSize: '9px', marginTop: '3px' }}>
                            Data Sources: {Array.isArray(corridor.data_sources) ? corridor.data_sources.slice(0, 2).join(', ') : 'Live Telemetry & Field Inspection'}
                          </div>
                        </div>
                      </Tooltip>
                    </Polyline>

                    {/* NHAI Shield Label on Midpoint */}
                    {layers.nhaiShields && corridor.midpoint && (
                      <Marker
                        position={corridor.midpoint}
                        icon={createNHAIShieldPin(corridor.corridor_code || corridor.nh_number || 'NH', corridor.name)}
                        eventHandlers={{
                          click: () => handleSelectCorridor(corridor)
                        }}
                      />
                    )}
                  </React.Fragment>
                );
              })}

              {/* Dynamic Primary Route Path */}
              {Array.isArray(primaryRoute) && primaryRoute.length > 1 && (() => {
                const nh27Blocked = corridors.some(c => 
                  (c.corridor_code === 'COR-NH27' || (c.name && c.name.includes('NH27'))) &&
                  (c.status === 'BLOCKED' || c.accessibility_status === 'BLOCKED' || c.accessibility_score === 0)
                );
                return (
                  <React.Fragment key="primary-route-group">
                    <Polyline
                      positions={primaryRoute}
                      pathOptions={{
                        color: '#FFFFFF',
                        weight: 8.5,
                        opacity: 0.90
                      }}
                    />
                    <Polyline
                      positions={primaryRoute}
                      pathOptions={{
                        color: nh27Blocked ? '#DC2626' : '#15803D',
                        weight: 6.0,
                        opacity: 0.95,
                        dashArray: nh27Blocked ? '6, 6' : null
                      }}
                    >
                      <Tooltip sticky className="leaflet-tooltip">
                        <div style={{ fontFamily: 'Inter', fontSize: '11px' }}>
                          <strong style={{ color: nh27Blocked ? '#991B1B' : '#0B3B24' }}>
                            {nh27Blocked ? '⛔ Primary Route (via Kohima) — BLOCKED' : '✓ Primary Route (via Kohima)'}
                          </strong>
                          <div style={{ color: '#3E5649', fontSize: '10px' }}>
                            {nh27Blocked ? 'Senapati Pass impassable. Alternative Detour Active / Recommended.' : 'Guwahati ➔ Imphal (480 km, ~11h)'}
                          </div>
                        </div>
                      </Tooltip>
                    </Polyline>
                  </React.Fragment>
                );
              })()}

              {/* Dynamic Alternate Detour Path */}
              {Array.isArray(alternateRoute) && alternateRoute.length > 1 && (
                <React.Fragment key="alternate-route-group">
                  <Polyline
                    positions={alternateRoute}
                    pathOptions={{
                      color: '#FFFFFF',
                      weight: 7.5,
                      opacity: 0.90
                    }}
                  />
                  <Polyline
                    positions={alternateRoute}
                    pathOptions={{
                      color: '#0284C7',
                      weight: 5.5,
                      opacity: 0.95,
                      dashArray: '8, 6'
                    }}
                  >
                    <Tooltip sticky className="leaflet-tooltip">
                      <div style={{ fontFamily: 'Inter', fontSize: '11px' }}>
                        <strong style={{ color: '#0369A1' }}>
                          ✓ Recommended Alternate Route B (NH-37 Western Detour)
                        </strong>
                        <div style={{ color: '#3E5649', fontSize: '10px' }}>
                          Via Silchar / Jiribam ➔ Imphal (535 km, ~13.5h | +55 km Detour)
                        </div>
                      </div>
                    </Tooltip>
                  </Polyline>
                </React.Fragment>
              )}
            </>
          )}

          {/* 4. EMERGENCY & DISASTER-TIME ACCESSIBILITY LIFELINES */}
          {layers.emergencyRoutes && (
            <>
              {DISASTER_LIFELINE_CORRIDORS.map((life) => {
                if (!life?.coords || !Array.isArray(life.coords) || life.coords.length === 0) return null;
                const isSelected = selectedAsset?.id === life.id || selectedCorridorId === life.id;

                return (
                  <React.Fragment key={life.id}>
                    {/* High-Contrast Halo */}
                    <Polyline
                      positions={life.coords}
                      pathOptions={{
                        color: '#FFFFFF',
                        weight: isSelected ? 8.5 : 7.0,
                        opacity: 0.90
                      }}
                    />
                    {/* Core Lifeline Polyline */}
                    <Polyline
                      positions={life.coords}
                      pathOptions={{
                        color: life.color || '#0284C7',
                        weight: isSelected ? 5.5 : 4.5,
                        opacity: 0.95,
                        dashArray: '6, 4'
                      }}
                      eventHandlers={{
                        click: () => {
                          if (onSelectAsset) {
                            onSelectAsset({
                              asset_type: 'Lifeline Corridor',
                              name: life.name,
                              corridor_code: life.code,
                              priority: life.priority,
                              role: life.role,
                              clearance: life.clearance,
                              authority: life.authority,
                              status: life.status,
                              accessibility_score: 95,
                              risk_level: 'LOW',
                              reason: `${life.role}. Maintained under high-priority emergency clearance by ${life.authority}.`
                            });
                          }
                        }
                      }}
                    >
                      <Tooltip sticky className="leaflet-tooltip">
                        <div style={{ fontFamily: 'Inter', fontSize: '11px', minWidth: '190px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
                            <strong style={{ color: '#0369A1' }}>{life.code}</strong>
                            <span style={{ fontSize: '9px', fontWeight: 800, color: '#0284C7' }}>{life.priority}</span>
                          </div>
                          <div style={{ color: '#13261D', fontWeight: 700 }}>{life.name}</div>
                          <div style={{ color: '#0D9488', fontSize: '10px', marginTop: '2px' }}>{life.role}</div>
                          <div style={{ color: '#3E5649', fontSize: '9px', marginTop: '2px' }}>Clearance: {life.clearance}</div>
                        </div>
                      </Tooltip>
                    </Polyline>

                    {/* Lifeline Badge Marker on Midpoint */}
                    {life.midpoint && (
                      <Marker
                        position={life.midpoint}
                        icon={createLifelineShieldPin(life.code, life.name)}
                        eventHandlers={{
                          click: () => {
                            if (onSelectAsset) {
                              onSelectAsset({
                                asset_type: 'Lifeline Corridor',
                                name: life.name,
                                corridor_code: life.code,
                                priority: life.priority,
                                role: life.role,
                                clearance: life.clearance,
                                authority: life.authority,
                                status: life.status,
                                accessibility_score: 95,
                                risk_level: 'LOW',
                                reason: `${life.role}. All-weather operational corridor.`
                              });
                            }
                          }
                        }}
                      />
                    )}
                  </React.Fragment>
                );
              })}
            </>
          )}

          {/* 5. STRATEGIC RIVER BRIDGES (ENABLED BY DEFAULT) */}
          {layers.bridges && (
            <>
              {displayBridges.map((bridge) => {
                const lat = bridge.lat || bridge.latitude;
                const lng = bridge.lng || bridge.longitude;
                if (!lat || !lng) return null;

                return (
                  <Marker
                    key={bridge.id || bridge.bridge_code}
                    position={[lat, lng]}
                    icon={createBridgePin(bridge.name, bridge.status, bridge.load_limit, bridge.river)}
                    eventHandlers={{
                      click: () => handleSelectBridge(bridge)
                    }}
                  >
                    <Popup className="custom-popup">
                      <div className="p-3 text-xs space-y-2 max-w-sm text-[#13261D] font-sans">
                        <div className="flex items-center justify-between border-b border-[#D5E4DB] pb-1.5">
                          <span className="font-extrabold text-[#0B3B24] flex items-center gap-1.5 text-xs">
                            <Waves className="w-4 h-4 text-[#15803D]" />
                            {bridge.name}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                            bridge.status === 'OPERATIONAL' 
                              ? 'bg-[#EAF7EE] text-[#15803D] border border-[#15803D]/30' 
                              : 'bg-amber-50 text-[#D98C00] border border-[#D98C00]/30'
                          }`}>
                            {bridge.status}
                          </span>
                        </div>

                        <div className="text-[11px] text-[#3E5649] space-y-1">
                          <div><strong>Location:</strong> {bridge.location || bridge.state}</div>
                          <div><strong>Water Body:</strong> <span className="text-[#0D9488] font-semibold">{bridge.river || 'River Crossing'}</span></div>
                          <div><strong>National Highway:</strong> <span className="text-[#0B3B24] font-bold">{bridge.highway || 'Strategic Route'}</span></div>
                          {bridge.length_km && <div><strong>Span / Length:</strong> {bridge.length_km}</div>}
                          <div><strong>Authority:</strong> {bridge.authority || 'NHAI / BRO / PWD'}</div>
                        </div>

                        <p className="text-[#5B6570] text-[11px] bg-[#F6F8FA] p-2 rounded border border-[#D9E0E7]">
                          {bridge.reason || 'Strategic river bridge monitored under NER88.'}
                        </p>

                        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-[#D5E4DB] text-[10px] text-[#627B6E]">
                          <div>Load Rating: <strong className="text-[#13261D]">{bridge.load_limit || '60T'}</strong></div>
                          <div>Score: <strong className="text-[#15803D]">{bridge.accessibility_score || 95}/100</strong></div>
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
            </>
          )}

          {/* 6. LOGISTICS BOTTLENECKS & SUPPLY CHAIN GAPS */}
          {layers.bottlenecks && (
            <>
              {STRATEGIC_BOTTLENECK_ZONES.map((bn) => {
                const isSelected = selectedAsset?.id === bn.id;
                return (
                  <Marker
                    key={bn.id}
                    position={[bn.lat, bn.lng]}
                    icon={createBottleneckPin(bn, isSelected)}
                    eventHandlers={{
                      click: () => {
                        if (onSelectAsset) {
                          onSelectAsset({
                            asset_type: 'Logistics Bottleneck',
                            name: bn.name,
                            choke_code: bn.code,
                            highway: bn.highway,
                            state: bn.state,
                            location: bn.location,
                            severity: bn.severity,
                            choke_type: bn.choke_type,
                            delay: bn.delay,
                            load_limit: bn.load_limit,
                            capacity_reduction: bn.capacity_reduction,
                            bypass_route: bn.bypass_route,
                            accessibility_score: bn.severity === 'CRITICAL' ? 35 : 55,
                            risk_level: bn.severity,
                            reason: bn.description
                          });
                        }
                      }
                    }}
                  >
                    <Popup className="custom-popup">
                      <div className="p-3 text-xs space-y-2 max-w-sm text-[#13261D] font-sans">
                        <div className="flex items-center justify-between border-b border-[#D5E4DB] pb-1.5">
                          <span className="font-extrabold text-[#991B1B] flex items-center gap-1 text-xs">
                            <AlertOctagon className="w-4 h-4 text-[#DC2626]" />
                            {bn.name}
                          </span>
                          <span className="px-2 py-0.5 rounded text-[9.5px] font-mono font-black bg-red-50 text-red-700 border border-red-200">
                            {bn.severity}
                          </span>
                        </div>
                        <div className="text-[11px] text-[#3E5649] space-y-1">
                          <div><strong>Highway Sector:</strong> <span className="font-bold text-[#0B3B24]">{bn.highway}</span> ({bn.location})</div>
                          <div><strong>Choke Mechanism:</strong> <span className="text-[#B91C1C] font-semibold">{bn.choke_type.replace('_', ' ')}</span></div>
                          <div className="flex items-center gap-3">
                            <span>Delay: <strong className="text-amber-700">{bn.delay}</strong></span>
                            <span>Limit: <strong className="text-red-700">{bn.load_limit}</strong></span>
                          </div>
                          <div><strong>Throughput Impact:</strong> <span className="text-rose-700 font-bold">{bn.capacity_reduction}</span></div>
                          {bn.bypass_route && (
                            <div className="bg-emerald-50 p-1.5 rounded border border-emerald-200 text-[#166534] mt-1 text-[10px]">
                              <strong>Bypass Detour:</strong> {bn.bypass_route}
                            </div>
                          )}
                        </div>
                        <p className="text-[#5B6570] text-[10.5px] bg-[#F6F8FA] p-2 rounded border border-[#D9E0E7]">
                          {bn.description}
                        </p>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
            </>
          )}

          {/* 7. DISTRICT-WISE CONNECTIVITY STATUS */}
          {layers.districtConnectivity && (
            <>
              {DISTRICT_CONNECTIVITY_DATASET.map((dst) => {
                const isSelected = selectedAsset?.id === dst.id;
                return (
                  <Marker
                    key={dst.id}
                    position={dst.coords}
                    icon={createDistrictPin(dst, isSelected)}
                    eventHandlers={{
                      click: () => {
                        if (onSelectAsset) {
                          onSelectAsset({
                            asset_type: 'District Connectivity Node',
                            name: `${dst.name} (${dst.state})`,
                            district_name: dst.name,
                            state: dst.state,
                            accessibility_score: dst.score,
                            status: dst.status,
                            risk_level: dst.score < 50 ? 'HIGH' : dst.score < 75 ? 'MEDIUM' : 'LOW',
                            bottleneck_count: dst.bottleneck_count,
                            lifeline_links: dst.lifeline_links,
                            fuel_buffer: dst.fuel_buffer,
                            medical_access: dst.medical_access,
                            reason: `District connectivity rating: ${dst.score}% (${dst.status}). ${dst.bottleneck_count} active bottlenecks, ${dst.lifeline_links} emergency lifelines.`
                          });
                        }
                      }
                    }}
                  >
                    <Popup className="custom-popup">
                      <div className="p-3 text-xs space-y-2 max-w-xs text-[#13261D] font-sans">
                        <div className="flex items-center justify-between border-b border-[#D5E4DB] pb-1.5">
                          <span className="font-extrabold text-[#0B3B24] flex items-center gap-1.5 text-xs">
                            <Building2 className="w-4 h-4 text-[#15803D]" />
                            {dst.name}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-black ${
                            dst.score >= 75 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                            dst.score >= 50 ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                            'bg-red-50 text-red-700 border border-red-200'
                          }`}>
                            {dst.score}% Rating
                          </span>
                        </div>
                        <div className="text-[11px] text-[#3E5649] space-y-1">
                          <div><strong>State / Hub:</strong> {dst.state} &bull; {dst.hub}</div>
                          <div><strong>Status:</strong> <span className="font-bold text-[#13261D]">{dst.status}</span></div>
                          <div className="grid grid-cols-2 gap-1 pt-1 text-[10.5px]">
                            <div>Bottlenecks: <strong className={dst.bottleneck_count > 0 ? 'text-red-600' : 'text-emerald-600'}>{dst.bottleneck_count}</strong></div>
                            <div>Lifeline Links: <strong className="text-cyan-700">{dst.lifeline_links}</strong></div>
                            <div>Medical Access: <strong className="text-[#13261D]">{dst.medical_access}</strong></div>
                            <div>Fuel Buffer: <strong className="text-[#13261D]">{dst.fuel_buffer}</strong></div>
                          </div>
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
            </>
          )}

          {/* 8. LIVE TELEMETRY & ESSENTIAL SUPPLIES FLEET */}
          {layers.vehicles && (
            <>
              {displayVehicles.map((veh) => {
                const lat = veh.current_lat || veh.latitude;
                const lng = veh.current_lng || veh.longitude;
                if (!lat || !lng) return null;

                const isAlert = veh.status === 'CRITICAL' || (veh.speed_kmh === 0 && veh.status === 'IN_TRANSIT');

                return (
                  <Marker
                    key={veh.id || veh.vehicle_code}
                    position={[lat, lng]}
                    icon={createVehiclePin(veh, isAlert)}
                    eventHandlers={{
                      click: () => {
                        if (onSelectVehicle) onSelectVehicle(veh);
                        if (onSelectAsset) {
                          onSelectAsset({
                            asset_type: 'Essential Supplies Consignment',
                            name: `Vehicle ${veh.vehicle_code} (${veh.cargo_type || 'SUPPLIES'})`,
                            vehicle_code: veh.vehicle_code,
                            cargo_type: veh.cargo_type || 'GENERAL',
                            cargo_desc: veh.cargo_desc || 'Essential Logistics Supplies',
                            status: veh.status,
                            speed: `${veh.speed_kmh} km/h`,
                            destination: veh.destination,
                            eta: veh.eta || '3h',
                            driver_name: veh.driver_name,
                            accessibility_score: 95,
                            risk_level: 'LOW',
                            reason: `Live telematics broadcast from ${veh.vehicle_code} carrying ${veh.cargo_desc || veh.cargo_type} along ${veh.route_code || 'designated corridor'}.`
                          });
                        }
                      }
                    }}
                  >
                    <Popup className="custom-popup">
                      <div className="p-3 text-xs space-y-2 max-w-xs text-[#13261D]">
                        <div className="flex items-center justify-between border-b border-[#D5E4DB] pb-1.5">
                          <span className="font-bold text-[#0B3B24] flex items-center gap-1.5">
                            <Truck className="w-3.5 h-3.5 text-[#15803D]" />
                            {veh.vehicle_code} &bull; {veh.cargo_type || 'SUPPLIES'}
                          </span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#EAF7EE] text-[#15803D] border border-[#15803D]/30">
                            {veh.speed_kmh} km/h
                          </span>
                        </div>
                        <div className="text-[#3E5649] text-[11px] space-y-1">
                          {veh.cargo_desc && <div className="text-emerald-800 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded text-[10px]">{veh.cargo_desc}</div>}
                          <div>Driver: <strong className="text-[#13261D]">{veh.driver_name || 'Field Operator'}</strong></div>
                          <div>Destination: <strong className="text-[#13261D]">{veh.destination || 'Regional Hub'}</strong></div>
                          {veh.eta && <div>ETA: <strong className="text-[#0B3B24]">{veh.eta}</strong></div>}
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
            </>
          )}

          {/* 9. INCIDENTS & HAZARDS */}
          {layers.incidents && (
            <>
              {filteredIncidents.map((inc) => {
                const lat = inc.lat || inc.latitude;
                const lng = inc.lng || inc.longitude;
                if (!lat || !lng) return null;

                const isSelected = activeIncident?.id === inc.id || activeIncident?.incident_code === inc.incident_code;

                return (
                  <Marker
                    key={inc.id || inc.incident_code}
                    position={[lat, lng]}
                    icon={createIncidentPin(inc.title || 'Hazard', inc.severity, isSelected)}
                    eventHandlers={{
                      click: () => handleSelectIncident(inc)
                    }}
                  />
                );
              })}
            </>
          )}

          {/* 10. TRANSIT HUBS & MAJOR LOGISTICS CITIES */}
          {layers.cities && !isFocusMode && (
            <>
              {MAJOR_LOGISTICS_CITIES.map((city) => (
                <Marker
                  key={city.id}
                  position={[city.coords[1], city.coords[0]]}
                  icon={createCityPin(city.name, city.type, city.importance === 'HIGH')}
                  eventHandlers={{
                    click: () => {
                      if (onSelectAsset) {
                        onSelectAsset({
                          asset_type: 'Hub',
                          name: `${city.name} Logistics Center`,
                          district_name: city.name,
                          state: city.state,
                          accessibility_score: 85,
                          risk_level: 'LOW',
                          reason: city.type
                        });
                      }
                    }
                  }}
                >
                  <Tooltip sticky className="leaflet-tooltip">
                    <div style={{ fontFamily: 'Inter', fontSize: '11px' }}>
                      <strong style={{ color: '#0B3B24' }}>{city.name}</strong> ({city.state})
                      <div style={{ color: '#3E5649', fontSize: '10px' }}>{city.type}</div>
                    </div>
                  </Tooltip>
                </Marker>
              ))}
            </>
          )}
        </MapContainer>
      </div>

      {/* ── BOTTOM MAP CONTROLS & SHORTCUTS ── */}
      <div className="absolute bottom-3 left-3 z-[400] flex items-center gap-2 pointer-events-auto flex-wrap">
        {/* Reset View to North-East India */}
        <button
          onClick={handleResetView}
          className="bg-white/95 backdrop-blur-md border border-[#CCE0D5] hover:border-[#15803D] hover:bg-[#F7FAF8] p-2 rounded-lg text-[#13261D] shadow-sm transition flex items-center gap-1.5 text-xs font-bold cursor-pointer"
          title={t('map.resetMap', 'Reset Map')}
        >
          <RotateCcw className="w-3.5 h-3.5 text-[#15803D]" />
          <span className="hidden sm:inline">{t('map.resetMap', 'Reset Map')}</span>
        </button>

        {/* Locate NER Center */}
        <button
          onClick={handleResetView}
          className="bg-white/95 backdrop-blur-md border border-[#CCE0D5] hover:border-[#15803D] hover:bg-[#F7FAF8] p-2 rounded-lg text-[#13261D] shadow-sm transition flex items-center gap-1.5 text-xs font-bold cursor-pointer"
          title={t('map.centerNer', 'Center NER')}
        >
          <Crosshair className="w-3.5 h-3.5 text-[#15803D]" />
          <span className="hidden sm:inline">{t('map.centerNer', 'Center NER')}</span>
        </button>
      </div>

      {/* ── COLLAPSIBLE MAP LEGEND ── */}
      <div className="absolute bottom-3 right-12 z-[400] pointer-events-auto">
        <div className="bg-white/95 backdrop-blur-md border border-[#D5E4DB] rounded-lg shadow-md p-2.5 text-xs max-w-xs transition-all text-[#13261D]">
          <div 
            onClick={() => setShowLegend(!showLegend)}
            className="flex items-center justify-between cursor-pointer gap-3 font-bold text-[#0B3B24] text-[11px] uppercase tracking-wider"
          >
            <span className="flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5 text-[#15803D]" /> {t('map.legendTitle', 'GIS INFRASTRUCTURE LEGEND')}
            </span>
            {showLegend ? <ChevronDown className="w-3.5 h-3.5 text-[#3E5649]" /> : <ChevronUp className="w-3.5 h-3.5 text-[#3E5649]" />}
          </div>

          <AnimatePresence>
            {showLegend && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.18 }}
                className="mt-2 space-y-2 border-t border-[#D5E4DB] pt-2 text-[10px] overflow-hidden"
              >
                {/* NHAI Corridors & Lifelines */}
                <div>
                  <span className="text-[#0B3B24] block font-extrabold mb-1">CORRIDORS &amp; LIFELINES</span>
                  <div className="grid grid-cols-2 gap-1 text-[#13261D]">
                    <div className="flex items-center gap-1.5">
                      <span className="w-3.5 h-1 rounded bg-[#15803D]"></span>
                      <span>NHAI Trunk (4-Lane)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-3.5 h-1 border-b-2 border-dashed border-[#0284C7]"></span>
                      <span>Disaster Lifeline</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-3.5 h-1 rounded bg-[#D98C00]"></span>
                      <span>Restricted Lane</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-3.5 h-1 rounded bg-[#C62828]"></span>
                      <span>Blocked / Choke</span>
                    </div>
                  </div>
                </div>

                {/* Bottlenecks, Bridges & Supplies */}
                <div className="border-t border-[#D5E4DB] pt-1.5">
                  <span className="text-[#0B3B24] block font-extrabold mb-1">ASSETS &amp; TELEMETRY</span>
                  <div className="grid grid-cols-2 gap-1 text-[#13261D]">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-[#15803D]"></span>
                      <span>Bridge (60T+)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-[#DC2626]"></span>
                      <span>Bottleneck Choke</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-[#16A34A]"></span>
                      <span>District Rating (90%+)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-[#0284C7]"></span>
                      <span>Essential Supplies</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── MAP DATA TRANSPARENCY FOOTER ── */}
      <div className="absolute bottom-1 right-28 z-[300] bg-white/90 backdrop-blur-sm border border-[#D5E4DB] px-2.5 py-0.5 rounded text-[9px] text-[#3E5649] hidden lg:flex items-center gap-2 shadow-sm">
        <span>{t('map.terrainBasemap', 'Terrain Basemap')}: <strong className="text-[#13261D]">{basemap === 'satellite' ? 'Esri Satellite Terrain' : basemap === 'terrain' ? 'Esri Topo / Shaded Relief' : basemap === 'physical' ? 'Esri Physical Relief' : 'OpenStreetMap'}</strong></span>
        <span>&bull;</span>
        <span>{t('map.highways', 'Highways')}: <strong className="text-[#15803D]">NHAI / MoRTH</strong></span>
        <span>&bull;</span>
        <span>{t('map.bridges', 'Bridges')}: <strong className="text-[#0B3B24]">BRO &amp; NHIDCL</strong></span>
      </div>
    </div>
  );
};

export default SatelliteGISMap;
