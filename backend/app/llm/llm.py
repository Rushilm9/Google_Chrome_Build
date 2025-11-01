import os
from dotenv import load_dotenv
from langchain_google_genai import ChatGoogleGenerativeAI

load_dotenv()

class LLMClient:
    def __init__(self):
        """Initialize Google Gemini Chat model."""
        self.llm = ChatGoogleGenerativeAI(
            model="gemini-2.5-flash",  # ✅ latest working model
            google_api_key=os.getenv("GOOGLE_API_KEY"),
        )

    def chat(self, prompt: str) -> str:
        """Send a text prompt and return the LLM's response."""
        try:
            response = self.llm.invoke(prompt)
            return response.content if hasattr(response, "content") else str(response)
        except Exception as e:
            return f"[LLM Error] {str(e)}"
