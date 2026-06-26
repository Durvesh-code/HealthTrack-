# backend/agent/tools.py
"""
Tool definitions for the chatbot agent, grouped by role.

Each get_*_tools() factory binds the current user's id via closure, so the
LLM can never be talked into pulling another user's data — the id always
comes from the verified JWT in chatbot_controller.py, never from anything
the model or the end user can set directly as a tool argument.
"""

from agno.tools import tool

from models.appointment_model import AppointmentModel
from models.doctor_model import DoctorModel
from models.patient_model import PatientModel
from models.pharmacist_model import PharmacistModel
from models.prescription_model import PrescriptionModel
from models.inventory_model import InventoryModel
from models.hospital_model import HospitalModel
from controllers.watch_controller import get_chart_data_from_db


# ---------------------------------------------------------------------------
# Patient tools
# ---------------------------------------------------------------------------

def get_patient_tools(patient_id: int, user_location: dict = None):

    @tool(description="Search for hospitals using the user's exact GPS coordinates.")
    def find_hospitals_by_gps() -> str:
        if not user_location or 'lat' not in user_location or 'lon' not in user_location:
            return "GPS coordinates are not available. Please ask the user to provide a location manually."
        
        results = HospitalModel.find_nearest(user_location['lat'], user_location['lon'], top_n=5)
        if results and "error" in results[0]:
            return results[0]["error"]
            
        lines = [
            f"- **{h['name']}** — {h['distance']} km away, {h['address']}, phone: {h['phone']} [🗺️ View on Map](https://www.google.com/maps/dir/?api=1&destination={h['lat']},{h['lon']})"
            for h in results
        ]
        return "\n".join(lines) if lines else "No hospitals found nearby."

    @tool(description="Search for hospitals near a place name, e.g. a city or district.")
    def find_nearby_hospitals(location: str) -> str:
        results = HospitalModel.search_by_query(location, top_n=5)
        if isinstance(results, dict) and "error" in results:
            return results["error"]
        lines = [
            f"- **{h['name']}** — {h['distance']} km away, {h['address']}, phone: {h['phone']} [🗺️ View on Map](https://www.google.com/maps/dir/?api=1&destination={h['lat']},{h['lon']})"
            for h in results
        ]
        return "\n".join(lines) if lines else "No hospitals found for that location."

    @tool(description="List doctors, optionally filtered by specialization (e.g. 'cardiologist').")
    def list_doctors(specialization: str = "") -> str:
        doctors = DoctorModel.find_all()
        if specialization:
            spec = specialization.lower()
            doctors = [d for d in doctors if spec in (d.get("specialization") or "").lower()]
        if not doctors:
            return "No doctors found matching that specialization."
        lines = [
            f"- ID {d['doctor_id']}: Dr. {d['name']} ({d.get('specialization') or 'General'}), "
            f"rating {float(d.get('average_rating') or 0):.1f}/5"
            for d in doctors[:10]
        ]
        return "\n".join(lines)



    @tool(description="List the user's own appointments, past and upcoming.")
    def get_my_appointments() -> str:
        appts = AppointmentModel.get_by_patient(patient_id)
        if not appts:
            return "No appointments found."
        lines = [
            f"- ID {a['appointment_id']}: Dr. {a.get('doctor_name') or 'Unknown'} on "
            f"{a['appointment_datetime']} — status: {a['status']}"
            for a in appts[:10]
        ]
        return "\n".join(lines)

    @tool(description="Cancel one of the user's own upcoming appointments by its ID.")
    def cancel_appointment(appointment_id: int) -> str:
        appt = AppointmentModel.get_by_id(appointment_id)
        if not appt or str(appt.get("patient_id")) != str(patient_id):
            return "That appointment doesn't belong to this account, so I can't cancel it."
        ok = AppointmentModel.cancel_appointment(appointment_id)
        return "Appointment cancelled." if ok else "Couldn't cancel — it may already be completed or cancelled."

    @tool(description="Check the dispense status of the user's own prescriptions.")
    def check_prescription_status() -> str:
        prescriptions = PrescriptionModel.get_by_patient(patient_id)
        if not prescriptions:
            return "No prescriptions found."
        lines = [
            f"- Prescription {p['prescription_id']}: status {p.get('dispense_status') or 'unknown'}"
            + (f", at {p['pharmacy_name']}" if p.get("pharmacy_name") else "")
            for p in prescriptions[:10]
        ]
        return "\n".join(lines)

    @tool(description=(
        "Get the user's own health profile (age, gender, chronic conditions, "
        "medications). Call this whenever the conversation turns to symptoms "
        "so your suggestions account for their existing conditions."
    ))
    def get_my_health_profile() -> str:
        profile = PatientModel.get_profile(patient_id)
        if not profile:
            return "Profile not found."
        return (
            f"Age: {profile.get('age', 'unknown')}, gender: {profile.get('gender', 'unknown')}, "
            f"chronic conditions: {profile.get('chronic_diseases') or 'none recorded'}, "
            f"current medications: {profile.get('medications') or 'none recorded'}."
        )

    @tool(description="Get the user's recent wearable vitals (heart rate, sleep, steps, calories). Use this when asked about daily activity, sleep issues, or cardiovascular symptoms.")
    def get_my_wearable_vitals(days: int = 7) -> str:
        chart_data = get_chart_data_from_db(patient_id, days=days)
        if not chart_data:
            return "No wearable data found. Please ask the user to connect Google Fit."
        
        summary = []
        for metric in ["heart_rate", "sleep", "steps", "calories"]:
            if metric in chart_data and chart_data[metric].get("values"):
                vals = chart_data[metric]["values"]
                avg = sum(vals) / len(vals)
                summary.append(f"Average {metric}: {avg:.1f}")
        
        if not summary:
            return "No wearable data recorded recently."
        return f"Recent wearable averages over last {days} days: " + ", ".join(summary) + ". For deeper trends, ask the patient to view their charts."

    return [
        find_nearby_hospitals,
        find_hospitals_by_gps,
        list_doctors,
        get_my_appointments,
        cancel_appointment,
        check_prescription_status,
        get_my_health_profile,
        get_my_wearable_vitals,
    ]


