from decimal import Decimal, ROUND_HALF_UP
from typing import Dict, List, Optional, Tuple
from datetime import datetime, date, timedelta
from motor.motor_asyncio import AsyncIOMotorCollection
import calendar


async def calculate_payment_totals(
    fee_items: List[Dict],
    overall_discount_percentage: Optional[Decimal] = None,
    overall_discount_amount: Optional[Decimal] = None,
    tax_rate: Optional[Decimal] = None
) -> Dict[str, Decimal]:
    """Calculate comprehensive payment totals"""

    subtotal = Decimal("0")
    total_item_discounts = Decimal("0")
    total_tax = Decimal("0")
    total_late_fees = Decimal("0")

    # Calculate item-level totals
    for item in fee_items:
        amount = Decimal(str(item.get("amount", 0)))
        quantity = int(item.get("quantity", 1))
        item_total = amount * quantity
        subtotal += item_total

        # Item-level discount
        item_discount = Decimal(str(item.get("discount_amount", 0)))
        if item.get("discount_percentage"):
            item_discount = item_total * (Decimal(str(item["discount_percentage"])) / 100)

        total_item_discounts += item_discount

        # Tax on this item (after discount)
        item_tax_rate = Decimal(str(item.get("tax_percentage", 0)))
        if item_tax_rate > 0:
            taxable_amount = item_total - item_discount
            item_tax = taxable_amount * (item_tax_rate / 100)
            total_tax += item_tax.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

        # Late fees for this item
        item_late_fee = Decimal(str(item.get("late_fee_amount", 0)))
        total_late_fees += item_late_fee

    # Apply overall discount (overrides item-level discounts if specified)
    if overall_discount_percentage:
        total_discount = subtotal * (overall_discount_percentage / 100)
    elif overall_discount_amount:
        total_discount = overall_discount_amount
    else:
        total_discount = total_item_discounts

    # Apply overall tax rate if specified (overrides item-level tax)
    if tax_rate:
        taxable_amount = subtotal - total_discount
        total_tax = taxable_amount * (tax_rate / 100)
        total_tax = total_tax.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    # Calculate final total
    final_total = subtotal - total_discount + total_tax + total_late_fees
    final_total = final_total.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    return {
        "subtotal": subtotal,
        "discount_amount": total_discount,
        "tax_amount": total_tax,
        "late_fee_amount": total_late_fees,
        "total_amount": final_total,
        "amount_due": final_total  # Alias for compatibility
    }


async def apply_late_fees(
    original_amount: Decimal,
    late_fee_percentage: Decimal,
    grace_days: int = 0,
    due_date: Optional[date] = None,
    payment_date: Optional[date] = None
) -> Decimal:
    """Calculate late fees based on payment date vs due date"""

    if not due_date or not payment_date:
        return Decimal("0")

    # Calculate days overdue
    days_overdue = (payment_date - due_date).days

    # Apply grace period
    if days_overdue <= grace_days:
        return Decimal("0")

    # Calculate late fee
    late_fee = original_amount * (late_fee_percentage / 100)
    return late_fee.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


async def calculate_installment_amounts(
    total_amount: Decimal,
    number_of_installments: int,
    installment_fee: Optional[Decimal] = None
) -> List[Dict[str, Decimal]]:
    """Calculate installment breakdown"""

    if number_of_installments <= 0:
        raise ValueError("Number of installments must be greater than 0")

    # Base installment amount
    base_amount = total_amount / number_of_installments
    base_amount = base_amount.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    installments = []
    remaining_amount = total_amount

    for i in range(number_of_installments):
        if i == number_of_installments - 1:
            # Last installment takes any remaining amount due to rounding
            installment_amount = remaining_amount
        else:
            installment_amount = base_amount
            remaining_amount -= installment_amount

        # Add installment fee if specified
        fee = installment_fee or Decimal("0")
        total_installment = installment_amount + fee

        installments.append({
            "installment_number": i + 1,
            "principal_amount": installment_amount,
            "installment_fee": fee,
            "total_amount": total_installment
        })

    return installments


async def calculate_discount_amount(
    amount: Decimal,
    discount_type: str,
    discount_value: Decimal,
    max_discount: Optional[Decimal] = None
) -> Decimal:
    """Calculate discount amount based on type"""

    if discount_type == "percentage":
        discount = amount * (discount_value / 100)
    elif discount_type == "fixed":
        discount = discount_value
    else:
        raise ValueError(f"Invalid discount type: {discount_type}")

    # Apply maximum discount limit
    if max_discount and discount > max_discount:
        discount = max_discount

    # Ensure discount doesn't exceed original amount
    if discount > amount:
        discount = amount

    return discount.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


async def calculate_prorated_fee(
    annual_fee: Decimal,
    start_date: date,
    end_date: date,
    academic_year_start: date,
    academic_year_end: date
) -> Decimal:
    """Calculate prorated fee amount for partial periods"""

    # Total days in academic year
    total_days = (academic_year_end - academic_year_start).days + 1

    # Days in billing period
    billing_days = (end_date - start_date).days + 1

    # Ensure billing period is within academic year
    actual_start = max(start_date, academic_year_start)
    actual_end = min(end_date, academic_year_end)
    actual_days = (actual_end - actual_start).days + 1

    if actual_days <= 0:
        return Decimal("0")

    # Calculate prorated amount
    prorated_amount = annual_fee * (Decimal(actual_days) / Decimal(total_days))
    return prorated_amount.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


