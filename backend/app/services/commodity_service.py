"""
Essential Commodity Lifecycle Tracking Service (SIH Gap 13)
Provides end-to-end consignment lifecycle management for 4 critical NER commodity categories:
1. Medicines & Medical Supplies (Cold-chain, urgent)
2. Food Supplies & PDS Rations (Civil supplies, bulk)
3. Construction Materials & Bridge Spans (Infrastructure restoration)
4. Agricultural Produce & Hill Perishables (Time-sensitive farm produce)
Lifecycle: CREATED -> ASSIGNED -> LOADED -> DISPATCHED -> IN_TRANSIT -> DELAYED_AT_RISK -> ARRIVED -> DELIVERED
"""

import json
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
import logging
from sqlalchemy.orm import Session

from app.models.models import Delivery, Vehicle, AuditLog, Alert
from app.schemas.schemas import (
    CommodityConsignmentCreateIn,
    CommodityStatusUpdateIn,
    CommodityDeliveryCompleteIn,
    CommodityCategorySummaryItem,
    EssentialCommoditiesOverviewOut,
    DeliveryOut
)
from app.services.routing_service import RoutingService
from app.services.eta_service import ETAService

logger = logging.getLogger("link_x8.commodity_service")

COMMODITY_CATEGORIES = [
    "Medicines",
    "Food supplies",
    "Construction materials",
    "Agricultural produce"
]

