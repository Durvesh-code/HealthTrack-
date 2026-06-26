# backend/agent/chat_agent.py
"""
Builds the Agno agent for a single chat turn.

A fresh Agent object is created per request — Flask is stateless and may
run multiple worker processes, so we can't keep one Agent alive in memory
between requests. Conversation continuity instead comes from the MongoDB
session store (see MongoDb below): as long as the same session_id is used,
get_agent() + agent.run() picks the conversation back up correctly, even
in a brand-new process.
"""

import os
from typing import Optional

from agno.agent import Agent
from agno.models.openai import OpenAIChat
from agno.db.mongo import MongoDb

# pyrefly: ignore [missing-import]
from agent.prompts import build_instructions
# pyrefly: ignore [missing-import]
from agent.tools import get_patient_tools, get_doctor_tools, get_pharmacist_tools

# Reuses the same Mongo instance already used for Google Fit data
# (see controllers/watch_controller.py) — just a new collection in it.
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
MONGO_DB = os.getenv("MONGO_DB", "medical_system")

# gpt-4o-mini by default: tool-calling chat at a fraction of gpt-4o's cost.
# Override with CHAT_MODEL=gpt-4o in .env if you want the bigger model.
CHAT_MODEL = os.getenv("CHAT_MODEL", "gpt-5.4")

# pymongo's MongoClient (which this wraps) connects lazily, so building
# this at import time is safe even if Mongo isn't reachable yet — same
# pattern as watch_controller.py's _get_db().
_db = MongoDb(db_url=MONGO_URI, db_name=MONGO_DB, session_collection="chat_history")




def session_id_for(role: str, user_id: str) -> str:
    """One continuous conversation per user per role — not per page."""
    return f"{role}_{user_id}"


def get_agent(
    role: str,
    user_id: str,
    route: Optional[str] = None,
    user_name: Optional[str] = None,
    user_location: Optional[dict] = None,
    session_id: Optional[str] = None,
) -> Agent:
    tools = []
    if role != "visitor":
        try:
            user_id_int = int(user_id)
            if role == "patient":
                tools = get_patient_tools(user_id_int, user_location=user_location)
            elif role == "doctor":
                tools = get_doctor_tools(user_id_int)
            elif role == "pharmacist":
                tools = get_pharmacist_tools(user_id_int)
        except ValueError:
            pass

    return Agent(
        model=OpenAIChat(id=CHAT_MODEL),
        session_id=session_id,
        db=_db,
        tools=tools,
        instructions=build_instructions(role, route, user_name, user_location),
        add_history_to_context=True,
        num_history_runs=10,
        add_datetime_to_context=True,
        markdown=True,
    )
