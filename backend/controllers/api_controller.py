from functools import wraps
from datetime import datetime, timedelta
import os
import time
from urllib.parse import urlencode

from flask import Blueprint, jsonify, request, send_from_directory
from werkzeug.utils import secure_filename
import requests
from flask_jwt_extended import (
    jwt_required, get_jwt_identity, get_jwt,
    create_access_token, decode_token
)

from config import UPLOAD_FOLDER, ALLOWED_EXTENSIONS
from database.connection import get_connection
from models.patient_model import PatientModel
from models.doctor_model import DoctorModel
from models.appointment_model import AppointmentModel
from models.prescription_model import PrescriptionModel
from models.pharmacist_model import PharmacistModel
from models.inventory_model import InventoryModel
from models.hospital_model import HospitalModel
from models.availability_model import AvailabilityModel

from controllers.watch_controller import (
    ensure_indexes,
    get_chart_data_from_db,
    get_refresh_token,
    fetch_and_store_fit_data,
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    REDIRECT_URI,
    SCOPES,
)

api_bp = Blueprint("api", __name__, url_prefix="/api")


def _allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


def _json_error(message, status=400):
    return jsonify({"success": False, "message": message}), status


# --- UPDATED: JWT Role Decorator (Fixes the Session Issue) ---
def require_role(*roles):
    def decorator(fn):
        @wraps(fn)
        @jwt_required()  # Validate Token first
        def wrapper(*args, **kwargs):
            # Get claims from the token
            claims = get_jwt()
            user_role = claims.get("role")
            
            # Allow if user's role is in the allowed list
            if user_role not in roles:
                return _json_error(f"Unauthorized: Requires {roles}, got {user_role}", 403)
            
            return fn(*args, **kwargs)
        return wrapper
    return decorator


@api_bp.route("/health", methods=["GET"])
def health():
    return jsonify({"success": True, "status": "ok"})


# --- UPDATED: /me Endpoint (Fixes Logout Loop) ---
@api_bp.route("/auth/me", methods=["GET"])
@jwt_required()
def me():
    # Get identity (ID) and role from token
    current_user_id = get_jwt_identity()
    claims = get_jwt()
    role = claims.get("role")

    if not role:
        return _json_error("Invalid Token Structure", 401)

    payload = {"role": role, "id": current_user_id}
    
    # We fetch name/details based on role to be helpful to frontend
    try:
        if role == "patient":
            p = PatientModel.get_profile(current_user_id)
            payload["patient_id"] = current_user_id
            payload["name"] = p.get("name") if p else "Patient"
            payload["profile_img"] = p.get("profile_img") if p else None
            
        elif role == "doctor":
            d = DoctorModel.get_profile(current_user_id)
            payload["doctor_id"] = current_user_id
            payload["name"] = d.get("name") if d else "Doctor"
            payload["profile_img"] = d.get("profile_img") if d else None
            
        elif role == "pharmacist":
            ph = PharmacistModel.get_profile(current_user_id)
            payload["pharmacist_id"] = current_user_id
            payload["name"] = ph.get("name") if ph else "Pharmacist"
            payload["profile_img"] = ph.get("profile_img") if ph else None
            
    except Exception as e:
        print(f"Error fetching user details in /me: {e}")
        # Don't fail the auth check just because name fetch failed
        payload["name"] = role.capitalize()

    return jsonify({"success": True, "user": payload})


# -------------------- Patient APIs --------------------


@api_bp.route("/patient/doctors", methods=["GET"])
@require_role("patient")
def patient_doctors():
    return jsonify({"success": True, "doctors": DoctorModel.find_all()})


@api_bp.route("/patient/profile", methods=["GET", "PUT"])
@require_role("patient")
def patient_profile():
    # UPDATED: Get ID from Token
    patient_id = get_jwt_identity()
    
    if request.method == "GET":
        profile = PatientModel.get_profile(patient_id)
        return jsonify({"success": True, "profile": profile or {}})

    incoming = request.get_json(silent=True) or {}
    current = PatientModel.get_profile(patient_id) or {}

    keys = [
        "name", "email", "gender", "age", "contact", "address",
        "blood_group", "allergy", "medical_history", "emergency_contact",
        "height_cm", "weight_kg", "chronic_diseases", "medications",
        "insurance_provider", "insurance_number", "profile_img",
    ]
    update_data = {k: incoming.get(k, current.get(k)) for k in keys}
    
    PatientModel.update_profile(patient_id, update_data)
    updated = PatientModel.get_profile(patient_id)
    
    return jsonify({"success": True, "profile": updated or {}})


@api_bp.route("/patient/appointments", methods=["GET"])
@require_role("patient")
def patient_appointments():
    patient_id = get_jwt_identity()
    rows = AppointmentModel.get_by_patient(patient_id)
    return jsonify({"success": True, "appointments": rows})


@api_bp.route("/patient/prescription/<int:appointment_id>", methods=["GET"])
@require_role("patient")
def patient_get_prescription(appointment_id):
    patient_id = get_jwt_identity()
    
    # 1. Fetch the prescription details
    rows = PrescriptionModel.get_by_appointment(appointment_id)
    if not rows:
        return _json_error("Prescription not found", 404)

    # 2. Verify the appointment belongs to the patient
    if str(rows[0].get("patient_id")) != str(patient_id):
        return _json_error("Unauthorized to view this prescription", 403)
        
    return jsonify({"success": True, "prescription": rows})



