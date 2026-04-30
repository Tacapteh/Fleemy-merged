from fastapi import APIRouter, HTTPException, Depends, Request, Response, Body
from fastapi.responses import JSONResponse
from typing import Dict, Any, Optional
from datetime import datetime, timezone
import asyncio
import os
import logging

from server import (
    verify_token,
    db,
    firestore,
    user_col,
    user_doc,
    team_col,
    stream_docs,
    _apply_cors_headers,
    Quote,
    Invoice,
    QuoteCreateRequest,
    InvoiceCreateRequest,
    InvoiceStatusUpdate,
    DocumentPdfRequest,
    DocumentEmailRequest,
)

try:
    from pdf_utils import document_filename, invoice_pdf_bytes, quote_pdf_bytes
    from email_utils import send_document_email
except ImportError:
    from backend.pdf_utils import document_filename, invoice_pdf_bytes, quote_pdf_bytes
    from backend.email_utils import send_document_email

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/quotes")
async def get_quotes(user: Dict[str, Any] = Depends(verify_token)):
    return await stream_docs(user_col(user["uid"], "quotes").order_by("created_at", direction=firestore.Query.DESCENDING))


@router.post("/quotes")
async def create_quote(quote_request: QuoteCreateRequest, user: Dict[str, Any] = Depends(verify_token)):
    quote_count = len(await stream_docs(user_col(user["uid"], "quotes")))
    quote_number = f"DEV-{datetime.now(timezone.utc).year}-{quote_count + 1:04d}"
    data = quote_request.dict()
    data["quote_number"] = quote_number
    data["valid_until"] = datetime.fromisoformat(data["valid_until"].replace("Z", "+00:00"))
    subtotal = sum(it["quantity"] * it["unit_price"] for it in data["items"])
    tax_amount = subtotal * (data["tax_rate"] / 100)
    data.update({"subtotal": subtotal, "tax_amount": tax_amount, "total": subtotal + tax_amount})
    quote = Quote(uid=user["uid"], **data)
    await asyncio.to_thread(user_col(user["uid"], "quotes").document(quote.id).set, quote.dict())
    user_snap = await asyncio.to_thread(user_doc(user["uid"]).get)
    team_id = user_snap.to_dict().get("team_id") if user_snap.exists else None
    if team_id:
        await asyncio.to_thread(team_col(team_id, "quotes").document(quote.id).set, quote.dict())
    return quote


@router.put("/quotes/{quote_id}")
async def update_quote(quote_id: str, quote_request: QuoteCreateRequest, user: Dict[str, Any] = Depends(verify_token)):
    data = quote_request.dict()
    data["valid_until"] = datetime.fromisoformat(data["valid_until"].replace("Z", "+00:00"))
    subtotal = sum(it["quantity"] * it["unit_price"] for it in data["items"])
    tax_amount = subtotal * (data["tax_rate"] / 100)
    data.update({"subtotal": subtotal, "tax_amount": tax_amount, "total": subtotal + tax_amount, "updated_at": datetime.now(timezone.utc)})
    await asyncio.to_thread(user_col(user["uid"], "quotes").document(quote_id).update, data)
    user_snap = await asyncio.to_thread(user_doc(user["uid"]).get)
    team_id = user_snap.to_dict().get("team_id") if user_snap.exists else None
    if team_id:
        await asyncio.to_thread(team_col(team_id, "quotes").document(quote_id).update, data)
    return (await asyncio.to_thread(user_col(user["uid"], "quotes").document(quote_id).get)).to_dict()


@router.delete("/quotes/{quote_id}")
async def delete_quote(quote_id: str, user: Dict[str, Any] = Depends(verify_token)):
    doc_ref = user_col(user["uid"], "quotes").document(quote_id)
    if not (await asyncio.to_thread(doc_ref.get)).exists:
        raise HTTPException(status_code=404, detail="Quote not found")
    await asyncio.to_thread(doc_ref.delete)
    user_snap = await asyncio.to_thread(user_doc(user["uid"]).get)
    team_id = user_snap.to_dict().get("team_id") if user_snap.exists else None
    if team_id:
        await asyncio.to_thread(team_col(team_id, "quotes").document(quote_id).delete)
    return {"message": "Quote deleted"}


