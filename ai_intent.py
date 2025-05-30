import os
import json
from openai import OpenAI
from typing import Optional, Dict

class AIIntentParser:
    def __init__(self):
        self.api_key = os.getenv("PERPLEXITY_API_KEY")
        if not self.api_key:
            raise ValueError("PERPLEXITY_API_KEY not found in environment variables")
            
        self.client = OpenAI(
            api_key=self.api_key,
            base_url="https://api.perplexity.ai"
        )  # Fixed: Added missing closing parenthesis
        
        self.system_prompt = """Analyze Algorand-related requests and return JSON with:
{
  "intent": "send_algo|create_wallet|connect_wallet|create_nft|disconnect|balance",
  "parameters": {
    "amount": float,
    "recipient": "address", 
    "name": "string",
    "supply": int,
    "description": "string"
  }
}

Examples:
User: "Hey, send 3 ALGO to K54ZTTHNDB..."
{"intent": "send_algo", "parameters": {"amount": 3, "recipient": "K54ZTTHNDB..."}}

User: "Create a new wallet"
{"intent": "create_wallet", "parameters": {}}

User: "Check my balance"
{"intent": "balance", "parameters": {}}"""

    def parse(self, user_input: str) -> Optional[Dict]:
        try:
            response = self.client.chat.completions.create(
                model="sonar-pro",
                messages=[
                    {"role": "system", "content": self.system_prompt},
                    {"role": "user", "content": user_input}
                ],
                temperature=0.1,
                max_tokens=200
            )  # Fixed: Added missing closing parenthesis
            return self._extract_json(response.choices[0].message.content)
        except Exception as e:
            print(f"AI Parsing Error: {e}")
            return None

    def _extract_json(self, text: str) -> Dict:
        try:
            start = text.find('{')
            end = text.rfind('}') + 1
            return json.loads(text[start:end])
        except:
            return {"intent": "unknown"}
