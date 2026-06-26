# controllers/watch_controller.py
# Google Fit OAuth + Health Data Sync (MongoDB storage)

import os
import time
from datetime import datetime, timedelta
from urllib.parse import urlencode

from flask import Blueprint, jsonify, request, redirect
from flask_jwt_extended import jwt_required, get_jwt_identity
import requests

try:
    from pymongo import MongoClient, ASCENDING
except ImportError:
    MongoClient = None
    ASCENDING = 1

# -------------------------
# Config from environment
# -------------------------
GOOGLE_CLIENT_ID = os.getenv(
    "GOOGLE_CLIENT_ID", ""
)
GOOGLE_CLIENT_SECRET = os.getenv(
    "GOOGLE_CLIENT_SECRET", ""
)
REDIRECT_URI = os.getenv(
    "REDIRECT_URI", "http://localhost:5000/api/watch/googlefit/callback"
)
FRONTEND_URL = os.getenv(
    "FRONTEND_URL", "http://localhost:5173/patient/watch-data"
)

SCOPES = " ".join([
    "https://www.googleapis.com/auth/fitness.heart_rate.read",
    "https://www.googleapis.com/auth/fitness.activity.read",
    "https://www.googleapis.com/auth/fitness.sleep.read",
    "https://www.googleapis.com/auth/fitness.body.read",
])

# MongoDB
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
MONGO_DB = os.getenv("MONGO_DB", "medical_system")

# SMTP / Email
EMAIL_FROM = os.getenv("EMAIL_FROM", "")
EMAIL_APP_PASSWORD = os.getenv("EMAIL_APP_PASSWORD", "")
SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))

# -------------------------
# MongoDB Helper
# -------------------------
_mongo_client = None
_mongo_db = None


def _get_db():
    """Lazy-initialise and return the MongoDB database handle."""
    global _mongo_client, _mongo_db
    if _mongo_db is None:
        if MongoClient is None:
            raise RuntimeError("pymongo is not installed")
        _mongo_client = MongoClient(MONGO_URI)
        _mongo_db = _mongo_client[MONGO_DB]
    return _mongo_db


def ensure_indexes():
    """Create indexes on the health-data collections (idempotent)."""
    try:
        db = _get_db()
        db["google_tokens"].create_index(
            [("patient_id", ASCENDING)], unique=True, background=True
        )
        for col_name in ("heart_rate", "steps", "calories", "sleep"):
            db[col_name].create_index(
                [("patient_id", ASCENDING), ("date", ASCENDING)],
                background=True,
            )
    except Exception as e:
        print(f"[watch_controller] ensure_indexes error: {e}")


# -------------------------
# Token helpers
# -------------------------
def save_refresh_token(patient_id, refresh_token):
    """Persist the Google OAuth refresh token in MongoDB."""
    db = _get_db()
    db["google_tokens"].update_one(
        {"patient_id": str(patient_id)},
        {"$set": {"refresh_token": refresh_token, "updated_at": datetime.utcnow()}},
        upsert=True,
    )


def get_refresh_token(patient_id):
    """Return the stored refresh token for a patient, or None."""
    try:
        db = _get_db()
        doc = db["google_tokens"].find_one({"patient_id": str(patient_id)})
        return doc.get("refresh_token") if doc else None
    except Exception:
        return None


# -------------------------
# Google Fit data helpers
# -------------------------
_FIT_DATA_SOURCES = {
    "heart_rate": "derived:com.google.heart_rate.bpm:com.google.android.gms:merge_heart_rate_bpm",
    "steps": "derived:com.google.step_count.delta:com.google.android.gms:estimated_steps",
    "calories": "derived:com.google.calories.expended:com.google.android.gms:merge_calories_expended",
    "sleep": "derived:com.google.sleep.segment:com.google.android.gms:merged",
}


