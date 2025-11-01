import asyncio
import json
import re
from typing import List, Dict, Any, Optional
from datetime import datetime

import httpx
from fastapi import FastAPI, HTTPException, Query

# ------------------------------------------------------------
#  i-SMART RESEARCH API — FastAPI Implementation
# ------------------------------------------------------------

app = FastAPI(
    title="i-SMART Research API",
    description="Discover, enrich, and rank scientific papers using OpenAlex, Crossref, and SJR data.",
    version="2.0.0"
)

# --- Configuration ---
SJR_LOOKUP_FILE = "sjr_lookup_claudeSjrQ.json"
sjr_lookup_data = {}

CONCURRENT_REQUEST_LIMIT = 5
RATE_LIMIT_DELAY = 0.3
MAX_RETRIES = 5
INITIAL_BACKOFF = 2.0

semaphore = asyncio.Semaphore(CONCURRENT_REQUEST_LIMIT)
last_request_time = {"openalex": None, "crossref": None}


# --- Helper Functions ---

def clean_issn(issn: str) -> str:
    """Remove all non-digit characters from ISSN."""
    return re.sub(r'\D', '', issn)


def deconstruct_abstract(inverted_index: Optional[Dict]) -> Optional[str]:
    """Reconstruct plain-text abstract from OpenAlex inverted index."""
    if not inverted_index:
        return None
    try:
        valid_indices = [val[0] for val in inverted_index.values() if isinstance(val, list) and val]
        if not valid_indices:
            return None
        max_index = max(valid_indices)
        word_list = [''] * (max_index + 1)
        for word, indices in inverted_index.items():
            if isinstance(indices, list):
                for index in indices:
                    if isinstance(index, int) and 0 <= index < len(word_list):
                        word_list[index] = word
        return ' '.join(word for word in word_list if word).strip()
    except Exception:
        return None


async def rate_limit_delay(api_name: str):
    """Ensure delay between API calls to avoid 429 errors."""
    global last_request_time
    if last_request_time[api_name]:
        elapsed = (datetime.now() - last_request_time[api_name]).total_seconds()
        if elapsed < RATE_LIMIT_DELAY:
            await asyncio.sleep(RATE_LIMIT_DELAY - elapsed)
    last_request_time[api_name] = datetime.now()


def calculate_quality_score(paper: Dict[str, Any]) -> float:
    """Composite paper quality score (0–150 scale)."""
    import math
    score = 0.0
    if paper.get('sjrScore'):
        score += min(paper['sjrScore'] * 10, 40)
    if paper.get('h_index'):
        score += min(paper['h_index'] / 5, 30)
    quartile_scores = {'Q1': 20, 'Q2': 15, 'Q3': 10, 'Q4': 5}
    if paper.get('quartile'):
        score += quartile_scores.get(paper['quartile'], 0)
    if paper.get('citationCount') and paper['citationCount'] > 0:
        score += min(math.log10(paper['citationCount'] + 1) * 10, 30)
    if paper.get('yearPublished'):
        years_old = datetime.now().year - paper['yearPublished']
        if years_old <= 5:
            score += max(10 - (years_old * 2), 0)
    if paper.get('isFreelyAvailable'):
        score += 5
    if paper.get('abstract'):
        score += 5
    return round(score, 2)


# --- Load SJR Data on Startup ---

@app.on_event("startup")
async def load_sjr_data():
    """Load SJR lookup table at startup."""
    global sjr_lookup_data
    try:
        with open(SJR_LOOKUP_FILE, 'r', encoding='utf-8') as f:
            sjr_lookup_data = json.load(f)
        print(f"✅ Loaded {len(sjr_lookup_data)} SJR records.")
    except FileNotFoundError:
        print(f"⚠ ERROR: SJR file not found at {SJR_LOOKUP_FILE}")
    except json.JSONDecodeError:
        print(f"⚠ ERROR: Invalid JSON in {SJR_LOOKUP_FILE}")


# --- External API Integrations ---

async def enrich_paper_with_crossref(client: httpx.AsyncClient, doi: str) -> Optional[Dict[str, Any]]:
    """Fetch metadata from Crossref with retry logic."""
    if not doi:
        return None
    url = f"https://api.crossref.org/works/{doi}"
    delay = INITIAL_BACKOFF
    for attempt in range(MAX_RETRIES):
        try:
            await rate_limit_delay("crossref")
            resp = await client.get(url, timeout=15.0)
            resp.raise_for_status()
            return resp.json().get('message', {})
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 429:
                await asyncio.sleep(delay)
                delay *= 1.5
            elif e.response.status_code == 404:
                return None
        except Exception:
            await asyncio.sleep(delay)
            delay *= 1.5
    return None


