"""Tests de integración para los endpoints de autenticación (/auth/*)."""


# ── Registro ────────────────────────────────────────────────────────────────

class TestRegistro:
    def test_registro_exitoso_devuelve_201_y_token(self, client):
        res = client.post("/auth/register", json={"email": "nuevo@test.com", "password": "pass123"})
        assert res.status_code == 201
        assert "access_token" in res.json()

    def test_registro_devuelve_token_tipo_bearer(self, client):
        res = client.post("/auth/register", json={"email": "nuevo@test.com", "password": "pass123"})
        assert res.json()["token_type"] == "bearer"

    def test_registro_email_duplicado_devuelve_400(self, client):
        payload = {"email": "dup@test.com", "password": "pass123"}
        client.post("/auth/register", json=payload)
        res = client.post("/auth/register", json=payload)
        assert res.status_code == 400

    def test_registro_email_invalido_devuelve_422(self, client):
        res = client.post("/auth/register", json={"email": "no-es-un-email", "password": "pass"})
        assert res.status_code == 422


# ── Login ───────────────────────────────────────────────────────────────────

class TestLogin:
    def test_login_correcto_devuelve_token(self, client, registered_user):
        res = client.post(
            "/auth/login",
            data={"username": registered_user["email"], "password": registered_user["password"]},
        )
        assert res.status_code == 200
        assert "access_token" in res.json()

    def test_login_contrasena_incorrecta_devuelve_401(self, client, registered_user):
        res = client.post(
            "/auth/login",
            data={"username": registered_user["email"], "password": "INCORRECTA"},
        )
        assert res.status_code == 401

    def test_login_usuario_inexistente_devuelve_401(self, client):
        res = client.post(
            "/auth/login",
            data={"username": "fantasma@test.com", "password": "cualquiera"},
        )
        assert res.status_code == 401


# ── Perfil ──────────────────────────────────────────────────────────────────

class TestPerfil:
    def test_get_perfil_sin_token_devuelve_401(self, client):
        res = client.get("/auth/profile")
        assert res.status_code == 401

    def test_get_perfil_con_token_invalido_devuelve_401(self, client):
        res = client.get("/auth/profile", headers={"Authorization": "Bearer token.falso.aqui"})
        assert res.status_code == 401

    def test_get_perfil_autenticado_devuelve_email(self, client, registered_user, auth_headers):
        res = client.get("/auth/profile", headers=auth_headers)
        assert res.status_code == 200
        assert res.json()["email"] == registered_user["email"]

    def test_get_perfil_valores_iniciales_son_null(self, client, auth_headers):
        res = client.get("/auth/profile", headers=auth_headers)
        data = res.json()
        assert data["capital_base"] is None
        assert data["tolerancia_riesgo"] is None

    def test_put_perfil_actualiza_capital(self, client, auth_headers):
        res = client.put(
            "/auth/profile",
            json={"capital_base": 25000.0},
            headers=auth_headers,
        )
        assert res.status_code == 200
        assert res.json()["capital_base"] == 25000.0

    def test_put_perfil_actualiza_tolerancia(self, client, auth_headers):
        res = client.put(
            "/auth/profile",
            json={"tolerancia_riesgo": 15.0},
            headers=auth_headers,
        )
        assert res.status_code == 200
        assert res.json()["tolerancia_riesgo"] == 15.0

    def test_put_perfil_persiste_al_volver_a_consultar(self, client, auth_headers):
        client.put("/auth/profile", json={"capital_base": 50000.0}, headers=auth_headers)
        res = client.get("/auth/profile", headers=auth_headers)
        assert res.json()["capital_base"] == 50000.0

    def test_put_perfil_sin_token_devuelve_401(self, client):
        res = client.put("/auth/profile", json={"capital_base": 1000.0})
        assert res.status_code == 401