@router.put("/quotes/{quote_id}/status")
async def update_quote_status(quote_id: str, status: str, user: Dict[str, Any] = Depends(verify_token)):
    update_data = {"status": status, "updated_at": datetime.now(timezone.utc)}
    await asyncio.to_thread(user_col(user["uid"], "quotes").document(quote_id).update, update_data)
    user_snap = await asyncio.to_thread(user_doc(user["uid"]).get)
    team_id = user_snap.to_dict().get("team_id") if user_snap.exists else None
    if team_id:
        await asyncio.to_thread(team_col(team_id, "quotes").document(quote_id).update, update_data)
    return (await asyncio.to_thread(user_col(user["uid"], "quotes").document(quote_id).get)).to_dict()


@router.get("/invoices")
async def get_invoices(user: Dict[str, Any] = Depends(verify_token)):
    return await stream_docs(user_col(user["uid"], "invoices").order_by("created_at", direction=firestore.Query.DESCENDING))


@router.post("/invoices")
async def create_invoice(invoice_request: InvoiceCreateRequest, user: Dict[str, Any] = Depends(verify_token)):
    invoice_count = len(await stream_docs(user_col(user["uid"], "invoices")))
    invoice_number = f"FACT-{datetime.now(timezone.utc).year}-{invoice_count + 1:04d}"
    data = invoice_request.dict()
    data["invoice_number"] = invoice_number
    data["due_date"] = datetime.fromisoformat(data["due_date"].replace("Z", "+00:00"))
    subtotal = sum(it["quantity"] * it["unit_price"] for it in data["items"])
    tax_amount = subtotal * (data["tax_rate"] / 100)
    data.update({"subtotal": subtotal, "tax_amount": tax_amount, "total": subtotal + tax_amount})
    invoice = Invoice(uid=user["uid"], **data)
    await asyncio.to_thread(user_col(user["uid"], "invoices").document(invoice.id).set, invoice.dict())
    user_snap = await asyncio.to_thread(user_doc(user["uid"]).get)
    team_id = user_snap.to_dict().get("team_id") if user_snap.exists else None
    if team_id:
        await asyncio.to_thread(team_col(team_id, "invoices").document(invoice.id).set, invoice.dict())
    return invoice


@router.put("/invoices/{invoice_id}")
async def update_invoice(invoice_id: str, invoice_request: InvoiceCreateRequest, user: Dict[str, Any] = Depends(verify_token)):
    data = invoice_request.dict()
    data["due_date"] = datetime.fromisoformat(data["due_date"].replace("Z", "+00:00"))
    subtotal = sum(it["quantity"] * it["unit_price"] for it in data["items"])
    tax_amount = subtotal * (data["tax_rate"] / 100)
    data.update({"subtotal": subtotal, "tax_amount": tax_amount, "total": subtotal + tax_amount, "updated_at": datetime.now(timezone.utc)})
    await asyncio.to_thread(user_col(user["uid"], "invoices").document(invoice_id).update, data)
    user_snap = await asyncio.to_thread(user_doc(user["uid"]).get)
    team_id = user_snap.to_dict().get("team_id") if user_snap.exists else None
    if team_id:
        await asyncio.to_thread(team_col(team_id, "invoices").document(invoice_id).update, data)
    return (await asyncio.to_thread(user_col(user["uid"], "invoices").document(invoice_id).get)).to_dict()


@router.delete("/invoices/{invoice_id}")
async def delete_invoice(invoice_id: str, user: Dict[str, Any] = Depends(verify_token)):
    doc_ref = user_col(user["uid"], "invoices").document(invoice_id)
    if not (await asyncio.to_thread(doc_ref.get)).exists:
        raise HTTPException(status_code=404, detail="Invoice not found")
    await asyncio.to_thread(doc_ref.delete)
    user_snap = await asyncio.to_thread(user_doc(user["uid"]).get)
    team_id = user_snap.to_dict().get("team_id") if user_snap.exists else None
    if team_id:
        await asyncio.to_thread(team_col(team_id, "invoices").document(invoice_id).delete)
    return {"message": "Invoice deleted"}


@router.put("/invoices/{invoice_id}/status")
async def update_invoice_status(
    invoice_id: str,
    status_update: Optional[InvoiceStatusUpdate] = Body(None),
    status: Optional[str] = None,
    user: Dict[str, Any] = Depends(verify_token),
):
    update_data = {"status": status, "updated_at": datetime.now(timezone.utc)}
    if status == "paid":
        update_data["paid_date"] = datetime.now(timezone.utc)
    await asyncio.to_thread(user_col(user["uid"], "invoices").document(invoice_id).update, update_data)
    user_snap = await asyncio.to_thread(user_doc(user["uid"]).get)
    team_id = user_snap.to_dict().get("team_id") if user_snap.exists else None
    if team_id:
        await asyncio.to_thread(team_col(team_id, "invoices").document(invoice_id).update, update_data)
    return (await asyncio.to_thread(user_col(user["uid"], "invoices").document(invoice_id).get)).to_dict()


