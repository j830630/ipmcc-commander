"""
0-DTE Data Service
Provides live market structure data for 0-DTE trading using Schwab API
"""

from datetime import datetime, date
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/zero-dte", tags=["0-DTE"])


# ============================================================================
# DATA MODELS
# ============================================================================

class GEXLevel(BaseModel):
    strike: float
    net_gex: float
    call_gex: float
    put_gex: float
    call_oi: int
    put_oi: int
    call_volume: int
    put_volume: int
    level_type: str


class MarketRegime(BaseModel):
    regime_type: str
    strength: str
    bias: str
    total_gex: float
    description: str


class VIXData(BaseModel):
    vix: float
    vix_change: float
    vix_change_percent: float
    vix1d: Optional[float] = None
    vix1d_change: Optional[float] = None
    term_structure: str
    regime: str


class KeyLevels(BaseModel):
    call_wall: float
    put_wall: float
    gamma_flip: float
    max_pain: float
    zero_gamma: float


class ZeroDTEMarketData(BaseModel):
    timestamp: datetime
    underlying: str
    spot_price: float
    spot_change: float
    spot_change_percent: float
    vix_data: VIXData
    regime: MarketRegime
    key_levels: KeyLevels
    gex_profile: List[GEXLevel]
    total_call_oi: int
    total_put_oi: int
    put_call_ratio: float


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def safe_float(value, default=0.0) -> float:
    """Safely convert value to float"""
    if value is None:
        return default
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def get_vix_regime(vix: float) -> str:
    """Classify VIX regime"""
    if vix < 15:
        return 'low'
    elif vix < 20:
        return 'elevated'
    elif vix < 30:
        return 'high'
    else:
        return 'extreme'


def determine_regime(total_gex: float) -> MarketRegime:
    """Determine market regime based on total GEX"""
    if total_gex > 3.0:
        return MarketRegime(
            regime_type='positive_gamma',
            strength='strong' if total_gex > 6.0 else 'moderate',
            bias='pin',
            total_gex=round(total_gex, 2),
            description='Dealers LONG gamma - will sell rallies/buy dips. Expect mean reversion and pinning.'
        )
    elif total_gex < -3.0:
        return MarketRegime(
            regime_type='negative_gamma',
            strength='strong' if total_gex < -6.0 else 'moderate',
            bias='trend',
            total_gex=round(total_gex, 2),
            description='Dealers SHORT gamma - must chase price. Expect amplified moves and trending.'
        )
    else:
        return MarketRegime(
            regime_type='neutral',
            strength='weak',
            bias='chop',
            total_gex=round(total_gex, 2),
            description='Neutral GEX - no strong dealer positioning. Expect choppy action.'
        )


def generate_estimated_gex(spot_price: float, underlying: str) -> List[GEXLevel]:
    """Generate estimated GEX levels when option chain unavailable"""
    import random
    random.seed(int(spot_price))  # Consistent results for same price
    
    interval = 50 if underlying.upper() == 'SPX' else 5
    base_strike = round(spot_price / interval) * interval
    
    levels = []
    for i in range(-10, 11):
        strike = base_strike + (i * interval)
        distance = abs(strike - spot_price) / spot_price
        
        # GEX decreases with distance from spot
        base_gex = max(0.1, 2.0 - distance * 30) * (1 + random.uniform(-0.3, 0.3))
        
        if strike > spot_price:
            call_gex = base_gex * 1.5
            put_gex = -base_gex * 0.3
            level_type = 'call_wall' if call_gex > 1.5 else 'neutral'
        else:
            call_gex = base_gex * 0.3
            put_gex = -base_gex * 1.5
            level_type = 'put_wall' if put_gex < -1.5 else 'neutral'
        
        if abs(strike - spot_price) < interval * 0.6:
            level_type = 'gamma_flip'
        
        levels.append(GEXLevel(
            strike=strike,
            net_gex=round(call_gex + put_gex, 3),
            call_gex=round(call_gex, 3),
            put_gex=round(put_gex, 3),
            call_oi=int(base_gex * 8000),
            put_oi=int(abs(put_gex) * 6000),
            call_volume=int(base_gex * 4000),
            put_volume=int(abs(put_gex) * 3000),
            level_type=level_type
        ))
    
    return levels


