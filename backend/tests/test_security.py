"""Tests unitarios para app.core.security (sin red ni BD)."""

import pytest
from jose import JWTError

from app.core.security import (
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)


class TestHashPassword:
    def test_devuelve_string(self):
        assert isinstance(hash_password("mi_clave"), str)

    def test_no_es_la_contrasena_en_texto_plano(self):
        assert hash_password("mi_clave") != "mi_clave"

    def test_sal_aleatoria_produce_hashes_distintos(self):
        # bcrypt usa sal aleatoria: el mismo input genera hashes distintos
        h1 = hash_password("misma_clave")
        h2 = hash_password("misma_clave")
        assert h1 != h2


class TestVerifyPassword:
    def test_contrasena_correcta(self):
        h = hash_password("correcta")
        assert verify_password("correcta", h) is True

    def test_contrasena_incorrecta(self):
        h = hash_password("correcta")
        assert verify_password("incorrecta", h) is False

    def test_cadena_vacia_no_coincide(self):
        h = hash_password("algo")
        assert verify_password("", h) is False


class TestJWT:
    def test_token_es_string_no_vacio(self):
        token = create_access_token("42")
        assert isinstance(token, str) and len(token) > 0

    def test_roundtrip_subject(self):
        token = create_access_token("99")
        assert decode_access_token(token) == "99"

    def test_subject_numerico_grande(self):
        token = create_access_token("1000000")
        assert decode_access_token(token) == "1000000"

    def test_token_invalido_lanza_jwterror(self):
        with pytest.raises(JWTError):
            decode_access_token("esto.no.es.un.token")

    def test_token_manipulado_lanza_jwterror(self):
        token = create_access_token("1")
        # Alteramos el último carácter
        manipulado = token[:-1] + ("A" if token[-1] != "A" else "B")
        with pytest.raises(JWTError):
            decode_access_token(manipulado)