@api_bp.route("/patient/book-appointment", methods=["POST"])
@require_role("patient")
def patient_book_appointment():
    patient_id = get_jwt_identity()
    
    is_json = request.is_json or "application/json" in (request.content_type or "")
    data = request.get_json(silent=True) or {} if is_json else request.form

    doctor_id = data.get("doctor_id")
    date = data.get("date")
    time_value = data.get("time")
    symptoms = data.get("symptoms")

    if not doctor_id or not date or not time_value:
        return _json_error("doctor_id, date and time are required", 400)
    try:
        doctor_id = int(doctor_id)
    except (TypeError, ValueError):
        return _json_error("doctor_id must be a valid integer", 400)

    report_path = None
    report = request.files.get("report")
    if report and report.filename and _allowed_file(report.filename):
        os.makedirs(UPLOAD_FOLDER, exist_ok=True)
        timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S%f")
        filename = f"{timestamp}_{secure_filename(report.filename)}"
        save_path = os.path.join(UPLOAD_FOLDER, filename)
        report.save(save_path)
        report_path = filename

    appointment_datetime = f"{date} {time_value}"
    if len(time_value.split(":")) == 2:
        appointment_datetime = f"{appointment_datetime}:00"

    # 1. Double-booking check
    if AppointmentModel.is_double_booked(doctor_id, appointment_datetime):
        return _json_error("This doctor is already booked or has another appointment within 10 minutes of your selected time.", 409)

    # 2. Availability check
    availability_slots = AvailabilityModel.get_by_doctor(doctor_id)
    if availability_slots:
        try:
            dt = datetime.strptime(appointment_datetime, "%Y-%m-%d %H:%M:%S")
        except ValueError:
            return _json_error("Invalid date or time format. Please use YYYY-MM-DD for date and HH:MM for time.", 400)
            
        day_of_week = dt.strftime("%A")
        time_str = dt.strftime("%H:%M:%S")
        
        is_available = AvailabilityModel.check_availability(doctor_id, day_of_week, time_str)
        if not is_available:
            return _json_error("The selected date and time falls outside the doctor's availability slots.", 400)

    appointment_id = AppointmentModel.create(
        patient_id,
        doctor_id,
        appointment_datetime,
        symptoms,
        report_path,
    )
    return jsonify({"success": True, "appointment_id": appointment_id}), 201


@api_bp.route("/patient/appointment/<int:appointment_id>/cancel", methods=["PUT", "POST"])
@require_role("patient")
def patient_cancel_appointment(appointment_id):
    patient_id = get_jwt_identity()
    appt = AppointmentModel.get_by_id(appointment_id)
    if not appt or str(appt.get("patient_id")) != str(patient_id):
        return _json_error("Appointment not found or does not belong to you", 403)
    ok = AppointmentModel.cancel_appointment(appointment_id)
    if not ok:
        return _json_error("Could not cancel appointment (already completed or cancelled)", 400)
    return jsonify({"success": True})


@api_bp.route("/uploads/<filename>")
@jwt_required()
def uploaded_file(filename):
    # Verify ownership
    appt = AppointmentModel.get_by_report_path(filename)
    if not appt:
        return _json_error("File not found or unauthorized", 404)
        
    user_id = str(get_jwt_identity())
    role = get_jwt().get("role")
    
    # Allow patient who owns it, or doctor who owns the appointment
    if role == "patient" and str(appt.get("patient_id")) != user_id:
        return _json_error("Unauthorized to view this report", 403)
    if role == "doctor" and str(appt.get("doctor_id")) != user_id:
        return _json_error("Unauthorized to view this report", 403)
        
    return send_from_directory(UPLOAD_FOLDER, filename)



@api_bp.route("/patient/hospitals", methods=["POST"])
@require_role("patient")
def patient_hospitals():
    data = request.get_json(silent=True) or {}
    query = (data.get("query") or "").strip()
    lat = data.get("lat")
    lon = data.get("lon")

    if query:
        result = HospitalModel.search_by_query(query)
        if isinstance(result, dict) and result.get("error"):
            return jsonify({"success": False, **result}), 404
        return jsonify({"success": True, "hospitals": result})

    if lat is not None and lon is not None:
        try:
            lat = float(lat)
            lon = float(lon)
        except (ValueError, TypeError):
            return _json_error("Invalid numeric format for latitude or longitude", 400)
        result = HospitalModel.find_nearest(lat, lon)
        return jsonify({"success": True, "hospitals": result})

    return _json_error("Provide either query or coordinates", 400)


@api_bp.route("/patient/watch-data", methods=["GET"])
@require_role("patient")
def patient_watch_data():
    ensure_indexes()
    patient_id = get_jwt_identity() # UPDATED
    
    try:
        days = int(request.args.get("days", 30))
    except (TypeError, ValueError):
        days = 30
    days = max(1, min(days, 365))

    google_auth_url = (
        "https://accounts.google.com/o/oauth2/v2/auth?"
        + urlencode(
            {
                "client_id": GOOGLE_CLIENT_ID,
                "redirect_uri": REDIRECT_URI,
                "response_type": "code",
                "scope": SCOPES,
                "access_type": "offline",
                "prompt": "consent",
            }
        )
    )

    chart_data = get_chart_data_from_db(patient_id, days=days)
    has_refresh_token = bool(get_refresh_token(patient_id))
    return jsonify(
        {
            "success": True,
            "days": days,
            "chart_data": chart_data,
            "google_auth_url": google_auth_url,
            "connected": has_refresh_token,
        }
    )


@api_bp.route("/patient/watch-data/update", methods=["POST"])
@require_role("patient")
def patient_watch_data_update():
    ensure_indexes()
    patient_id = get_jwt_identity() # UPDATED
    payload = request.get_json(silent=True) or {}

    try:
        days = int(payload.get("days", 30))
    except (TypeError, ValueError):
        days = 30
    days = max(1, min(days, 365))

    refresh = bool(payload.get("refresh", True))
    if not refresh:
        chart_data = get_chart_data_from_db(patient_id, days=days)
        return jsonify({"success": True, "chart_data": chart_data, "days": days})

    refresh_token = get_refresh_token(patient_id)
    if not refresh_token:
        return _json_error("No OAuth refresh token found. Connect Google Fit first.", 400)

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
        return _json_error("Failed to contact token endpoint", 500)

    if token_resp.status_code != 200:
        return _json_error("Failed to refresh access token", 500)

    access_token = token_resp.json().get("access_token")
    if not access_token:
        return _json_error("Access token missing from refresh response", 500)

    now_ms = int(time.time() * 1000)
    start_ms = now_ms - (days * 24 * 60 * 60 * 1000)
    chart_data = fetch_and_store_fit_data(patient_id, access_token, start_ms, now_ms)

    return jsonify(
        {
            "success": True,
            "message": "Watch data updated successfully.",
            "chart_data": chart_data,
            "days": days,
        }
    )


