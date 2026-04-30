from fastapi import APIRouter, HTTPException, Depends
from typing import Dict, Any
import asyncio
import json
import logging
import os

import httpx

from server import verify_token, ImportParseRequest, IMPORT_SYSTEM_PROMPT

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/import/parse")
async def import_parse(
    body: ImportParseRequest,
    user: Dict[str, Any] = Depends(verify_token),
):
    anthropic_key = os.environ.get("ANTHROPIC_API_KEY")
    if not anthropic_key:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY not configured on server")

    user_message = f'Voici le contenu du fichier "{body.filename}" à analyser :\n\n{body.content}'

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "Content-Type": "application/json",
                    "x-api-key": anthropic_key,
                    "anthropic-version": "2023-06-01",
                },
                json={
                    "model": "claude-haiku-4-5-20251001",
                    "max_tokens": 8000,
                    "system": IMPORT_SYSTEM_PROMPT,
                    "messages": [{"role": "user", "content": user_message}],
                },
            )
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="timeout")

    if not resp.is_success:
        raise HTTPException(status_code=502, detail=f"Anthropic API {resp.status_code}")

    data = resp.json()
    text: str = (data.get("content") or [{}])[0].get("text") or "[]"
    clean = text.replace("```json", "").replace("```", "").strip()
    try:
        parsed = json.loads(clean)
        return parsed if isinstance(parsed, list) else []
    except json.JSONDecodeError:
        return []
