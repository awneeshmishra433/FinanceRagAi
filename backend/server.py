"""Financial Research Intelligence Platform — Backend.

Endpoints
- GET  /api/companies                       — list pre-loaded companies
- GET  /api/companies/{ticker}/filings      — filings library for a company
- POST /api/query                           — RAG Q&A (SSE streaming)
- POST /api/upload                          — upload user PDF, returns session_id
- GET  /api/sessions/{sid}/filings          — list uploaded session filings
- GET  /api/chunk/{chunk_id}                — fetch a chunk (for source drawer)
- GET  /api/example-questions/{ticker}      — suggested questions
"""

from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from pathlib import Path
import os
import re
import io
import json
import uuid
import asyncio
import logging
from datetime import datetime, timezone

from rank_bm25 import BM25Okapi
import fitz  # PyMuPDF

import google.generativeai as genai

from corpus import COMPANIES, CORPUS, get_company_by_ticker

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

GEMINI_API_KEY = os.environ["GEMINI_API_KEY"]

genai.configure(api_key=GEMINI_API_KEY)

app = FastAPI(title="Financial Research Intelligence Platform")
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
log = logging.getLogger(__name__)


# ---------- In-memory chunk store ---------------------------------------------
# Structure: chunks_by_key[key] = list of {id, ticker|session, form, section, period, text}
# BM25 index per key for fast retrieval.

_chunks_by_key: Dict[str, List[Dict[str, Any]]] = {}
_bm25_by_key: Dict[str, BM25Okapi] = {}


def _tokenize(text: str) -> List[str]:
    return re.findall(r"[a-zA-Z0-9$%.\-]+", text.lower())


def _index_chunks(key: str, chunks: List[Dict[str, Any]]):
    _chunks_by_key[key] = chunks
    tokenized = [_tokenize(c["text"]) for c in chunks]
    if tokenized:
        _bm25_by_key[key] = BM25Okapi(tokenized)


def _bootstrap_corpus():
    """Build BM25 indexes for all curated companies on startup."""
    for ticker, items in CORPUS.items():
        chunks = []
        for i, item in enumerate(items):
            chunks.append({
                "id": f"{ticker}-{i}",
                "ticker": ticker,
                "form": item["form"],
                "section": item["section"],
                "period": item["period"],
                "text": item["text"],
            })
        _index_chunks(ticker, chunks)
    log.info(f"Indexed {sum(len(v) for v in _chunks_by_key.values())} curated chunks across {len(_chunks_by_key)} companies")


_bootstrap_corpus()


# ---------- Models -------------------------------------------------------------

class QueryIn(BaseModel):
    question: str
    ticker: Optional[str] = None
    session_id: Optional[str] = None
    top_k: int = 5


class Citation(BaseModel):
    n: int
    chunk_id: str
    form: str
    section: str
    period: str
    snippet: str


# ---------- Retrieval ----------------------------------------------------------

def retrieve(key: str, question: str, top_k: int = 5) -> List[Dict[str, Any]]:
    if key not in _bm25_by_key:
        return []
    bm25 = _bm25_by_key[key]
    chunks = _chunks_by_key[key]
    # Curated corpora are small — pass everything to the LLM, ordered by BM25 relevance.
    if len(chunks) <= 8:
        scores = bm25.get_scores(_tokenize(question))
        ranked = sorted(zip(scores, chunks), key=lambda x: -x[0])
        return [c for _, c in ranked]
    scores = bm25.get_scores(_tokenize(question))
    ranked = sorted(zip(scores, chunks), key=lambda x: -x[0])
    top = [c for s, c in ranked[:top_k] if s > 0]
    if not top:
        top = [c for _, c in ranked[:min(3, len(ranked))]]
    return top


def _confidence(top_score: float, n_hits: int) -> str:
    if n_hits >= 3 and top_score > 3.0:
        return "high"
    if n_hits >= 2 and top_score > 1.2:
        return "medium"
    return "low"


# ---------- LLM prompt ---------------------------------------------------------

SYSTEM_PROMPT = """You are a meticulous financial research analyst. You answer questions about a company strictly using the SOURCE EXCERPTS provided below.

Rules:
1. Use ONLY information present in the source excerpts. Do not fabricate numbers, dates, or facts.
2. Every factual claim in your answer must be followed by an inline citation like [1] or [2,3] referencing the excerpt number(s).
3. If the excerpts do not contain enough information to answer, say so plainly — do not guess.
4. Be concise and structured. Use short paragraphs or bullets when helpful. Numbers should be exact as given in excerpts.
5. Do not write a separate "Sources" section — citations are inline only.
6. Tone: precise, professional, FT-editorial — never marketing fluff.
"""


def _build_user_prompt(question: str, hits: List[Dict[str, Any]]) -> str:
    blocks = []
    for i, h in enumerate(hits, 1):
        blocks.append(f"[{i}] ({h['form']} · {h['section']} · {h['period']})\n{h['text']}")
    sources = "\n\n".join(blocks)
    return f"SOURCE EXCERPTS:\n\n{sources}\n\n---\n\nQUESTION: {question}\n\nAnswer using only the excerpts above, with inline citations like [1], [2]."


# ---------- Endpoints ----------------------------------------------------------

@api.get("/")
async def root():
    return {"service": "Financial Research Intelligence Platform", "status": "ok"}


@api.get("/companies")
async def list_companies():
    out = []
    for c in COMPANIES:
        out.append({**c, "filings_count": len(CORPUS.get(c["ticker"], []))})
    return out


