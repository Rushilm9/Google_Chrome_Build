# 🧠 i-Smart ScholAR  
*An AI-powered web application for smarter academic research and literature review*  

---

## 📘 Overview  
**i-Smart ScholAR** is an intelligent academic assistant that helps researchers and students **discover, analyze, and summarize** research papers using AI.  
It integrates **Gemini**, **Chrome Built-in AI APIs**, and **LangChain** to automate research workflows — from **keyword generation** to **literature review synthesis** — all within an interactive web app.  

---

## ⚡ Key Features  

✅ AI-based **keyword generation** from prompts or PDFs  
✅ **Smart paper discovery & ranking** by relevance  
✅ **Instant summaries and translations** using Chrome Built-in AI  
✅ **Automated literature review** with Gemini  
✅ **Report export** in Markdown or PDF  
✅ Runs directly in Chrome with built-in AI support  

---

## 🧠 Core Technologies  

| Layer | Tools / Frameworks |
|-------|--------------------|
| 💻 **Frontend** | React.js, Vite, TailwindCSS |
| ⚙️ **Backend** | FastAPI, LangChain |
| 🧩 **AI Models / APIs** | Gemini API, Chrome Built-in AI APIs |
| 🗄️ **Database** | MySQL |
| 🌐 **External API** | OpenAlex (for research papers) |

---

## 🏗️ System Architecture  
![Architecture](./images/arch2.png)

**Flow:**  
1. React frontend interacts with FastAPI backend via REST.  
2. Backend integrates:  
   - 🧠 **Gemini API** → Summarization, literature synthesis  
   - ⚙️ **Chrome Built-in AI APIs** → Keyword generation, translation  
   - 🔗 **LangChain** → Chaining and context handling  
   - 🗄️ **MySQL** → Project data and metadata storage  

---

## 🧩 Core Modules  

### 1️⃣ Project Creation  
![Dashboard](./images/project.png)  
Manage your research projects — create, edit, and switch between topics easily.  

---

### 2️⃣ Keyword Generator  
![Keyword Generator](./images/upload.png)  
Generate keywords from prompts or PDFs using **Chrome Built-in AI** + **Gemini** for better search precision.  

---

### 3️⃣ Paper List  
![Paper List](./images/paper.png)  
Fetch and rank research papers by AI relevance. Quickly view abstracts, summaries, and key findings.  

---

### 4️⃣ Literature Upload  
![Upload](./images/lit-upload.png)  
Upload PDFs and let AI extract key points like **contribution**, **methods**, and **results** using Gemini.  

---

### 5️⃣ Literature Review  
![Review](./images/literature.png)  
Auto-generate a **structured literature review** divided into sections like:  
- Introduction  
- Related Work  
- Key Themes  
- Research Gaps  
- Future Work  

All synthesized intelligently via Gemini.  

---

### 6️⃣ Translation  
![Translation](./images/translation.png)  
Translate abstracts, summaries, or reviews using **Chrome Built-in Translation API** — offline and instant.  

---

## ⚙️ Setup Guide  

### 🧩 Prerequisites  
- 🐍 Python 3.9+  
- 🧱 Node.js 18+  
- 🐬 MySQL installed and running  

---

### 🔧 Backend Setup  
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
