# projects_router.py
import asyncio
import json
import math
import re
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime

import httpx
from fastapi import APIRouter, HTTPException, Query

# ----- Rich (colorful CLI) -----
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.progress import Progress, SpinnerColumn, BarColumn, TextColumn, TimeElapsedColumn

console = Console()

# --- Configuration ---
router = APIRouter(prefix="/projects", tags=["Projects"])

SJR_LOOKUP_FILE = "sjr_lookup_claudeSjrQ.json"
sjr_lookup_data: Dict[str, Dict[str, Any]] = {}

# API rate limiting / concurrency
CONCURRENT_REQUEST_LIMIT = 5           # per-service request concurrency (OpenAlex/Crossref)
KEYWORD_CONCURRENCY_LIMIT = 5          # how many keywords to process in parallel
RATE_LIMIT_DELAY = 0.3                 # seconds between requests (per service)
MAX_RETRIES = 5
INITIAL_BACKOFF = 2.0

semaphore = asyncio.Semaphore(CONCURRENT_REQUEST_LIMIT)
last_request_time = {"openalex": None, "crossref": None}

# ---------- Helpers ----------

def clean_issn(issn: str) -> str:
    """Remove all non-digit characters from an ISSN string."""
    return re.sub(r"\D", "", issn or "")

def deconstruct_abstract(inverted_index: Optional[Dict]) -> Optional[str]:
    """
    Reconstruct plain-text abstract from OpenAlex inverted index.
    Robust against malformed data.
    """
    if not inverted_index:
        return None
    try:
        valid_indices = [val[0] for val in inverted_index.values()
                         if isinstance(val, list) and val]
        if not valid_indices:
            return None
        max_index = max(valid_indices)
        word_list = [""] * (max_index + 1)
        for word, indices in inverted_index.items():
            if isinstance(indices, list):
                for index in indices:
                    if isinstance(index, int) and 0 <= index < len(word_list):
                        word_list[index] = word
        return " ".join(w for w in word_list if w).strip()
    except Exception as e:
        console.log(f"[yellow]WARN[/]: Could not deconstruct abstract: {e}")
        return None

async def rate_limit_delay(api_name: str):
    """Lightweight spacing between requests to reduce 429s."""
    global last_request_time
    now = datetime.now()
    last = last_request_time.get(api_name)
    if last:
        elapsed = (now - last).total_seconds()
        if elapsed < RATE_LIMIT_DELAY:
            await asyncio.sleep(RATE_LIMIT_DELAY - elapsed)
    last_request_time[api_name] = now

def normalize_query(q: str) -> str:
    """
    Collapse whitespace/commas/semicolons, de-duplicate tokens (case-insensitive),
    and join into a single string for OpenAlex default.search.
    """
    tokens = [t.strip() for t in re.split(r"[,;\s]+", q or "") if t.strip()]
    seen = set()
    deduped = []
    for t in tokens:
        k = t.lower()
        if k not in seen:
            seen.add(k)
            deduped.append(t)
    return " ".join(deduped)

def split_keywords(q: str) -> List[str]:
    """
    Split user query into keywords for parallel processing.
    Supports comma/semicolon/newline separators.
    """
    parts = [p.strip() for p in re.split(r"[,\n;]+", q or "") if p and p.strip()]
    return parts if parts else [q.strip()]