class CommodityService:
    """
    Coordinates end-to-end commodity dispatch, GPS tracking, and delivery completion audits.
    """

    @classmethod
    def create_consignment(
        cls,
        payload: CommodityConsignmentCreateIn,
        db: Session
    ) -> Delivery:
        """Creates a new essential commodity consignment with automated route & ETA setup."""
        code_count = db.query(Delivery).count() + 1
        prefix = {
            "Medicines": "MED",
            "Food supplies": "FOOD",
            "Construction materials": "CONST",
            "Agricultural produce": "AGRI"
        }.get(payload.cargo_category, "DEL")

        code = f"{prefix}-2026-{code_count:03d}"
        route = RoutingService.get_route(payload.origin_city, payload.destination_city)

        eta_breakdown = ETAService.calculate_eta_breakdown(
            origin=payload.origin_city,
            destination=payload.destination_city,
            corridor_code="COR-NH27",
            departure_time=datetime.utcnow(),
            db=db
        )

        deliv = Delivery(
            delivery_code=code,
            cargo_name=payload.cargo_name,
            cargo_type=payload.cargo_type,
            cargo_category=payload.cargo_category,
            priority=payload.priority,
            origin_city=payload.origin_city,
            destination_city=payload.destination_city,
            assigned_vehicle_id=payload.assigned_vehicle_id,
            driver_name=payload.driver_name,
            status="CREATED" if not payload.assigned_vehicle_id else "ASSIGNED",
            original_eta=eta_breakdown.base_eta,
            revised_eta=eta_breakdown.predicted_eta,
            estimated_delay_mins=eta_breakdown.total_estimated_delay_mins,
            delay_reason=eta_breakdown.primary_delay_reason,
            quantity_description=payload.quantity_description,
            temperature_controlled=payload.temperature_controlled,
            route_risk_score=18.0,
            route_risk_category="LOW",
            active_route_path=json.dumps(route.get("waypoints", [])),
            alternate_route_path=json.dumps(route.get("alternate_waypoints", []))
        )
        db.add(deliv)
        db.commit()
        db.refresh(deliv)

        db.add(AuditLog(
            user_email="dispatcher@linkx8.in",
            action="CREATE_COMMODITY_CONSIGNMENT",
            resource="Delivery",
            details=f"Created {payload.cargo_category} consignment {deliv.delivery_code} ({deliv.cargo_name})"
        ))
        db.commit()
        return deliv

    @classmethod
    def update_lifecycle_status(
        cls,
        delivery_id: int,
        payload: CommodityStatusUpdateIn,
        db: Session
    ) -> Delivery:
        """Updates consignment state and triggers dynamic ETA recalculation."""
        deliv = db.query(Delivery).filter(Delivery.id == delivery_id).first()
        if not deliv:
            raise ValueError(f"Delivery with ID {delivery_id} not found")

        deliv.status = payload.status.upper()

        if payload.current_lat is not None and payload.current_lng is not None:
            ETAService.update_delivery_live_eta(deliv, payload.current_lat, payload.current_lng, db)

        db.add(AuditLog(
            user_email="dispatcher@linkx8.in",
            action="UPDATE_COMMODITY_STATUS",
            resource="Delivery",
            details=f"Updated status of {deliv.delivery_code} to {deliv.status}. Note: {payload.location_note or 'None'}"
        ))
        db.commit()
        db.refresh(deliv)
        return deliv

    @classmethod
    def complete_delivery(
        cls,
        delivery_id: int,
        payload: CommodityDeliveryCompleteIn,
        db: Session
    ) -> Delivery:
        """Finalizes delivery, records completion timestamp and actual transit duration."""
        deliv = db.query(Delivery).filter(Delivery.id == delivery_id).first()
        if not deliv:
            raise ValueError(f"Delivery with ID {delivery_id} not found")

        now = datetime.utcnow()
        duration_hours = round((now - deliv.created_at).total_seconds() / 3600.0, 2)

        deliv.status = "DELIVERED"
        deliv.completed_at = now
        deliv.actual_delivery_duration_hours = max(0.5, duration_hours)

        db.add(AuditLog(
            user_email="consignee@linkx8.in",
            action="DELIVERY_COMPLETED",
            resource="Delivery",
            details=f"Consignment {deliv.delivery_code} delivered successfully to {payload.received_by}. Notes: {payload.completion_notes}"
        ))
        db.commit()
        db.refresh(deliv)
        return deliv

    @classmethod
    def get_overview(cls, db: Session) -> EssentialCommoditiesOverviewOut:
        """Returns regional aggregated tracking statistics across the 4 commodity categories."""
        all_delivs = db.query(Delivery).all()
        categories_map = {c: [] for c in COMMODITY_CATEGORIES}

        for d in all_delivs:
            cat = d.cargo_category if d.cargo_category in categories_map else "Medicines"
            categories_map[cat].append(d)

        cat_summary_items = []
        for cat_name, delivs in categories_map.items():
            in_transit = len([d for d in delivs if d.status in ["IN_TRANSIT", "DISPATCHED"]])
            delayed = len([d for d in delivs if d.status == "DELAYED_AT_RISK" or d.estimated_delay_mins > 30])
            delivered = len([d for d in delivs if d.status in ["DELIVERED", "Completed"]])
            avg_delay = sum(d.estimated_delay_mins for d in delivs) / max(1, len(delivs))
            
            # Find highest priority
            priors = [d.priority for d in delivs]
            highest = "EMERGENCY" if "EMERGENCY" in priors else ("URGENT" if "URGENT" in priors else "NORMAL")

            cat_summary_items.append(CommodityCategorySummaryItem(
                category=cat_name,
                total_consignments=len(delivs),
                in_transit_count=in_transit,
                delayed_count=delayed,
                delivered_count=delivered,
                average_delay_mins=round(avg_delay, 1),
                highest_priority_active=highest
            ))

        active_count = len([d for d in all_delivs if d.status not in ["DELIVERED", "Completed"]])

        return EssentialCommoditiesOverviewOut(
            total_active_essential_deliveries=active_count,
            medicines_count=len(categories_map["Medicines"]),
            food_supplies_count=len(categories_map["Food supplies"]),
            construction_materials_count=len(categories_map["Construction materials"]),
            agricultural_produce_count=len(categories_map["Agricultural produce"]),
            categories_summary=cat_summary_items,
            generated_at=datetime.utcnow()
        )

    @classmethod
    def seed_demo_scenarios(cls, db: Session) -> List[Delivery]:
        """Explicitly seeds the 4 verified SIH essential commodity scenarios."""
        v1 = db.query(Vehicle).first()
        vid = v1.id if v1 else None

        demos = [
            CommodityConsignmentCreateIn(
                cargo_name="Critical Insulin & Typhoid Vaccines",
                cargo_category="Medicines",
                cargo_type="Cold-Chain Pharmaceuticals",
                priority="EMERGENCY",
                origin_city="Guwahati",
                destination_city="Imphal",
                assigned_vehicle_id=vid,
                driver_name="Ramesh Sharma",
                quantity_description="2,000 refrigerated doses (2°C - 8°C)",
                temperature_controlled=True
            ),
            CommodityConsignmentCreateIn(
                cargo_name="PDS Essential Rice & Pulses Bulk Consignment",
                cargo_category="Food supplies",
                cargo_type="Essential Food Grains",
                priority="URGENT",
                origin_city="Guwahati",
                destination_city="Silchar",
                assigned_vehicle_id=vid,
                driver_name="Bikram Gogoi",
                quantity_description="20 Metric Tons fortified rice",
                temperature_controlled=False
            ),
            CommodityConsignmentCreateIn(
                cargo_name="Bailey Bridge Structural Steel & Cement",
                cargo_category="Construction materials",
                cargo_type="Emergency Bridge Repair Hardware",
                priority="HIGH",
                origin_city="Silchar",
                destination_city="Aizawl",
                assigned_vehicle_id=vid,
                driver_name="Tenzing Lepcha",
                quantity_description="15 Tons Pre-fabricated Galvanized Girders",
                temperature_controlled=False
            ),
            CommodityConsignmentCreateIn(
                cargo_name="Organic Hill Ginger & Fresh Horticultural Produce",
                cargo_category="Agricultural produce",
                cargo_type="Fresh Perishable Produce",
                priority="URGENT",
                origin_city="Shillong",
                destination_city="Guwahati",
                assigned_vehicle_id=vid,
                driver_name="Lalthangliana Sailo",
                quantity_description="8 Metric Tons Fresh Spices",
                temperature_controlled=False
            )
        ]

        created = []
        for item in demos:
            d = cls.create_consignment(item, db)
            created.append(d)
        return created
