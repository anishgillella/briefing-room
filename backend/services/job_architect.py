import json
import logging
from typing import List, Optional, Dict, Literal, Any
from pydantic import BaseModel, Field
from openai import AsyncOpenAI
from config import OPENROUTER_API_KEY, LLM_MODEL
from services.market_data import get_market_data_service

logger = logging.getLogger(__name__)

class Message(BaseModel):
    role: Literal["user", "assistant", "system"]
    content: str
    
class ArchitectResponse(BaseModel):
    message: str
    market_insights: Optional[Dict[str, Any]] = None
    suggested_title: Optional[str] = None
    is_ready_to_generate: bool = False

# Tool Definitions
TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "get_market_insights",
            "description": "Fetch real-time market data (salary, skills, demand) for a specific role and location.",
            "parameters": {
                "type": "object",
                "properties": {
                    "role": {"type": "string", "description": "Job title (e.g. 'Senior Backend Engineer')"},
                    "location": {"type": "string", "description": "City and Country (e.g. 'San Francisco, USA')"}
                },
                "required": ["role", "location"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "propose_title",
            "description": "Propose a specific job title based on the user's described problem.",
            "parameters": {
                "type": "object",
                "properties": {
                    "title": {"type": "string", "description": "The proposed job title"}
                },
                "required": ["title"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "ready_to_generate",
            "description": "Signal that we have enough information to generate the full Job Description.",
            "parameters": {
                "type": "object",
                "properties": {},
            }
        }
    }
]

SYSTEM_PROMPT = """You are an expert Talent Acquisition Architect. Your goal is to help a hiring manager define a perfect job role.

### CONVERSATION FLOW:

1. **INITIALIZATION (Start here)**
   - Ask: "Do you have a specific job title in mind for this role?"
   - **IF YES (User provides title)**:
     - Acknowledge the title.
     - Move immediately to **MARKET CALIBRATION**.
   - **IF NO (User says "No", "Not sure", or describes a problem)**:
     - Move to **ROLE DISCOVERY**.

2. **ROLE DISCOVERY (If Title is Unknown)**
   - Ask: "What business problem are you trying to solve?" or "What gap is missing in your team?"
   - Listen to their pain points.
   - Use `propose_title` when you have a strong recommendation based on the problem.

3. **MARKET CALIBRATION**
   - Once a title and location are established (either provided by user or proposed by you), IMMEDIATELY use `get_market_insights` to fetch salary ranges and top skills.
   - Present this data to the user: "For a [Title] in [Location], market data shows a range of $X-$Y. Does that fit your budget?"
   - Confirm the top skills required.

4. **CONTEXT & CULTURE**
   - Ask about the team VIBE (e.g., "Are you a 'move fast and break things' team or a 'measure twice, cut once' team?").
   - Ask for 1-2 specific KPIs (Key Performance Indicators) for the first 90 days.
   - Ask about reporting structure.

5. **GENERATION**
   - When you have the Title, Salary Range, Key Skills, Culture, and KPIs, call `ready_to_generate`.

### GUIDELINES:
- **Responsive Flow**: Do not force the user into "Discovery" if they already know what they want.
- **One Question at a Time**: Never overwhelm the user.
- **Be Consultative**: Challenge them if their requirements seem unrealistic.
- **Short & Punchy**: Keep messages under 3 sentences unless explaining market data.
"""

class JobArchitect:
    def __init__(self):
        self.client = AsyncOpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=OPENROUTER_API_KEY
        )
        self.model = LLM_MODEL
        self.market_service = get_market_data_service()

    async def chat(self, history: List[Message]) -> ArchitectResponse:
        """
        Process a conversation turn.
        Returns the AI's response and any side-effects (market data, state changes).
        """
        messages = [{"role": "system", "content": SYSTEM_PROMPT}] + [m.model_dump() for m in history]
        
        # 1. First LLM Call (Decision)
        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                tools=TOOLS,
                tool_choice="auto",
                temperature=0.7
            )
        except Exception as e:
            logger.error(f"LLM Error: {e}")
            return ArchitectResponse(message="I'm having trouble connecting to my brain. Can we try again?")

        response_message = response.choices[0].message
        tool_calls = response_message.tool_calls
        
        architect_res = ArchitectResponse(message=response_message.content or "")

        # 2. Handle Tool Calls
        if tool_calls:
            # We might have multiple tool calls, or a tool call AND content
            # If tool call, we need to execute it and then call LLM again with the result
            
            tool_outputs = []
            
            for tool_call in tool_calls:
                func_name = tool_call.function.name
                args = json.loads(tool_call.function.arguments)
                
                if func_name == "get_market_insights":
                    # Execute Market Data Service
                    insights = await self.market_service.get_insights(
                        role=args.get("role"), 
                        location=args.get("location")
                    )
                    
                    # Add to response for frontend side-panel
                    architect_res.market_insights = insights.model_dump()
                    
                    # Add to conversation history for LLM
                    tool_outputs.append({
                        "tool_call_id": tool_call.id,
                        "role": "tool",
                        "name": func_name,
                        "content": json.dumps(insights.model_dump())
                    })
                    
                elif func_name == "propose_title":
                    architect_res.suggested_title = args.get("title")
                    tool_outputs.append({
                        "tool_call_id": tool_call.id,
                        "role": "tool",
                        "name": func_name,
                        "content": "Title proposed to user."
                    })
                    
                elif func_name == "ready_to_generate":
                    architect_res.is_ready_to_generate = True
                    tool_outputs.append({
                        "tool_call_id": tool_call.id,
                        "role": "tool",
                        "name": func_name,
                        "content": "Ready state set."
                    })

            # 3. Second LLM Call (if tools were used, generating the final response to user)
            if tool_outputs:
                # Append assistant's tool use message
                messages.append(response_message)
                # Append tool outputs
                messages.extend(tool_outputs)
                
                # Get final conversational response
                final_response = await self.client.chat.completions.create(
                    model=self.model,
                    messages=messages,
                    temperature=0.7
                )
                architect_res.message = final_response.choices[0].message.content

        return architect_res

    async def generate_jd(self, history: List[Message]) -> str:
        """
        Generate the final Markdown Job Description based on the full conversation history.
        """
        generation_prompt = """
        Based on the conversation history above, write a professional, compelling Job Description.
        
        Format it in Markdown with these sections:
        # [Job Title]
        
        ## About the Role
        [Summary including the business problem we are solving]
        
        ## About the Team
        [Culture and context details]
        
        ## Responsibilities
        - [Bulleted list]
        
        ## Requirements
        - [Must-have skills]
        
        ## Success Metrics (First 90 Days)
        - [KPIs discussed]
        
        ## Compensation & Benefits
        - [Salary range discussed]
        """
        
        messages = [{"role": "system", "content": SYSTEM_PROMPT}] + \
                   [m.model_dump() for m in history] + \
                   [{"role": "user", "content": generation_prompt}]
                   
        response = await self.client.chat.completions.create(
            model=self.model,
            messages=messages,
            temperature=0.5
        )
        
        return response.choices[0].message.content
