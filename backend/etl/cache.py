"""
Caché TTL en memoria para datos de mercado.

Justificación: yfinance descarga histórico cada vez que se llama, lo que añade
8-15 s de latencia y satura el rate-limit de Yahoo Finance cuando varios usuarios
hacen optimizaciones/backtests con tickers comunes (SPY, AAPL, etc.).

Implementación: caché LRU con expiración por entrada. Los precios diarios se
estabilizan al cierre, así que un TTL de 6 h es razonable para precios y de 1 h
para metadatos. Sin dependencias externas.
"""

from __future__ import annotations

import threading
import time
from collections import OrderedDict
from functools import wraps
from typing import Any, Callable

import logging

logger = logging.getLogger(__name__)


class TTLCache:
    """LRU cache con expiración por entrada. Thread-safe."""

    def __init__(self, ttl_seconds: int, max_size: int = 256):
        self.ttl = ttl_seconds
        self.max_size = max_size
        self._store: OrderedDict[Any, tuple[float, Any]] = OrderedDict()
        self._lock = threading.RLock()
        # Métricas para introspección (útil en /debug y para la memoria del TFG)
        self.hits = 0
        self.misses = 0

    def get(self, key: Any) -> Any | None:
        with self._lock:
            entry = self._store.get(key)
            if entry is None:
                self.misses += 1
                return None
            timestamp, value = entry
            if time.monotonic() - timestamp > self.ttl:
                del self._store[key]
                self.misses += 1
                return None
            # Mover al final para LRU
            self._store.move_to_end(key)
            self.hits += 1
            return value

    def set(self, key: Any, value: Any) -> None:
        with self._lock:
            self._store[key] = (time.monotonic(), value)
            self._store.move_to_end(key)
            while len(self._store) > self.max_size:
                self._store.popitem(last=False)

    def clear(self) -> None:
        with self._lock:
            self._store.clear()
            self.hits = 0
            self.misses = 0

    def stats(self) -> dict:
        total = self.hits + self.misses
        return {
            "size": len(self._store),
            "max_size": self.max_size,
            "hits": self.hits,
            "misses": self.misses,
            "hit_rate": round(self.hits / total, 3) if total else 0.0,
            "ttl_seconds": self.ttl,
        }


def ttl_cache(cache: TTLCache):
    """
    Decorador que envuelve una función pura y la cachea por (args, kwargs).

    Uso:
        prices_cache = TTLCache(ttl_seconds=21600)
        @ttl_cache(prices_cache)
        def get_historical_prices(ticker, period, start, end):
            ...
    """
    def decorator(fn: Callable):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            # Saltarse self/cls si los hay (primer arg con __dict__ y no es str/int)
            key_args = args
            if args and hasattr(args[0], "__dict__") and not isinstance(args[0], (str, int, float, tuple)):
                key_args = args[1:]
            key = (fn.__name__, key_args, tuple(sorted(kwargs.items())))
            cached = cache.get(key)
            if cached is not None:
                logger.debug("[cache HIT] %s", key)
                return cached
            result = fn(*args, **kwargs)
            cache.set(key, result)
            return result
        wrapper.cache = cache  # type: ignore
        return wrapper
    return decorator


# Singletons compartidos por toda la aplicación
prices_cache = TTLCache(ttl_seconds=6 * 3600,  max_size=256)  # 6 horas
info_cache   = TTLCache(ttl_seconds=1 * 3600,  max_size=512)  # 1 hora
search_cache = TTLCache(ttl_seconds=15 * 60,   max_size=256)  # 15 min
