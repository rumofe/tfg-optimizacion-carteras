"""
Tests de la caché TTL y, en particular, del bloqueo por clave (single-flight)
que evita el efecto "cache stampede": N peticiones simultáneas de la misma
clave deben provocar UNA sola ejecución de la función subyacente.
"""
import threading
import time

from etl.cache import TTLCache, ttl_cache


class TestTTLCacheBasico:
    def test_hit_y_miss(self):
        cache = TTLCache(ttl_seconds=10)
        assert cache.get("k") is None        # miss
        cache.set("k", 42)
        assert cache.get("k") == 42          # hit

    def test_expiracion(self):
        cache = TTLCache(ttl_seconds=0)      # expira de inmediato
        cache.set("k", 1)
        time.sleep(0.01)
        assert cache.get("k") is None        # ya caducado

    def test_lru_descarta_el_mas_antiguo(self):
        cache = TTLCache(ttl_seconds=100, max_size=2)
        cache.set("a", 1)
        cache.set("b", 2)
        cache.set("c", 3)                    # excede el tamaño -> descarta "a"
        assert cache.get("a") is None
        assert cache.get("b") == 2
        assert cache.get("c") == 3


class TestSingleFlight:
    def test_peticiones_concurrentes_misma_clave_una_sola_ejecucion(self):
        """N hilos piden la misma clave a la vez con la caché vacía.
        Gracias al lock por clave, la función subyacente debe ejecutarse
        UNA sola vez; el resto sirve el resultado desde la caché."""
        cache = TTLCache(ttl_seconds=100)
        llamadas = {"n": 0}
        lock_contador = threading.Lock()

        @ttl_cache(cache)
        def descarga_lenta(ticker):
            with lock_contador:
                llamadas["n"] += 1
            time.sleep(0.05)                 # simula la latencia de la API
            return f"datos_{ticker}"

        resultados = []
        res_lock = threading.Lock()

        def worker():
            r = descarga_lenta("SPY")
            with res_lock:
                resultados.append(r)

        hilos = [threading.Thread(target=worker) for _ in range(10)]
        for h in hilos:
            h.start()
        for h in hilos:
            h.join()

        # La función solo se ejecutó una vez pese a las 10 peticiones simultáneas
        assert llamadas["n"] == 1
        # Y las 10 obtuvieron el mismo resultado correcto
        assert resultados == ["datos_SPY"] * 10

    def test_claves_distintas_se_ejecutan_por_separado(self):
        """Peticiones de claves distintas no deben bloquearse entre sí:
        cada clave ejecuta su propia descarga."""
        cache = TTLCache(ttl_seconds=100)
        llamadas = {"n": 0}
        lock_contador = threading.Lock()

        @ttl_cache(cache)
        def descarga(ticker):
            with lock_contador:
                llamadas["n"] += 1
            return f"datos_{ticker}"

        for t in ("SPY", "TLT", "GLD"):
            descarga(t)

        assert llamadas["n"] == 3             # una por ticker distinto