# -------------------- Doctor APIs --------------------


@api_bp.route("/doctor/profile", methods=["GET", "PUT"])
@require_role("doctor")
def doctor_profile():
    doctor_id = get_jwt_identity() # UPDATED
    
    if request.method == "GET":
        profile = DoctorModel.get_profile(doctor_id)
        return jsonify({"success": True, "profile": profile or {}})

    data = request.get_json(silent=True) or {}
    update_keys = [
        "name", "email", "contact", "specialization", "qualification",
        "experience", "languages", "clinic_name", "clinic_address",
        "available_hours", "fee", "license_no", "skills", "bio",
    ]

    set_keys = [k for k in update_keys if k in data]
    if not set_keys:
        return _json_error("No valid fields provided", 400)

    set_clause = ", ".join([f"{k}=%s" for k in set_keys])
    values = [data.get(k) for k in set_keys]
    values.append(doctor_id)

    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(f"UPDATE doctor SET {set_clause} WHERE doctor_id=%s", values)
        conn.commit()
    finally:
        cur.close()
        conn.close()

    profile = DoctorModel.get_profile(doctor_id)
    return jsonify({"success": True, "profile": profile or {}})


@api_bp.route("/doctor/appointments", methods=["GET"])
@require_role("doctor")
def doctor_appointments():
    doctor_id = get_jwt_identity() # UPDATED
    rows = AppointmentModel.get_by_doctor(doctor_id)
    return jsonify({"success": True, "appointments": rows})


@api_bp.route("/doctor/patients", methods=["GET"])
@require_role("doctor")
def doctor_patients():
    doctor_id = get_jwt_identity() # UPDATED
    patients = PatientModel.get_all_for_doctor(doctor_id)
    return jsonify({"success": True, "patients": patients})


@api_bp.route("/doctor/patient/<int:patient_id>", methods=["GET"])
@require_role("doctor")
def doctor_patient_detail(patient_id):
    doctor_id = get_jwt_identity()
    # Verify this patient has at least one appointment with the logged-in doctor
    all_patients = PatientModel.get_all_for_doctor(doctor_id)
    if not any(str(p.get("patient_id")) == str(patient_id) for p in (all_patients or [])):
        return _json_error("Patient not found or not assigned to you", 403)
    patient = PatientModel.get_by_id(patient_id)
    history = AppointmentModel.get_by_patient(patient_id)
    return jsonify({"success": True, "patient": patient or {}, "history": history})


@api_bp.route("/doctor/appointment/<int:appointment_id>", methods=["GET"])
@require_role("doctor")
def doctor_appointment_detail(appointment_id):
    doctor_id = get_jwt_identity()
    appointment = AppointmentModel.get_by_id(appointment_id)
    if not appointment or str(appointment.get("doctor_id")) != str(doctor_id):
        return _json_error("Appointment not found or not yours", 403)
    prescription = PrescriptionModel.get_by_appointment(appointment_id)
    return jsonify({"success": True, "appointment": appointment, "prescription": prescription or []})


@api_bp.route("/doctor/appointment/<int:appointment_id>/complete", methods=["POST"])
@require_role("doctor")
def doctor_complete_appointment(appointment_id):
    doctor_id = get_jwt_identity()
    appt = AppointmentModel.get_by_id(appointment_id)
    if not appt or str(appt.get("doctor_id")) != str(doctor_id):
        return _json_error("Appointment not found or not yours", 403)
    AppointmentModel.update_status(appointment_id, "Completed")
    return jsonify({"success": True})


@api_bp.route("/doctor/appointment/<int:appointment_id>/prescription", methods=["POST"])
@require_role("doctor")
def doctor_submit_prescription(appointment_id):
    """Create a prescription with medicine details for a given appointment."""
    doctor_id = get_jwt_identity()

    appt = AppointmentModel.get_by_id(appointment_id)
    if not appt:
        return _json_error("Appointment not found", 404)
    if str(appt.get("doctor_id")) != str(doctor_id):
        return _json_error("Not authorized to submit prescription for this appointment", 403)

    data = request.get_json(silent=True) or {}
    medicines   = data.get("medicines", [])
    pharmacy_id = data.get("pharmacy_id")  # optional — patient may select later

    if not medicines:
        return _json_error("At least one medicine is required", 400)

    # 1. Create prescription header (pharmacy_id may be None)
    pres_id = PrescriptionModel.create(
        appointment_id, doctor_id, appt["patient_id"], pharmacy_id
    )
    if not pres_id:
        return _json_error("Failed to create prescription record", 500)

    # Auto-send to pharmacy's dispense queue if the doctor assigned a store.
    # This changes dispense_status from 'Created' → 'Sent' immediately so
    # the pharmacist can see it in their dispense section without waiting
    # for the patient to manually select a pharmacy.
    if pharmacy_id:
        PrescriptionModel.set_pharmacy(pres_id, int(pharmacy_id))

    # 2. Insert each medicine detail
    for item in medicines:
        medicine_name = (item.get("medicine") or "").strip()
        dosage        = (item.get("dosage") or "").strip()
        notes         = (item.get("notes") or "").strip()
        medicine_id   = item.get("medicine_id")   # set if chosen from store inventory
        quantity      = int(item.get("quantity") or 1)
        item_source   = "StoreSuggestion" if medicine_id else "DoctorManual"
        if medicine_name:
            PrescriptionModel.add_detail(
                pres_id, medicine_name, dosage, notes,
                medicine_id=medicine_id, quantity=quantity, item_source=item_source
            )

    # 3. Mark appointment as completed
    AppointmentModel.update_status(appointment_id, "Completed")

    return jsonify({"success": True, "prescription_id": pres_id}), 201


