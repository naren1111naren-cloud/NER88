import React, { createContext, useContext, useState } from 'react';
import api from '../services/api';

const DemoContext = createContext(null);

export const DemoProvider = ({ children }) => {
  const [isDemoMode, setIsDemoMode] = useState(true);
  const [isScenarioRunning, setIsScenarioRunning] = useState(false);
  const [scenarioStep, setScenarioStep] = useState(0); // 0 to 16
  const [showScenarioModal, setShowScenarioModal] = useState(false);

  const scenarioSteps = [
    { title: 'STEP 1: Emergency Cargo Dispatched', desc: 'Critical medical supply shipment DEL-2026-001 assigned to vehicle NER-V001 (Guwahati ➔ Imphal).', status: 'pending' },
    { title: 'STEP 2: Vehicle Telemetry Active', desc: 'Simulated GPS tracking active near Dimapur / Kohima highway pass at 42 km/h.', status: 'pending' },
    { title: 'STEP 3: Severe Weather Escalation', desc: 'Monsoon precipitation surges to 75 mm/hr over Senapati mountain sector.', status: 'pending' },
    { title: 'STEP 4: Field Report Logged', desc: 'Field Inspector submits geo-tagged report of massive mountain landslide at Senapati Pass.', status: 'pending' },
    { title: 'STEP 5: GIS Incident Pin Rendered', desc: 'Landslide hazard marker appears live on Leaflet GIS Operational Map.', status: 'pending' },
    { title: 'STEP 6: AI Model Inference Executed', desc: 'Random Forest Regressor & Classifier evaluate 8-feature contract parameters.', status: 'pending' },
    { title: 'STEP 7: Risk Score Escalated', desc: 'Route risk score surges to 82/100 (CRITICAL Risk level).', status: 'pending' },
    { title: 'STEP 8: Corridor Access Blocked', desc: 'Transport Corridor COR-NH27 status set to BLOCKED / IMPASSABLE.', status: 'pending' },
    { title: 'STEP 9: District Index Updated', desc: 'Senapati District accessibility score drops to 24/100 (Severely Inaccessible).', status: 'pending' },
    { title: 'STEP 10: Multi-Route Optimization', desc: 'AI evaluates candidate routes (Route A, Route B, Route C) using weighted cost model.', status: 'pending' },
    { title: 'STEP 11: Reroute Rationale Generated', desc: 'Alternate Route B (via Silchar / Jiribam - NH37) recommended (+35 mins delay, lower landslide probability).', status: 'pending' },
    { title: 'STEP 12: Operational Alert Triggered', desc: 'Priority Alert dispatched to Command Center for Dispatcher reroute approval.', status: 'pending' },
    { title: 'STEP 13: Dispatcher Action Approved', desc: 'Logistics Dispatcher approves detour based on SHAP feature explainability.', status: 'pending' },
    { title: 'STEP 14: GIS Polyline Trajectory Updated', desc: 'Vehicle polyline trajectory on GIS map updates to Alternate Route B.', status: 'pending' },
    { title: 'STEP 15: ETA & Status Updated', desc: 'Delivery status updated to REROUTED with revised ETA +35 mins.', status: 'pending' },
    { title: 'STEP 16: Audit Trail Recorded', desc: 'Permanent audit log entry saved for compliance and transparency.', status: 'pending' }
  ];

  const toggleDemoMode = () => {
    setIsDemoMode((prev) => !prev);
  };

  const startDemoScenario = async () => {
    setShowScenarioModal(true);
    setIsScenarioRunning(true);
    setScenarioStep(0);

    try {
      await api.post('/demo/trigger-landslide').catch(() => {});

      for (let i = 1; i <= 16; i++) {
        await new Promise((resolve) => setTimeout(resolve, 450));
        setScenarioStep(i);
      }
      
      window.dispatchEvent(new Event('sih_demo_triggered'));
    } catch (err) {
      console.error(err);
    } finally {
      setIsScenarioRunning(false);
    }
  };

  const startHeavyRainScenario = async () => {
    setIsScenarioRunning(true);
    try {
      await api.post('/demo/trigger-heavy-rainfall').catch(() => {});
      window.dispatchEvent(new Event('sih_demo_triggered'));
    } catch (err) {
      console.error(err);
    } finally {
      setIsScenarioRunning(false);
    }
  };

  const resetDemoScenario = async () => {
    try {
      await api.post('/demo/reset').catch(() => {});
      window.dispatchEvent(new Event('sih_demo_reset'));
    } catch (err) {
      console.error(err);
    }
    setScenarioStep(0);
    setShowScenarioModal(false);
  };

  return (
    <DemoContext.Provider
      value={{
        isDemoMode,
        toggleDemoMode,
        isScenarioRunning,
        scenarioStep,
        showScenarioModal,
        setShowScenarioModal,
        scenarioSteps,
        startDemoScenario,
        startHeavyRainScenario,
        resetDemoScenario
      }}
    >
      {children}
    </DemoContext.Provider>
  );
};

export const useDemo = () => {
  const ctx = useContext(DemoContext);
  if (!ctx) {
    throw new Error('useDemo must be used within a DemoProvider');
  }
  return ctx;
};