def calculate_quality_score(paper: Dict[str, Any]) -> float:
    """
    Composite (0-150): SJR (40) + h-index (30) + Citations (30) + Quartile (20)
                       + Recency (10) + OA (5) + Abstract (5).
    Uses gentle saturation so no single metric dominates.
    """
    score = 0.0

    # SJR (0..40; saturating)
    sjr = paper.get("sjrScore")
    if isinstance(sjr, (int, float)) and sjr is not None:
        score += min(40.0, 40.0 * (1 - math.exp(-sjr / 3.0)))

    # h-index (0..30; taper after 200)
    h_index = paper.get("h_index")
    if isinstance(h_index, (int, float)) and h_index is not None:
        score += min(30.0, 30.0 * (min(h_index, 200) / 200.0))

    # Quartile (0..20)
    quartile_scores = {"Q1": 20, "Q2": 15, "Q3": 10, "Q4": 5}
    q = paper.get("quartile")
    if isinstance(q, str):
        score += quartile_scores.get(q.upper(), 0)

    # Citations (0..30; log10)
    cites = paper.get("citationCount")
    if isinstance(cites, int) and cites > 0:
        score += min(30.0, math.log10(cites + 1) * 10.0)

    # Recency (0..10 within last 5 years)
    year = paper.get("yearPublished")
    if isinstance(year, int):
        current_year = datetime.now().year
        years_old = current_year - year
        if years_old <= 5:
            score += max(10 - (years_old * 2), 0)

    # OA + Abstract
    if paper.get("isFreelyAvailable"):
        score += 5
    if paper.get("abstract"):
        score += 5

    return round(score, 2)

# ---------- Startup: load SJR ----------

@router.on_event("startup")
async def startup_event():
    """Load SJR lookup data on app startup."""
    global sjr_lookup_data
    try:
        with open(SJR_LOOKUP_FILE, "r", encoding="utf-8") as f:
            sjr_lookup_data = json.load(f)
        console.print(Panel.fit(
            f"Loaded [bold]{len(sjr_lookup_data)}[/] SJR records from [cyan]{SJR_LOOKUP_FILE}[/].",
            title="SJR Lookup", border_style="green"))
    except FileNotFoundError:
        console.print(Panel.fit(
            f"Lookup file not found: [red]{SJR_LOOKUP_FILE}[/]\nRanking will be limited.",
            title="SJR Lookup", border_style="red"))
        sjr_lookup_data = {}
    except json.JSONDecodeError:
        console.print(Panel.fit(
            f"Could not decode JSON in: [red]{SJR_LOOKUP_FILE}[/]",
            title="SJR Lookup", border_style="red"))
        sjr_lookup_data = {}

# ---------- External enrichment ----------

async def enrich_paper_with_crossref(
    client: httpx.AsyncClient,
    doi: Optional[str],
    retries: int = MAX_RETRIES,
    kw: str = ""
) -> Optional[Dict[str, Any]]:
    """
    Enrich paper metadata from Crossref with proper rate limiting + backoff.
    Returns Crossref's 'message' dict or None on failure.
    """
    if not doi:
        return None

    url = f"https://api.crossref.org/works/{doi}"
    delay = INITIAL_BACKOFF

    for attempt in range(retries):
        try:
            await rate_limit_delay("crossref")
            async with semaphore:
                response = await client.get(url, timeout=15.0)
            response.raise_for_status()
            data = response.json()
            return data.get("message", {})
        except httpx.HTTPStatusError as e:
            code = e.response.status_code
            if code == 429:
                wait_time = delay * (attempt + 1)
                console.log(f"[yellow]Crossref 429[/] for DOI [magenta]{doi}[/] (kw='{kw}') "
                            f"→ sleep {wait_time:.1f}s (attempt {attempt+1}/{retries})")
                await asyncio.sleep(wait_time)
                delay *= 1.5
                continue
            if code == 404:
                return None
            console.log(f"[red]Crossref HTTP {code}[/] for DOI {doi} (kw='{kw}')")
            return None
        except (httpx.RequestError, ValueError) as e:
            console.log(f"[red]Crossref error[/] for DOI {doi} (kw='{kw}'): {e}")
            if attempt < retries - 1:
                await asyncio.sleep(delay)
                delay *= 1.5
                continue
            return None
        except Exception as e:
            console.log(f"[red]Unexpected Crossref error[/] for DOI {doi} (kw='{kw}'): {e}")
            return None
    return None

# ---------- Core discovery (single keyword) ----------

