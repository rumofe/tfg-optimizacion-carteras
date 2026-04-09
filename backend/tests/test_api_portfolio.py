"""Tests de integración para los endpoints de carteras (/portfolio/*)."""


def _payload_cartera(nombre="Cartera Test"):
    return {
        "nombre_estrategia": nombre,
        "tickers": ["AAPL", "MSFT"],
        "pesos": {"AAPL": 0.6, "MSFT": 0.4},
        "capital": 10_000,
    }


# ── Guardar cartera ─────────────────────────────────────────────────────────

class TestGuardarCartera:
    def test_guardar_autenticado_devuelve_201(self, client, auth_headers):
        res = client.post("/portfolio/", json=_payload_cartera(), headers=auth_headers)
        assert res.status_code == 201

    def test_guardar_devuelve_id(self, client, auth_headers):
        res = client.post("/portfolio/", json=_payload_cartera(), headers=auth_headers)
        assert "id" in res.json()

    def test_guardar_sin_token_devuelve_401(self, client):
        res = client.post("/portfolio/", json=_payload_cartera())
        assert res.status_code == 401


# ── Listar carteras ─────────────────────────────────────────────────────────

class TestListarCarteras:
    def test_lista_vacia_al_inicio(self, client, auth_headers):
        res = client.get("/portfolio/", headers=auth_headers)
        assert res.status_code == 200
        assert res.json() == []

    def test_lista_devuelve_cartera_guardada(self, client, auth_headers):
        client.post("/portfolio/", json=_payload_cartera(), headers=auth_headers)
        res = client.get("/portfolio/", headers=auth_headers)
        assert len(res.json()) == 1
        assert res.json()[0]["nombre_estrategia"] == "Cartera Test"

    def test_lista_contiene_activos(self, client, auth_headers):
        client.post("/portfolio/", json=_payload_cartera(), headers=auth_headers)
        cartera = client.get("/portfolio/", headers=auth_headers).json()[0]
        tickers_guardados = {a["ticker"] for a in cartera["activos"]}
        assert tickers_guardados == {"AAPL", "MSFT"}

    def test_lista_sin_token_devuelve_401(self, client):
        res = client.get("/portfolio/")
        assert res.status_code == 401

    def test_usuarios_distintos_no_ven_carteras_ajenas(self, client):
        # Usuario A guarda una cartera
        client.post("/auth/register", json={"email": "a@test.com", "password": "passA"})
        token_a = client.post("/auth/login", data={"username": "a@test.com", "password": "passA"}).json()["access_token"]
        headers_a = {"Authorization": f"Bearer {token_a}"}
        client.post("/portfolio/", json=_payload_cartera(), headers=headers_a)

        # Usuario B no debe verla
        client.post("/auth/register", json={"email": "b@test.com", "password": "passB"})
        token_b = client.post("/auth/login", data={"username": "b@test.com", "password": "passB"}).json()["access_token"]
        headers_b = {"Authorization": f"Bearer {token_b}"}
        res = client.get("/portfolio/", headers=headers_b)
        assert res.json() == []


# ── Actualizar cartera ──────────────────────────────────────────────────────

class TestActualizarCartera:
    def test_actualizar_nombre_y_pesos(self, client, auth_headers):
        cartera_id = client.post("/portfolio/", json=_payload_cartera(), headers=auth_headers).json()["id"]
        res = client.put(
            f"/portfolio/{cartera_id}",
            json={"nombre_estrategia": "Nombre Nuevo", "pesos": {"AAPL": 0.7, "MSFT": 0.3}},
            headers=auth_headers,
        )
        assert res.status_code == 200

    def test_nombre_actualizado_aparece_en_lista(self, client, auth_headers):
        cartera_id = client.post("/portfolio/", json=_payload_cartera(), headers=auth_headers).json()["id"]
        client.put(
            f"/portfolio/{cartera_id}",
            json={"nombre_estrategia": "Renombrada", "pesos": {"AAPL": 1.0}},
            headers=auth_headers,
        )
        lista = client.get("/portfolio/", headers=auth_headers).json()
        assert lista[0]["nombre_estrategia"] == "Renombrada"

    def test_actualizar_cartera_inexistente_devuelve_404(self, client, auth_headers):
        res = client.put(
            "/portfolio/99999",
            json={"nombre_estrategia": "X", "pesos": {"AAPL": 1.0}},
            headers=auth_headers,
        )
        assert res.status_code == 404

    def test_actualizar_sin_token_devuelve_401(self, client):
        res = client.put("/portfolio/1", json={"nombre_estrategia": "X", "pesos": {}})
        assert res.status_code == 401


# ── Eliminar cartera ─────────────────────────────────────────────────────────

class TestEliminarCartera:
    def test_eliminar_devuelve_204(self, client, auth_headers):
        cartera_id = client.post("/portfolio/", json=_payload_cartera(), headers=auth_headers).json()["id"]
        res = client.delete(f"/portfolio/{cartera_id}", headers=auth_headers)
        assert res.status_code == 204

    def test_cartera_eliminada_no_aparece_en_lista(self, client, auth_headers):
        cartera_id = client.post("/portfolio/", json=_payload_cartera(), headers=auth_headers).json()["id"]
        client.delete(f"/portfolio/{cartera_id}", headers=auth_headers)
        lista = client.get("/portfolio/", headers=auth_headers).json()
        assert lista == []

    def test_eliminar_cartera_inexistente_devuelve_404(self, client, auth_headers):
        res = client.delete("/portfolio/99999", headers=auth_headers)
        assert res.status_code == 404

    def test_eliminar_sin_token_devuelve_401(self, client):
        res = client.delete("/portfolio/1")
        assert res.status_code == 401
