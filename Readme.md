% ===========================
% LaTeX version of README.md
% Paste this into your README as a fenced code block,
% or compile as a standalone .tex document.
% ===========================
\documentclass[11pt]{article}

\usepackage[a4paper,margin=1in]{geometry}
\usepackage[T1]{fontenc}
\usepackage{lmodern}
\usepackage{hyperref}
\usepackage{titlesec}
\usepackage{enumitem}
\usepackage{listings}
\usepackage{xcolor}

\hypersetup{
  colorlinks=true,
  linkcolor=black,
  urlcolor=blue
}

\setlist[itemize]{leftmargin=1.2em}
\setlist[enumerate]{leftmargin=1.2em}

\titleformat{\section}{\large\bfseries}{}{0em}{}
\titleformat{\subsection}{\normalsize\bfseries}{}{0em}{}

\lstdefinestyle{terminal}{
  basicstyle=\ttfamily\small,
  columns=fullflexible,
  breaklines=true,
  frame=single
}

\begin{document}

\begin{center}
{\huge \textbf{🧠 i-Smart ScholAR}}\\[4pt]
A smart AI-powered academic research assistant that helps users \textbf{discover, analyze, summarize, and understand} research papers faster and smarter.
\end{center}

\hrule
\vspace{1em}

\section*{🚀 Overview}
\textit{i-Smart ScholAR} is a web-based AI assistant designed to assist researchers, educators, and students in managing academic literature. It automates paper discovery, summarization, translation, and literature review generation — saving hours of manual effort.

\section*{✨ Features}
\begin{itemize}
  \item 🔍 \textbf{AI Keyword Generation} — Extracts key terms from prompts or uploaded files
  \item 📚 \textbf{Smart Paper Retrieval} — Fetches and ranks research papers using AI-driven metrics
  \item 🧾 \textbf{Instant Summaries \& Translations} — Summarizes and translates abstracts automatically
  \item 🤖 \textbf{AI Literature Review} — Generates structured, insightful literature reviews
  \item 💾 \textbf{Export \& Report} — Save and export concise summaries or full reports
\end{itemize}

\section*{🏗 Tech Stack}
\textbf{Frontend}
\begin{itemize}
  \item React.js
  \item HTML / CSS / JavaScript
\end{itemize}

\textbf{Backend}
\begin{itemize}
  \item FastAPI (Python)
  \item MySQL
  \item LangChain
  \item Gemini API (for summarization, translation \& reasoning)
  \item Chrome Build APIs
\end{itemize}

\section*{📁 Project Structure}
\begin{lstlisting}[style=terminal]
i-smart-scholAR/
├── frontend/        # React frontend
│   ├── src/
│   ├── public/
│   ├── package.json
│   └── ...
│
├── backend/         # FastAPI backend
│   ├── app/
│   ├── requirements.txt
│   ├── main.py
│   └── ...
│
└── README.md
\end{lstlisting}

\section*{⚙️ Setup \& Installation}

\subsection*{🖥 Backend Setup}
\begin{lstlisting}[style=terminal,language=bash]
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
\end{lstlisting}

This starts the FastAPI backend server (default: \url{http://127.0.0.1:8000}).

\subsection*{💻 Frontend Setup}
\begin{lstlisting}[style=terminal,language=bash]
cd frontend
npm install
npm run build
npm start
\end{lstlisting}

This runs the frontend (default: \url{http://localhost:3000}).

\section*{🧩 How It Works}
\begin{enumerate}
  \item Users enter prompts or upload research papers.
  \item The backend uses \textbf{LangChain agents} and \textbf{Gemini} to analyze content.
  \item Summaries, translations, and recommendations are generated automatically.
  \item Results are stored in \textbf{MySQL} and displayed via the \textbf{React} interface.
\end{enumerate}

\section*{🏅 Accomplishments}
\begin{itemize}
  \item Developed a fully functional AI-powered academic assistant
  \item Integrated \textit{Gemini AI}, \textit{LangChain}, and \textit{Chrome APIs} for intelligent processing
  \item Used by students and teachers at our institute for real research tasks
\end{itemize}

\section*{📚 What We Learned}
\begin{itemize}
  \item Integrating multiple AI services efficiently
  \item Using Chrome Build APIs for local summarization and translation
  \item Managing API tokens and optimizing LLM calls
  \item Building a cost-effective browser–AI hybrid workflow
\end{itemize}

\section*{🚀 What’s Next}
\begin{itemize}
  \item Launch beta testing for institute users
  \item Add analytics and usage insights
  \item Enhance summarization and recommendation accuracy
  \item Prepare for broader public release
\end{itemize}

\section*{📸 Screenshots}
Add your project screenshots here (interface, dashboard, or results page).

\textbf{Example folder structure:}
\begin{lstlisting}[style=terminal]
frontend/assets/screenshots/
│
├── home_page.png
├── analysis_view.png
└── summary_report.png
\end{lstlisting}

\textbf{Example image display (Markdown):}
\begin{lstlisting}[style=terminal]
![Home Page](./frontend/assets/screenshots/home_page.png)
![Analysis View](./frontend/assets/screenshots/analysis_view.png)
![Summary Report](./frontend/assets/screenshots/summary_report.png)
\end{lstlisting}

\section*{🧑‍💻 Contributors}
\begin{itemize}
  \item \textbf{Your Name(s)} — Developer / Researcher
  \item \textbf{Team / Institute} — [Your Institute Name Here]
\end{itemize}

\section*{📄 License}
This project is released under the \textbf{MIT License}. Feel free to use, modify, and improve it for educational and research purposes.

\bigskip
\hrule
\bigskip

\begin{center}
\textbf{⭐ i-Smart ScholAR — Making AI-Assisted Research Accessible, Efficient \& Impactful.}
\end{center}

\end{document}