async def calculate_refund_amount(
    original_payment: Decimal,
    refund_percentage: Optional[Decimal] = None,
    refund_amount: Optional[Decimal] = None,
    processing_fee: Optional[Decimal] = None,
    refund_policy_days: Optional[int] = None,
    payment_date: Optional[date] = None
) -> Dict[str, Decimal]:
    """Calculate refund amount based on policy"""

    # Check if refund is within policy period
    if refund_policy_days and payment_date:
        days_since_payment = (date.today() - payment_date).days
        if days_since_payment > refund_policy_days:
            return {
                "refund_amount": Decimal("0"),
                "processing_fee": Decimal("0"),
                "net_refund": Decimal("0"),
                "reason": "Outside refund policy period"
            }

    # Calculate base refund amount
    if refund_amount:
        base_refund = min(refund_amount, original_payment)
    elif refund_percentage:
        base_refund = original_payment * (refund_percentage / 100)
    else:
        base_refund = original_payment

    # Apply processing fee
    processing_fee = processing_fee or Decimal("0")
    net_refund = max(Decimal("0"), base_refund - processing_fee)

    return {
        "refund_amount": base_refund.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP),
        "processing_fee": processing_fee,
        "net_refund": net_refund.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP),
        "reason": "Refund approved"
    }


async def generate_receipt_number(
    collection: AsyncIOMotorCollection,
    branch_id: str,
    prefix: str = "RCP"
) -> str:
    """Generate unique receipt number"""

    current_year = datetime.now().year

    # Find the last receipt number for this year and branch
    last_receipt = await collection.find_one(
        {
            "branch_id": branch_id,
            "receipt_no": {"$regex": f"^{prefix}-{current_year}-"}
        },
        sort=[("receipt_no", -1)]
    )

    if last_receipt and last_receipt.get("receipt_no"):
        # Extract sequence number from last receipt
        try:
            last_sequence = int(last_receipt["receipt_no"].split("-")[-1])
            next_sequence = last_sequence + 1
        except (ValueError, IndexError):
            next_sequence = 1
    else:
        next_sequence = 1

    # Format: RCP-2024-000001
    receipt_no = f"{prefix}-{current_year}-{next_sequence:06d}"

    return receipt_no


def calculate_payment_schedule(
    total_amount: Decimal,
    start_date: date,
    frequency: str,
    number_of_payments: int
) -> List[Dict]:
    """Generate payment schedule"""

    schedule = []
    current_date = start_date
    payment_amount = total_amount / number_of_payments
    payment_amount = payment_amount.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    for i in range(number_of_payments):
        # Adjust last payment for any rounding differences
        if i == number_of_payments - 1:
            paid_so_far = payment_amount * (number_of_payments - 1)
            payment_amount = total_amount - paid_so_far

        schedule.append({
            "payment_number": i + 1,
            "due_date": current_date,
            "amount": payment_amount,
            "status": "pending"
        })

        # Calculate next due date based on frequency
        if frequency == "weekly":
            current_date += timedelta(weeks=1)
        elif frequency == "biweekly":
            current_date += timedelta(weeks=2)
        elif frequency == "monthly":
            # Add one month
            if current_date.month == 12:
                current_date = current_date.replace(year=current_date.year + 1, month=1)
            else:
                # Handle month-end dates
                next_month = current_date.month + 1
                try:
                    current_date = current_date.replace(month=next_month)
                except ValueError:
                    # Day doesn't exist in next month (e.g., Jan 31 -> Feb 31)
                    # Move to last day of next month
                    last_day = calendar.monthrange(current_date.year, next_month)[1]
                    current_date = current_date.replace(month=next_month, day=last_day)
        elif frequency == "quarterly":
            # Add 3 months
            for _ in range(3):
                if current_date.month == 12:
                    current_date = current_date.replace(year=current_date.year + 1, month=1)
                else:
                    current_date = current_date.replace(month=current_date.month + 1)
        elif frequency == "annually":
            current_date = current_date.replace(year=current_date.year + 1)

    return schedule


def format_currency(amount: Decimal, currency_code: str = "USD", locale: str = "en_US") -> str:
    """Format currency amount for display"""

    # Simple formatting for now - could be enhanced with locale support
    if currency_code == "USD":
        return f"${amount:,.2f}"
    elif currency_code == "SAR":
        return f"{amount:,.2f} ر.س"
    elif currency_code == "EUR":
        return f"€{amount:,.2f}"
    else:
        return f"{amount:,.2f} {currency_code}"


def calculate_tax_breakdown(
    subtotal: Decimal,
    tax_rates: Dict[str, Decimal]
) -> Dict[str, Decimal]:
    """Calculate breakdown of different tax types"""

    tax_breakdown = {}
    total_tax = Decimal("0")

    for tax_name, tax_rate in tax_rates.items():
        tax_amount = subtotal * (tax_rate / 100)
        tax_amount = tax_amount.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        tax_breakdown[tax_name] = tax_amount
        total_tax += tax_amount

    tax_breakdown["total_tax"] = total_tax
    return tax_breakdown