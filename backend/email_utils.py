"""Utilities to send documents by email."""

from __future__ import annotations

import base64
import logging
import os
import re
import smtplib
from datetime import datetime
from email.message import EmailMessage
from html import escape
from typing import Any, Dict, Optional, Sequence, Tuple
from urllib.parse import urlparse

import httpx
from fastapi import HTTPException

from .pdf_utils import document_filename

logger = logging.getLogger(__name__)


def _bool_env(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _sender_address() -> str:
    return (
        os.getenv("DOCUMENT_EMAIL_SENDER")
        or os.getenv("SMTP_SENDER")
        or os.getenv("EMAIL_SENDER")
        or os.getenv("SMTP_USERNAME")
        or "no-reply@fleemy.local"
    )


def _env_first(*names: str) -> Optional[str]:
    for name in names:
        value = os.getenv(name)
        if value:
            stripped = value.strip()
            if stripped:
                return stripped
    return None


def _parse_datetime(value: Any) -> Optional[datetime]:
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
    if not parsed:
        return ""
    return parsed.strftime("%d/%m/%Y")


def _format_currency(value: Any) -> str:
    try:
        amount = float(value or 0.0)
    except (TypeError, ValueError):
        return "0,00 €"
    formatted = f"{amount:,.2f}".replace(",", " ").replace(".", ",")
    return f"{formatted} €"


def _document_number(document: Dict[str, Any], document_type: str, fallback: str) -> str:
    key = "quote_number" if document_type == "quote" else "invoice_number"
    number = document.get(key) or document.get("number") or fallback
    return str(number)


def _format_total(document: Dict[str, Any]) -> str:
    return _format_currency(document.get("total"))


def _format_reference_date(document: Dict[str, Any], document_type: str) -> Optional[str]:
    label = "Valable jusqu'au" if document_type == "quote" else "Échéance"
    field = "valid_until" if document_type == "quote" else "due_date"
    formatted = _format_date(document.get(field))
    if not formatted:
        return None
    return f"{label} : {formatted}"


_HTML_TAG_REGEX = re.compile(r"<[a-zA-Z][^>]*>")


def _text_to_html(text: str) -> str:
    escaped = escape(text)
    paragraphs = escaped.replace("\r\n", "\n").split("\n\n")
    html_parts = []
    for paragraph in paragraphs:
        lines = paragraph.split("\n")
        html_parts.append("<p>" + "<br/>".join(lines) + "</p>")
    return "".join(html_parts)


def build_document_email(
    document: Dict[str, Any],
    document_type: str,
    document_id: str,
    *,
    subject: Optional[str] = None,
    body: Optional[str] = None,
) -> Tuple[str, str, str]:
    number = _document_number(document, document_type, document_id)
    subject_label = "devis" if document_type == "quote" else "facture"
    custom_subject = (subject or "").strip()
    final_subject = custom_subject or f"Votre {subject_label} {number}"

    client_name = document.get("client_name") or "client"
    total = _format_total(document)

    body_lines = [
        "Bonjour,",
        "",
        f"Veuillez trouver ci-joint {subject_label} {number} destiné à {client_name}.",
    ]

    reference = _format_reference_date(document, document_type)
    if reference:
        body_lines.append(reference)

    body_lines.extend(
        [
            f"Montant total : {total}.",
            "",
            "N'hésitez pas à nous contacter si vous avez des questions.",
            "",
            "Belle journée,",
            "L'équipe Fleemy",
        ]
    )

    normalized_body = (body or "").replace("\r\n", "\n")
    custom_body = normalized_body.strip()
    body_content = normalized_body if custom_body else "\n".join(body_lines)

    if custom_body and _HTML_TAG_REGEX.search(normalized_body):
        html_body = normalized_body
    else:
        html_body = _text_to_html(body_content)

    return final_subject, body_content, html_body


def _smtp_connection_from_url() -> Dict[str, Optional[Any]]:
    """Extract connection settings from standard SMTP URL env vars."""

    for name in ("SMTP_URL", "SMTP_URI", "MAIL_URL", "EMAIL_URL"):
        raw = os.getenv(name)
        if not raw:
            continue

        stripped = raw.strip()
        if not stripped:
            continue

        if "://" not in stripped:
            # Support bare host[:port] values as often configured in legacy
            # environments (e.g. Render secrets) without the scheme part.
            host_part = stripped.split("@", 1)[-1]
            host, sep, port_str = host_part.rpartition(":")
            if sep:
                candidate_host = host.strip("[] ")
                try:
                    candidate_port: Optional[int] = int(port_str)
                except ValueError:
                    logger.warning(
                        "Invalid SMTP port '%s' in %s, ignoring value", port_str, name
                    )
                    candidate_port = None
            else:
                candidate_host = host_part.strip("[] ")
                candidate_port = None

            if candidate_host:
                return {"host": candidate_host, "port": candidate_port}
            continue

        try:
            parsed = urlparse(stripped)
        except ValueError:
            logger.warning("Invalid SMTP URL in %s: %s", name, raw)
            continue

        if parsed.hostname:
            return {
                "host": parsed.hostname,
                "port": parsed.port,
            }

    return {"host": None, "port": None}


def _resolve_smtp_host() -> str:
    connection = _smtp_connection_from_url()
    if connection["host"]:
        return connection["host"]

    host = _env_first(
        "SMTP_HOST",
        "SMTP_SERVER",
        "SMTP_ADDRESS",
        "SMTP_SERVICE_HOST",
        "MAIL_HOST",
        "MAIL_SERVER",
        "MAIL_ADDRESS",
        "EMAIL_HOST",
        "EMAIL_SERVER",
        "EMAIL_ADDRESS",
        "MAILGUN_SMTP_SERVER",
        "MAILGUN_SMTP_HOST",
        "MAILGUN_SMTP_ADDRESS",
        "SENDGRID_SMTP_HOST",
        "SENDGRID_SMTP_SERVER",
        "SENDGRID_SMTP_ADDRESS",
        "SENDINBLUE_SMTP_HOST",
        "SENDINBLUE_SMTP_SERVER",
        "SENDINBLUE_SMTP_ADDRESS",
        "BREVO_SMTP_HOST",
        "BREVO_SMTP_SERVER",
        "BREVO_SMTP_ADDRESS",
    )
    if host:
        return host

    # Provide sensible defaults for well-known providers when credentials are
    # configured but the host variable is omitted. This mirrors the defaults
    # documented by the providers and avoids hard failures in deployments that
    # only set usernames/passwords.
    if _env_first("SENDGRID_USERNAME", "SENDGRID_PASSWORD", "SENDGRID_API_KEY"):
        return "smtp.sendgrid.net"

    if _env_first(
        "MAILGUN_SMTP_LOGIN",
        "MAILGUN_SMTP_PASSWORD",
        "MAILGUN_API_KEY",
        "MAILGUN_DOMAIN",
    ):
        return "smtp.mailgun.org"

    if _env_first(
        "SENDINBLUE_SMTP_LOGIN",
        "SENDINBLUE_SMTP_PASSWORD",
        "SENDINBLUE_API_KEY",
        "BREVO_SMTP_LOGIN",
        "BREVO_SMTP_PASSWORD",
        "BREVO_API_KEY",
    ):
        return "smtp-relay.sendinblue.com"

    raise RuntimeError(
        "SMTP_HOST n'est pas configuré. Définissez SMTP_HOST pour activer l'envoi d'e-mails."
    )


def _resolve_smtp_port(default_port: int) -> int:
    connection = _smtp_connection_from_url()
    if connection["port"]:
        return int(connection["port"])

    port_value = _env_first(
        "SMTP_PORT",
        "MAIL_PORT",
        "EMAIL_PORT",
        "MAIL_SERVER_PORT",
        "MAILGUN_SMTP_PORT",
        "SENDGRID_SMTP_PORT",
    )
    if not port_value:
        return default_port
    try:
        return int(port_value)
    except ValueError:
        logger.warning("Invalid SMTP port '%s', falling back to %s", port_value, default_port)
        return default_port


def _resolve_smtp_credentials() -> Dict[str, Optional[str]]:
    username = _env_first(
        "SMTP_USERNAME",
        "SMTP_USER",
        "MAIL_USERNAME",
        "MAIL_USER",
        "EMAIL_USERNAME",
        "MAILGUN_SMTP_LOGIN",
        "SENDGRID_USERNAME",
        "SENDINBLUE_SMTP_LOGIN",
        "BREVO_SMTP_LOGIN",
    )
    password = _env_first(
        "SMTP_PASSWORD",
        "SMTP_PASS",
        "MAIL_PASSWORD",
        "MAIL_PASS",
        "EMAIL_PASSWORD",
        "MAILGUN_SMTP_PASSWORD",
        "SENDGRID_PASSWORD",
        "SENDINBLUE_SMTP_PASSWORD",
        "BREVO_SMTP_PASSWORD",
    )
    return {"username": username, "password": password}


BREVO_API_ENDPOINT = "https://api.brevo.com/v3/smtp/email"


def send_transactional_email_via_brevo(
    to_email: str,
    to_name: Optional[str],
    subject: str,
    html_body: str,
    reply_to_email: Optional[str],
    reply_to_name: Optional[str],
    *,
    text_body: Optional[str] = None,
    attachments: Optional[Sequence[Tuple[str, bytes]]] = None,
) -> None:
    api_key = os.getenv("BREVO_API_KEY")
    provider = (os.getenv("EMAIL_PROVIDER") or "brevo").strip().lower() or "brevo"
    sender_email = os.getenv("EMAIL_FROM")
    sender_name = (os.getenv("EMAIL_FROM_NAME") or "Fleemy").strip() or "Fleemy"

    if provider != "brevo":
        logger.debug("send_transactional_email_via_brevo called while provider=%s", provider)

    if not api_key or not sender_email:
        logger.error("Brevo configuration missing: BREVO_API_KEY or EMAIL_FROM not set")
        raise HTTPException(status_code=500, detail="Configuration e-mail Brevo manquante")

    payload: Dict[str, Any] = {
        "sender": {
            "email": sender_email,
            "name": sender_name,
        },
        "to": [
            {
                "email": to_email,
                "name": to_name or to_email,
            }
        ],
        "subject": subject,
        "htmlContent": html_body,
        "replyTo": {
            "email": (reply_to_email or sender_email),
            "name": (reply_to_name or to_name or sender_name),
        },
    }

    if text_body:
        payload["textContent"] = text_body

    if attachments:
        encoded_attachments = []
        for filename, content_bytes in attachments:
            if not filename:
                continue
            encoded_attachments.append(
                {
                    "name": filename,
                    "content": base64.b64encode(content_bytes).decode("utf-8"),
                }
            )
        if encoded_attachments:
            payload["attachment"] = encoded_attachments

    headers = {
        "api-key": api_key,
        "accept": "application/json",
        "content-type": "application/json",
    }

    try:
        response = httpx.post(
            BREVO_API_ENDPOINT,
            headers=headers,
            json=payload,
            timeout=10.0,
        )
    except httpx.RequestError as exc:  # pragma: no cover - network failure
        logger.error("Brevo request failed: %s", exc)
        raise RuntimeError("Échec de l'envoi de l'e-mail : connexion au service Brevo impossible") from exc

    if response.status_code < 200 or response.status_code >= 300:
        logger.error(
            "Brevo API error %s: %s",
            response.status_code,
            response.text,
        )
        raise RuntimeError(
            "Échec de l'envoi de l'e-mail : %s - %s"
            % (response.status_code, response.text)
        )


def _send_email_via_smtp(
    to_email: str,
    to_name: Optional[str],
    subject: str,
    html_body: str,
    reply_to_email: Optional[str],
    reply_to_name: Optional[str],
    *,
    text_body: Optional[str] = None,
    attachments: Optional[Sequence[Tuple[str, bytes]]] = None,
) -> None:
    from email.utils import formataddr

    sender_email = _sender_address()
    sender_display_name = (os.getenv("EMAIL_FROM_NAME") or "Fleemy").strip() or "Fleemy"

    host = _resolve_smtp_host()

    use_ssl = _bool_env("SMTP_USE_SSL", False)
    use_tls = _bool_env("SMTP_USE_TLS", not use_ssl)
    default_port = 465 if use_ssl else 587 if use_tls else 25
    port = _resolve_smtp_port(default_port)

    timeout = float(os.getenv("SMTP_TIMEOUT", "10"))
    creds = _resolve_smtp_credentials()

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = formataddr((sender_display_name, sender_email))
    message["To"] = formataddr((to_name or to_email, to_email))
    reply_email = reply_to_email or sender_email
    if reply_email:
        message["Reply-To"] = formataddr(
            (
                reply_to_name or to_name or sender_display_name,
                reply_email,
            )
        )

    content = text_body or html_body or ""
    message.set_content(content)
    if html_body:
        message.add_alternative(html_body, subtype="html")

    if attachments:
        for filename, content_bytes in attachments:
            message.add_attachment(
                content_bytes,
                maintype="application",
                subtype="pdf",
                filename=filename,
            )

    smtp_class = smtplib.SMTP_SSL if use_ssl else smtplib.SMTP

    try:
        with smtp_class(host, port, timeout=timeout) as smtp:
            smtp.ehlo()
            if use_tls and not use_ssl:
                smtp.starttls()
                smtp.ehlo()
            if creds["username"] and creds["password"]:
                smtp.login(creds["username"], creds["password"])
            smtp.send_message(message)
    except Exception as exc:  # pragma: no cover - safety net
        logger.error("Failed to send email via SMTP: %s", exc)
        raise RuntimeError("Échec de l'envoi de l'e-mail : %s" % exc) from exc


def send_fleemy_email(
    *,
    to_email: str,
    to_name: Optional[str],
    subject: str,
    html_body: str,
    reply_to_email: Optional[str],
    reply_to_name: Optional[str],
    text_body: Optional[str] = None,
    attachments: Optional[Sequence[Tuple[str, bytes]]] = None,
) -> None:
    provider = (os.getenv("EMAIL_PROVIDER") or "brevo").strip().lower() or "brevo"

    if provider == "brevo":
        send_transactional_email_via_brevo(
            to_email,
            to_name,
            subject,
            html_body,
            reply_to_email,
            reply_to_name,
            text_body=text_body,
            attachments=attachments,
        )
        return

    if provider == "smtp":
        _send_email_via_smtp(
            to_email,
            to_name,
            subject,
            html_body,
            reply_to_email,
            reply_to_name,
            text_body=text_body,
            attachments=attachments,
        )
        return

    raise RuntimeError(f"Provider d'e-mail non supporté : {provider}")


def send_document_email(
    *,
    document: Dict[str, Any],
    document_type: str,
    recipient: str,
    document_id: str,
    pdf_bytes: bytes,
    subject: Optional[str] = None,
    body: Optional[str] = None,
    reply_to_email: Optional[str] = None,
    reply_to_name: Optional[str] = None,
    recipient_name: Optional[str] = None,
) -> None:
    final_subject, text_body, html_body = build_document_email(
        document,
        document_type,
        document_id,
        subject=subject,
        body=body,
    )

    attachment_name = document_filename(document, document_type)
    attachments = [(attachment_name, pdf_bytes)]

    to_name = (
        recipient_name
        or document.get("client_contact_name")
        or document.get("client_name")
        or document.get("client", {}).get("name")
        if isinstance(document.get("client"), dict)
        else None
    )

    sender_email = os.getenv("EMAIL_FROM")
    sender_name = (os.getenv("EMAIL_FROM_NAME") or "Fleemy").strip() or "Fleemy"

    send_fleemy_email(
        to_email=recipient,
        to_name=to_name,
        subject=final_subject,
        html_body=html_body,
        reply_to_email=reply_to_email or sender_email,
        reply_to_name=reply_to_name or sender_name,
        text_body=text_body,
        attachments=attachments,
    )