async def discover_and_process_single(keyword: str, fetch_pages: int = 4) -> List[Dict[str, Any]]:
    """
    Discover works from OpenAlex for a single keyword, enrich with Crossref + SJR,
    and ALWAYS store & score every fetched work.
    Uses cursor-based pagination and per_page=200 for efficiency.
    """
    results: List[Dict[str, Any]] = []

    headers = {
        "User-Agent": "iSMART-API/2.0 (mailto:hardikanawala07@gmail.com)",
        "Accept": "application/json",
    }

    norm_query = normalize_query(keyword)

    async with httpx.AsyncClient(headers=headers, timeout=30.0) as client:
        openalex_url = "https://api.openalex.org/works"
        params = {
            "filter": f"default.search:{norm_query},has_doi:true",
            "per_page": 200,
            "sort": "relevance_score:desc",
            "select": "id,doi,title,authorships,cited_by_count,publication_year,open_access,abstract_inverted_index,host_venue",
            "cursor": "*",
        }

        pages_fetched = 0
        while pages_fetched < fetch_pages:
            try:
                console.log(f"[cyan]Fetching[/] OpenAlex page {pages_fetched+1}/{fetch_pages} "
                            f"for kw='[bold]{keyword}[/]' cursor={params['cursor']!r}")
                await rate_limit_delay("openalex")
                response = await client.get(openalex_url, params=params)
                response.raise_for_status()
                payload = response.json()

                discovered_works = payload.get("results", []) or []
                if not discovered_works:
                    console.log(f"[yellow]No more results[/] for kw='{keyword}'.")
                    break

                # Enrich via Crossref concurrently
                enrichment_tasks = [
                    enrich_paper_with_crossref(client, work.get("doi"), kw=keyword)
                    for work in discovered_works
                ]
                crossref_metadata_list = await asyncio.gather(
                    *enrichment_tasks, return_exceptions=True
                )

                for work, crossref_meta in zip(discovered_works, crossref_metadata_list):
                    if not work:
                        continue

                    title = work.get("title")
                    authors = [
                        a["author"]["display_name"]
                        for a in work.get("authorships", [])
                        if a.get("author")
                    ]
                    doi = work.get("doi")
                    citation_count = work.get("cited_by_count", 0)
                    year = work.get("publication_year")
                    abstract = deconstruct_abstract(work.get("abstract_inverted_index"))
                    oa = work.get("open_access", {}) or {}
                    is_oa = oa.get("is_oa", False)
                    oa_url = oa.get("oa_url")

                    journal_title = None
                    publisher = None

                    # --- Gather ISSN candidates from Crossref and OpenAlex host_venue ---
                    issn_candidates: List[str] = []

                    # From Crossref
                    if crossref_meta and not isinstance(crossref_meta, Exception):
                        publisher = crossref_meta.get("publisher")
                        ct = crossref_meta.get("container-title", [])
                        journal_title = ct[0] if ct else None
                        cr_issns = crossref_meta.get("ISSN", []) or []
                        issn_candidates.extend(cr_issns)

                    # From OpenAlex host_venue (fallback)
                    host_venue = work.get("host_venue") or {}
                    if host_venue:
                        hv_issns = host_venue.get("issn") or []
                        if isinstance(hv_issns, str):
                            hv_issns = [hv_issns]
                        issn_l = host_venue.get("issn_l")
                        if issn_l:
                            issn_candidates.append(issn_l)
                        issn_candidates.extend(hv_issns)
                        if not journal_title:
                            journal_title = host_venue.get("display_name")

                    # Normalize ISSNs and pick the first usable one
                    issn_clean = None
                    for raw in issn_candidates:
                        if raw:
                            c = clean_issn(raw)
                            if c:
                                issn_clean = c
                                break

                    quartile = None
                    h_index = None
                    sjr_score = None
                    impact_factor = None  # <-- reintroduced

                    # Map SJR + H-index + Quartile + Impact Factor from lookup
                    if issn_clean and issn_clean in sjr_lookup_data:
                        r = sjr_lookup_data[issn_clean]
                        quartile = r.get("quartile")
                        h_index = r.get("h_index")
                        sjr_score = r.get("sjr")
                        # Accept common key variants for impact factor
                        impact_factor = (
                            r.get("impact_factor")
                            or r.get("ImpactFactor")
                            or r.get("JIF")
                            or r.get("jif")
                        )

                    final_paper = {
                        "title": title,
                        "authors": authors,
                        "doi": doi,
                        "citationCount": citation_count,
                        "publisher": publisher,
                        "yearPublished": year,
                        "abstract": abstract,
                        "isFreelyAvailable": is_oa,
                        "downloadUrl": oa_url,
                        "journalTitle": journal_title,
                        "issn": issn_clean,
                        "quartile": quartile,
                        "h_index": h_index,
                        "sjrScore": sjr_score,
                        "impactFactor": impact_factor,
                        "sourceKeyword": keyword,  # which keyword produced this
                    }

                    final_paper["qualityScore"] = calculate_quality_score(final_paper)
                    results.append(final_paper)

                # advance cursor
                next_cursor = (payload.get("meta") or {}).get("next_cursor")
                if not next_cursor:
                    console.log(f"[green]End of results[/] for kw='{keyword}'.")
                    break
                params["cursor"] = next_cursor
                pages_fetched += 1

                await asyncio.sleep(0.3)

            except httpx.HTTPStatusError as e:
                console.log(f"[red]OpenAlex HTTP error[/] on kw='{keyword}' page {pages_fetched+1}: {e}")
                break
            except Exception as e:
                console.log(f"[red]Unexpected error[/] on kw='{keyword}' page {pages_fetched+1}: {e}")
                break

    console.log(f"[green]Discovered[/] {len(results)} papers for kw='[bold]{keyword}[/]'.")
    return results

