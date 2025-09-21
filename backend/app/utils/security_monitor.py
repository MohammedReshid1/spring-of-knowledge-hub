"""
Real-time Security Monitoring System
Monitors audit logs for suspicious patterns and triggers alerts
"""

import asyncio
import json
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Set
from enum import Enum
from dataclasses import dataclass
from collections import defaultdict, deque
import statistics

from .audit_logger import get_audit_logger, AuditAction, AuditSeverity
from .rbac import Role

# Configure security monitor logger
security_logger = logging.getLogger("security_monitor")
security_logger.setLevel(logging.INFO)

class ThreatLevel(str, Enum):
    """Threat severity levels"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

class AlertType(str, Enum):
    """Types of security alerts"""
    BRUTE_FORCE = "brute_force_attack"
    PRIVILEGE_ESCALATION = "privilege_escalation_attempt"
    SUSPICIOUS_ACCESS = "suspicious_access_pattern"
    DATA_BREACH = "potential_data_breach"
    ACCOUNT_TAKEOVER = "account_takeover_attempt"
    CROSS_BRANCH_VIOLATION = "cross_branch_access_violation"
    PERMISSION_ABUSE = "permission_abuse"
    UNUSUAL_ACTIVITY = "unusual_activity_pattern"
    REPEATED_FAILURES = "repeated_authorization_failures"
    BULK_DATA_ACCESS = "bulk_data_access_attempt"

@dataclass
class SecurityAlert:
    """Security alert data structure"""
    alert_id: str
    alert_type: AlertType
    threat_level: ThreatLevel
    title: str
    description: str
    user_id: Optional[str]
    user_email: Optional[str]
    user_role: Optional[str]
    ip_address: Optional[str]
    affected_resources: List[str]
    evidence: Dict
    timestamp: datetime
    resolved: bool = False
    resolution_notes: Optional[str] = None

class SecurityPatternDetector:
    """
    Detects suspicious security patterns from audit logs
    """
    
    def __init__(self):
        self.user_activity_windows = defaultdict(lambda: deque(maxlen=100))
        self.ip_activity_windows = defaultdict(lambda: deque(maxlen=100))
        self.failed_attempts = defaultdict(lambda: deque(maxlen=50))
        self.bulk_access_tracking = defaultdict(lambda: deque(maxlen=200))
        
        # Thresholds for pattern detection
        self.BRUTE_FORCE_THRESHOLD = 5  # Failed attempts in window
        self.BRUTE_FORCE_WINDOW = 300   # 5 minutes
        self.BULK_ACCESS_THRESHOLD = 20  # Records accessed in window
        self.BULK_ACCESS_WINDOW = 60     # 1 minute
        self.UNUSUAL_ACTIVITY_THRESHOLD = 3  # Standard deviations
        self.CROSS_BRANCH_THRESHOLD = 3  # Cross-branch attempts in window
    
    async def analyze_event(self, event: Dict) -> List[SecurityAlert]:
        """
        Analyze a single audit event for suspicious patterns
        """
        alerts = []
        
        try:
            # Extract event data
            user_id = event.get("user", {}).get("id")
            user_email = event.get("user", {}).get("email")
            user_role = event.get("user", {}).get("role")
            ip_address = event.get("metadata", {}).get("ip_address")
            action = event.get("action")
            success = event.get("success", True)
            timestamp = event.get("timestamp", datetime.utcnow())
            
            # Track user activity
            if user_id:
                self.user_activity_windows[user_id].append({
                    "timestamp": timestamp,
                    "action": action,
                    "success": success,
                    "ip": ip_address
                })
            
            # Track IP activity
            if ip_address:
                self.ip_activity_windows[ip_address].append({
                    "timestamp": timestamp,
                    "user_id": user_id,
                    "action": action,
                    "success": success
                })
            
            # Check for brute force attacks
            if not success and action in ["login_failed", "permission_denied"]:
                alerts.extend(await self._detect_brute_force(
                    user_email or user_id, ip_address, timestamp
                ))
            
            # Check for privilege escalation attempts
            if action == "permission_denied" and user_role:
                alerts.extend(await self._detect_privilege_escalation(
                    user_id, user_role, event, timestamp
                ))
            
            # Check for cross-branch access violations
            if "cross_branch" in event.get("details", {}).get("event_type", ""):
                alerts.extend(await self._detect_cross_branch_violations(
                    user_id, user_role, event, timestamp
                ))
            
            # Check for bulk data access
            if action == "read" and success:
                alerts.extend(await self._detect_bulk_data_access(
                    user_id, event, timestamp
                ))
            
            # Check for unusual activity patterns
            if user_id and len(self.user_activity_windows[user_id]) >= 10:
                alerts.extend(await self._detect_unusual_activity(
                    user_id, user_role, timestamp
                ))
            
            # Check for repeated authorization failures
            alerts.extend(await self._detect_repeated_failures(
                user_id, ip_address, timestamp
            ))
            
        except Exception as e:
            security_logger.error(f"Error analyzing security event: {e}")
        
        return alerts
    
    async def _detect_brute_force(
        self, 
        identifier: str, 
        ip_address: str, 
        timestamp: datetime
    ) -> List[SecurityAlert]:
        """Detect brute force attack patterns"""
        
        alerts = []
        
        if not identifier:
            return alerts
        
        # Track failed attempts by identifier
        self.failed_attempts[identifier].append(timestamp)
        
        # Check if threshold exceeded in time window
        cutoff = timestamp - timedelta(seconds=self.BRUTE_FORCE_WINDOW)
        recent_failures = [
            t for t in self.failed_attempts[identifier] 
            if t > cutoff
        ]
        
        if len(recent_failures) >= self.BRUTE_FORCE_THRESHOLD:
            alert = SecurityAlert(
                alert_id=f"brute_force_{identifier}_{int(timestamp.timestamp())}",
                alert_type=AlertType.BRUTE_FORCE,
                threat_level=ThreatLevel.HIGH,
                title="Brute Force Attack Detected",
                description=f"Multiple failed login attempts detected for {identifier}",
                user_id=None,
                user_email=identifier if "@" in identifier else None,
                user_role=None,
                ip_address=ip_address,
                affected_resources=[identifier],
                evidence={
                    "failed_attempts": len(recent_failures),
                    "time_window": f"{self.BRUTE_FORCE_WINDOW} seconds",
                    "attempts_timestamps": [t.isoformat() for t in recent_failures[-10:]]
                },
                timestamp=timestamp
            )
            alerts.append(alert)
        
        return alerts
    
    async def _detect_privilege_escalation(
        self,
        user_id: str,
        user_role: str,
        event: Dict,
        timestamp: datetime
    ) -> List[SecurityAlert]:
        """Detect privilege escalation attempts"""
        
        alerts = []
        
        if not user_id or not user_role:
            return alerts
        
        # Check if lower privilege role is attempting high-privilege actions
        high_privilege_actions = [
            "DELETE_STUDENT", "MANAGE_BRANCHES", "SYSTEM_SETTINGS",
            "DELETE_USER", "BACKUP_RESTORE"
        ]
        
        low_privilege_roles = [Role.STUDENT, Role.PARENT, Role.TEACHER]
        
        required_permission = event.get("details", {}).get("required_permission", "")
        
        if (user_role in [r.value for r in low_privilege_roles] and 
            any(action in required_permission for action in high_privilege_actions)):
            
            alert = SecurityAlert(
                alert_id=f"privilege_escalation_{user_id}_{int(timestamp.timestamp())}",
                alert_type=AlertType.PRIVILEGE_ESCALATION,
                threat_level=ThreatLevel.CRITICAL,
                title="Privilege Escalation Attempt",
                description=f"User {user_id} with role {user_role} attempted high-privilege action",
                user_id=user_id,
                user_email=event.get("user", {}).get("email"),
                user_role=user_role,
                ip_address=event.get("metadata", {}).get("ip_address"),
                affected_resources=[event.get("resource", {}).get("type", "unknown")],
                evidence={
                    "attempted_permission": required_permission,
                    "user_role": user_role,
                    "endpoint": event.get("details", {}).get("endpoint"),
                    "action": event.get("action")
                },
                timestamp=timestamp
            )
            alerts.append(alert)
        
        return alerts
    
    async def _detect_cross_branch_violations(
        self,
        user_id: str,
        user_role: str,
        event: Dict,
        timestamp: datetime
    ) -> List[SecurityAlert]:
        """Detect cross-branch access violations"""
        
        alerts = []
        
        if not user_id:
            return alerts
        
        # Count recent cross-branch attempts
        recent_violations = []
        for activity in list(self.user_activity_windows[user_id])[-20:]:
            if "cross_branch" in str(activity.get("action", "")):
                recent_violations.append(activity)
        
        if len(recent_violations) >= self.CROSS_BRANCH_THRESHOLD:
            alert = SecurityAlert(
                alert_id=f"cross_branch_{user_id}_{int(timestamp.timestamp())}",
                alert_type=AlertType.CROSS_BRANCH_VIOLATION,
                threat_level=ThreatLevel.HIGH,
                title="Cross-Branch Access Violation",
                description=f"Multiple cross-branch access attempts by user {user_id}",
                user_id=user_id,
                user_email=event.get("user", {}).get("email"),
                user_role=user_role,
                ip_address=event.get("metadata", {}).get("ip_address"),
                affected_resources=["branch_isolation"],
                evidence={
                    "violation_count": len(recent_violations),
                    "user_branch": event.get("details", {}).get("user_branch"),
                    "attempted_branches": list(set([
                        v.get("attempted_branch") for v in recent_violations 
                        if v.get("attempted_branch")
                    ]))
                },
                timestamp=timestamp
            )
            alerts.append(alert)
        
        return alerts
    
    async def _detect_bulk_data_access(
        self,
        user_id: str,
        event: Dict,
        timestamp: datetime
    ) -> List[SecurityAlert]:
        """Detect bulk data access attempts"""
        
        alerts = []
        
        if not user_id:
            return alerts
        
        # Track data access by user
        self.bulk_access_tracking[user_id].append({
            "timestamp": timestamp,
            "resource_type": event.get("resource", {}).get("type"),
            "resource_id": event.get("resource", {}).get("id")
        })
        
        # Check access rate in recent window
        cutoff = timestamp - timedelta(seconds=self.BULK_ACCESS_WINDOW)
        recent_access = [
            access for access in self.bulk_access_tracking[user_id]
            if access["timestamp"] > cutoff
        ]
        
        if len(recent_access) >= self.BULK_ACCESS_THRESHOLD:
            # Check if accessing diverse resources (potential data scraping)
            unique_resources = len(set([
                f"{access['resource_type']}_{access['resource_id']}"
                for access in recent_access
                if access['resource_type'] and access['resource_id']
            ]))
            
            if unique_resources >= 10:  # Accessing many different records
                alert = SecurityAlert(
                    alert_id=f"bulk_access_{user_id}_{int(timestamp.timestamp())}",
                    alert_type=AlertType.BULK_DATA_ACCESS,
                    threat_level=ThreatLevel.MEDIUM,
                    title="Bulk Data Access Detected",
                    description=f"User {user_id} accessed {len(recent_access)} records in {self.BULK_ACCESS_WINDOW} seconds",
                    user_id=user_id,
                    user_email=event.get("user", {}).get("email"),
                    user_role=event.get("user", {}).get("role"),
                    ip_address=event.get("metadata", {}).get("ip_address"),
                    affected_resources=[f"bulk_data_access_{len(recent_access)}_records"],
                    evidence={
                        "access_count": len(recent_access),
                        "unique_resources": unique_resources,
                        "time_window": f"{self.BULK_ACCESS_WINDOW} seconds",
                        "resource_types": list(set([
                            access["resource_type"] for access in recent_access
                            if access["resource_type"]
                        ]))
                    },
                    timestamp=timestamp
                )
                alerts.append(alert)
        
        return alerts
    
    async def _detect_unusual_activity(
        self,
        user_id: str,
        user_role: str,
        timestamp: datetime
    ) -> List[SecurityAlert]:
        """Detect unusual activity patterns"""
        
        alerts = []
        
        user_activities = list(self.user_activity_windows[user_id])
        if len(user_activities) < 20:  # Need enough data
            return alerts
        
        # Calculate activity rate (actions per hour)
        activity_rates = []
        current_time = timestamp
        
        for i in range(24):  # Last 24 hours
            hour_start = current_time - timedelta(hours=i+1)
            hour_end = current_time - timedelta(hours=i)
            
            hour_activities = [
                a for a in user_activities
                if hour_start <= a["timestamp"] <= hour_end
            ]
            activity_rates.append(len(hour_activities))
        
        if len(activity_rates) >= 5:
            # Check if current activity is unusually high
            avg_rate = statistics.mean(activity_rates[1:])  # Exclude current hour
            std_rate = statistics.stdev(activity_rates[1:]) if len(activity_rates) > 2 else 0
            current_rate = activity_rates[0]
            
            if std_rate > 0 and current_rate > avg_rate + (self.UNUSUAL_ACTIVITY_THRESHOLD * std_rate):
                alert = SecurityAlert(
                    alert_id=f"unusual_activity_{user_id}_{int(timestamp.timestamp())}",
                    alert_type=AlertType.UNUSUAL_ACTIVITY,
                    threat_level=ThreatLevel.MEDIUM,
                    title="Unusual Activity Pattern",
                    description=f"User {user_id} showing unusual activity levels",
                    user_id=user_id,
                    user_email=None,
                    user_role=user_role,
                    ip_address=None,
                    affected_resources=[f"user_activity_{user_id}"],
                    evidence={
                        "current_rate": current_rate,
                        "average_rate": round(avg_rate, 2),
                        "standard_deviation": round(std_rate, 2),
                        "threshold_exceeded": round(current_rate - avg_rate, 2)
                    },
                    timestamp=timestamp
                )
                alerts.append(alert)
        
        return alerts
    
    async def _detect_repeated_failures(
        self,
        user_id: str,
        ip_address: str,
        timestamp: datetime
    ) -> List[SecurityAlert]:
        """Detect repeated authorization failures"""
        
        alerts = []
        
        if not user_id:
            return alerts
        
        # Count recent permission denials for user
        user_activities = list(self.user_activity_windows[user_id])
        recent_failures = [
            a for a in user_activities[-20:]  # Last 20 activities
            if not a.get("success", True) and a.get("action") == "permission_denied"
        ]
        
        if len(recent_failures) >= 5:
            alert = SecurityAlert(
                alert_id=f"repeated_failures_{user_id}_{int(timestamp.timestamp())}",
                alert_type=AlertType.REPEATED_FAILURES,
                threat_level=ThreatLevel.MEDIUM,
                title="Repeated Authorization Failures",
                description=f"User {user_id} has {len(recent_failures)} recent permission denials",
                user_id=user_id,
                user_email=None,
                user_role=None,
                ip_address=ip_address,
                affected_resources=[f"authorization_failures_{user_id}"],
                evidence={
                    "failure_count": len(recent_failures),
                    "recent_activities": len(user_activities),
                    "failure_rate": round(len(recent_failures) / len(user_activities), 2) if user_activities else 0
                },
                timestamp=timestamp
            )
            alerts.append(alert)
        
        return alerts

class SecurityMonitor:
    """
    Main security monitoring system
    """
    
    def __init__(self):
        self.pattern_detector = SecurityPatternDetector()
        self.active_alerts = {}
        self.alert_history = deque(maxlen=1000)
        self.monitoring_active = False
        self.audit_logger = None
        
    async def initialize(self):
        """Initialize the security monitor"""
        self.audit_logger = get_audit_logger()
        await self.audit_logger.initialize()
        security_logger.info("Security monitor initialized")
    
    async def start_monitoring(self):
        """Start real-time security monitoring"""
        if self.monitoring_active:
            return
        
        self.monitoring_active = True
        security_logger.info("Starting real-time security monitoring")
        
        # Start background task for monitoring
        asyncio.create_task(self._monitor_loop())
    
    async def stop_monitoring(self):
        """Stop security monitoring"""
        self.monitoring_active = False
        security_logger.info("Security monitoring stopped")
    
    async def _monitor_loop(self):
        """Main monitoring loop"""
        while self.monitoring_active:
            try:
                # Get recent security events from audit logs
                recent_events = await self.audit_logger.get_security_events(hours=1)
                
                for event in recent_events:
                    # Analyze each event for suspicious patterns
                    alerts = await self.pattern_detector.analyze_event(event)
                    
                    # Process generated alerts
                    for alert in alerts:
                        await self._process_alert(alert)
                
                # Wait before next monitoring cycle
                await asyncio.sleep(30)  # Check every 30 seconds
                
            except Exception as e:
                security_logger.error(f"Error in monitoring loop: {e}")
                await asyncio.sleep(60)  # Wait longer if error
    
    async def _process_alert(self, alert: SecurityAlert):
        """Process a security alert"""
        
        # Check if this is a duplicate alert
        if alert.alert_id in self.active_alerts:
            return
        
        # Add to active alerts
        self.active_alerts[alert.alert_id] = alert
        self.alert_history.append(alert)
        
        # Log the alert
        security_logger.warning(f"Security Alert: {alert.title} - {alert.description}")
        
        # Send alert through various channels
        await self._send_alert_notifications(alert)
        
        # Auto-resolve certain types of alerts after time
        if alert.threat_level in [ThreatLevel.LOW, ThreatLevel.MEDIUM]:
            asyncio.create_task(self._auto_resolve_alert(alert.alert_id, hours=24))
    
    async def _send_alert_notifications(self, alert: SecurityAlert):
        """Send alert notifications through multiple channels"""
        
        try:
            # Log to audit system
            if self.audit_logger:
                await self.audit_logger.log_security_event(
                    event_type=alert.alert_type.value,
                    user_id=alert.user_id,
                    details={
                        "alert_id": alert.alert_id,
                        "threat_level": alert.threat_level.value,
                        "title": alert.title,
                        "description": alert.description,
                        "evidence": alert.evidence
                    },
                    ip_address=alert.ip_address,
                    severity=AuditSeverity.CRITICAL if alert.threat_level == ThreatLevel.CRITICAL else AuditSeverity.WARNING
                )
            
            # TODO: Integrate with notification system
            # await self._send_email_alert(alert)
            # await self._send_slack_alert(alert)
            # await self._send_dashboard_notification(alert)
            
        except Exception as e:
            security_logger.error(f"Error sending alert notifications: {e}")
    
    async def _auto_resolve_alert(self, alert_id: str, hours: int = 24):
        """Auto-resolve alert after specified time"""
        await asyncio.sleep(hours * 3600)  # Convert hours to seconds
        
        if alert_id in self.active_alerts:
            alert = self.active_alerts[alert_id]
            alert.resolved = True
            alert.resolution_notes = f"Auto-resolved after {hours} hours"
            del self.active_alerts[alert_id]
            
            security_logger.info(f"Auto-resolved alert: {alert_id}")
    
    async def get_active_alerts(self, threat_level: Optional[ThreatLevel] = None) -> List[SecurityAlert]:
        """Get currently active security alerts"""
        alerts = list(self.active_alerts.values())
        
        if threat_level:
            alerts = [a for a in alerts if a.threat_level == threat_level]
        
        return sorted(alerts, key=lambda a: a.timestamp, reverse=True)
    
    async def get_alert_history(self, hours: int = 24) -> List[SecurityAlert]:
        """Get alert history for specified time period"""
        cutoff = datetime.utcnow() - timedelta(hours=hours)
        
        return [
            alert for alert in self.alert_history
            if alert.timestamp > cutoff
        ]
    
    async def resolve_alert(self, alert_id: str, resolution_notes: str = ""):
        """Manually resolve a security alert"""
        if alert_id in self.active_alerts:
            alert = self.active_alerts[alert_id]
            alert.resolved = True
            alert.resolution_notes = resolution_notes
            del self.active_alerts[alert_id]
            
            security_logger.info(f"Manually resolved alert: {alert_id}")
            return True
        
        return False
    
    async def get_security_metrics(self) -> Dict:
        """Get security monitoring metrics"""
        current_time = datetime.utcnow()
        
        # Count alerts by type and threat level
        alert_counts = defaultdict(int)
        threat_counts = defaultdict(int)
        
        for alert in self.alert_history:
            if current_time - alert.timestamp <= timedelta(hours=24):
                alert_counts[alert.alert_type.value] += 1
                threat_counts[alert.threat_level.value] += 1
        
        return {
            "active_alerts": len(self.active_alerts),
            "alerts_24h": len([
                a for a in self.alert_history
                if current_time - a.timestamp <= timedelta(hours=24)
            ]),
            "alert_types": dict(alert_counts),
            "threat_levels": dict(threat_counts),
            "monitoring_active": self.monitoring_active
        }

# Global security monitor instance
_security_monitor_instance = None

def get_security_monitor() -> SecurityMonitor:
    """Get or create the global security monitor instance"""
    global _security_monitor_instance
    if _security_monitor_instance is None:
        _security_monitor_instance = SecurityMonitor()
    return _security_monitor_instance

# Export all components
__all__ = [
    'SecurityMonitor',
    'SecurityPatternDetector',
    'SecurityAlert',
    'AlertType',
    'ThreatLevel',
    'get_security_monitor'
]