def _fetch_fit_dataset(access_token, data_source_id, start_ms, end_ms):
    """Fetch a dataset range from the Google Fit REST API."""
    url = (
        f"https://www.googleapis.com/fitness/v1/users/me/dataSources/"
        f"{data_source_id}/datasets/{start_ms}000000-{end_ms}000000"
    )
    resp = requests.get(url, headers={"Authorization": f"Bearer {access_token}"}, timeout=30)
    if resp.status_code != 200:
        print(f"[watch_controller] Fit API error ({resp.status_code}): {resp.text[:200]}")
        return []
    return resp.json().get("point", [])


def _aggregate_daily(points, value_key="fpVal"):
    """Aggregate data-points by day, returning {date_str: value}."""
    daily = {}
    for pt in points:
        start_ns = int(pt.get("startTimeNanos", 0))
        ts = start_ns / 1e9
        day = datetime.utcfromtimestamp(ts).strftime("%Y-%m-%d")
        vals = pt.get("value", [])
        val = vals[0].get(value_key, vals[0].get("intVal", 0)) if vals else 0
        daily[day] = daily.get(day, 0) + (val if isinstance(val, (int, float)) else 0)
    return daily


def fetch_and_store_fit_data(patient_id, access_token, start_ms, end_ms):
    """
    Pull heart_rate, steps, calories, sleep from Google Fit,
    store daily aggregates in MongoDB, and return chart_data dict.
    """
    db = _get_db()
    patient_id = str(patient_id)
    chart_data = {}

    for metric, ds_id in _FIT_DATA_SOURCES.items():
        points = _fetch_fit_dataset(access_token, ds_id, start_ms, end_ms)

        vk = "intVal" if metric == "steps" else "fpVal"
        daily = _aggregate_daily(points, value_key=vk)

        # Upsert each day into Mongo
        col = db[metric]
        for day_str, value in daily.items():
            col.update_one(
                {"patient_id": patient_id, "date": day_str},
                {"$set": {"value": value, "updated_at": datetime.utcnow()}},
                upsert=True,
            )

        sorted_days = sorted(daily.keys())
        chart_data[metric] = {
            "labels": sorted_days,
            "values": [round(daily[d], 2) for d in sorted_days],
        }

    return chart_data


def get_chart_data_from_db(patient_id, days=30):
    """
    Read stored daily aggregates from MongoDB for the given patient
    and return a dict suitable for the frontend charts.
    """
    try:
        db = _get_db()
    except Exception:
        return {}

    patient_id = str(patient_id)
    cutoff = (datetime.utcnow() - timedelta(days=days)).strftime("%Y-%m-%d")
    chart_data = {}

    for metric in ("heart_rate", "steps", "calories", "sleep"):
        docs = list(
            db[metric]
            .find({"patient_id": patient_id, "date": {"$gte": cutoff}})
            .sort("date", ASCENDING)
        )
        chart_data[metric] = {
            "labels": [d["date"] for d in docs],
            "values": [round(d.get("value", 0), 2) for d in docs],
        }

    return chart_data if any(chart_data[m]["labels"] for m in chart_data) else None


# -------------------------
# Blueprint
# -------------------------
watch_bp = Blueprint("watch", __name__, url_prefix="/api/watch")


@watch_bp.route("/auth-url", methods=["GET"])
@jwt_required()
def auth_url():
    """Return the Google OAuth URL for the frontend to redirect to."""
    patient_id = get_jwt_identity()
    url = (
        "https://accounts.google.com/o/oauth2/v2/auth?"
        + urlencode({
            "client_id": GOOGLE_CLIENT_ID,
            "redirect_uri": REDIRECT_URI,
            "response_type": "code",
            "scope": SCOPES,
            "access_type": "offline",
            "prompt": "consent",
            "state": str(patient_id or ""),
        })
    )
    return jsonify({"success": True, "url": url})


