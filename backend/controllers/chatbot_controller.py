# backend/controllers/chatbot_controller.py
"""
Chatbot endpoints — stream a reply, fetch history, clear history.

This matches exactly what frontend/src/components/common/ChatBubble.jsx
already expects:

  GET    /api/chat/history  -> { success, messages: [{role, content}, ...] }
  POST   /api/chat/stream   -> text/event-stream of 'data: {...}\\n\\n' lines,
                                each either {"content": "..."} or
                                {"error": "..."}, terminated by 'data: [DONE]\\n\\n'
  DELETE /api/chat/history  -> { success }
"""

import json
from typing import Optional

from flask import Blueprint, request, jsonify, Response, stream_with_context
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt

from extensions import limiter
from models.patient_model import PatientModel
from models.doctor_model import DoctorModel
from models.pharmacist_model import PharmacistModel
from agent.chat_agent import get_agent, session_id_for

chatbot_bp = Blueprint("chatbot", __name__, url_prefix="/api/chat")

def _display_name(role: str, user_id: str) -> Optional[str]:
    if role == "visitor":
        return "Visitor"
        
    try:
        uid = int(user_id)
        if role == "patient":
            record = PatientModel.get_by_id(uid)
        elif role == "doctor":
            record = DoctorModel.find_by_id(uid)
        elif role == "pharmacist":
            record = PharmacistModel.get_profile(uid)
        else:
            return None
        return record.get("name") if record else None
    except (ValueError, TypeError):
        return None

@chatbot_bp.route("/stream", methods=["POST"])
@limiter.limit("5 per minute, 50 per hour, 200 per day")
@jwt_required(optional=True)
def chat_stream():
    user_id = get_jwt_identity()
    if user_id is None:
        role = "visitor"
        user_id = request.headers.get("X-Forwarded-For", request.remote_addr) or "visitor_ip"
    else:
        role = get_jwt().get("role", "patient")

    data = request.get_json(silent=True) or {}
    message = (data.get("message") or "").strip()
    route = data.get("route")
    location_data = data.get("location")

    if not message:
        return jsonify({"success": False, "message": "Message is empty."}), 400

    session_id = session_id_for(role, user_id)
    user_name = _display_name(role, user_id)
    agent = get_agent(role, user_id, route, user_name, location_data)

    def generate():
        try:
            for event in agent.run(message, stream=True, user_id=str(user_id), session_id=session_id):
                if event.event == "RunContent" and event.content:
                    yield f"data: {json.dumps({'content': event.content})}\n\n"
                elif event.event == "RunError":
                    yield f"data: {json.dumps({'error': event.content or 'Something went wrong.'})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
        finally:
            yield "data: [DONE]\n\n"

    return Response(
        stream_with_context(generate()),
        mimetype="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@chatbot_bp.route("/history", methods=["GET"])
@jwt_required(optional=True)
def chat_history():
    user_id = get_jwt_identity()
    if not user_id:
        return jsonify({"success": True, "messages": []})
        
    role = get_jwt().get("role", "patient")
    session_id = session_id_for(role, user_id)

    agent = get_agent(role, user_id, session_id=session_id)
    try:
        history = agent.get_chat_history()
    except Exception:
        history = []

    messages = [{"role": m.role, "content": m.content} for m in history if m.content]
    return jsonify({"success": True, "messages": messages})


@chatbot_bp.route("/history", methods=["DELETE"])
@jwt_required(optional=True)
def clear_chat_history():
    user_id = get_jwt_identity()
    if not user_id:
        return jsonify({"success": True})
        
    role = get_jwt().get("role", "patient")
    session_id = session_id_for(role, user_id)

    agent = get_agent(role, user_id, session_id=session_id)
    try:
        storage = getattr(agent, 'storage', getattr(agent, 'db', None))
        if storage and hasattr(storage, 'delete_session'):
            storage.delete_session(session_id)
    except Exception:
        pass

    return jsonify({"success": True})