async def discover_and_process(query: str, fetch_pages: int = 4) -> List[Dict[str, Any]]:
    """Fetch and enrich research papers from OpenAlex + Crossref."""
    all_results = []
    headers = {
        "User-Agent": "iSMART-API/2.0 (mailto:hardikanawala07@gmail.com)",
        "Accept": "application/json"
    }

    async with httpx.AsyncClient(headers=headers, timeout=30.0) as client:
        for page in range(1, fetch_pages + 1):
            params = {
                'filter': f'default.search:{query},has_doi:true',
                'per_page': 25,
                'page': page,
                'sort': 'relevance_score:desc',
                'select': 'id,doi,title,authorships,cited_by_count,publication_year,open_access,abstract_inverted_index'
            }
            await rate_limit_delay("openalex")
            resp = await client.get("https://api.openalex.org/works", params=params)
            resp.raise_for_status()
            works = resp.json().get('results', [])
            if not works:
                break

            tasks = [enrich_paper_with_crossref(client, w.get('doi')) for w in works]
            crossref_data = await asyncio.gather(*tasks, return_exceptions=True)

            for w, meta in zip(works, crossref_data):
                if not w or isinstance(meta, Exception) or not meta:
                    continue

                journal_title = meta.get('container-title', [None])[0]
                final_paper = {
                    "title": w.get('title'),
                    "authors": [a['author']['display_name'] for a in w.get('authorships', []) if a.get('author')],
                    "doi": w.get('doi'),
                    "citationCount": w.get('cited_by_count', 0),
                    "publisher": meta.get('publisher'),
                    "yearPublished": w.get('publication_year'),
                    "abstract": deconstruct_abstract(w.get('abstract_inverted_index')),
                    "isFreelyAvailable": w.get('open_access', {}).get('is_oa', False),
                    "downloadUrl": w.get('open_access', {}).get('oa_url'),
                    "journalTitle": journal_title
                }

                issn_list = meta.get('ISSN', [])
                cleaned_issn = clean_issn(issn_list[0]) if issn_list else None
                if cleaned_issn and cleaned_issn in sjr_lookup_data:
                    rank_data = sjr_lookup_data[cleaned_issn]
                    final_paper.update({
                        "issn": cleaned_issn,
                        "quartile": rank_data.get('quartile'),
                        "h_index": rank_data.get('h_index'),
                        "sjrScore": rank_data.get('sjr')
                    })
                else:
                    final_paper.update({"issn": cleaned_issn, "quartile": None, "h_index": None, "sjrScore": None})

                final_paper["qualityScore"] = calculate_quality_score(final_paper)
                all_results.append(final_paper)
            await asyncio.sleep(0.5)
    return all_results


# --- /search Endpoint ---

@app.get("/search", summary="Search and rank research papers with advanced filtering")
async def search_papers(
    query: str = Query(...),
    limit: int = Query(10, ge=1, le=50),
    min_year: Optional[int] = None,
    max_year: Optional[int] = None,
    min_citations: Optional[int] = None,
    max_citations: Optional[int] = None,
    quartile: Optional[str] = Query(None, regex="^(Q1|Q2|Q3|Q4)$"),
    min_sjr: Optional[float] = None,
    min_h_index: Optional[int] = None,
    only_open_access: Optional[bool] = False,
    require_abstract: Optional[bool] = False,
    min_quality_score: Optional[float] = None,
    sort_by: Optional[str] = Query("qualityScore", regex="^(qualityScore|citationCount|yearPublished|sjrScore|h_index)$")
):
    """Main paper search endpoint."""
    if not query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty")

    results = await discover_and_process(query)
    if not results:
        raise HTTPException(status_code=404, detail="No papers found.")

    filtered = results
    if min_year:
        filtered = [p for p in filtered if p.get('yearPublished', 0) >= min_year]
    if max_year:
        filtered = [p for p in filtered if p.get('yearPublished', 0) <= max_year]
    if min_citations:
        filtered = [p for p in filtered if p.get('citationCount', 0) >= min_citations]
    if max_citations:
        filtered = [p for p in filtered if p.get('citationCount', 0) <= max_citations]
    if quartile:
        filtered = [p for p in filtered if p.get('quartile') == quartile]
    if min_sjr:
        filtered = [p for p in filtered if p.get('sjrScore', 0) >= min_sjr]
    if min_h_index:
        filtered = [p for p in filtered if p.get('h_index', 0) >= min_h_index]
    if only_open_access:
        filtered = [p for p in filtered if p.get('isFreelyAvailable')]
    if require_abstract:
        filtered = [p for p in filtered if p.get('abstract')]
    if min_quality_score:
        filtered = [p for p in filtered if p.get('qualityScore', 0) >= min_quality_score]

    filtered.sort(key=lambda x: x.get(sort_by, 0) or 0, reverse=True)
    return {
        "query": query,
        "totalDiscovered": len(results),
        "totalAfterFiltering": len(filtered),
        "results": filtered[:limit],
        "sortedBy": sort_by
    }


# --- Additional Utility Endpoints ---

@app.get("/", summary="API Health Check")
async def root():
    return {
        "status": "operational",
        "service": "i-SMART Research API",
        "version": "2.0.0",
        "sjr_data_loaded": len(sjr_lookup_data) > 0,
        "sjr_records": len(sjr_lookup_data)
    }


@app.get("/stats", summary="Get SJR statistics")
async def get_stats():
    if not sjr_lookup_data:
        return {"error": "SJR data not loaded"}
    quartile_counts = {"Q1": 0, "Q2": 0, "Q3": 0, "Q4": 0, "None": 0}
    for record in sjr_lookup_data.values():
        q = record.get('quartile', 'None')
        quartile_counts[q] = quartile_counts.get(q, 0) + 1
    return {"total_journals": len(sjr_lookup_data), "quartile_distribution": quartile_counts}


@app.get("/filter-guide", summary="Recommended filter thresholds")
async def filter_guide():
    return {
        "recommendations": {
            "min_quality_score": 60,
            "min_sjr": 1.0,
            "min_h_index": 100,
            "quartile": "Q1",
            "notes": [
                "Use min_quality_score ≥ 60 for high-quality papers.",
                "Q1 journals indicate top 25% by impact.",
                "Combine filters (e.g., Q1 + min_citations:20) for best results."
            ]
        }
    }
