# app/services/research_service.py
import asyncio
import json
import math
import re
from datetime import datetime
from typing import Any, Dict, Iterable, List, Optional, Tuple

import httpx

SJR_LOOKUP_FILE = "sjr_lookup_claudeSjrQ.json"
sjr_lookup_data: Dict[str, Dict[str, Any]] = {}

# load SJR json once (no FastAPI startup hook)
try:
    with open(SJR_LOOKUP_FILE, "r", encoding="utf-8") as f:
        sjr_lookup_data = json.load(f)
except Exception:
    sjr_lookup_data = {}

CONCURRENT_REQUEST_LIMIT = 5
RATE_LIMIT_DELAY = 0.3
MAX_RETRIES = 5
INITIAL_BACKOFF = 2.0

_last_request_time = {"openalex": None, "crossref": None}


def _clean_issn(issn: Optional[str]) -> str:
    return re.sub(r"\D", "", issn or "")


def deconstruct_abstract(inverted_index: Optional[Dict]) -> Optional[str]:
    if not inverted_index:
        return None
    try:
        valid_indices = [val[0] for val in inverted_index.values() if isinstance(val, list) and val]
        if not valid_indices:
            return None
        max_index = max(valid_indices)
        word_list = [""] * (max_index + 1)
        for word, indices in inverted_index.items():
            if isinstance(indices, list):
                for idx in indices:
                    if isinstance(idx, int) and 0 <= idx < len(word_list):
                        word_list[idx] = word
        return " ".join(w for w in word_list if w).strip()
    except Exception:
        return None


async def _rate_limit_delay(api_name: str):
    from datetime import datetime as dt

    if _last_request_time[api_name]:
        elapsed = (dt.now() - _last_request_time[api_name]).total_seconds()
        if elapsed < RATE_LIMIT_DELAY:
            await asyncio.sleep(RATE_LIMIT_DELAY - elapsed)
    _last_request_time[api_name] = dt.now()


def calc_quality_score(paper: Dict[str, Any]) -> float:
    score = 0.0
    if paper.get("sjrScore"):
        score += min(paper["sjrScore"] * 10, 40)
    if paper.get("h_index"):
        score += min(paper["h_index"] / 5, 30)
    quartile_scores = {"Q1": 20, "Q2": 15, "Q3": 10, "Q4": 5}
    if paper.get("quartile"):
        score += quartile_scores.get(paper["quartile"], 0)
    if paper.get("citationCount") and paper["citationCount"] > 0:
        score += min(math.log10(paper["citationCount"] + 1) * 10, 30)
    if paper.get("yearPublished"):
        cur = datetime.now().year
        yrs = cur - paper["yearPublished"]
        if yrs <= 5:
            score += max(10 - (yrs * 2), 0)
    if paper.get("isFreelyAvailable"):
        score += 5
    if paper.get("abstract"):
        score += 5
    return round(score, 2)


async def _crossref_get(client: httpx.AsyncClient, doi: str) -> Optional[Dict[str, Any]]:
    if not doi:
        return None
    url = f"https://api.crossref.org/works/{doi}"
    delay = INITIAL_BACKOFF
    for attempt in range(MAX_RETRIES):
        try:
            await _rate_limit_delay("crossref")
            resp = await client.get(url, timeout=15.0)
            resp.raise_for_status()
            return resp.json().get("message", {})
        except httpx.HTTPStatusError as e:
            if e.response is not None and e.response.status_code == 429:
                wait = delay * (attempt + 1)
                await asyncio.sleep(wait)
                delay *= 1.5
                continue
            if e.response is not None and e.response.status_code == 404:
                return None
            return None
        except httpx.RequestError:
            if attempt < MAX_RETRIES - 1:
                await asyncio.sleep(delay)
                delay *= 1.5
                continue
            return None
        except Exception:
            return None
    return None


async def _openalex_fetch_keyword(
    client: httpx.AsyncClient,
    keyword: str,
    pages: int = 2,
) -> List[Dict[str, Any]]:
    """
    Fetch results for a single keyword. Tries 'filter=default.search:' first.
    If 403 (or any HTTP error), falls back to 'search='.
    """
    base = "https://api.openalex.org/works"
    collected: List[Dict[str, Any]] = []

    # First attempt: filter=default.search
    for page in range(1, pages + 1):
        params = {
            "filter": f"default.search:{keyword},has_doi:true",
            "per_page": 25,
            "page": page,
            "sort": "relevance_score:desc",
            "select": "id,doi,title,authorships,cited_by_count,publication_year,open_access,abstract_inverted_index",
        }
        try:
            await _rate_limit_delay("openalex")
            r = await client.get(base, params=params)
            r.raise_for_status()
            works = r.json().get("results", [])
            if not works:
                break
            collected.extend(works)
        except httpx.HTTPStatusError as e:
            # fallback path (e.g., 403)
            if e.response is not None and e.response.status_code in (403, 400):
                collected.extend(await _openalex_fetch_keyword_fallback(client, keyword, pages))
                break
            else:
                break
        except Exception:
            # generic fallback
            collected.extend(await _openalex_fetch_keyword_fallback(client, keyword, pages))
            break

    return collected


