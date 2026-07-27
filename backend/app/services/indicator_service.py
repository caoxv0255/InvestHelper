import numpy as np
import pandas as pd
from typing import List, Tuple


class IndicatorService:
    @staticmethod
    def calculate_ma(close_prices: List[float], period: int) -> List[float]:
        if len(close_prices) < period:
            return [None] * len(close_prices)
        ma = []
        for i in range(len(close_prices)):
            if i < period - 1:
                ma.append(None)
            else:
                ma.append(round(sum(close_prices[i - period + 1 : i + 1]) / period, 4))
        return ma

    @staticmethod
    def calculate_macd(
        close_prices: List[float],
        fast: int = 12,
        slow: int = 26,
        signal: int = 9,
    ) -> Tuple[List[float], List[float], List[float]]:
        close_arr = np.array(close_prices, dtype=float)
        ema_fast = pd.Series(close_arr).ewm(span=fast, adjust=False).mean().values
        ema_slow = pd.Series(close_arr).ewm(span=slow, adjust=False).mean().values
        dif = ema_fast - ema_slow
        dea = pd.Series(dif).ewm(span=signal, adjust=False).mean().values
        macd_hist = (dif - dea) * 2

        return (
            [round(x, 4) if not np.isnan(x) else None for x in dif],
            [round(x, 4) if not np.isnan(x) else None for x in dea],
            [round(x, 4) if not np.isnan(x) else None for x in macd_hist],
        )

    @staticmethod
    def calculate_kdj(
        high_prices: List[float],
        low_prices: List[float],
        close_prices: List[float],
        n: int = 9,
        m1: int = 3,
        m2: int = 3,
    ) -> Tuple[List[float], List[float], List[float]]:
        length = len(close_prices)
        if length < n:
            return [None] * length, [None] * length, [None] * length

        k_values = []
        d_values = []
        j_values = []

        rsv_list = []
        for i in range(length):
            if i < n - 1:
                rsv_list.append(None)
                k_values.append(None)
                d_values.append(None)
                j_values.append(None)
            else:
                period_high = max(high_prices[i - n + 1 : i + 1])
                period_low = min(low_prices[i - n + 1 : i + 1])
                if period_high == period_low:
                    rsv = 50.0
                else:
                    rsv = (close_prices[i] - period_low) / (period_high - period_low) * 100
                rsv_list.append(rsv)

                if i == n - 1:
                    k = rsv
                    d = rsv
                else:
                    k = (k_values[-1] * (m1 - 1) + rsv) / m1
                    d = (d_values[-1] * (m2 - 1) + k) / m2
                j = 3 * k - 2 * d

                k_values.append(round(k, 2))
                d_values.append(round(d, 2))
                j_values.append(round(j, 2))

        return k_values, d_values, j_values