def calculate_gex_from_chain(
    spot_price: float,
    call_exp_map: Dict,
    put_exp_map: Dict
) -> List[GEXLevel]:
    """Calculate GEX from Schwab option chain"""
    
    strikes_data: Dict[float, Dict] = {}
    
    # Process calls
    for exp_date, strikes in call_exp_map.items():
        for strike_str, contracts in strikes.items():
            try:
                strike = float(strike_str)
            except:
                continue
                
            if strike not in strikes_data:
                strikes_data[strike] = {
                    'call_oi': 0, 'put_oi': 0,
                    'call_volume': 0, 'put_volume': 0,
                    'call_gamma': 0.01, 'put_gamma': 0.01
                }
            
            for contract in contracts:
                strikes_data[strike]['call_oi'] += int(contract.get('openInterest', 0) or 0)
                strikes_data[strike]['call_volume'] += int(contract.get('totalVolume', 0) or 0)
                gamma = contract.get('gamma')
                if gamma:
                    strikes_data[strike]['call_gamma'] = abs(safe_float(gamma, 0.01))
    
    # Process puts
    for exp_date, strikes in put_exp_map.items():
        for strike_str, contracts in strikes.items():
            try:
                strike = float(strike_str)
            except:
                continue
                
            if strike not in strikes_data:
                strikes_data[strike] = {
                    'call_oi': 0, 'put_oi': 0,
                    'call_volume': 0, 'put_volume': 0,
                    'call_gamma': 0.01, 'put_gamma': 0.01
                }
            
            for contract in contracts:
                strikes_data[strike]['put_oi'] += int(contract.get('openInterest', 0) or 0)
                strikes_data[strike]['put_volume'] += int(contract.get('totalVolume', 0) or 0)
                gamma = contract.get('gamma')
                if gamma:
                    strikes_data[strike]['put_gamma'] = abs(safe_float(gamma, 0.01))
    
    # Calculate GEX
    levels = []
    multiplier = 100
    
    for strike, data in sorted(strikes_data.items()):
        # GEX = Gamma * OI * 100 * Spot^2 / 1B
        call_gex = data['call_gamma'] * data['call_oi'] * multiplier * (spot_price ** 2) / 1e9
        put_gex = -data['put_gamma'] * data['put_oi'] * multiplier * (spot_price ** 2) / 1e9
        net_gex = call_gex + put_gex
        
        # Determine type
        if call_gex > 0.3:
            level_type = 'call_wall'
        elif put_gex < -0.3:
            level_type = 'put_wall'
        elif abs(net_gex) < 0.1:
            level_type = 'gamma_flip'
        else:
            level_type = 'neutral'
        
        levels.append(GEXLevel(
            strike=strike,
            net_gex=round(net_gex, 4),
            call_gex=round(call_gex, 4),
            put_gex=round(put_gex, 4),
            call_oi=data['call_oi'],
            put_oi=data['put_oi'],
            call_volume=data['call_volume'],
            put_volume=data['put_volume'],
            level_type=level_type
        ))
    
    return levels