# ---------- Orchestrator (multiple keywords concurrently) ----------

async def discover_and_process_multi(query: str, fetch_pages: int = 4) -> Tuple[List[Dict[str, Any]], List[str]]:
    keywords = split_keywords(query)
    console.print(Panel.fit(
        f"[bold]{len(keywords)}[/] keyword(s) parsed: [cyan]{', '.join(keywords)}[/]",
        title="Keyword Parsing", border_style="cyan"))

    kw_sem = asyncio.Semaphore(KEYWORD_CONCURRENCY_LIMIT)

    async def _runner(kw: str):
        async with kw_sem:
            return await discover_and_process_single(kw, fetch_pages=fetch_pages)

    all_results: List[Dict[str, Any]] = []
    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        BarColumn(),
        TimeElapsedColumn(),
        transient=True,
        console=console,
    ) as progress:
        task_id = progress.add_task("Processing keywords…", total=len(keywords))
        coros = [_runner(kw) for kw in keywords]
        for coro in asyncio.as_completed(coros):
            res = await coro
            all_results.extend(res)
            progress.advance(task_id)

    # De-duplicate by DOI across keywords; keep higher qualityScore
    dedup: Dict[str, Dict[str, Any]] = {}
    for p in all_results:
        doi = p.get("doi")
        if not doi:
            key = (p.get("title"), p.get("yearPublished"))
            if key not in dedup:
                dedup[str(key)] = p
            else:
                if p.get("qualityScore", 0) > dedup[str(key)].get("qualityScore", 0):
                    dedup[str(key)] = p
            continue

        if doi not in dedup or p.get("qualityScore", 0) > dedup[doi].get("qualityScore", 0):
            dedup[doi] = p

    merged_results = list(dedup.values())
    console.log(f"[bold green]Total papers after de-dup:[/]{len(merged_results)}")
    return merged_results, keywords

# ---------- Endpoints ----------