@router.post("/documents/{doc_id}/pdf")
async def export_document_pdf(
    doc_id: str,
    payload: DocumentPdfRequest,
    request: Request,
    user: Dict[str, Any] = Depends(verify_token),
):
    document_type = payload.type
    if payload.client_name is not None or payload.items is not None:
        document_data: Dict[str, Any] = {k: v for k, v in payload.dict().items() if k != "type" and v is not None}
        if payload.items is not None:
            document_data["items"] = [item.dict() for item in payload.items]
        document_data.setdefault("invoice_number" if document_type == "invoice" else "quote_number", doc_id)
    else:
        collection_name = "quotes" if document_type == "quote" else "invoices"
        doc_ref = user_col(user["uid"], collection_name).document(doc_id)
        snap = await asyncio.to_thread(doc_ref.get)
        if not getattr(snap, "exists", False):
            raise HTTPException(status_code=404, detail="Document not found")
        document_data = snap.to_dict() or {}
        if document_data.get("uid") and document_data["uid"] != user["uid"]:
            raise HTTPException(status_code=403, detail="Not authorized to access this document")
    try:
        pdf_bytes = await quote_pdf_bytes(document_data) if document_type == "quote" else await invoice_pdf_bytes(document_data)
    except Exception as exc:
        logger.error("PDF generation failed: %s", exc)
        raise HTTPException(status_code=500, detail="Impossible de générer le PDF demandé") from exc
    filename = document_filename(document_data, document_type)
    response = Response(content=pdf_bytes, media_type="application/pdf")
    response.headers["Content-Disposition"] = f'attachment; filename="{filename}"'
    return _apply_cors_headers(request, response)


@router.post("/documents/{doc_id}/email")
async def email_document_endpoint(
    doc_id: str,
    payload: DocumentEmailRequest,
    user: Dict[str, Any] = Depends(verify_token),
):
    document_type = payload.type
    recipient = payload.to
    if not recipient:
        return JSONResponse(status_code=400, content={"success": False, "error": "Adresse email du destinataire manquante"})

    if payload.client_name is not None or payload.items is not None:
        document_data: Dict[str, Any] = {k: v for k, v in payload.dict().items() if k not in ("type", "to", "subject", "body") and v is not None}
        if payload.items is not None:
            document_data["items"] = [item.dict() for item in payload.items]
        document_data.setdefault("invoice_number" if document_type == "invoice" else "quote_number", doc_id)
    else:
        collection_name = "quotes" if document_type == "quote" else "invoices"
        snap = await asyncio.to_thread(user_col(user["uid"], collection_name).document(doc_id).get)
        if not getattr(snap, "exists", False):
            return JSONResponse(status_code=404, content={"success": False, "error": "Document not found"})
        document_data = snap.to_dict() or {}
        if document_data.get("uid") and document_data["uid"] != user["uid"]:
            return JSONResponse(status_code=403, content={"success": False, "error": "Not authorized"})
    try:
        pdf_bytes = await quote_pdf_bytes(document_data) if document_type == "quote" else await invoice_pdf_bytes(document_data)
    except Exception as exc:
        logger.error("PDF gen failed for email: %s", exc)
        return JSONResponse(status_code=500, content={"success": False, "error": "Impossible de générer le PDF"})

    client_display_name = (document_data.get("client_contact_name") or document_data.get("client_name"))
    user_display_name = user.get("name") or user.get("email") or "Utilisateur Fleemy"
    user_email = user.get("email") or os.getenv("EMAIL_FROM")
    try:
        await asyncio.to_thread(
            send_document_email,
            document=document_data, document_type=document_type, recipient=recipient,
            document_id=doc_id, pdf_bytes=pdf_bytes, subject=payload.subject, body=payload.body,
            reply_to_email=user_email, reply_to_name=user_display_name, recipient_name=client_display_name,
        )
    except HTTPException as exc:
        detail = exc.detail if isinstance(exc.detail, str) else str(exc.detail)
        return JSONResponse(status_code=exc.status_code, content={"success": False, "error": f"Échec de l'envoi : {detail}"})
    except Exception as exc:
        return JSONResponse(status_code=500, content={"success": False, "error": f"Échec de l'envoi : {exc}"})
    return {"success": True, "ok": True, "sentTo": payload.to}