@api.get("/companies/{ticker}/filings")
async def list_filings(ticker: str):
    if ticker not in CORPUS:
        raise HTTPException(404, "Unknown ticker")
    items = CORPUS[ticker]
    # Group by (form, period)
    seen = {}
    for it in items:
        k = (it["form"], it["period"])
        seen.setdefault(k, []).append(it["section"])
    out = []
    for (form, period), sections in seen.items():
        out.append({"form": form, "period": period, "sections": sections})
    out.sort(key=lambda x: (x["period"], x["form"]), reverse=True)
    return out


@api.get("/example-questions/{ticker}")
async def example_questions(ticker: str):
    company = get_company_by_ticker(ticker)
    if not company:
        raise HTTPException(404, "Unknown ticker")
    name = company["name"].split(" Inc")[0].split(",")[0]
    return [
        f"What was {name}'s total revenue in the most recent fiscal year?",
        f"How did {name}'s gross margin trend recently?",
        f"What are {name}'s most significant risk factors?",
        f"Summarize {name}'s operating segments and their growth.",
    ]


@api.get("/chunk/{chunk_id}")
async def get_chunk(chunk_id: str):
    for chunks in _chunks_by_key.values():
        for c in chunks:
            if c["id"] == chunk_id:
                return c
    raise HTTPException(404, "Chunk not found")


@api.post("/upload")
async def upload_pdf(file: UploadFile = File(...), label: str = Form("Uploaded document")):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(400, "Only PDF files are supported")
    data = await file.read()
    if len(data) > 20 * 1024 * 1024:
        raise HTTPException(400, "File too large (max 20MB)")
    try:
        doc = fitz.open(stream=data, filetype="pdf")
    except Exception as e:
        raise HTTPException(400, f"Could not parse PDF: {e}")

    # Extract text by page, chunk into ~1200 char windows
    text_pages = []
    for page_idx, page in enumerate(doc):
        text_pages.append((page_idx + 1, page.get_text("text")))
    doc.close()

    session_id = str(uuid.uuid4())[:12]
    chunks: List[Dict[str, Any]] = []
    chunk_idx = 0
    for page_no, txt in text_pages:
        txt = re.sub(r"\s+", " ", txt).strip()
        if not txt:
            continue
        # window 1200 chars, stride 1000
        for start in range(0, len(txt), 1000):
            piece = txt[start:start + 1200]
            if len(piece) < 80:
                continue
            chunks.append({
                "id": f"{session_id}-{chunk_idx}",
                "session_id": session_id,
                "form": "Uploaded",
                "section": f"Page {page_no}",
                "period": label,
                "text": piece,
            })
            chunk_idx += 1

    if not chunks:
        raise HTTPException(400, "No extractable text in PDF")

    _index_chunks(session_id, chunks)
    return {
        "session_id": session_id,
        "label": label,
        "filename": file.filename,
        "pages": len(text_pages),
        "chunks": len(chunks),
    }


@api.get("/sessions/{sid}/filings")
async def session_filings(sid: str):
    if sid not in _chunks_by_key:
        raise HTTPException(404, "Session not found")
    chunks = _chunks_by_key[sid]
    pages = sorted({c["section"] for c in chunks})
    label = chunks[0]["period"] if chunks else ""
    return {"session_id": sid, "label": label, "chunks": len(chunks), "pages": pages}


@api.post("/query")
async def query(payload: QueryIn):
    key = payload.ticker if payload.ticker else payload.session_id
    if not key:
        raise HTTPException(400, "Provide ticker or session_id")
    if key not in _chunks_by_key:
        raise HTTPException(404, "Unknown ticker or session_id")

    hits = retrieve(key, payload.question, top_k=payload.top_k)
    if not hits:
        async def empty_gen():
            yield f"data: {json.dumps({'type': 'error', 'message': 'No relevant excerpts found.'})}\n\n"
        return StreamingResponse(empty_gen(), media_type="text/event-stream")

    # Build citations payload
    citations = []
    for i, h in enumerate(hits, 1):
        citations.append({
            "n": i,
            "chunk_id": h["id"],
            "form": h["form"],
            "section": h["section"],
            "period": h["period"],
            "snippet": h["text"][:400],
        })

        # Compute confidence
    bm25 = _bm25_by_key[key]
    scores = bm25.get_scores(_tokenize(payload.question))
    top_score = float(max(scores)) if len(scores) else 0.0
    conf = _confidence(top_score, len(hits))

    user_prompt = _build_user_prompt(payload.question, hits)

    async def event_gen():
        yield f"data: {json.dumps({'type': 'meta', 'citations': citations, 'confidence': conf, 'top_score': round(top_score, 3)})}\n\n"

        try:
            model = genai.GenerativeModel(
                model_name="gemini-2.5-flash",
                system_instruction=SYSTEM_PROMPT
            )

            response = model.generate_content(user_prompt)

            yield f"data: {json.dumps({'type': 'delta', 'content': response.text})}\n\n"

        except Exception as e:
            log.exception("Gemini failed")
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

        yield f"data: {json.dumps({'type': 'done'})}\n\n"

        try:
            await db.queries.insert_one({
                "id": str(uuid.uuid4()),
                "key": key,
                "ticker": payload.ticker,
                "session_id": payload.session_id,
                "question": payload.question,
                "n_hits": len(hits),
                "confidence": conf,
                "ts": datetime.now(timezone.utc).isoformat(),
            })
        except Exception:
            pass

    return StreamingResponse(
        event_gen(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# Wire up
app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