@router.get("/search", summary="Search and rank research papers with advanced filtering")
async def search_papers(
    query: str = Query(..., description="Search query (comma/semicolon/newline to separate keywords)"),
    limit: int = Query(10, ge=1, le=50, description="Maximum results to return"),
    min_year: Optional[int] = Query(None, ge=1900, le=2030, description="Minimum publication year"),
    max_year: Optional[int] = Query(None, ge=1900, le=2030, description="Maximum publication year"),
    min_citations: Optional[int] = Query(None, ge=0, description="Minimum citation count"),
    max_citations: Optional[int] = Query(None, ge=0, description="Maximum citation count"),
    quartile: Optional[str] = Query(None, regex="^(Q1|Q2|Q3|Q4)$", description="Journal quartile filter"),
    min_sjr: Optional[float] = Query(None, ge=0.0, description="Minimum SJR score"),
    min_h_index: Optional[int] = Query(None, ge=0, description="Minimum journal h-index"),
    min_impact_factor: Optional[float] = Query(None, ge=0.0, description="Minimum Journal Impact Factor"),
    only_open_access: Optional[bool] = Query(False, description="Only return open access papers"),
    require_abstract: Optional[bool] = Query(False, description="Only return papers with abstracts (len>50)"),
    min_quality_score: Optional[float] = Query(None, ge=0.0, le=150.0, description="Minimum composite quality score"),
    sort_by: Optional[str] = Query(
        "qualityScore",
        regex="^(qualityScore|citationCount|yearPublished|sjrScore|h_index|impactFactor)$",
        description="Sort results by this field (higher is better)"
    ),
):
    """
    Search for research papers with comprehensive filtering and ranking.
    Supports multi-keyword async discovery, SJR/H-index/Impact Factor enrichment,
    and colorful CLI debugging via Rich.
    """
    if not query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty")

    # Validate ranges
    if min_year and max_year and min_year > max_year:
        raise HTTPException(status_code=400, detail="min_year cannot be greater than max_year")
    if min_citations and max_citations and min_citations > max_citations:
        raise HTTPException(status_code=400, detail="min_citations cannot be greater than max_citations")

    console.rule("[bold blue]Search Start")
    console.log(f"Incoming query: [bold]{query}[/]")

    results, keywords = await discover_and_process_multi(query, fetch_pages=4)
    if not results:
        raise HTTPException(status_code=404, detail="No papers found. Try a different search query.")

    # In-memory filtering
    filtered_results = results

    if min_year is not None:
        filtered_results = [p for p in filtered_results if p.get("yearPublished") and p["yearPublished"] >= min_year]

    if max_year is not None:
        filtered_results = [p for p in filtered_results if p.get("yearPublished") and p["yearPublished"] <= max_year]

    if min_citations is not None:
        filtered_results = [p for p in filtered_results if p.get("citationCount") is not None and p["citationCount"] >= min_citations]

    if max_citations is not None:
        filtered_results = [p for p in filtered_results if p.get("citationCount") is not None and p["citationCount"] <= max_citations]

    if quartile is not None:
        filtered_results = [p for p in filtered_results if p.get("quartile") and p["quartile"].upper() == quartile.upper()]

    if min_sjr is not None:
        filtered_results = [p for p in filtered_results if p.get("sjrScore") is not None and p["sjrScore"] >= min_sjr]

    if min_h_index is not None:
        filtered_results = [p for p in filtered_results if p.get("h_index") is not None and p["h_index"] >= min_h_index]

    if min_impact_factor is not None:
        filtered_results = [
            p for p in filtered_results
            if p.get("impactFactor") is not None and p["impactFactor"] >= min_impact_factor
        ]

    if only_open_access:
        filtered_results = [p for p in filtered_results if p.get("isFreelyAvailable") is True]

    if require_abstract:
        filtered_results = [p for p in filtered_results if p.get("abstract") is not None and len(p["abstract"]) > 50]

    if min_quality_score is not None:
        filtered_results = [p for p in filtered_results if p.get("qualityScore", 0) >= min_quality_score]

    if not filtered_results:
        raise HTTPException(
            status_code=404,
            detail="No papers match the specified filters. Try relaxing your criteria.",
        )

    # Sort (all higher-is-better)
    filtered_results.sort(key=lambda x: x.get(sort_by, 0) or 0, reverse=True)

    # Limit
    final_results = filtered_results[:limit]

    # Pretty summary in CLI
    tbl = Table(title="Search Summary", show_header=True, header_style="bold magenta")
    tbl.add_column("Metric")
    tbl.add_column("Value", justify="right")
    tbl.add_row("Keywords", str(len(keywords)))
    tbl.add_row("Discovered (dedup)", str(len(results)))
    tbl.add_row("After Filtering", str(len(filtered_results)))
    tbl.add_row("Returned", str(len(final_results)))
    tbl.add_row("Sorted By", sort_by)
    console.print(tbl)
    console.rule("[bold blue]Search End")

    return {
        "query": query,
        "keywords": keywords,                    # to show what was parsed/called
        "totalDiscovered": len(results),
        "totalAfterFiltering": len(filtered_results),
        "resultCount": len(final_results),
        "sortedBy": sort_by,
        "results": final_results,
    }

