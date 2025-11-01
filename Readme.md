# 🧠 i-Smart ScholAR

An AI-powered academic assistant to **discover papers, analyze PDFs, generate summaries/translations, and craft literature reviews** — all in one place.

> Example prompt:  
> “Find the latest papers on few-shot learning after 2023 and summarize the key methods.”

---

## 🔎 Overview

**i-Smart ScholAR** streamlines your research workflow:
- Discover and rank relevant papers from your query/keywords
- Upload PDFs for instant summaries, highlights, and Q&A
- Generate structured **Literature Reviews** with citations
- Translate abstracts and sections to your preferred language
- Export insights to Markdown/PDF

---

## ✨ Core Features

1. 🔍 **AI Keyword Generation**
   - Extracts key terms from prompts or uploaded PDFs
   - Helps refine search queries and paper retrieval

2. 📚 **Smart Paper Retrieval**
   - Finds papers and ranks them using AI-driven relevance
   - Shows titles, abstracts, links, and quick actions

3. 🧾 **Instant Summaries & Translations**
   - TL;DR abstracts/sections
   - Translate to EN/HI/ES/… with one click

4. 🤖 **AI Literature Review**
   - Auto-structures related work with headings
   - Pulls out themes, gaps, and future directions
   - Optional BibTeX parsing for citations

5. 💾 **Export & Report**
   - Export **Markdown** or **PDF** summaries/reviews
   - Batch export multiple papers into one report

---

## 🗂 Pages

### 🏠 Page 1: Home / Discovery

![Home / Discovery](./images/translation.png)

**What you can do**
- Enter a research topic or paste an abstract
- Auto-generate **keywords** and **search strings**
- Retrieve and rank papers

**Try prompts**
- “Quantum error correction codes for near-term devices”
- “LLM-based code generation reliability after 2024 — survey the latest”

---

### 📄 Page 2: Paper Workspace

![Literature Review](../images/paper.png)


**What you can do**
- Upload PDFs (`.pdf`) or attach retrieved papers
- **Summarize**, **translate**, **extract keywords**
- Ask questions like:
  - “What is the main contribution vs. prior work?”
  - “List datasets and evaluation metrics”
  - “Explain the loss function in simple terms”

---

### 🧠 Page 3: Literature Review

![Literature Review](../images/literature.png)


**What you can do**
- Generate a structured review (Introduction → Themes → Gaps → Future Work)
- Auto-include short citations or parse BibTeX
- Edit section headers and re-generate any section

---

### 📤 Page 4: Reports & Export

**What you can do**
- Combine multiple paper summaries into one report
- Export **Markdown** or **PDF**
- Include translated abstracts / key-insights table

---



## 🏗 Tech Stack

**Frontend**
- React.js • HTML • CSS • JavaScript

**Backend**
- FastAPI (Python) • LangChain • Gemini API
- MySQL (storage)
- (Optional) Chrome Build APIs

---

## 📦 Clone & Run

### 1) Backend

```bash
git clone https://github.com/your-username/i-smart-scholar.git
cd i-smart-scholar/backend

# Create & activate venv (optional)
# python -m venv .venv && source .venv/bin/activate

pip install -r requirements.txt