@api_bp.route("/doctor/medicine-suggest", methods=["GET"])
@require_role("doctor")
def doctor_medicine_suggest():
    """Autocomplete medicines from a specific pharmacy store's inventory."""
    pharmacy_id = request.args.get("pharmacy_id")
    query       = request.args.get("q", "").strip()

    if len(query) < 2:
        return jsonify({"success": True, "medicines": []})

    if pharmacy_id:
        results = InventoryModel.search_by_store(int(pharmacy_id), query)
        for r in results:
            r["in_stock"] = r.get("stock_quantity", 0) > 0
    else:
        results = []

    return jsonify({"success": True, "medicines": results})


@api_bp.route("/doctor/statistics", methods=["GET"])
@require_role("doctor")
def doctor_statistics():
    doctor_id = get_jwt_identity() # UPDATED
    stats = AppointmentModel.get_statistics(doctor_id)
    return jsonify({"success": True, "stats": stats})


# -------------------- Pharmacy Store List (public) --------------------


@api_bp.route("/pharmacy/stores", methods=["GET"])
@jwt_required()
def pharmacy_stores():
    """List active pharmacy stores. type=collaborator|all"""
    store_type = request.args.get("type", "all")
    conn = get_connection()
    cur = conn.cursor(dictionary=True)
    try:
        if store_type == "collaborator":
            cur.execute("""
                SELECT pharmacy_id, store_name, address, contact, store_type, status
                FROM pharmacy_store WHERE status='Active' AND store_type='Collaborator'
                ORDER BY store_name
            """)
        else:
            cur.execute("""
                SELECT pharmacy_id, store_name, address, contact, store_type, status
                FROM pharmacy_store WHERE status='Active'
                ORDER BY store_type DESC, store_name
            """)
        stores = cur.fetchall()
        return jsonify({"success": True, "stores": stores})
    except Exception as e:
        return _json_error(str(e), 500)
    finally:
        cur.close()
        conn.close()


# -------------------- Pharmacy Store Self-Registration --------------------


@api_bp.route("/pharmacy/setup-store", methods=["POST"])
@require_role("pharmacist")
def pharmacy_setup_store():
    """Allow a pharmacist with no linked store to create one and link themselves to it."""
    pharmacist_id = get_jwt_identity()

    # If already linked, return the existing store info
    existing = PharmacistModel.get_pharmacy_id(pharmacist_id)
    if existing:
        return _json_error("Your account is already linked to a pharmacy store", 400)

    data       = request.get_json(silent=True) or {}
    store_name = (data.get("store_name") or "").strip()
    address    = (data.get("address") or "").strip()
    contact    = (data.get("contact") or "").strip()
    store_type = data.get("store_type", "Collaborator")

    if not store_name:
        return _json_error("store_name is required", 400)
    if store_type not in ("Collaborator", "General"):
        store_type = "Collaborator"

    conn = get_connection()
    cur  = conn.cursor()
    try:
        # 1. Create the pharmacy_store record
        cur.execute("""
            INSERT INTO pharmacy_store (store_name, address, contact, store_type, status)
            VALUES (%s, %s, %s, %s, 'Active')
        """, (store_name, address or None, contact or None, store_type))
        pharmacy_id = cur.lastrowid

        # 2. Link the pharmacist to this store
        cur.execute(
            "UPDATE pharmacist SET pharmacy_id = %s WHERE pharmacist_id = %s",
            (pharmacy_id, pharmacist_id)
        )
        conn.commit()
        return jsonify({
            "success": True,
            "message": f"Store '{store_name}' created and linked to your account.",
            "pharmacy_id": pharmacy_id,
            "store_name": store_name,
        }), 201
    except Exception as e:
        conn.rollback()
        return _json_error(f"Failed to create store: {str(e)}", 500)
    finally:
        cur.close()
        conn.close()


# -------------------- Patient Pharmacy Selection --------------------


@api_bp.route("/patient/prescription/<int:prescription_id>/select-pharmacy", methods=["POST"])
@require_role("patient")
def patient_select_pharmacy(prescription_id):
    """Patient selects a pharmacy for their prescription."""
    patient_id  = get_jwt_identity()
    data        = request.get_json(silent=True) or {}
    pharmacy_id = data.get("pharmacy_id")

    if not pharmacy_id:
        return _json_error("pharmacy_id is required", 400)

    # Verify prescription belongs to this patient
    pres = PrescriptionModel.get_by_id(prescription_id)
    if not pres or str(pres.get("patient_id")) != str(patient_id):
        return _json_error("Prescription not found or not yours", 403)

    if pres.get("dispense_status") not in ("Created", "Cancelled"):
        return _json_error(
            f"Cannot select pharmacy — current status is '{pres.get('dispense_status')}'", 400
        )

    ok = PrescriptionModel.set_pharmacy(prescription_id, int(pharmacy_id))
    if not ok:
        return _json_error("Failed to set pharmacy — prescription may not be in editable state", 400)

    updated = PrescriptionModel.get_by_id(prescription_id)
    return jsonify({"success": True, "prescription": updated})


@api_bp.route("/patient/prescription/<int:prescription_id>/change-pharmacy", methods=["POST"])
@require_role("patient")
def patient_change_pharmacy(prescription_id):
    """Patient changes pharmacy manually (resets window to new store)."""
    patient_id  = get_jwt_identity()
    data        = request.get_json(silent=True) or {}
    pharmacy_id = data.get("pharmacy_id")

    if not pharmacy_id:
        return _json_error("pharmacy_id is required", 400)

    pres = PrescriptionModel.get_by_id(prescription_id)
    if not pres or str(pres.get("patient_id")) != str(patient_id):
        return _json_error("Prescription not found or not yours", 403)

    if pres.get("dispense_status") == "Dispensed":
        return _json_error("Cannot change pharmacy — already dispensed", 400)

    ok = PrescriptionModel.change_pharmacy(prescription_id, int(pharmacy_id))
    if not ok:
        return _json_error("Failed to change pharmacy", 400)

    updated = PrescriptionModel.get_by_id(prescription_id)
    return jsonify({"success": True, "prescription": updated})