async def _openalex_fetch_keyword_fallback(
    client: httpx.AsyncClient, keyword: str, pages: int = 2
) -> List[Dict[str, Any]]:
    """
    Fallback to simple 'search=' query.
    """
    base = "https://api.openalex.org/works"
    out: List[Dict[str, Any]] = []
    for page in range(1, pages + 1):
        params = {
            "search": keyword,
            "filter": "has_doi:true",
            "per_page": 25,
            "page": page,
            "sort": "relevance_score:desc",
            "select": "id,doi,title,authorships,cited_by_count,publication_year,open_access,abstract_inverted_index",
        }
        try:
            await _rate_limit_delay("openalex")
            r = await client.get(base, params=params)
            r.raise_for_status()
            works = r.json().get("results", [])
            if not works:
                break
            out.extend(works)
        except Exception:
            break
    return out


def _enrich_with_sjr(paper: Dict[str, Any], issn_list: List[str]):
    cleaned = _clean_issn(issn_list[0]) if issn_list else None
    if cleaned and cleaned in sjr_lookup_data:
        rank = sjr_lookup_data[cleaned]
        paper.update(
            {"issn": cleaned, "quartile": rank.get("quartile"), "h_index": rank.get("h_index"), "sjrScore": rank.get("sjr")}
        )
    else:
        paper.update({"issn": cleaned, "quartile": None, "h_index": None, "sjrScore": None})


async def discover_many_keywords(
    keywords: Iterable[str],
    fetch_pages_per_keyword: int = 2,
) -> List[Dict[str, Any]]:
    """
    Iterate over keywords, fetch from OpenAlex per keyword, Crossref-enrich, SJR-enrich, score, de-dupe.
    """
    headers = {
        "User-Agent": "iSMART-API/2.0 (mailto:your-email@example.com)",
        "Accept": "application/json",
    }
    results: Dict[str, Dict[str, Any]] = {}  # key by DOI if present else title lower

    async with httpx.AsyncClient(headers=headers, timeout=30.0) as client:
        for kw in (k for k in keywords if isinstance(k, str) and k.strip()):
            works = await _openalex_fetch_keyword(client, kw.strip(), pages=fetch_pages_per_keyword)
            if not works:
                continue

            # Crossref enrichment tasks (per work with DOI)
            tasks = [_crossref_get(client, w.get("doi")) for w in works]
            meta_list = await asyncio.gather(*tasks, return_exceptions=True)

            for work, meta in zip(works, meta_list):
                if not work or isinstance(meta, Exception) or meta is None:
                    continue

                container_titles = meta.get("container-title", [])
                journal_title = container_titles[0] if container_titles else None

                paper = {
                    "title": work.get("title"),
                    "authors": [
                        a["author"]["display_name"]
                        for a in (work.get("authorships") or [])
                        if a.get("author")
                    ],
                    "doi": work.get("doi"),
                    "citationCount": work.get("cited_by_count", 0),
                    "publisher": meta.get("publisher"),
                    "yearPublished": work.get("publication_year"),
                    "abstract": deconstruct_abstract(work.get("abstract_inverted_index")),
                    "isFreelyAvailable": (work.get("open_access") or {}).get("is_oa", False),
                    "downloadUrl": (work.get("open_access") or {}).get("oa_url"),
                    "journalTitle": journal_title,
                }

                _enrich_with_sjr(paper, meta.get("ISSN", []))
                paper["qualityScore"] = calc_quality_score(paper)

                # de-dupe: prefer DOI; fallback to normalized title
                key = (paper.get("doi") or "").lower().strip()
                if not key:
                    key = (paper.get("title") or "").lower().strip()
                if not key:
                    continue

                existing = results.get(key)
                if not existing:
                    results[key] = paper
                else:
                    # keep the better one (higher qualityScore / more complete)
                    if (paper.get("qualityScore", 0) > existing.get("qualityScore", 0)) or (
                        paper.get("abstract") and not existing.get("abstract")
                    ):
                        results[key] = paper

    return list(results.values())