# ---------------------------------------------------------------------------
# Doctor tools
# ---------------------------------------------------------------------------

def get_doctor_tools(doctor_id: int):

    @tool(description="Get the doctor's appointment queue, optionally filtered by status: Pending, Completed, or Cancelled.")
    def get_my_appointments(status: str = "") -> str:
        appts = AppointmentModel.get_by_doctor(doctor_id, status or None)
        if not appts:
            return "No appointments found."
        lines = [
            f"- ID {a['appointment_id']}: {a.get('patient_name') or 'Unknown'} on "
            f"{a['appointment_datetime']} — {a['status']}, symptoms: {a.get('symptoms') or 'none noted'}"
            for a in appts[:15]
        ]
        return "\n".join(lines)

    @tool(description="Get a patient's profile and history. Only works for patients who have an appointment with this doctor.")
    def get_patient_history(patient_id: int) -> str:
        own_patients = {a["patient_id"] for a in AppointmentModel.get_by_doctor(doctor_id)}
        if patient_id not in own_patients:
            return "This patient has no appointment with you, so I can't share their record."
        profile = PatientModel.get_profile(patient_id)
        if not profile:
            return "Patient not found."
        return (
            f"{profile['name']}, age {profile.get('age', 'unknown')}, "
            f"chronic conditions: {profile.get('chronic_diseases') or 'none recorded'}, "
            f"medications: {profile.get('medications') or 'none recorded'}."
        )

    @tool(description="Get this doctor's appointment statistics — totals by status, top symptoms, monthly trend.")
    def get_statistics() -> str:
        stats = AppointmentModel.get_statistics(doctor_id)
        s = stats["summary"] or {}
        top = ", ".join(f"{t['symptoms']} ({t['count']})" for t in stats["top_symptoms"][:5])
        return (
            f"Total: {s.get('total', 0)}, completed: {s.get('completed', 0)}, "
            f"pending: {s.get('pending', 0)}, cancelled: {s.get('cancelled', 0)}.\n"
            f"Top symptoms: {top or 'none recorded'}."
        )

    @tool(description="Check whether a medicine is in stock at a given pharmacy — useful before deciding what to prescribe.")
    def check_medicine_stock(medicine_name: str, pharmacy_id: int = None) -> str:
        result = InventoryModel.check_stock(medicine_name, pharmacy_id)
        if not result:
            return f"No stock record found for '{medicine_name}'."
        return f"{result['name']}: {result['stock_quantity']} units in stock."

    return [get_my_appointments, get_patient_history, get_statistics, check_medicine_stock]


# ---------------------------------------------------------------------------
# Pharmacist tools
# ---------------------------------------------------------------------------

def get_pharmacist_tools(pharmacist_id: int):
    pharmacy_id = PharmacistModel.get_pharmacy_id(pharmacist_id)

    @tool(description="List or search this pharmacy's inventory by medicine name.")
    def get_inventory(query: str = "") -> str:
        items = (
            InventoryModel.search_by_store(pharmacy_id, query)
            if query else InventoryModel.get_by_store(pharmacy_id)
        )
        if not items:
            return "No inventory items found."
        lines = [f"- {i['name']}: {i['stock_quantity']} units" for i in items[:15]]
        return "\n".join(lines)

    @tool(description="Get medicines below a stock threshold (default 10) for this pharmacy.")
    def get_low_stock(threshold: int = 10) -> str:
        items = InventoryModel.get_low_stock(pharmacy_id, threshold)
        if not items:
            return "Nothing is low on stock right now."
        lines = [f"- {i['name']}: only {i['stock_quantity']} left" for i in items]
        return "\n".join(lines)

    @tool(description="Check stock and price for one specific medicine by name.")
    def check_medicine_stock(medicine_name: str) -> str:
        result = InventoryModel.check_stock(medicine_name, pharmacy_id)
        if not result:
            return f"'{medicine_name}' not found in this pharmacy's inventory."
        return f"{result['name']}: {result['stock_quantity']} units, price {result.get('price_per_unit', 'N/A')} each."

    @tool(description="Get prescriptions sent to this pharmacy that are pending dispense.")
    def get_pending_prescriptions() -> str:
        prescriptions = PrescriptionModel.get_by_store(pharmacy_id)
        if not prescriptions:
            return "No pending prescriptions."
        lines = [
            f"- Prescription {p['prescription_id']} for {p.get('patient_name') or 'unknown patient'}"
            for p in prescriptions[:15]
        ]
        return "\n".join(lines)

    return [get_inventory, get_low_stock, check_medicine_stock, get_pending_prescriptions]
