"""
Financial Analytics and Reporting Service
Provides comprehensive financial insights and analytics
"""
from typing import List, Dict, Optional, Any
from datetime import datetime, date, timedelta
from bson import ObjectId
from ..models.payment import (
    PaymentStatus, PaymentMethod, FeeType,
    FinancialSummary, PaymentAnalytics, Currency
)
import asyncio
from collections import defaultdict
import pandas as pd
import numpy as np

class FinancialAnalyticsService:
    """Service for financial analytics and reporting"""
    
    def __init__(self, db):
        self.db = db
    
    async def generate_financial_summary(
        self,
        branch_id: str,
        start_date: date,
        end_date: date,
        currency: Currency = Currency.USD
    ) -> FinancialSummary:
        """
        Generate comprehensive financial summary
        """
        # Convert dates to datetime for MongoDB queries
        start_datetime = datetime.combine(start_date, datetime.min.time())
        end_datetime = datetime.combine(end_date, datetime.max.time())
        
        # Build base query for branch filtering
        base_query = {}
        if branch_id != "all":
            base_query["branch_id"] = branch_id

        # Get payment transactions
        payment_pipeline = [
            {
                "$match": {
                    **base_query,
                    "payment_date": {
                        "$gte": start_datetime,
                        "$lte": end_datetime
                    },
                    "currency": currency
                }
            },
            {
                "$group": {
                    "_id": "$status",
                    "total_amount": {"$sum": "$amount"},
                    "count": {"$sum": 1}
                }
            }
        ]
        
        payment_results = await self.db.payment_transactions.aggregate(payment_pipeline).to_list(length=None)
        
        # Process payment results
        payment_summary = {
            "paid": {"amount": 0, "count": 0},
            "pending": {"amount": 0, "count": 0},
            "failed": {"amount": 0, "count": 0}
        }

        for result in payment_results:
            status = result["_id"]
            if status in payment_summary:
                payment_summary[status] = {
                    "amount": result["total_amount"],
                    "count": result["count"]
                }
        
        # Get payment method breakdown
        method_pipeline = [
            {
                "$match": {
                    **base_query,
                    "payment_date": {
                        "$gte": start_datetime,
                        "$lte": end_datetime
                    },
                    "status": "paid",
                    "currency": currency
                }
            },
            {
                "$group": {
                    "_id": "$payment_method",
                    "total_amount": {"$sum": "$amount"},
                    "count": {"$sum": 1}
                }
            }
        ]
        
        method_results = await self.db.payment_transactions.aggregate(method_pipeline).to_list(length=None)
        
        # Get fee type breakdown
        fee_type_base_query = {}
        if branch_id != "all":
            fee_type_base_query["branch_id"] = branch_id

        fee_type_pipeline = [
            {
                "$match": {
                    **fee_type_base_query,
                    "created_at": {
                        "$gte": start_datetime,
                        "$lte": end_datetime
                    }
                }
            },
            {
                "$lookup": {
                    "from": "fee_templates",
                    "localField": "fee_template_id",
                    "foreignField": "_id",
                    "as": "template"
                }
            },
            {
                "$unwind": "$template"
            },
            {
                "$group": {
                    "_id": "$template.fee_type",
                    "total_amount": {"$sum": "$total_amount"},
                    "paid_amount": {"$sum": "$paid_amount"}
                }
            }
        ]
        
        fee_type_results = await self.db.fee_structures.aggregate(fee_type_pipeline).to_list(length=None)
        
        # Calculate revenue by fee type
        tuition_revenue = 0
        other_revenue = 0
        
        for result in fee_type_results:
            if result["_id"] == FeeType.TUITION:
                tuition_revenue = result["paid_amount"]
            else:
                other_revenue += result["paid_amount"]
        
        # Get outstanding amounts
        outstanding_base_query = {}
        if branch_id != "all":
            outstanding_base_query["branch_id"] = branch_id

        outstanding_pipeline = [
            {
                "$match": {
                    **outstanding_base_query,
                    "balance": {"$gt": 0},
                    "is_active": True
                }
            },
            {
                "$group": {
                    "_id": None,
                    "total_outstanding": {"$sum": "$balance"},
                    "count": {"$sum": 1}
                }
            }
        ]
        
        outstanding_result = await self.db.fee_structures.aggregate(outstanding_pipeline).to_list(length=1)
        total_outstanding = outstanding_result[0]["total_outstanding"] if outstanding_result else 0
        
        # Get overdue amounts
        overdue_pipeline = [
            {
                "$match": {
                    **outstanding_base_query,
                    "balance": {"$gt": 0},
                    "due_date": {"$lt": datetime.now()},
                    "is_active": True
                }
            },
            {
                "$group": {
                    "_id": None,
                    "overdue_amount": {"$sum": "$balance"},
                    "count": {"$sum": 1}
                }
            }
        ]
        
        overdue_result = await self.db.fee_structures.aggregate(overdue_pipeline).to_list(length=1)
        overdue_amount = overdue_result[0]["overdue_amount"] if overdue_result else 0
        
        # Get refunds
        refund_pipeline = [
            {
                "$match": {
                    **base_query,
                    "created_at": {
                        "$gte": start_datetime,
                        "$lte": end_datetime
                    },
                    "status": "refunded"
                }
            },
            {
                "$group": {
                    "_id": None,
                    "total_refunds": {"$sum": "$refund_amount"},
                    "count": {"$sum": 1}
                }
            }
        ]
        
        refund_result = await self.db.refunds.aggregate(refund_pipeline).to_list(length=1)
        total_refunds = refund_result[0]["total_refunds"] if refund_result else 0
        refund_count = refund_result[0]["count"] if refund_result else 0
        
        # Get student payment statistics
        student_pipeline = [
            {
                "$match": {
                    **outstanding_base_query,
                    "is_active": True
                }
            },
            {
                "$group": {
                    "_id": "$student_id",
                    "total_amount": {"$sum": "$total_amount"},
                    "paid_amount": {"$sum": "$paid_amount"},
                    "balance": {"$sum": "$balance"}
                }
            },
            {
                "$project": {
                    "status": {
                        "$cond": [
                            {"$eq": ["$balance", 0]},
                            "paid",
                            {
                                "$cond": [
                                    {"$gt": ["$paid_amount", 0]},
                                    "partially_paid",
                                    "unpaid"
                                ]
                            }
                        ]
                    }
                }
            },
            {
                "$group": {
                    "_id": "$status",
                    "count": {"$sum": 1}
                }
            }
        ]
        
        student_results = await self.db.fee_structures.aggregate(student_pipeline).to_list(length=None)
        
        student_stats = {
            "paid": 0,
            "partially_paid": 0,
            "unpaid": 0
        }
        
        for result in student_results:
            if result["_id"] in student_stats:
                student_stats[result["_id"]] = result["count"]
        
        # Calculate collection rate
        total_revenue = tuition_revenue + other_revenue
        total_billed = total_revenue + total_outstanding
        collection_rate = (total_revenue / total_billed * 100) if total_billed > 0 else 0
        
        # Calculate average payment
        average_payment = (
            payment_summary["paid"]["amount"] /
            payment_summary["paid"]["count"]
        ) if payment_summary["paid"]["count"] > 0 else 0
        
        # Compile financial summary
        summary = FinancialSummary(
            branch_id=branch_id,
            period_start=start_date,
            period_end=end_date,
            currency=currency,
            total_revenue=total_revenue,
            tuition_revenue=tuition_revenue,
            other_revenue=other_revenue,
            total_collected=payment_summary["paid"]["amount"],
            cash_collected=sum(r["total_amount"] for r in method_results if r["_id"] == PaymentMethod.CASH.value),
            online_collected=sum(r["total_amount"] for r in method_results if r["_id"] in [PaymentMethod.CREDIT_CARD.value, PaymentMethod.ONLINE_PAYMENT.value]),
            other_collected=sum(r["total_amount"] for r in method_results if r["_id"] not in [PaymentMethod.CASH.value, PaymentMethod.CREDIT_CARD.value, PaymentMethod.ONLINE_PAYMENT.value]),
            total_outstanding=total_outstanding,
            overdue_amount=overdue_amount,
            total_transactions=sum(payment_summary[s]["count"] for s in payment_summary),
            successful_transactions=payment_summary["paid"]["count"],
            failed_transactions=payment_summary["failed"]["count"],
            pending_transactions=payment_summary["pending"]["count"],
            total_refunds=total_refunds,
            refund_count=refund_count,
            total_students=sum(student_stats.values()),
            paid_students=student_stats["paid"],
            partially_paid_students=student_stats["partially_paid"],
            unpaid_students=student_stats["unpaid"],
            average_payment=average_payment,
            collection_rate=collection_rate,
            generated_at=datetime.utcnow()
        )
        
        return summary
    
    async def generate_payment_analytics(
        self,
        branch_id: str,
        days: int = 30
    ) -> PaymentAnalytics:
        """
        Generate detailed payment analytics
        """
        end_date = datetime.now().date()
        start_date = end_date - timedelta(days=days)
        
        # Build base query for branch filtering
        base_query = {}
        if branch_id != "all":
            base_query["branch_id"] = branch_id

        # Daily collections
        daily_pipeline = [
            {
                "$match": {
                    **base_query,
                    "payment_date": {
                        "$gte": datetime.combine(start_date, datetime.min.time()),
                        "$lte": datetime.combine(end_date, datetime.max.time())
                    },
                    "status": "paid"
                }
            },
            {
                "$group": {
                    "_id": {
                        "$dateToString": {
                            "format": "%Y-%m-%d",
                            "date": "$payment_date"
                        }
                    },
                    "amount": {"$sum": "$amount"},
                    "count": {"$sum": 1}
                }
            },
            {
                "$sort": {"_id": 1}
            }
        ]
        
        daily_results = await self.db.payment_transactions.aggregate(daily_pipeline).to_list(length=None)
        
        # Monthly collections
        monthly_pipeline = [
            {
                "$match": {
                    **base_query,
                    "payment_date": {
                        "$gte": datetime.combine(start_date - timedelta(days=365), datetime.min.time()),
                        "$lte": datetime.combine(end_date, datetime.max.time())
                    },
                    "status": "paid"
                }
            },
            {
                "$group": {
                    "_id": {
                        "$dateToString": {
                            "format": "%Y-%m",
                            "date": "$payment_date"
                        }
                    },
                    "amount": {"$sum": "$amount"},
                    "count": {"$sum": 1}
                }
            },
            {
                "$sort": {"_id": 1}
            }
        ]
        
        monthly_results = await self.db.payment_transactions.aggregate(monthly_pipeline).to_list(length=None)
        
        # Payment method distribution
        method_dist_pipeline = [
            {
                "$match": {
                    **base_query,
                    "payment_date": {
                        "$gte": datetime.combine(start_date, datetime.min.time()),
                        "$lte": datetime.combine(end_date, datetime.max.time())
                    },
                    "status": "paid"
                }
            },
            {
                "$group": {
                    "_id": "$payment_method",
                    "amount": {"$sum": "$amount"}
                }
            }
        ]
        
        method_dist_results = await self.db.payment_transactions.aggregate(method_dist_pipeline).to_list(length=None)
        method_distribution = {r["_id"]: r["amount"] for r in method_dist_results}
        
        # Fee type distribution
        fee_type_base_query = {}
        if branch_id != "all":
            fee_type_base_query["branch_id"] = branch_id

        fee_type_dist_pipeline = [
            {
                "$match": {
                    **fee_type_base_query,
                    "created_at": {
                        "$gte": datetime.combine(start_date, datetime.min.time()),
                        "$lte": datetime.combine(end_date, datetime.max.time())
                    }
                }
            },
            {
                "$lookup": {
                    "from": "fee_templates",
                    "localField": "fee_template_id",
                    "foreignField": "_id",
                    "as": "template"
                }
            },
            {
                "$unwind": "$template"
            },
            {
                "$group": {
                    "_id": "$template.fee_type",
                    "amount": {"$sum": "$paid_amount"}
                }
            }
        ]
        
        fee_type_dist_results = await self.db.fee_structures.aggregate(fee_type_dist_pipeline).to_list(length=None)
        fee_type_distribution = {r["_id"]: r["amount"] for r in fee_type_dist_results}
        
        # Grade level collections
        grade_level_pipeline = [
            {
                "$match": {
                    "branch_id": branch_id,
                    "created_at": {
                        "$gte": datetime.combine(start_date, datetime.min.time()),
                        "$lte": datetime.combine(end_date, datetime.max.time())
                    }
                }
            },
            {
                "$lookup": {
                    "from": "students",
                    "localField": "student_id",
                    "foreignField": "_id",
                    "as": "student"
                }
            },
            {
                "$unwind": "$student"
            },
            {
                "$group": {
                    "_id": "$student.grade_level",
                    "amount": {"$sum": "$paid_amount"}
                }
            }
        ]
        
        grade_level_results = await self.db.fee_structures.aggregate(grade_level_pipeline).to_list(length=None)
        grade_level_collections = {r["_id"]: r["amount"] for r in grade_level_results}
        
        # Overdue analysis
        overdue_pipeline = [
            {
                "$match": {
                    "branch_id": branch_id,
                    "balance": {"$gt": 0},
                    "due_date": {"$lt": datetime.now()},
                    "is_active": True
                }
            },
            {
                "$project": {
                    "days_overdue": {
                        "$divide": [
                            {
                                "$subtract": [
                                    datetime.utcnow(),
                                    "$due_date"
                                ]
                            },
                            1000 * 60 * 60 * 24  # Convert to days
                        ]
                    },
                    "balance": 1
                }
            },
            {
                "$bucket": {
                    "groupBy": "$days_overdue",
                    "boundaries": [0, 7, 14, 30, 60, 90, 180, 365, 1000],
                    "default": "365+",
                    "output": {
                        "count": {"$sum": 1},
                        "amount": {"$sum": "$balance"}
                    }
                }
            }
        ]
        
        overdue_results = await self.db.fee_structures.aggregate(overdue_pipeline).to_list(length=None)
        
        overdue_by_days = {}
        overdue_by_amount = {}
        
        for result in overdue_results:
            bucket = result["_id"]
            if isinstance(bucket, (int, float)):
                if bucket < 7:
                    key = "0-7 days"
                elif bucket < 14:
                    key = "8-14 days"
                elif bucket < 30:
                    key = "15-30 days"
                elif bucket < 60:
                    key = "31-60 days"
                elif bucket < 90:
                    key = "61-90 days"
                elif bucket < 180:
                    key = "91-180 days"
                elif bucket < 365:
                    key = "181-365 days"
                else:
                    key = "365+ days"
            else:
                key = str(bucket)
            
            overdue_by_days[key] = result["count"]
            overdue_by_amount[key] = result["amount"]
        
        # Top fee types
        top_fee_types = sorted(
            [{"fee_type": k, "amount": v} for k, v in fee_type_distribution.items()],
            key=lambda x: x["amount"],
            reverse=True
        )[:5]
        
        # Top defaulters
        defaulters_pipeline = [
            {
                "$match": {
                    "branch_id": branch_id,
                    "balance": {"$gt": 0},
                    "due_date": {"$lt": datetime.now()},
                    "is_active": True
                }
            },
            {
                "$group": {
                    "_id": "$student_id",
                    "total_overdue": {"$sum": "$balance"},
                    "overdue_count": {"$sum": 1}
                }
            },
            {
                "$sort": {"total_overdue": -1}
            },
            {
                "$limit": 10
            },
            {
                "$lookup": {
                    "from": "students",
                    "localField": "_id",
                    "foreignField": "_id",
                    "as": "student"
                }
            },
            {
                "$unwind": "$student"
            },
            {
                "$project": {
                    "student_id": "$_id",
                    "student_name": "$student.first_name",
                    "total_overdue": 1,
                    "overdue_count": 1
                }
            }
        ]
        
        defaulters_results = await self.db.fee_structures.aggregate(defaulters_pipeline).to_list(length=10)
        
        analytics = PaymentAnalytics(
            branch_id=branch_id,
            daily_collections=[{"date": r["_id"], "amount": r["amount"], "count": r["count"]} for r in daily_results],
            monthly_collections=[{"month": r["_id"], "amount": r["amount"], "count": r["count"]} for r in monthly_results],
            payment_method_distribution=method_distribution,
            fee_type_distribution=fee_type_distribution,
            grade_level_collections=grade_level_collections,
            overdue_by_days=overdue_by_days,
            overdue_by_amount=overdue_by_amount,
            top_fee_types=top_fee_types,
            top_defaulters=defaulters_results,
            generated_at=datetime.utcnow()
        )
        
        return analytics
    
    async def generate_collection_forecast(
        self,
        branch_id: str,
        forecast_days: int = 30
    ) -> Dict:
        """
        Generate collection forecast based on historical data
        """
        # Get historical payment data
        historical_days = 90
        end_date = datetime.now().date()
        start_date = end_date - timedelta(days=historical_days)
        
        pipeline = [
            {
                "$match": {
                    "branch_id": branch_id,
                    "payment_date": {
                        "$gte": datetime.combine(start_date, datetime.min.time()),
                        "$lte": datetime.combine(end_date, datetime.max.time())
                    },
                    "status": PaymentStatus.PAID
                }
            },
            {
                "$group": {
                    "_id": {
                        "$dateToString": {
                            "format": "%Y-%m-%d",
                            "date": "$payment_date"
                        }
                    },
                    "amount": {"$sum": "$amount"}
                }
            },
            {
                "$sort": {"_id": 1}
            }
        ]
        
        historical_results = await self.db.payment_transactions.aggregate(pipeline).to_list(length=None)
        
        if not historical_results:
            return {
                "forecast_period": forecast_days,
                "predicted_collections": 0,
                "confidence": 0,
                "based_on_days": 0
            }
        
        # Calculate average daily collection
        total_amount = sum(r["amount"] for r in historical_results)
        days_with_data = len(historical_results)
        avg_daily_collection = total_amount / days_with_data if days_with_data > 0 else 0
        
        # Get upcoming due payments
        upcoming_pipeline = [
            {
                "$match": {
                    "branch_id": branch_id,
                    "balance": {"$gt": 0},
                    "due_date": {
                        "$gte": datetime.now(),
                        "$lte": datetime.now() + timedelta(days=forecast_days)
                    },
                    "is_active": True
                }
            },
            {
                "$group": {
                    "_id": None,
                    "total_due": {"$sum": "$balance"}
                }
            }
        ]
        
        upcoming_result = await self.db.fee_structures.aggregate(upcoming_pipeline).to_list(length=1)
        total_due = upcoming_result[0]["total_due"] if upcoming_result else 0
        
        # Calculate collection rate from historical data
        historical_collection_rate = 0.75  # Default 75% collection rate
        
        # Estimate collections
        predicted_from_average = avg_daily_collection * forecast_days
        predicted_from_due = total_due * historical_collection_rate
        
        # Weighted average prediction
        predicted_collections = (predicted_from_average * 0.6) + (predicted_from_due * 0.4)
        
        # Calculate confidence based on data availability
        confidence = min(days_with_data / 30, 1.0) * 100  # Max 100% confidence
        
        return {
            "forecast_period": forecast_days,
            "predicted_collections": round(predicted_collections, 2),
            "predicted_from_historical": round(predicted_from_average, 2),
            "predicted_from_due": round(predicted_from_due, 2),
            "total_due_amount": round(total_due, 2),
            "average_daily_collection": round(avg_daily_collection, 2),
            "collection_rate": round(historical_collection_rate * 100, 2),
            "confidence": round(confidence, 2),
            "based_on_days": days_with_data
        }
    
    async def get_revenue_trends(
        self,
        branch_id: str,
        months: int = 12
    ) -> Dict:
        """
        Get revenue trends over time
        """
        end_date = datetime.now().date()
        start_date = end_date - timedelta(days=months * 30)
        
        pipeline = [
            {
                "$match": {
                    "branch_id": branch_id,
                    "payment_date": {
                        "$gte": datetime.combine(start_date, datetime.min.time()),
                        "$lte": datetime.combine(end_date, datetime.max.time())
                    },
                    "status": PaymentStatus.PAID
                }
            },
            {
                "$group": {
                    "_id": {
                        "year": {"$year": "$payment_date"},
                        "month": {"$month": "$payment_date"}
                    },
                    "revenue": {"$sum": "$amount"},
                    "transactions": {"$sum": 1}
                }
            },
            {
                "$sort": {"_id.year": 1, "_id.month": 1}
            }
        ]
        
        results = await self.db.payment_transactions.aggregate(pipeline).to_list(length=None)
        
        # Calculate month-over-month growth
        trends = []
        previous_revenue = None
        
        for result in results:
            month_data = {
                "year": result["_id"]["year"],
                "month": result["_id"]["month"],
                "revenue": result["revenue"],
                "transactions": result["transactions"],
                "growth_rate": None,
                "growth_amount": None
            }
            
            if previous_revenue is not None:
                month_data["growth_amount"] = result["revenue"] - previous_revenue
                month_data["growth_rate"] = (
                    (result["revenue"] - previous_revenue) / previous_revenue * 100
                ) if previous_revenue > 0 else 0
            
            trends.append(month_data)
            previous_revenue = result["revenue"]
        
        # Calculate average growth rate
        growth_rates = [t["growth_rate"] for t in trends if t["growth_rate"] is not None]
        avg_growth_rate = sum(growth_rates) / len(growth_rates) if growth_rates else 0
        
        return {
            "trends": trends,
            "average_growth_rate": round(avg_growth_rate, 2),
            "total_months": len(trends),
            "highest_revenue_month": max(trends, key=lambda x: x["revenue"]) if trends else None,
            "lowest_revenue_month": min(trends, key=lambda x: x["revenue"]) if trends else None
        }