@api_bp.route("/patient/prescription/<int:prescription_id>/qr", methods=["GET"])
@require_role("patient")
def patient_get_qr(prescription_id):
    """Generate a short-lived transfer token (JWT) for QR code display."""
    patient_id = get_jwt_identity()
    pres = PrescriptionModel.get_by_id(prescription_id)

    if not pres or str(pres.get("patient_id")) != str(patient_id):
        return _json_error("Prescription not found or not yours", 403)

    if pres.get("dispense_status") not in ("Sent", "Created"):
        return _json_error(
            f"Cannot generate QR for status '{pres.get('dispense_status')}'", 400
        )

    # Create a short-lived JWT with prescription context
    token = create_access_token(
        identity=str(patient_id),
        additional_claims={
            "purpose": "pharmacy_transfer",
            "prescription_id": prescription_id,
        },
        expires_delta=timedelta(minutes=15),
    )
    return jsonify({
        "success": True,
        "token": token,
        "prescription_id": prescription_id,
        "expires_in": 900,  # 15 min in seconds
    })


# -------------------- Pharmacy APIs --------------------


@api_bp.route("/pharmacy/transfer/accept", methods=["POST"])
@require_role("pharmacist")
def pharmacy_accept_transfer():
    """New pharmacy accepts a QR-based transfer. Cancels old store access."""
    pharmacist_id = get_jwt_identity()
    pharmacy_id   = PharmacistModel.get_pharmacy_id(pharmacist_id)

    if not pharmacy_id:
        return _json_error("Your account is not linked to a pharmacy store", 403)

    data  = request.get_json(silent=True) or {}
    token = (data.get("token") or "").strip()
    if not token:
        return _json_error("Transfer token is required", 400)

    try:
        decoded = decode_token(token)
        claims  = decoded.get("sub") and decoded  # flask-jwt-extended structure
        purpose = decoded.get("purpose") or (decoded.get("additional_claims") or {}).get("purpose")
        prescription_id = (
            decoded.get("prescription_id")
            or (decoded.get("additional_claims") or {}).get("prescription_id")
        )
    except Exception:
        return _json_error("Invalid or expired transfer token", 400)

    if purpose != "pharmacy_transfer" or not prescription_id:
        return _json_error("Token is not a valid pharmacy transfer token", 400)

    pres = PrescriptionModel.get_by_id(int(prescription_id))
    if not pres:
        return _json_error("Prescription not found", 404)

    if pres.get("dispense_status") == "Dispensed":
        return _json_error("Prescription already dispensed — cannot transfer", 400)

    if str(pres.get("pharmacy_id")) == str(pharmacy_id):
        return _json_error("This prescription is already assigned to your store", 400)

    ok = PrescriptionModel.transfer(int(prescription_id), pharmacy_id, token)
    if not ok:
        return _json_error("Transfer failed — prescription may not be in transferable state", 400)

    updated = PrescriptionModel.get_by_id(int(prescription_id))
    details = PrescriptionModel.get_details(int(prescription_id))
    return jsonify({"success": True, "prescription": updated, "details": details})


# -------------------- Medicine Details (Pharmacist) --------------------

@api_bp.route("/pharmacy/prescription/<int:prescription_id>/medicines", methods=["GET"])
@require_role("pharmacist")
def pharmacy_get_prescription_medicines(prescription_id):
    """Return medicine lines for a prescription in this pharmacist's store."""
    pharmacist_id = get_jwt_identity()
    pharmacy_id   = PharmacistModel.get_pharmacy_id(pharmacist_id)

    pres = PrescriptionModel.get_by_id(prescription_id)
    if not pres:
        return _json_error("Prescription not found", 404)
    if str(pres.get("pharmacy_id")) != str(pharmacy_id):
        return _json_error("Not authorised to view this prescription", 403)

    details = PrescriptionModel.get_details(prescription_id)
    return jsonify({"success": True, "medicines": details, "prescription": pres})


# -------------------- Medicine Details (Doctor) --------------------

@api_bp.route("/doctor/appointment/<int:appointment_id>/medicines", methods=["GET"])
@require_role("doctor")
def doctor_get_appointment_medicines(appointment_id):
    """Return prescription + medicine lines for a completed appointment."""
    doctor_id = get_jwt_identity()
    appt = AppointmentModel.get_by_id(appointment_id)
    if not appt or str(appt.get("doctor_id")) != str(doctor_id):
        return _json_error("Appointment not found or not yours", 403)
    rows = PrescriptionModel.get_by_appointment(appointment_id)
    if not rows:
        return jsonify({"success": True, "medicines": [], "prescription": None})
    # Header columns are identical across all rows; medicines differ per row
    pres = {k: v for k, v in rows[0].items()
            if k not in ("detail_id", "medicine_name", "dosage", "notes", "quantity", "item_source")}
    medicines = [
        {
            "detail_id":    r["detail_id"],
            "medicine_name": r["medicine_name"],
            "dosage":        r["dosage"],
            "notes":         r["notes"],
            "quantity":      r["quantity"],
            "item_source":   r["item_source"],
        }
        for r in rows if r.get("detail_id")
    ]
    return jsonify({"success": True, "medicines": medicines, "prescription": pres})




@api_bp.route("/pharmacy/dashboard", methods=["GET"])
@require_role("pharmacist")
def pharmacy_dashboard():
    """Pharmacy dashboard — store-filtered prescriptions and inventory."""
    pharmacist_id = get_jwt_identity()
    profile       = PharmacistModel.get_profile(pharmacist_id) or {}
    pharmacy_id   = PharmacistModel.get_pharmacy_id(pharmacist_id)

    payload = {
        "profile":   profile,
        "pending":   PrescriptionModel.get_by_store(pharmacy_id) if pharmacy_id else [],
        "inventory": InventoryModel.get_by_store(pharmacy_id) if pharmacy_id else [],
        "low_stock": InventoryModel.get_low_stock(pharmacy_id, threshold=10) if pharmacy_id else [],
    }
    return jsonify({"success": True, **payload})


