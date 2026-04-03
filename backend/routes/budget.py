# Backend Budget Planner routes
from fastapi import APIRouter, HTTPException, Depends, Query
from typing import List, Optional, Dict, Any, Literal
from pydantic import BaseModel, Field, validator
from datetime import datetime, timezone, timedelta
import asyncio
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/budget", tags=["budget"])

# Import verify_token from server module
# These will be imported when the router is included in server.py
from server import verify_token, db, firestore


class BudgetItem(BaseModel):
    id: Optional[str] = None
    userId: str
    createdAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updatedAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    label: str
    amount: float
    type: Literal["income", "expense", "saving"]
    categoryId: str
    iconId: str
    color: str
    recurrence: Literal["none", "weekly", "monthly"] = "none"
    startDate: str  # ISO date YYYY-MM-DD
    endDate: Optional[str] = None  # ISO date YYYY-MM-DD
    notes: Optional[str] = None

    @validator('amount')
    def validate_amount(cls, v):
        if v <= 0:
            raise ValueError('amount must be greater than 0')
        return v

    @validator('label')
    def validate_label(cls, v):
        if not v or not v.strip():
            raise ValueError('label is required')
        return v.strip()

    @validator('endDate')
    def validate_end_date(cls, v, values):
        if v and 'startDate' in values:
            if v < values['startDate']:
                raise ValueError('endDate must be >= startDate')
        return v

    @validator('startDate')
    def validate_start_date_required(cls, v, values):
        if 'recurrence' in values and values['recurrence'] != 'none' and not v:
            raise ValueError('startDate required when recurrence is set')
        return v


class BudgetSettings(BaseModel):
    userId: str
    defaultCurrency: str = "EUR"
    monthlyTargets: Dict[str, Optional[float]] = Field(default_factory=lambda: {
        "savingsTarget": None,
        "incomeTarget": None
    })
    customCategories: List[Dict[str, str]] = Field(default_factory=list)


class BudgetItemCreateRequest(BaseModel):
    label: str
    amount: float
    type: Literal["income", "expense", "saving"]
    categoryId: str
    iconId: str
    color: str
    recurrence: Literal["none", "weekly", "monthly"] = "none"
    startDate: str
    endDate: Optional[str] = None
    notes: Optional[str] = None


class BudgetItemUpdateRequest(BaseModel):
    label: Optional[str] = None
    amount: Optional[float] = None
    type: Optional[Literal["income", "expense", "saving"]] = None
    categoryId: Optional[str] = None
    iconId: Optional[str] = None
    color: Optional[str] = None
    recurrence: Optional[Literal["none", "weekly", "monthly"]] = None
    startDate: Optional[str] = None
    endDate: Optional[str] = None
    notes: Optional[str] = None


def expand_recurrence(
    item: Dict[str, Any],
    from_date: str,
    to_date: str
) -> List[Dict[str, Any]]:
    """Expand recurring items into materialized occurrences within date range."""
    recurrence = item.get('recurrence', 'none')
    
    if recurrence == 'none':
        # Single occurrence
        item_date = item.get('startDate')
        if item_date and from_date <= item_date <= to_date:
            return [item]
        return []
    
    # Recurring item
    start = datetime.fromisoformat(item['startDate'])
    end_date = item.get('endDate')
    end = datetime.fromisoformat(end_date) if end_date else datetime.fromisoformat(to_date)
    
    from_dt = datetime.fromisoformat(from_date)
    to_dt = datetime.fromisoformat(to_date)
    
    occurrences = []
    current = start
    
    while current <= min(end, to_dt):
        if current >= from_dt:
            occurrence = item.copy()
            occurrence['startDate'] = current.date().isoformat()
            occurrence['_isRecurring'] = True
            occurrence['_originalId'] = item.get('id')
            occurrences.append(occurrence)
        
        if recurrence == 'weekly':
            current += timedelta(weeks=1)
        elif recurrence == 'monthly':
            # Add one month
            month = current.month
            year = current.year
            if month == 12:
                month = 1
                year += 1
            else:
                month += 1
            try:
                current = current.replace(year=year, month=month)
            except ValueError:
                # Handle day overflow (e.g., Jan 31 -> Feb 28/29)
                import calendar
                last_day = calendar.monthrange(year, month)[1]
                current = current.replace(year=year, month=month, day=last_day)
        else:
            break
    
    return occurrences