def find_key_levels(gex_levels: List[GEXLevel], spot_price: float) -> KeyLevels:
    """Find key levels from GEX profile"""
    
    if not gex_levels:
        return KeyLevels(
            call_wall=spot_price + 50,
            put_wall=spot_price - 50,
            gamma_flip=spot_price,
            max_pain=spot_price,
            zero_gamma=spot_price
        )
    
    # Call wall: highest call GEX above spot
    above_spot = [g for g in gex_levels if g.strike > spot_price]
    call_wall = max(above_spot, key=lambda x: x.call_gex).strike if above_spot else spot_price + 50
    
    # Put wall: most negative put GEX below spot
    below_spot = [g for g in gex_levels if g.strike < spot_price]
    put_wall = min(below_spot, key=lambda x: x.put_gex).strike if below_spot else spot_price - 50
    
    # Gamma flip: where net GEX crosses zero
    flip = [g for g in gex_levels if g.level_type == 'gamma_flip']
    gamma_flip = min(flip, key=lambda x: abs(x.strike - spot_price)).strike if flip else spot_price
    
    # Max pain: highest total OI
    max_pain = max(gex_levels, key=lambda x: x.call_oi + x.put_oi).strike
    
    return KeyLevels(
        call_wall=call_wall,
        put_wall=put_wall,
        gamma_flip=gamma_flip,
        max_pain=max_pain,
        zero_gamma=gamma_flip
    )


# ============================================================================
# API ENDPOINTS
# ============================================================================