@api_bp.route("/pharmacy/dispense/<int:prescription_id>", methods=["POST"])
@require_role("pharmacist")
def pharmacy_dispense(prescription_id):
    """Dispense — store ownership + expiry check + correct stock deduction."""
    pharmacist_id = get_jwt_identity()
    pharmacy_id   = PharmacistModel.get_pharmacy_id(pharmacist_id)

    pres = PrescriptionModel.get_by_id(prescription_id)
    if not pres:
        return _json_error("Prescription not found", 404)
    if str(pres.get("pharmacy_id")) != str(pharmacy_id):
        return _json_error("This prescription does not belong to your store", 403)
    if pres.get("dispense_status") == "Expired":
        return _json_error("Cannot dispense — prescription has expired", 400)
    if pres.get("dispense_status") != "Sent":
        return _json_error(
            f"Cannot dispense — status is '{pres.get('dispense_status')}'", 400
        )

    details = PrescriptionModel.get_details(prescription_id)
    for item in details:
        med_id = item.get("medicine_id")
        qty    = int(item.get("quantity") or 1)
        if med_id:
            InventoryModel.decrease_store_stock(pharmacy_id, med_id, qty)
        else:
            InventoryModel.decrease_stock_by_name(pharmacy_id, item.get("medicine_name", ""), qty)

    ok = PrescriptionModel.mark_dispensed(prescription_id, pharmacy_id)
    if not ok:
        return _json_error("Failed to mark as dispensed", 500)
    return jsonify({"success": True})


@api_bp.route("/pharmacy/add-medicine", methods=["POST"])
@require_role("pharmacist")
def pharmacy_add_medicine():
    pharmacist_id = get_jwt_identity()
    pharmacy_id   = PharmacistModel.get_pharmacy_id(pharmacist_id)
    if not pharmacy_id:
        return _json_error("Not linked to any store", 403)

    data           = request.get_json(silent=True) or request.form
    name           = (data.get("name") or "").strip()
    if not name:
        return _json_error("Medicine name is required", 400)

    stock_quantity = int(data.get("stock_quantity") or 0)
    price_per_unit = float(data.get("price_per_unit") or 0)
    expiry_date    = data.get("expiry_date") or None
    batch_no       = data.get("batch_no") or None

    result = InventoryModel.add_to_store(
        pharmacy_id, name, stock_quantity, price_per_unit, expiry_date, batch_no
    )
    if not result:
        return _json_error("Failed to add medicine", 400)
    return jsonify({"success": True, "inventory_id": result}), 201


@api_bp.route("/pharmacy/update-stock/<int:inventory_id>", methods=["POST"])
@require_role("pharmacist")
def pharmacy_update_stock(inventory_id):
    pharmacist_id = get_jwt_identity()
    pharmacy_id   = PharmacistModel.get_pharmacy_id(pharmacist_id)

    data     = request.get_json(silent=True) or request.form
    quantity = int(data.get("quantity") or 0)
    if quantity <= 0:
        return _json_error("Quantity must be greater than zero", 400)

    ok = InventoryModel.update_store_stock(pharmacy_id, inventory_id, quantity)
    if not ok:
        return _json_error("Failed to update stock", 400)
    return jsonify({"success": True})


@api_bp.route("/pharmacy/remove-medicine/<int:inventory_id>", methods=["DELETE"])
@require_role("pharmacist")
def pharmacy_remove_medicine(inventory_id):
    pharmacist_id = get_jwt_identity()
    pharmacy_id   = PharmacistModel.get_pharmacy_id(pharmacist_id)
    ok = InventoryModel.remove_from_store(pharmacy_id, inventory_id)
    if not ok:
        return _json_error("Failed to remove medicine", 400)
    return jsonify({"success": True})


@api_bp.route("/pharmacy/history", methods=["GET"])
@require_role("pharmacist")
def pharmacy_history():
    pharmacist_id = get_jwt_identity()
    pharmacy_id   = PharmacistModel.get_pharmacy_id(pharmacist_id)
    history       = PrescriptionModel.get_dispensed_by_store(pharmacy_id) if pharmacy_id else []

    # Graph: medicines dispensed by this store
    conn = get_connection()
    cur  = conn.cursor(dictionary=True)
    try:
        cur.execute("""
            SELECT pd.medicine_name, COUNT(*) as amount_sold
            FROM prescription_detail pd
            JOIN prescription pr ON pr.prescription_id = pd.prescription_id
            WHERE pr.pharmacy_id = %s AND pr.dispense_status = 'Dispensed'
            GROUP BY pd.medicine_name ORDER BY amount_sold DESC
        """, (pharmacy_id,))
        medicine_sales = cur.fetchall()

        cur.execute("""
            SELECT DATE(pr.dispensed_at) as sale_date, COUNT(*) as prescriptions_dispensed
            FROM prescription pr
            WHERE pr.pharmacy_id = %s AND pr.dispense_status = 'Dispensed'
            GROUP BY DATE(pr.dispensed_at) ORDER BY sale_date ASC LIMIT 30
        """, (pharmacy_id,))
        sales_by_date = cur.fetchall()
        for row in sales_by_date:
            if hasattr(row.get("sale_date"), "isoformat"):
                row["sale_date"] = row["sale_date"].isoformat()
            else:
                row["sale_date"] = str(row.get("sale_date"))
    except Exception as e:
        medicine_sales = []
        sales_by_date  = []
    finally:
        cur.close()
        conn.close()

    return jsonify({
        "success":    True,
        "history":    history,
        "graph_data": {"medicine_sales": medicine_sales, "sales_by_date": sales_by_date},
    })


@api_bp.route("/pharmacy/check-stock", methods=["GET"])
@require_role("doctor", "pharmacist")
def pharmacy_check_stock():
    """Check medicine stock — scoped to store if pharmacy_id param given."""
    medicine_name = request.args.get("name", "")
    pharmacy_id   = request.args.get("pharmacy_id")
    result = InventoryModel.check_stock(medicine_name, pharmacy_id=int(pharmacy_id) if pharmacy_id else None)
    if not result:
        return jsonify({"success": True, "found": False, "stock": 0, "name": ""})
    return jsonify({
        "success": True,
        "found":   True,
        "name":    result["name"],
        "stock":   result["stock_quantity"],
        "price":   float(result["price_per_unit"]) if result.get("price_per_unit") is not None else 0,
    })


