"""
Real-Time Alert Delivery Service (SIH Gap 14)
Provides an in-app real-time notification engine with Server-Sent Events (SSE) streaming,
broadcast queue management, acknowledgement lifecycle tracking, reconnection handling,
and audit trail generation.
"""

import json
import asyncio
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional, Set
import logging
from sqlalchemy.orm import Session

from app.models.models import Alert, AuditLog
from app.schemas.schemas import AlertOut

logger = logging.getLogger("link_x8.alert_delivery")

class AlertDeliveryService:
    """
    Coordinates real-time delivery of operational alerts across LINK X8.
    Maintains active subscriber queues and publishes structured JSON event streams.
    """

    _subscribers: Set[asyncio.Queue] = set()
    _recent_events: List[Dict[str, Any]] = []
    _MAX_RECENT_BUFFER = 50

    @classmethod
    def subscribe(cls) -> asyncio.Queue:
        """Registers a new client connection to the real-time event bus."""
        queue = asyncio.Queue()
        cls._subscribers.add(queue)
        logger.info(f"Client connected to Real-Time Alert Stream. Total subscribers: {len(cls._subscribers)}")
        return queue

    @classmethod
    def unsubscribe(cls, queue: asyncio.Queue):
        """Removes a disconnected client from the subscriber registry."""
        cls._subscribers.discard(queue)
        logger.info(f"Client disconnected from Alert Stream. Active subscribers: {len(cls._subscribers)}")

    @classmethod
    def publish_generic_event(cls, event_type: str, data: Dict[str, Any]):
        """
        Broadcasts any real-time operational payload (telemetry, accessibility, reroute, demo) to all connected clients.
        """
        now_iso = datetime.now(timezone.utc).isoformat()
        event_id = f"evt-{data.get('id', 'gen')}-{int(datetime.now(timezone.utc).timestamp())}"
        payload = {
            "event_id": event_id,
            "event_type": event_type,
            "data": data,
            "alert": data.get("alert") if "alert" in data else (data if event_type.endswith("ALERT") else None),
            "timestamp": now_iso
        }

        # Maintain in-memory ring buffer for reconnections
        cls._recent_events.append(payload)
        if len(cls._recent_events) > cls._MAX_RECENT_BUFFER:
            cls._recent_events.pop(0)

        # Broadcast to all active subscriber queues
        dead_queues = set()
        for q in cls._subscribers:
            try:
                q.put_nowait(payload)
            except Exception as e:
                logger.warning(f"Failed to queue event to subscriber: {e}")
                dead_queues.add(q)

        for dq in dead_queues:
            cls._subscribers.discard(dq)

    @classmethod
    def publish_alert_event(cls, event_type: str, alert_data: Dict[str, Any]):
        """
        Broadcasts a structured alert event to all connected authenticated client streams.
        """
        cls.publish_generic_event(event_type, alert_data)

    @classmethod
    def create_and_broadcast_alert(
        cls,
        db: Session,
        alert_type: str,
        title: str,
        message: str,
        severity: str = "HIGH",
        location: Optional[str] = None,
        recommended_action: Optional[str] = None,
        delivery_id: Optional[int] = None,
        vehicle_id: Optional[int] = None,
        source_incident_id: Optional[int] = None,
        corridor_code: Optional[str] = None,
        district_name: Optional[str] = None
    ) -> Alert:
        """
        Persists an operational alert in the database and broadcasts it in real-time.
        """
        now_dt = datetime.now(timezone.utc).replace(tzinfo=None)
        alert = Alert(
            alert_type=alert_type,
            title=title,
            message=message,
            severity=severity.upper(),
            location=location,
            recommended_action=recommended_action,
            delivery_id=delivery_id,
            vehicle_id=vehicle_id,
            source_incident_id=source_incident_id,
            corridor_code=corridor_code,
            district_name=district_name,
            is_read=False,
            status="NEW",
            created_at=now_dt
        )
        db.add(alert)
        db.commit()
        db.refresh(alert)

        alert_dict = {
            "id": alert.id,
            "alert_type": alert.alert_type,
            "title": alert.title,
            "message": alert.message,
            "severity": alert.severity,
            "location": alert.location,
            "recommended_action": alert.recommended_action,
            "delivery_id": alert.delivery_id,
            "vehicle_id": alert.vehicle_id,
            "source_incident_id": alert.source_incident_id,
            "corridor_code": alert.corridor_code,
            "district_name": alert.district_name,
            "is_read": alert.is_read,
            "status": alert.status,
            "acknowledged_at": None,
            "acknowledged_by": None,
            "resolved_at": None,
            "created_at": alert.created_at.isoformat() if alert.created_at else now_dt.isoformat()
        }

        cls.publish_alert_event("NEW_ALERT", alert_dict)
        return alert

    @classmethod
    def acknowledge_alert(
        cls,
        alert_id: int,
        acknowledged_by: str,
        db: Session,
        notes: Optional[str] = None
    ) -> Alert:
        """
        Marks an alert as ACKNOWLEDGED, logs to audit trail, and broadcasts state update.
        """
        alert = db.query(Alert).filter(Alert.id == alert_id).first()
        if not alert:
            raise ValueError(f"Alert with ID {alert_id} not found")

        now_dt = datetime.now(timezone.utc).replace(tzinfo=None)
        alert.status = "ACKNOWLEDGED"
        alert.is_read = True
        alert.acknowledged_at = now_dt
        alert.acknowledged_by = acknowledged_by or "Regional Dispatcher"

        # Create audit trail
        audit = AuditLog(
            user_email=alert.acknowledged_by,
            action="ACKNOWLEDGE_ALERT",
            resource="Alert",
            details=f"Alert #{alert.id} ({alert.title}) acknowledged. Action/Notes: {notes or 'Standard acknowledgement'}"
        )
        db.add(audit)
        db.commit()
        db.refresh(alert)

        alert_dict = {
            "id": alert.id,
            "alert_type": alert.alert_type,
            "title": alert.title,
            "message": alert.message,
            "severity": alert.severity,
            "location": alert.location,
            "recommended_action": alert.recommended_action,
            "delivery_id": alert.delivery_id,
            "vehicle_id": alert.vehicle_id,
            "is_read": alert.is_read,
            "status": alert.status,
            "acknowledged_at": alert.acknowledged_at.isoformat() if alert.acknowledged_at else None,
            "acknowledged_by": alert.acknowledged_by,
            "created_at": alert.created_at.isoformat() if alert.created_at else now_dt.isoformat()
        }

        cls.publish_alert_event("ALERT_ACKNOWLEDGED", alert_dict)
        return alert

    @classmethod
    def get_missed_events(cls, last_event_id: Optional[str]) -> List[Dict[str, Any]]:
        """Returns events emitted since the provided last_event_id for reconnection resilience."""
        if not last_event_id:
            return cls._recent_events[-10:] if cls._recent_events else []

        missed = []
        found = False
        for evt in cls._recent_events:
            if found:
                missed.append(evt)
            elif evt.get("event_id") == last_event_id:
                found = True

        return missed if found else cls._recent_events[-10:]
