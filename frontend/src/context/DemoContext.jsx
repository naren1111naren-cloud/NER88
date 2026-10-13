import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';

const DemoContext = createContext(null);

export const DemoProvider = ({ children }) => {
  const [isDemoMode, setIsDemoMode] = useState(true);
  const [isScenarioRunning, setIsScenarioRunning] = useState(false);
  const [scenarioStep, setScenarioStep] = useState(0); // 0 to 6
  const [showScenarioModal, setShowScenarioModal] = useState(false);
  const [scenarioStatus, setScenarioStatus] = useState(null);
  const [scenarioTimeline, setScenarioTimeline] = useState([]);
  const [activeStepAction, setActiveStepAction] = useState(null);

  // Master Demonstration Scenario Steps (SIH26002 Guwahati -> Shillong Life-Saving Medicine Delivery)
  const masterScenarioSteps = [
    {
      step: 1,
      id: 'INIT',
      title: '1. Baseline Dispatch & Telemetry Active',
      origin: 'Guwahati (Khanapara)',
      destination: 'Shillong (Civil Hospital Hub)',
      corridor: 'COR-NH40 (GS Road)',
      statusLabel: 'OPEN (Score 94.0)',
      desc: 'Vehicle V-102 dispatched carrying Consignment MED-102 (Essential medicines & vaccines). Active corridor COR-NH40 clear and operational.',
      actionName: 'Initialize Baseline',
      source: 'Logistics Dispatch Engine & GPS Telemetry'
    },
    {
      step: 2,
      id: 'DISRUPT',
      title: '2. Disruption Cascade & Risk Impact',
      origin: 'Nongpoh Sector (Km 48)',
      destination: 'Shillong Gate',
      corridor: 'COR-NH40 (GS Road)',
      statusLabel: 'BLOCKED (Score 0.0)',
      desc: 'Monsoon torrential rain triggers massive hill slope landslide at Nongpoh. Accessibility drops to 0.0 (BLOCKED). Rerouting engine identifies affected vehicle V-102 and generates Route B Detour via Eastern Bypass NH106 (+36 km, +78 min delay).',
      actionName: 'Trigger Disruption Cascade',
      source: 'Disaster Incident Engine & Route Optimizer'
    },
    {
      step: 3,
      id: 'FIELD',
      title: '3. Offline Field Ground Confirmation Synced',
      origin: 'Ri Bhoi Patrol Sector',
      destination: 'Command Center',
      corridor: 'COR-NH40 (GS Road)',
      statusLabel: 'FIELD CONFIRMED',
      desc: 'Field Officer in low-connectivity hill zone captures geo-tagged ground truth report with photographic evidence. Report synchronizes automatically to Central Command Center upon reconnection.',
      actionName: 'Sync Field Report',
      source: 'Offline Field Reporting Module (Phase 4)'
    },
    {
      step: 4,
      id: 'REROUTE',
      title: '4. Operator Reroute Decision Approved',
      origin: 'Khanapara Bypass Link',
      destination: 'Shillong via Bhoirymbong',
      corridor: 'COR-NH106-BYPASS',
      statusLabel: 'DETOUR ACTIVE',
      desc: 'Logistics Dispatcher approves Route B detour via Jagiroad - Bhoirymbong link. Vehicle V-102 and shipment MED-102 transition to REROUTED status. Real-time alert dispatched to driver and Command Center.',
      actionName: 'Approve Route B Detour',
      source: 'Central Command Center & Dispatcher'
    },
    {
      step: 5,
      id: 'TELEMETRY',
      title: '5. In-Transit Telemetry Ingestion',
      origin: 'Bhoirymbong Eastern Bypass',
      destination: 'NEIGRIHMS Junction (Shillong Gate)',
      corridor: 'COR-NH106-BYPASS',
      statusLabel: 'IN TRANSIT (DETOUR)',
      desc: 'Simulated GPS telemetry receiver ingests live coordinates (Lat 25.6100, Lng 91.9500, Speed 40 km/h) advancing V-102 toward Shillong entry gate along the safe corridor.',
      actionName: 'Advance Telemetry',
      source: 'GPS Telemetry Ingestion (SIMULATED TELEMETRY)'
    },
    {
      step: 6,
      id: 'DELIVERED',
      title: '6. Delivery Completion & Cold-Chain Intake',
      origin: 'Shillong Gate',
      destination: 'Shillong Civil Hospital Central Pharmacy',
      corridor: 'COR-NH106-BYPASS',
      statusLabel: 'DELIVERED',
      desc: 'Vehicle V-102 safely reaches Shillong Civil Hospital Hub. Consignment MED-102 marked DELIVERED with actual delivery duration recorded. Completion alert logged.',
      actionName: 'Complete Delivery',
      source: 'Hospital Consignee Gateway'
    }
  ];

  const fetchScenarioStatus = useCallback(async () => {
    try {
      const res = await api.get('/demo/scenario/status');
      if (res.data) {
        setScenarioStatus(res.data);
        if (res.data.current_step !== undefined) {
          setScenarioStep(res.data.current_step);
        }
      }
    } catch {
      // Backend endpoint optional fallback
    }
  }, []);

  const fetchScenarioTimeline = useCallback(async () => {
    try {
      const res = await api.get('/demo/scenario/timeline');
      if (res.data && Array.isArray(res.data.timeline)) {
        setScenarioTimeline(res.data.timeline);
      }
    } catch {
      // Backend endpoint optional fallback
    }
  }, []);

  useEffect(() => {
    if (isDemoMode) {
      fetchScenarioStatus();
      fetchScenarioTimeline();
    }
  }, [isDemoMode, fetchScenarioStatus, fetchScenarioTimeline]);

  const toggleDemoMode = () => {
    setIsDemoMode((prev) => !prev);
  };

  // Master Scenario Execution Endpoints
  const startMasterScenario = async () => {
    setActiveStepAction('start');
    try {
      await api.post('/demo/scenario/start');
      setScenarioStep(1);
      await fetchScenarioStatus();
      await fetchScenarioTimeline();
      window.dispatchEvent(new Event('sih_demo_triggered'));
    } catch (err) {
      console.error('Failed to start master scenario:', err);
    } finally {
      setActiveStepAction(null);
    }
  };

  const disruptMasterScenario = async () => {
    setActiveStepAction('disrupt');
    try {
      await api.post('/demo/scenario/disrupt');
      setScenarioStep(2);
      await fetchScenarioStatus();
      await fetchScenarioTimeline();
      window.dispatchEvent(new Event('sih_demo_triggered'));
    } catch (err) {
      console.error('Failed to disrupt master scenario:', err);
    } finally {
      setActiveStepAction(null);
    }
  };

  const fieldConfirmMasterScenario = async () => {
    setActiveStepAction('field-confirm');
    try {
      await api.post('/demo/scenario/field-confirm');
      setScenarioStep(3);
      await fetchScenarioStatus();
      await fetchScenarioTimeline();
      window.dispatchEvent(new Event('sih_demo_triggered'));
    } catch (err) {
      console.error('Failed to sync field confirmation:', err);
    } finally {
      setActiveStepAction(null);
    }
  };

  const rerouteApproveMasterScenario = async () => {
    setActiveStepAction('reroute-approve');
    try {
      await api.post('/demo/scenario/reroute-approve');
      setScenarioStep(4);
      await fetchScenarioStatus();
      await fetchScenarioTimeline();
      window.dispatchEvent(new Event('sih_demo_triggered'));
    } catch (err) {
      console.error('Failed to approve reroute:', err);
    } finally {
      setActiveStepAction(null);
    }
  };

  const telemetryAdvanceMasterScenario = async () => {
    setActiveStepAction('telemetry-advance');
    try {
      await api.post('/demo/scenario/telemetry-advance');
      setScenarioStep(5);
      await fetchScenarioStatus();
      await fetchScenarioTimeline();
      window.dispatchEvent(new Event('sih_demo_triggered'));
    } catch (err) {
      console.error('Failed to advance telemetry:', err);
    } finally {
      setActiveStepAction(null);
    }
  };

  const deliverMasterScenario = async () => {
    setActiveStepAction('deliver');
    try {
      await api.post('/demo/scenario/deliver');
      setScenarioStep(6);
      await fetchScenarioStatus();
      await fetchScenarioTimeline();
      window.dispatchEvent(new Event('sih_demo_triggered'));
    } catch (err) {
      console.error('Failed to complete delivery:', err);
    } finally {
      setActiveStepAction(null);
    }
  };

  const resetMasterScenario = async () => {
    setActiveStepAction('reset');
    try {
      await api.post('/demo/scenario/reset');
      setScenarioStep(0);
      await fetchScenarioStatus();
      await fetchScenarioTimeline();
      window.dispatchEvent(new Event('sih_demo_reset'));
    } catch (err) {
      console.error('Failed to reset master scenario:', err);
    } finally {
      setActiveStepAction(null);
    }
  };

  // Run full deterministic demonstration sequence (pacing ~1.5s per step for quick review or presentation)
  const runFullMasterDemo = async () => {
    setIsScenarioRunning(true);
    try {
      await startMasterScenario();
      await new Promise((r) => setTimeout(r, 1200));

      await disruptMasterScenario();
      await new Promise((r) => setTimeout(r, 1500));

      await fieldConfirmMasterScenario();
      await new Promise((r) => setTimeout(r, 1200));

      await rerouteApproveMasterScenario();
      await new Promise((r) => setTimeout(r, 1500));

      await telemetryAdvanceMasterScenario();
      await new Promise((r) => setTimeout(r, 1200));

      await deliverMasterScenario();
    } catch (err) {
      console.error('Error running full master demo sequence:', err);
    } finally {
      setIsScenarioRunning(false);
    }
  };

  // Backward-compatible handlers
  const startDemoScenario = async () => {
    setShowScenarioModal(true);
    await runFullMasterDemo();
  };

  const startHeavyRainScenario = async () => {
    await disruptMasterScenario();
  };

  const resetDemoScenario = async () => {
    await resetMasterScenario();
    setShowScenarioModal(false);
  };

  return (
    <DemoContext.Provider
      value={{
        isDemoMode,
        toggleDemoMode,
        isScenarioRunning,
        scenarioStep,
        setScenarioStep,
        showScenarioModal,
        setShowScenarioModal,
        masterScenarioSteps,
        scenarioSteps: masterScenarioSteps,
        scenarioStatus,
        scenarioTimeline,
        activeStepAction,
        fetchScenarioStatus,
        fetchScenarioTimeline,
        startMasterScenario,
        disruptMasterScenario,
        fieldConfirmMasterScenario,
        rerouteApproveMasterScenario,
        telemetryAdvanceMasterScenario,
        deliverMasterScenario,
        resetMasterScenario,
        runFullMasterDemo,
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