@router.get("/market-data/{underlying}")
async def get_zero_dte_market_data(underlying: str = "SPX"):
    """Get comprehensive 0-DTE market data"""
    
    from app.services.schwab_service import schwab_service
    
    try:
        # ===== GET SPY QUOTE =====
        spy_response = await schwab_service.get_quotes(['SPY'])
        
        if 'SPY' not in spy_response:
            raise HTTPException(status_code=404, detail="SPY quote not found")
        
        spy_quote = spy_response['SPY'].get('quote', {})
        spy_price = safe_float(spy_quote.get('lastPrice') or spy_quote.get('closePrice'), 580)
        spy_change = safe_float(spy_quote.get('netChange'), 0)
        spy_change_pct = safe_float(spy_quote.get('netPercentChange'), 0)
        
        # Calculate SPX from SPY
        if underlying.upper() == 'SPX':
            spot_price = spy_price * 10
            spot_change = spy_change * 10
        else:
            spot_price = spy_price
            spot_change = spy_change
        spot_change_pct = spy_change_pct
        
        # ===== GET VIX =====
        vix = 15.0
        vix_change = 0.0
        vix_change_pct = 0.0
        
        try:
            vix_response = await schwab_service.get_quotes(['$VIX'])
            if '$VIX' in vix_response:
                vix_quote = vix_response['$VIX'].get('quote', {})
                vix = safe_float(vix_quote.get('lastPrice') or vix_quote.get('closePrice'), 15)
                vix_change = safe_float(vix_quote.get('netChange'), 0)
                vix_change_pct = safe_float(vix_quote.get('netPercentChange'), 0)
        except Exception as e:
            logger.warning(f"VIX fetch failed: {e}")
        
        # VIX1D (may not be available)
        vix1d = None
        vix1d_change = None
        try:
            vix1d_response = await schwab_service.get_quotes(['$VIX1D'])
            if '$VIX1D' in vix1d_response:
                vix1d_quote = vix1d_response['$VIX1D'].get('quote', {})
                vix1d = safe_float(vix1d_quote.get('lastPrice') or vix1d_quote.get('closePrice'))
                vix1d_change = safe_float(vix1d_quote.get('netPercentChange'))
        except:
            pass
        
        # Term structure
        term_structure = 'unknown'
        if vix1d and vix > 0:
            if vix1d < vix * 0.95:
                term_structure = 'contango'
            elif vix1d > vix * 1.05:
                term_structure = 'backwardation'
            else:
                term_structure = 'flat'
        
        vix_data = VIXData(
            vix=round(vix, 2),
            vix_change=round(vix_change, 2),
            vix_change_percent=round(vix_change_pct, 2),
            vix1d=round(vix1d, 2) if vix1d else None,
            vix1d_change=round(vix1d_change, 2) if vix1d_change else None,
            term_structure=term_structure,
            regime=get_vix_regime(vix)
        )
        
        # ===== GET OPTION CHAIN / GEX =====
        gex_levels = []
        
        try:
            today_str = date.today().strftime('%Y-%m-%d')
            chain = await schwab_service.get_option_chain(
                symbol='SPY',
                contract_type="ALL",
                strike_count=40,
                from_date=today_str,
                to_date=today_str
            )
            
            call_map = chain.get('callExpDateMap', {})
            put_map = chain.get('putExpDateMap', {})
            
            if call_map and put_map:
                gex_levels = calculate_gex_from_chain(spy_price, call_map, put_map)
                # Scale strikes for SPX
                if underlying.upper() == 'SPX':
                    for g in gex_levels:
                        g.strike = g.strike * 10
            else:
                logger.info("No 0-DTE options, using estimates")
                gex_levels = generate_estimated_gex(spot_price, underlying)
                
        except Exception as e:
            logger.warning(f"Option chain failed: {e}, using estimates")
            gex_levels = generate_estimated_gex(spot_price, underlying)
        
        # Filter to relevant strikes (within 3%)
        relevant_gex = [g for g in gex_levels if abs(g.strike - spot_price) / spot_price < 0.03]
        
        # Calculate totals
        total_gex = sum(g.net_gex for g in gex_levels)
        total_call_oi = sum(g.call_oi for g in gex_levels)
        total_put_oi = sum(g.put_oi for g in gex_levels)
        put_call_ratio = total_put_oi / total_call_oi if total_call_oi > 0 else 1.0
        
        return ZeroDTEMarketData(
            timestamp=datetime.now(),
            underlying=underlying.upper(),
            spot_price=round(spot_price, 2),
            spot_change=round(spot_change, 2),
            spot_change_percent=round(spot_change_pct, 2),
            vix_data=vix_data,
            regime=determine_regime(total_gex),
            key_levels=find_key_levels(gex_levels, spot_price),
            gex_profile=relevant_gex,
            total_call_oi=total_call_oi,
            total_put_oi=total_put_oi,
            put_call_ratio=round(put_call_ratio, 2)
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Market data error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/vix")
async def get_vix_data():
    """Get VIX data"""
    
    from app.services.schwab_service import schwab_service
    
    try:
        vix_response = await schwab_service.get_quotes(['$VIX'])
        
        vix = 15.0
        vix_change = 0.0
        vix_change_pct = 0.0
        
        if '$VIX' in vix_response:
            q = vix_response['$VIX'].get('quote', {})
            vix = safe_float(q.get('lastPrice') or q.get('closePrice'), 15)
            vix_change = safe_float(q.get('netChange'), 0)
            vix_change_pct = safe_float(q.get('netPercentChange'), 0)
        
        # VIX1D
        vix1d = None
        vix1d_change = None
        try:
            vix1d_response = await schwab_service.get_quotes(['$VIX1D'])
            if '$VIX1D' in vix1d_response:
                q = vix1d_response['$VIX1D'].get('quote', {})
                vix1d = safe_float(q.get('lastPrice') or q.get('closePrice'))
                vix1d_change = safe_float(q.get('netPercentChange'))
        except:
            pass
        
        term_structure = 'unknown'
        if vix1d and vix > 0:
            if vix1d < vix * 0.95:
                term_structure = 'contango'
            elif vix1d > vix * 1.05:
                term_structure = 'backwardation'
            else:
                term_structure = 'flat'
        
        return {
            'vix': round(vix, 2),
            'vix_change': round(vix_change, 2),
            'vix_change_percent': round(vix_change_pct, 2),
            'vix1d': round(vix1d, 2) if vix1d else None,
            'vix1d_change': round(vix1d_change, 2) if vix1d_change else None,
            'term_structure': term_structure,
            'regime': get_vix_regime(vix),
            'timestamp': datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"VIX error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/trading-windows")
async def get_trading_windows():
    """Get trading window status"""
    
    try:
        import pytz
        now = datetime.now(pytz.timezone('US/Eastern'))
    except:
        now = datetime.now()
    
    minutes = now.hour * 60 + now.minute
    
    windows = [
        {'name': 'Pre-Market', 'start': 480, 'end': 570, 'type': 'prep'},
        {'name': 'Opening Range', 'start': 570, 'end': 585, 'type': 'avoid'},
        {'name': 'Optimal Entry', 'start': 585, 'end': 615, 'type': 'optimal'},
        {'name': 'Mid-Day', 'start': 615, 'end': 840, 'type': 'manage'},
        {'name': 'Power Hour', 'start': 840, 'end': 900, 'type': 'caution'},
        {'name': 'Danger Zone', 'start': 900, 'end': 950, 'type': 'danger'},
        {'name': 'Final Minutes', 'start': 950, 'end': 960, 'type': 'lethal'},
    ]
    
    current = None
    for w in windows:
        if w['start'] <= minutes < w['end']:
            current = w
            break
    
    exit_time = 950  # 3:50 PM
    if minutes < exit_time:
        remaining = exit_time - minutes
        time_to_close = f"{remaining // 60}h {remaining % 60}m" if remaining >= 60 else f"{remaining}m"
    else:
        time_to_close = "PAST EXIT"
    
    return {
        'current_time': now.strftime('%H:%M:%S ET'),
        'current_window': current,
        'time_to_close': time_to_close,
        'windows': windows,
        'market_open': 570 <= minutes < 960
    }


@router.get("/kill-switch-status")
async def get_kill_switch_status():
    """Check kill switch conditions"""
    
    try:
        vix_data = await get_vix_data()
    except:
        vix_data = {'vix': 15, 'vix_change_percent': 0, 'vix1d_change': None, 'regime': 'low', 'term_structure': 'unknown'}
    
    trading = await get_trading_windows()
    
    alerts = []
    threat = 'normal'
    
    # VIX1D spike
    v1d = vix_data.get('vix1d_change')
    if v1d and v1d > 10:
        alerts.append({'type': 'vix_spike', 'severity': 'critical', 'message': f'VIX1D +{v1d:.1f}% - CLOSE ALL'})
        threat = 'critical'
    elif v1d and v1d > 5:
        alerts.append({'type': 'vix_elevated', 'severity': 'warning', 'message': f'VIX1D +{v1d:.1f}%'})
        threat = 'elevated'
    
    # Time
    window = trading.get('current_window')
    if window:
        if window['type'] == 'lethal':
            alerts.append({'type': 'time', 'severity': 'critical', 'message': 'EXIT NOW'})
            threat = 'critical'
        elif window['type'] == 'danger':
            alerts.append({'type': 'time', 'severity': 'warning', 'message': f"{trading['time_to_close']} to exit"})
            if threat == 'normal':
                threat = 'elevated'
    
    # VIX regime
    if vix_data['regime'] == 'extreme':
        alerts.append({'type': 'vix', 'severity': 'critical', 'message': f"VIX {vix_data['vix']} EXTREME"})
        threat = 'critical'
    
    # Term structure
    if vix_data.get('term_structure') == 'backwardation':
        alerts.append({'type': 'term', 'severity': 'warning', 'message': 'VIX backwardation'})
        if threat == 'normal':
            threat = 'elevated'
    
    return {
        'threat_level': threat,
        'alerts': alerts,
        'kill_switch_recommended': threat == 'critical',
        'timestamp': datetime.now().isoformat()
    }


@router.get("/test")
async def test_schwab():
    """Diagnostic endpoint"""
    from app.services.schwab_service import schwab_service
    
    results = {'authenticated': schwab_service.is_authenticated(), 'token_expiry': str(schwab_service.get_token_expiry())}
    
    try:
        spy = await schwab_service.get_quotes(['SPY'])
        results['spy_raw'] = spy
        results['spy_success'] = True
    except Exception as e:
        results['spy_error'] = str(e)
        results['spy_success'] = False
    
    try:
        vix = await schwab_service.get_quotes(['$VIX'])
        results['vix_raw'] = vix
        results['vix_success'] = True
    except Exception as e:
        results['vix_error'] = str(e)
        results['vix_success'] = False
    
    return results