# --- Health & stats ---

@router.get("/", summary="API Health Check")
async def root():
    """Health check endpoint."""
    return {
        "status": "operational",
        "service": "i-SMART Research API",
        "version": "2.0.0",
        "sjr_data_loaded": len(sjr_lookup_data) > 0,
        "sjr_records": len(sjr_lookup_data),
    }

@router.get("/stats", summary="Get API statistics")
async def get_stats():
    """Returns statistics about the SJR database."""
    if not sjr_lookup_data:
        return {"error": "SJR data not loaded"}

    quartile_counts = {"Q1": 0, "Q2": 0, "Q3": 0, "Q4": 0, "None": 0}
    for record in sjr_lookup_data.values():
        q = record.get("quartile", "None")
        quartile_counts[q] = quartile_counts.get(q, 0) + 1

    return {
        "total_journals": len(sjr_lookup_data),
        "quartile_distribution": quartile_counts,
        "api_version": "2.0.0",
    }

@router.get("/filter-guide", summary="Get recommended filter values")
async def filter_guide():
    """Provides recommended filter values for finding high-quality research papers."""
    return {
        "guide": {
            "h_index": {
                "description": "Measures journal's productivity and citation impact",
                "interpretation": "Higher h-index = more influential journal",
                "benchmarks": {
                    "basic": {"min": 20, "label": "Decent journal"},
                    "good": {"min": 50, "label": "Reputable journal"},
                    "very_good": {"min": 100, "label": "Highly reputable journal"},
                    "excellent": {"min": 200, "label": "Top-tier journal"},
                    "elite": {"min": 300, "label": "World-class journal (Nature, Science level)"},
                },
                "examples": {
                    "Nature": "h-index ~900",
                    "Science": "h-index ~850",
                    "PLOS ONE": "h-index ~350",
                    "Field-specific top journals": "h-index 100-300",
                },
            },
            "sjr_score": {
                "description": "SCImago Journal Rank - measures journal prestige and influence",
                "interpretation": "Higher SJR = more prestigious journal with higher quality citations",
                "benchmarks": {
                    "basic": {"min": 0.2, "label": "Published in indexed journal"},
                    "decent": {"min": 0.5, "label": "Good quality journal"},
                    "good": {"min": 1.0, "label": "Very good quality journal"},
                    "excellent": {"min": 2.0, "label": "Excellent journal"},
                    "outstanding": {"min": 5.0, "label": "Outstanding journal"},
                    "elite": {"min": 10.0, "label": "Elite journal (Nature, Science, Cell level)"},
                },
                "examples": {
                    "Nature": "SJR ~30",
                    "Science": "SJR ~25",
                    "Top specialized journals": "SJR 3-10",
                    "Solid field journals": "SJR 1-3",
                },
            },
            "citation_count": {
                "description": "Number of times a paper has been cited by other papers",
                "interpretation": "Higher citations = more influential/important paper",
                "note": "Citation counts vary greatly by field and paper age",
                "benchmarks": {
                    "emerging": {"min": 5, "label": "Gaining attention"},
                    "established": {"min": 10, "label": "Established research"},
                    "notable": {"min": 25, "label": "Notable contribution"},
                    "influential": {"min": 50, "label": "Influential work"},
                    "highly_influential": {"min": 100, "label": "Highly influential"},
                    "landmark": {"min": 500, "label": "Landmark paper"},
                    "seminal": {"min": 1000, "label": "Seminal work in the field"},
                },
                "age_factor": "Recent papers (< 2 years) typically have fewer citations even if high quality",
            },
            "quartile": {
                "description": "Journal ranking within its subject category",
                "interpretation": {
                    "Q1": "Top 25% of journals in the field - BEST",
                    "Q2": "25th-50th percentile - GOOD",
                    "Q3": "50th-75th percentile - AVERAGE",
                    "Q4": "75th-100th percentile - BELOW AVERAGE",
                },
                "recommendation": "For high-quality research, filter by Q1 or Q2",
            },
            "quality_score": {
                "description": "Composite score (0-150) calculated from multiple metrics",
                "components": "SJR (40pts) + h-index (30pts) + Citations (30pts) + Quartile (20pts) + Recency (10pts) + Open Access (5pts) + Abstract (5pts)",
                "benchmarks": {
                    "acceptable": {"min": 30, "label": "Acceptable quality"},
                    "good": {"min": 50, "label": "Good quality"},
                    "very_good": {"min": 70, "label": "Very good quality"},
                    "excellent": {"min": 90, "label": "Excellent quality"},
                    "outstanding": {"min": 110, "label": "Outstanding quality"},
                    "exceptional": {"min": 130, "label": "Exceptional quality"},
                },
            },
        },
        "recommended_presets": {
            "high_quality_recent": {
                "description": "Recent, high-quality papers from top journals",
                "filters": {"quartile": "Q1", "min_year": 2020, "min_quality_score": 60, "sort_by": "qualityScore"},
            },
            "highly_cited_influential": {
                "description": "Highly influential papers regardless of recency",
                "filters": {"min_citations": 100, "min_sjr": 2.0, "quartile": "Q1", "sort_by": "citationCount"},
            },
            "top_tier_journals": {
                "description": "Papers from elite journals only",
                "filters": {"min_h_index": 200, "min_sjr": 3.0, "quartile": "Q1", "sort_by": "qualityScore"},
            },
            "breakthrough_papers": {
                "description": "Landmark papers with massive impact",
                "filters": {"min_citations": 500, "min_sjr": 2.0, "quartile": "Q1", "sort_by": "citationCount"},
            },
            "emerging_research": {
                "description": "Recent papers showing early promise",
                "filters": {"min_year": 2023, "min_citations": 5, "quartile": "Q1", "sort_by": "yearPublished"},
            },
            "accessible_quality": {
                "description": "High-quality, freely available papers",
                "filters": {
                    "only_open_access": True,
                    "min_quality_score": 50,
                    "quartile": "Q1",
                    "require_abstract": True,
                    "sort_by": "qualityScore",
                },
            },
        },
        "field_specific_notes": {
            "biomedicine": "h-index 100-300 for top journals, citations accumulate quickly",
            "computer_science": "Conferences important, journal h-index 50-150 typical for top venues",
            "physics": "High citation counts common, top journals h-index 200+",
            "mathematics": "Lower citation counts normal, h-index 50-100 for top journals",
            "engineering": "Applied focus, h-index 80-200 for leading journals",
            "social_sciences": "Lower citation counts, h-index 50-150 for top journals",
        },
        "tips": [
            "Combine multiple filters for best results (e.g., Q1 + min_sjr:1.0 + min_citations:20)",
            "For recent topics, lower citation thresholds but require Q1/Q2 journals",
            "For established fields, use higher citation counts (50+) to find seminal works",
            "Quality score balances all metrics - use min_quality_score:60+ for reliable filtering",
            "Always check the paper's year - older papers naturally have more citations",
        ],
    }