# ==================== Collaboration API ====================

from models.collaboration_model import CollaborationModel  # noqa: E402 (placed here to avoid circular imports)


@api_bp.route("/pharmacy/collaboration/request", methods=["POST"])
@require_role("pharmacist")
def pharmacy_request_collaboration():
    """Pharmacy sends a collaboration request to a doctor."""
    pharmacist_id = get_jwt_identity()
    pharmacy_id   = PharmacistModel.get_pharmacy_id(pharmacist_id)

    if not pharmacy_id:
        return _json_error("Your account is not linked to any pharmacy store", 403)

    data      = request.get_json(silent=True) or {}
    doctor_id = data.get("doctor_id")
    if not doctor_id:
        return _json_error("doctor_id is required", 400)

    result = CollaborationModel.request_collaboration(pharmacy_id, int(doctor_id))
    if not result:
        return _json_error("Failed to send collaboration request", 400)

    return jsonify({"success": True, "message": "Collaboration request sent to the doctor"})


@api_bp.route("/doctor/collaborations", methods=["GET"])
@require_role("doctor")
def doctor_get_collaborations():
    """Doctor sees all collaboration records (any status)."""
    doctor_id = get_jwt_identity()
    records   = CollaborationModel.get_for_doctor(int(doctor_id))
    return jsonify({"success": True, "collaborations": records})


@api_bp.route("/doctor/collaboration/<int:collab_id>/respond", methods=["POST"])
@require_role("doctor")
def doctor_respond_collaboration(collab_id):
    """Doctor accepts or rejects a collaboration request."""
    doctor_id = get_jwt_identity()
    data      = request.get_json(silent=True) or {}
    status    = (data.get("status") or "").strip()

    if status not in ("Accepted", "Rejected"):
        return _json_error("status must be 'Accepted' or 'Rejected'", 400)

    ok = CollaborationModel.respond(collab_id, int(doctor_id), status)
    if not ok:
        return _json_error("Could not update request — it may not exist or already responded", 400)

    return jsonify({"success": True, "updated_status": status})


@api_bp.route("/doctor/collaboration/pending-count", methods=["GET"])
@require_role("doctor")
def doctor_collaboration_pending_count():
    """Returns the count of pending collaboration requests for the badge."""
    doctor_id = get_jwt_identity()
    count     = CollaborationModel.get_pending_count_for_doctor(int(doctor_id))
    return jsonify({"success": True, "count": count})


@api_bp.route("/doctor/collaboration/pharmacies", methods=["GET"])
@require_role("doctor")
def doctor_accepted_pharmacies():
    """Returns accepted pharmacy stores for the doctor (for prescription pharmacy picker)."""
    doctor_id = get_jwt_identity()
    stores    = CollaborationModel.get_accepted_pharmacies_for_doctor(int(doctor_id))
    return jsonify({"success": True, "pharmacies": stores})


@api_bp.route("/pharmacy/collaborations", methods=["GET"])
@require_role("pharmacist")
def pharmacy_get_collaborations():
    """Pharmacy sees all collaboration records they initiated."""
    pharmacist_id = get_jwt_identity()
    pharmacy_id   = PharmacistModel.get_pharmacy_id(pharmacist_id)

    if not pharmacy_id:
        return _json_error("Not linked to any store", 403)

    records = CollaborationModel.get_for_pharmacy(pharmacy_id)
    return jsonify({"success": True, "collaborations": records})


@api_bp.route("/pharmacy/collaboration/<int:collab_id>", methods=["DELETE"])
@require_role("pharmacist")
def pharmacy_break_collaboration(collab_id):
    """Pharmacy cancels/breaks a collaboration request (owns it, any status)."""
    pharmacist_id = get_jwt_identity()
    pharmacy_id   = PharmacistModel.get_pharmacy_id(pharmacist_id)

    if not pharmacy_id:
        return _json_error("Not linked to any store", 403)

    conn = get_connection()
    cur  = conn.cursor()
    try:
        cur.execute("""
            DELETE FROM doctor_pharmacy_collaboration
            WHERE collab_id = %s AND pharmacy_id = %s
        """, (collab_id, pharmacy_id))
        conn.commit()
        if cur.rowcount > 0:
            return jsonify({"success": True, "message": "Collaboration cancelled successfully"})
        return _json_error("Collaboration not found or unauthorised", 404)
    except Exception as e:
        return _json_error(f"Failed to cancel: {str(e)}", 500)
    finally:
        cur.close()
        conn.close()


@api_bp.route("/doctor/list", methods=["GET"])
@jwt_required()
def get_all_doctors():
    """List all doctors for the pharmacy collaboration request modal."""
    conn = get_connection()
    cur  = conn.cursor(dictionary=True)
    try:
        cur.execute("""
            SELECT doctor_id, name, specialization, contact, clinic_name,
                   clinic_address, profile_img
            FROM doctor ORDER BY name
        """)
        return jsonify({"success": True, "doctors": cur.fetchall()})
    except Exception as e:
        return _json_error(str(e), 500)
    finally:
        cur.close()
        conn.close()


# -------------------- Doctor Availability APIs --------------------

@api_bp.route("/doctor/availability", methods=["GET", "POST"])
@require_role("doctor")
def doctor_availability():
    doctor_id = get_jwt_identity()
    if request.method == "GET":
        slots = AvailabilityModel.get_by_doctor(doctor_id)
        return jsonify({"success": True, "slots": slots})
        
    # POST - Add new slot
    data = request.get_json(silent=True) or {}
    day_of_week = data.get("day_of_week")
    start_time = data.get("start_time")
    end_time = data.get("end_time")
    
    if not day_of_week or not start_time or not end_time:
        return _json_error("day_of_week, start_time, and end_time are required", 400)
        
    if isinstance(day_of_week, list):
        days_to_add = day_of_week
    else:
        days_to_add = [day_of_week]
        
    # Basic validation: day of week
    valid_days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    for day in days_to_add:
        if day not in valid_days:
            return _json_error(f"day_of_week must be one of {valid_days}", 400)
        
    # Try parsing times
    try:
        sh, sm = map(int, start_time.split(":"))
        eh, em = map(int, end_time.split(":"))
        if not (0 <= sh < 24 and 0 <= sm < 60 and 0 <= eh < 24 and 0 <= em < 60):
            raise ValueError()
        if (sh * 60 + sm) >= (eh * 60 + em):
            return _json_error("start_time must be before end_time", 400)
    except Exception:
        return _json_error("start_time and end_time must be in valid HH:MM format", 400)
        
    added_ids = []
    for day in days_to_add:
        availability_id = AvailabilityModel.add(doctor_id, day, start_time, end_time)
        if availability_id:
            added_ids.append(availability_id)
            
    if not added_ids:
        return _json_error("Could not add slots (duplicate or database error)", 400)
        
    return jsonify({
        "success": True, 
        "availability_ids": added_ids, 
        "message": f"Successfully added {len(added_ids)} availability slots"
    }), 201


