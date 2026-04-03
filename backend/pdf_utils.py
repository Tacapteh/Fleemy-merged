"""Utilities for generating PDF exports for quotes and invoices."""

from __future__ import annotations

import asyncio
from datetime import datetime
from io import BytesIO
from typing import Any, Dict, Iterable, List

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

Styles = getSampleStyleSheet()
Styles.add(
    ParagraphStyle(
        name="SmallGrey",
        parent=Styles["Normal"],
        fontSize=9,
        textColor=colors.grey,
    )
)


def _format_currency(value: Any) -> str:
    try:
        amount = float(value or 0.0)
    except (TypeError, ValueError):
        return "0,00 €"

    formatted = f"{amount:,.2f}".replace(",", " ").replace(".", ",")
    return f"{formatted} €"


def _format_quantity(value: Any) -> str:
    try:
        quantity = float(value)
    except (TypeError, ValueError):
        return ""

    if quantity.is_integer():
        return f"{int(quantity)}"
    return f"{quantity:.2f}".rstrip("0").rstrip(".")


def _parse_datetime(value: Any) -> datetime | None:
    if isinstance(value, datetime):
        return value
    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return None
    return None


def _format_date(value: Any) -> str:
    parsed = _parse_datetime(value)
    if parsed is None:
        return ""
    return parsed.strftime("%d/%m/%Y")


def _document_title(document: Dict[str, Any], document_type: str) -> str:
    label = "Devis" if document_type == "quote" else "Facture"
    number_key = "quote_number" if document_type == "quote" else "invoice_number"
    number = document.get(number_key) or document.get("number") or document.get("id")
    return f"{label} {number}" if number else label


def _document_filename(document: Dict[str, Any], document_type: str) -> str:
    prefix = "devis" if document_type == "quote" else "facture"
    number_key = "quote_number" if document_type == "quote" else "invoice_number"
    number = document.get(number_key) or document.get("number") or document.get("id")
    safe_number = str(number).strip().replace("/", "-") if number else "document"
    return f"{prefix}-{safe_number}.pdf"


def _items_rows(items: Iterable[Dict[str, Any]]) -> List[List[str]]:
    rows: List[List[str]] = []
    for item in items or []:
        description = str(item.get("description", "")).strip()
        if not description and not any(
            str(item.get(key, "")).strip() for key in ("quantity", "unit_price", "total")
        ):
            continue

        rows.append(
            [
                description or "—",
                _format_quantity(item.get("quantity", "")),
                _format_currency(item.get("unit_price", 0.0)),
                _format_currency(item.get("total", 0.0)),
            ]
        )
    return rows


def _build_pdf(document: Dict[str, Any], document_type: str) -> bytes:
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=18 * mm,
        rightMargin=18 * mm,
        topMargin=20 * mm,
        bottomMargin=20 * mm,
    )

    elements = []

    elements.append(Paragraph(_document_title(document, document_type), Styles["Title"]))
    elements.append(Spacer(1, 6))

    client_name = document.get("client_name") or document.get("client", {}).get("name")
    if client_name:
        elements.append(Paragraph(f"Client : {client_name}", Styles["Normal"]))

    reference_date = (
        document.get("valid_until") if document_type == "quote" else document.get("due_date")
    )
    date_label = "Valable jusqu'au" if document_type == "quote" else "Date d'échéance"
    formatted_date = _format_date(reference_date)
    if formatted_date:
        elements.append(Paragraph(f"{date_label} : {formatted_date}", Styles["Normal"]))

    created_at = _format_date(document.get("created_at"))
    if created_at:
        elements.append(Paragraph(f"Créé le : {created_at}", Styles["SmallGrey"]))

    elements.append(Spacer(1, 12))

    table_data: List[List[str]] = [
        ["Description", "Quantité", "Prix unitaire", "Total"],
        *_items_rows(document.get("items", [])),
    ]

    table = Table(
        table_data,
        colWidths=[None, 35 * mm, 40 * mm, 40 * mm],
        hAlign="LEFT",
    )
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1f2937")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
                ("ALIGN", (1, 0), (-1, -1), "RIGHT"),
                ("ALIGN", (0, 0), (0, -1), "LEFT"),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("BOTTOMPADDING", (0, 0), (-1, 0), 10),
                ("BACKGROUND", (0, 1), (-1, -1), colors.white),
                ("GRID", (0, 0), (-1, -1), 0.25, colors.lightgrey),
            ]
        )
    )
    elements.append(table)
    elements.append(Spacer(1, 12))

    totals_table_data: List[List[str]] = []
    totals_table_data.append(["Sous-total", _format_currency(document.get("subtotal"))])

    if document.get("tax_rate") is not None:
        tax_rate = document.get("tax_rate")
        totals_table_data.append(
            [
                f"TVA ({tax_rate} %)",
                _format_currency(document.get("tax_amount")),
            ]
        )

    totals_table_data.append(["Total", _format_currency(document.get("total"))])

    totals_table = Table(
        totals_table_data,
        colWidths=[60 * mm, 40 * mm],
        hAlign="RIGHT",
    )
    totals_table.setStyle(
        TableStyle(
            [
                ("ALIGN", (0, 0), (-1, -1), "RIGHT"),
                ("ALIGN", (0, 0), (0, -1), "LEFT"),
                ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
                ("LINEABOVE", (0, -1), (-1, -1), 0.5, colors.black),
                ("TOPPADDING", (0, 0), (-1, -1), 2),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
            ]
        )
    )
    elements.append(totals_table)

    notes = document.get("notes")
    if notes:
        elements.append(Spacer(1, 12))
        elements.append(Paragraph("Notes", Styles["Heading4"]))
        elements.append(Paragraph(str(notes), Styles["Normal"]))

    doc.build(elements)
    return buffer.getvalue()


async def quote_pdf_bytes(quote: Dict[str, Any]) -> bytes:
    """Generate a PDF for a quote document."""

    return await asyncio.to_thread(_build_pdf, quote, "quote")


async def invoice_pdf_bytes(invoice: Dict[str, Any]) -> bytes:
    """Generate a PDF for an invoice document."""

    return await asyncio.to_thread(_build_pdf, invoice, "invoice")


def document_filename(document: Dict[str, Any], document_type: str) -> str:
    """Return the preferred filename for the exported PDF."""

    return _document_filename(document, document_type)