@watch_bp.route("/googlefit/callback", methods=["GET"])
def googlefit_callback():
    """Handle the OAuth2 callback from Google."""
    # Note: callback cannot easily use jwt_required since it's a redirect from Google.
    # The state param passes the patient_id back to us safely.
    patient_id = request.args.get("state")
    code = request.args.get("code")

    if not code:
        return redirect(f"{FRONTEND_URL}?status=error&reason=no_code")

    # Exchange code for tokens
    try:
        token_resp = requests.post(
            "https://oauth2.googleapis.com/token",
            data={
                "code": code,
                "client_id": GOOGLE_CLIENT_ID,
                "client_secret": GOOGLE_CLIENT_SECRET,
                "redirect_uri": REDIRECT_URI,
                "grant_type": "authorization_code",
            },
            timeout=20,
        )
    except Exception as exc:
        print(f"[watch_controller] token exchange error: {exc}")
        return redirect(f"{FRONTEND_URL}?status=error&reason=token_exchange_failed")

    if token_resp.status_code != 200:
        print(f"[watch_controller] token response {token_resp.status_code}: {token_resp.text[:300]}")
        return redirect(f"{FRONTEND_URL}?status=error&reason=token_error")

    tokens = token_resp.json()
    refresh_token = tokens.get("refresh_token")
    access_token = tokens.get("access_token")

    if refresh_token and patient_id:
        ensure_indexes()
        save_refresh_token(patient_id, refresh_token)

    # Optionally do an initial sync
    if access_token and patient_id:
        now_ms = int(time.time() * 1000)
        start_ms = now_ms - (30 * 24 * 60 * 60 * 1000)  # last 30 days
        try:
            fetch_and_store_fit_data(patient_id, access_token, start_ms, now_ms)
        except Exception as exc:
            print(f"[watch_controller] initial sync error: {exc}")

    return redirect(f"{FRONTEND_URL}?status=success")


@watch_bp.route("/data", methods=["GET"])
@jwt_required()
def watch_data():
    """Return stored health chart data for a patient."""
    patient_id = get_jwt_identity()
    if not patient_id:
        return jsonify({"success": False, "message": "patient_id required"}), 400

    try:
        days = int(request.args.get("days", 30))
    except (TypeError, ValueError):
        days = 30
    days = max(1, min(days, 365))

    ensure_indexes()
    chart_data = get_chart_data_from_db(patient_id, days=days)
    is_connected = bool(get_refresh_token(patient_id))

    return jsonify({
        "success": True,
        "chart_data": chart_data,
        "is_connected": is_connected,
        "days": days,
    })


@watch_bp.route("/sync", methods=["POST"])
@jwt_required()
def sync_data():
    """Manually trigger a re-sync of Google Fit data."""
    patient_id = get_jwt_identity()
    if not patient_id:
        return jsonify({"success": False, "error": "patient_id required"}), 400

    refresh_token = get_refresh_token(patient_id)
    if not refresh_token:
        return jsonify({"success": False, "error": "No OAuth token. Connect Google Fit first."}), 400

    # Refresh the access token
    try:
        token_resp = requests.post(
            "https://oauth2.googleapis.com/token",
            data={
                "client_id": GOOGLE_CLIENT_ID,
                "client_secret": GOOGLE_CLIENT_SECRET,
                "refresh_token": refresh_token,
                "grant_type": "refresh_token",
            },
            timeout=20,
        )
    except Exception:
        return jsonify({"success": False, "error": "Failed to contact token endpoint"}), 500

    if token_resp.status_code != 200:
        return jsonify({"success": False, "error": "Failed to refresh access token"}), 500

    access_token = token_resp.json().get("access_token")
    if not access_token:
        return jsonify({"success": False, "error": "No access token in response"}), 500

    now_ms = int(time.time() * 1000)
    start_ms = now_ms - (30 * 24 * 60 * 60 * 1000)

    ensure_indexes()
    chart_data = fetch_and_store_fit_data(patient_id, access_token, start_ms, now_ms)

    return jsonify({
        "success": True,
        "message": "Watch data synced successfully!",
        "chart_data": chart_data,
    })