@api_bp.route("/doctor/availability/<int:availability_id>", methods=["DELETE"])
@require_role("doctor")
def doctor_delete_availability(availability_id):
    doctor_id = get_jwt_identity()
    ok = AvailabilityModel.delete(availability_id, doctor_id)
    if not ok:
        return _json_error("Slot not found or unauthorized", 404)
    return jsonify({"success": True, "message": "Slot deleted successfully"})


@api_bp.route("/patient/doctor/<int:doctor_id>/availability", methods=["GET"])
@require_role("patient")
def patient_get_doctor_availability(doctor_id):
    slots = AvailabilityModel.get_by_doctor(doctor_id)
    return jsonify({"success": True, "slots": slots})


# -------------------- Doctor Rating & Review APIs --------------------

@api_bp.route("/patient/appointment/<int:appointment_id>/review", methods=["POST"])
@require_role("patient")
def patient_submit_review(appointment_id):
    patient_id = get_jwt_identity()
    
    # 1. Fetch appointment details and verify ownership & status
    appt = AppointmentModel.get_by_id(appointment_id)
    if not appt:
        return _json_error("Appointment not found", 404)
        
    if str(appt.get("patient_id")) != str(patient_id):
        return _json_error("Unauthorized to review this appointment", 403)
        
    if appt.get("status") != "Completed":
        return _json_error("Cannot review an appointment that is not completed", 400)
        
    # 2. Get request body
    data = request.get_json(silent=True) or {}
    rating = data.get("rating")
    review_text = data.get("review_text", "").strip()
    
    if rating is None:
        return _json_error("Rating is required", 400)
        
    try:
        rating = int(rating)
        if not (1 <= rating <= 5):
            raise ValueError()
    except (ValueError, TypeError):
        return _json_error("Rating must be an integer between 1 and 5", 400)
        
    # 3. Create review (DB table unique constraint on appointment_id prevents double submissions)
    from models.review_model import ReviewModel
    rid = ReviewModel.create(
        appointment_id=appointment_id,
        doctor_id=appt["doctor_id"],
        patient_id=patient_id,
        rating=rating,
        review_text=review_text or None
    )
    if not rid:
        return _json_error("You have already reviewed this appointment or a database error occurred", 400)
        
    return jsonify({"success": True, "review_id": rid, "message": "Review submitted successfully"}), 201


@api_bp.route("/patient/doctor/<int:doctor_id>/reviews", methods=["GET"])
@jwt_required()
def patient_get_doctor_reviews(doctor_id):
    from models.review_model import ReviewModel
    reviews = ReviewModel.get_by_doctor(doctor_id)
    stats = ReviewModel.get_average_rating(doctor_id)
    return jsonify({
        "success": True,
        "reviews": reviews,
        "average_rating": float(stats.get("average_rating", 0)),
        "total_reviews": int(stats.get("total_reviews", 0))
    })


@api_bp.route("/doctor/appointment/<int:appointment_id>/reschedule", methods=["PUT"])
@require_role("doctor")
def doctor_reschedule_appointment(appointment_id):
    doctor_id = get_jwt_identity()
    
    # 1. Fetch appointment details and verify ownership & status
    appt = AppointmentModel.get_by_id(appointment_id)
    if not appt:
        return _json_error("Appointment not found", 404)
        
    if str(appt.get("doctor_id")) != str(doctor_id):
        return _json_error("Unauthorized to reschedule this appointment", 403)
        
    if appt.get("status") != "Pending":
        return _json_error("Only pending appointments can be rescheduled", 400)
        
    data = request.get_json(silent=True) or {}
    new_datetime = data.get("appointment_datetime") # format "YYYY-MM-DD HH:MM:SS"
    if not new_datetime:
        return _json_error("appointment_datetime is required", 400)
        
    # Clean datetime string format
    if len(new_datetime.split(":")) == 2:
        new_datetime = f"{new_datetime}:00"
        
    # 2. Check future date/time
    try:
        dt = datetime.strptime(new_datetime, "%Y-%m-%d %H:%M:%S")
        if dt < datetime.now():
            return _json_error("Reschedule date and time must be in the future", 400)
    except ValueError:
        return _json_error("Invalid date or time format. Use YYYY-MM-DD HH:MM:SS", 400)

    # 3. Double-booking check (exclude current appointment)
    if AppointmentModel.is_double_booked_exclude(doctor_id, new_datetime, appointment_id):
        return _json_error("This doctor has another appointment scheduled within 10 minutes of the new time.", 409)
        
    # 4. Availability check
    availability_slots = AvailabilityModel.get_by_doctor(doctor_id)
    if availability_slots:
        day_of_week = dt.strftime("%A")
        time_str = dt.strftime("%H:%M:%S")
        is_available = AvailabilityModel.check_availability(doctor_id, day_of_week, time_str)
        if not is_available:
            return _json_error("The selected time falls outside your weekly availability slots.", 400)
            
    # 5. Reschedule in DB
    ok = AppointmentModel.reschedule(appointment_id, new_datetime)
    if not ok:
        return _json_error("Failed to reschedule appointment", 500)
        
    return jsonify({"success": True, "message": "Appointment rescheduled successfully"})