def compute_summary(items: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Compute budget summary from items."""
    total_income = 0.0
    total_expense = 0.0
    savings = 0.0
    
    breakdown_by_category = {}
    breakdown_by_type = {"income": 0.0, "expense": 0.0, "saving": 0.0}
    
    for item in items:
        amount = item.get('amount', 0.0)
        item_type = item.get('type', 'expense')
        category_id = item.get('categoryId', 'other')
        
        if item_type == 'income':
            total_income += amount
        elif item_type == 'expense':
            total_expense += amount
        elif item_type == 'saving':
            savings += amount
        
        breakdown_by_type[item_type] += amount
        
        if category_id not in breakdown_by_category:
            breakdown_by_category[category_id] = {
                'amount': 0.0,
                'type': item_type,
                'color': item.get('color', '#CCCCCC'),
                'label': item.get('label', 'Unknown')
            }
        breakdown_by_category[category_id]['amount'] += amount
    
    return {
        'totalIncome': total_income,
        'totalExpense': total_expense,
        'net': total_income - total_expense,
        'savings': savings,
        'breakdownByCategory': breakdown_by_category,
        'breakdownByType': breakdown_by_type
    }


async def check_team_access(user_uid: str, target_uid: str) -> bool:
    """Check if user can access target user's budget (same team)."""
    if user_uid == target_uid:
        return True
    
    # Check if both users share a team
    try:
        user_doc = await asyncio.to_thread(
            db.collection('users').document(user_uid).get
        )
        target_doc = await asyncio.to_thread(
            db.collection('users').document(target_uid).get
        )
        
        if not user_doc.exists or not target_doc.exists:
            return False
        
        user_data = user_doc.to_dict()
        target_data = target_doc.to_dict()
        
        user_team = user_data.get('team_id')
        target_team = target_data.get('team_id')
        
        if user_team and target_team and user_team == target_team:
            return True
    except Exception as e:
        logger.error(f"Error checking team access: {e}")
    
    return False


@router.get("/items")
async def get_budget_items(
    from_date: str = Query(..., alias="from"),
    to_date: str = Query(..., alias="to"),
    teamMemberId: Optional[str] = None,
    user: Dict[str, Any] = Depends(verify_token)
):
    """Get budget items with recurrence expansion."""
    try:
        target_uid = teamMemberId if teamMemberId else user['uid']
        
        # Check access for team member view
        if teamMemberId and teamMemberId != user['uid']:
            has_access = await check_team_access(user['uid'], teamMemberId)
            if not has_access:
                raise HTTPException(status_code=403, detail="Not authorized to view this budget")
        
        # Fetch items from Firestore
        items_ref = db.collection('users').document(target_uid).collection('budgetItems')
        items_snap = await asyncio.to_thread(lambda: list(items_ref.stream()))
        
        items = []
        for doc in items_snap:
            data = doc.to_dict()
            data['id'] = doc.id
            items.append(data)
        
        # Expand recurrences
        expanded = []
        for item in items:
            occurrences = expand_recurrence(item, from_date, to_date)
            expanded.extend(occurrences)
        
        return {'success': True, 'items': expanded}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching budget items: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/items")
async def create_budget_item(
    item: BudgetItemCreateRequest,
    user: Dict[str, Any] = Depends(verify_token)
):
    """Create a new budget item."""
    try:
        now = datetime.now(timezone.utc)
        
        new_item = BudgetItem(
            userId=user['uid'],
            createdAt=now,
            updatedAt=now,
            **item.dict()
        )
        
        items_ref = db.collection('users').document(user['uid']).collection('budgetItems')
        doc_ref = items_ref.document()
        
        item_dict = new_item.dict()
        item_dict['id'] = doc_ref.id
        
        await asyncio.to_thread(doc_ref.set, item_dict)
        
        return {'success': True, 'item': item_dict}
    except Exception as e:
        logger.error(f"Error creating budget item: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/items/{item_id}")
async def update_budget_item(
    item_id: str,
    updates: BudgetItemUpdateRequest,
    teamMemberId: Optional[str] = None,
    user: Dict[str, Any] = Depends(verify_token)
):
    """Update a budget item."""
    try:
        # Prevent editing other team members' items
        if teamMemberId and teamMemberId != user['uid']:
            raise HTTPException(status_code=403, detail="Cannot edit other team members' budgets")
        
        target_uid = user['uid']
        item_ref = db.collection('users').document(target_uid).collection('budgetItems').document(item_id)
        
        item_snap = await asyncio.to_thread(item_ref.get)
        if not item_snap.exists:
            raise HTTPException(status_code=404, detail="Budget item not found")
        
        update_dict = {k: v for k, v in updates.dict().items() if v is not None}
        update_dict['updatedAt'] = datetime.now(timezone.utc)
        
        await asyncio.to_thread(item_ref.update, update_dict)
        
        updated_snap = await asyncio.to_thread(item_ref.get)
        updated_data = updated_snap.to_dict()
        updated_data['id'] = item_id
        
        return {'success': True, 'item': updated_data}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating budget item: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/items/{item_id}")
async def delete_budget_item(
    item_id: str,
    teamMemberId: Optional[str] = None,
    user: Dict[str, Any] = Depends(verify_token)
):
    """Delete a budget item."""
    try:
        if teamMemberId and teamMemberId != user['uid']:
            raise HTTPException(status_code=403, detail="Cannot delete other team members' budgets")
        
        target_uid = user['uid']
        item_ref = db.collection('users').document(target_uid).collection('budgetItems').document(item_id)
        
        await asyncio.to_thread(item_ref.delete)
        
        return {'success': True, 'message': 'Item deleted'}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting budget item: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/settings")
async def get_budget_settings(
    user: Dict[str, Any] = Depends(verify_token)
):
    """Get budget settings for user."""
    try:
        settings_ref = db.collection('users').document(user['uid']).collection('budgetSettings').document('main')
        settings_snap = await asyncio.to_thread(settings_ref.get)
        
        if settings_snap.exists:
            settings_data = settings_snap.to_dict()
            return {'success': True, 'settings': settings_data}
        else:
            # Return default settings
            default_settings = BudgetSettings(userId=user['uid']).dict()
            return {'success': True, 'settings': default_settings}
    except Exception as e:
        logger.error(f"Error fetching budget settings: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/settings")
async def update_budget_settings(
    settings: BudgetSettings,
    user: Dict[str, Any] = Depends(verify_token)
):
    """Update budget settings."""
    try:
        settings_ref = db.collection('users').document(user['uid']).collection('budgetSettings').document('main')
        
        settings_dict = settings.dict()
        settings_dict['userId'] = user['uid']
        
        await asyncio.to_thread(settings_ref.set, settings_dict, merge=True)
        
        return {'success': True, 'settings': settings_dict}
    except Exception as e:
        logger.error(f"Error updating budget settings: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/summary")
async def get_budget_summary(
    period: str = Query("month"),
    at: str = Query(...),  # YYYY-MM format
    teamMemberId: Optional[str] = None,
    user: Dict[str, Any] = Depends(verify_token)
):
    """Get budget summary with aggregates."""
    try:
        target_uid = teamMemberId if teamMemberId else user['uid']
        
        if teamMemberId and teamMemberId != user['uid']:
            has_access = await check_team_access(user['uid'], teamMemberId)
            if not has_access:
                raise HTTPException(status_code=403, detail="Not authorized to view this budget")
        
        # Parse at parameter (YYYY-MM)
        year, month = map(int, at.split('-'))
        
        # Calculate date range for the month
        import calendar
        first_day = f"{year:04d}-{month:02d}-01"
        last_day_num = calendar.monthrange(year, month)[1]
        last_day = f"{year:04d}-{month:02d}-{last_day_num:02d}"
        
        # Get items
        items_ref = db.collection('users').document(target_uid).collection('budgetItems')
        items_snap = await asyncio.to_thread(lambda: list(items_ref.stream()))
        
        items = []
        for doc in items_snap:
            data = doc.to_dict()
            data['id'] = doc.id
            items.append(data)
        
        # Expand recurrences
        expanded = []
        for item in items:
            occurrences = expand_recurrence(item, first_day, last_day)
            expanded.extend(occurrences)
        
        # Compute summary
        summary = compute_summary(expanded)
        
        return {'success': True, 'summary': summary}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error computing budget summary: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/seed")
async def seed_budget_data(
    user: Dict[str, Any] = Depends(verify_token)
):
    """Seed budget data for testing (temporary endpoint)."""
    try:
        now = datetime.now(timezone.utc)
        current_date = now.date().isoformat()
        
        # Sample seed data
        seed_items = [
            {
                'label': 'Salaire mensuel',
                'amount': 3500.0,
                'type': 'income',
                'categoryId': 'salary',
                'iconId': 'DollarSign',
                'color': '#B8EBD0',
                'recurrence': 'monthly',
                'startDate': '2025-01-01',
                'endDate': None,
                'notes': 'Salaire principal'
            },
            {
                'label': 'Freelance projet',
                'amount': 800.0,
                'type': 'income',
                'categoryId': 'freelance',
                'iconId': 'Briefcase',
                'color': '#BFE6FF',
                'recurrence': 'none',
                'startDate': current_date,
                'endDate': None,
                'notes': 'Projet client'
            },
            {
                'label': 'Investissement crypto',
                'amount': 1200.0,
                'type': 'income',
                'categoryId': 'investment',
                'iconId': 'TrendingUp',
                'color': '#FFD6B8',
                'recurrence': 'none',
                'startDate': current_date,
                'endDate': None,
                'notes': None
            },
            {
                'label': 'Loyer',
                'amount': 1200.0,
                'type': 'expense',
                'categoryId': 'housing',
                'iconId': 'Home',
                'color': '#DCCEF8',
                'recurrence': 'monthly',
                'startDate': '2025-01-01',
                'endDate': None,
                'notes': 'Loyer appartement'
            },
            {
                'label': 'Courses alimentaires',
                'amount': 400.0,
                'type': 'expense',
                'categoryId': 'food',
                'iconId': 'ShoppingCart',
                'color': '#FDF3B0',
                'recurrence': 'monthly',
                'startDate': '2025-01-01',
                'endDate': None,
                'notes': None
            },
            {
                'label': 'Transport',
                'amount': 80.0,
                'type': 'expense',
                'categoryId': 'transport',
                'iconId': 'Car',
                'color': '#FFBFC4',
                'recurrence': 'none',
                'startDate': current_date,
                'endDate': None,
                'notes': 'Essence et parking'
            },
            {
                'label': 'Abonnements',
                'amount': 50.0,
                'type': 'expense',
                'categoryId': 'subscriptions',
                'iconId': 'Tv',
                'color': '#CFE6C8',
                'recurrence': 'monthly',
                'startDate': '2025-01-01',
                'endDate': None,
                'notes': 'Netflix, Spotify, etc.'
            },
            {
                'label': 'Restaurant',
                'amount': 65.0,
                'type': 'expense',
                'categoryId': 'dining',
                'iconId': 'Utensils',
                'color': '#E3EEF9',
                'recurrence': 'none',
                'startDate': current_date,
                'endDate': None,
                'notes': 'Dîner en ville'
            },
            {
                'label': 'Épargne mensuelle',
                'amount': 500.0,
                'type': 'saving',
                'categoryId': 'savings',
                'iconId': 'PiggyBank',
                'color': '#B8EBD0',
                'recurrence': 'monthly',
                'startDate': '2025-01-01',
                'endDate': None,
                'notes': 'Objectif épargne'
            }
        ]
        
        items_ref = db.collection('users').document(user['uid']).collection('budgetItems')
        
        created_items = []
        for seed_item in seed_items:
            item = BudgetItem(
                userId=user['uid'],
                createdAt=now,
                updatedAt=now,
                **seed_item
            )
            
            doc_ref = items_ref.document()
            item_dict = item.dict()
            item_dict['id'] = doc_ref.id
            
            await asyncio.to_thread(doc_ref.set, item_dict)
            created_items.append(item_dict)
        
        return {'success': True, 'message': f'Created {len(created_items)} seed items', 'items': created_items}
    except Exception as e:
        logger.error(f"Error seeding budget data: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
