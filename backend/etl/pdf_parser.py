import logging
import re
from dataclasses import dataclass
from typing import Optional

import pdfplumber

logger = logging.getLogger(__name__)

# Captura números con coma o punto decimal y % opcional: "12,34 %" o "12.34%"
_NUMERO_RE = re.compile(r"[\d]+[,.]?\d*")


@dataclass
class FilaCartera:
    pais: str
    sector: str
    peso_porcentaje: float


class FondoParser:
    def parse(self, filepath: str) -> list[FilaCartera]:
        """
        Extrae filas [pais, sector, peso_porcentaje] de un PDF de gestora española.
        Devuelve lista vacía si no encuentra datos válidos; registra errores en el log.
        """
        resultados: list[FilaCartera] = []

        try:
            with pdfplumber.open(filepath) as pdf:
                for page_num, page in enumerate(pdf.pages, start=1):
                    tablas = page.extract_tables()
                    for tabla in tablas:
                        filas = self._procesar_tabla(tabla, page_num)
                        resultados.extend(filas)
        except FileNotFoundError:
            logger.error("PDF no encontrado: %s", filepath)
        except Exception as exc:
            logger.error("Error inesperado al parsear %s: %s", filepath, exc)

        if not resultados:
            logger.warning("No se encontraron datos válidos en %s", filepath)

        return resultados

    def _procesar_tabla(self, tabla: list, page_num: int) -> list[FilaCartera]:
        filas: list[FilaCartera] = []

        # Buscar cabecera que contenga las columnas esperadas
        header_idx: Optional[int] = None
        col_pais = col_sector = col_peso = -1

        for i, fila in enumerate(tabla):
            if fila is None:
                continue
            celdas = [str(c).lower().strip() if c else "" for c in fila]
            if any("pa" in c for c in celdas) and any("sector" in c for c in celdas):
                header_idx = i
                col_pais = next((j for j, c in enumerate(celdas) if "pa" in c), -1)
                col_sector = next((j for j, c in enumerate(celdas) if "sector" in c), -1)
                col_peso = next(
                    (j for j, c in enumerate(celdas) if "peso" in c or "%" in c or "pond" in c), -1
                )
                break

        if header_idx is None or -1 in (col_pais, col_sector, col_peso):
            logger.debug("Página sin cabecera reconocible (pág. %d)", page_num)
            return filas

        for fila in tabla[header_idx + 1:]:
            if not fila or all(c is None or str(c).strip() == "" for c in fila):
                continue
            try:
                pais = str(fila[col_pais] or "").strip()
                sector = str(fila[col_sector] or "").strip()
                peso_raw = str(fila[col_peso] or "")
                match = _NUMERO_RE.search(peso_raw)
                if not match or not pais or not sector:
                    continue
                peso = float(match.group().replace(",", "."))
                filas.append(FilaCartera(pais=pais, sector=sector, peso_porcentaje=peso))
            except Exception as exc:
                logger.warning("Fila ignorada por error de parseo: %s — %s", fila, exc)

        return filas
