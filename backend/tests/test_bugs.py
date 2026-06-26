"""
tests/test_bugs.py
Regression tests for the 6 bugs fixed in the medical system backend.
Run with:  cd backend && pip install pytest && pytest tests/test_bugs.py -v
"""

import ast
import os
import sys
import importlib
import inspect

import pytest

# ─── Helpers ────────────────────────────────────────────────────────────────

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

def _source_of(rel_path: str) -> str:
    """Return the source text of a file relative to the backend directory."""
    with open(os.path.join(PROJECT_ROOT, rel_path), "r", encoding="utf-8") as f:
        return f.read()


# ═══════════════════════════════════════════════════════════════════════════
# BUG-01 — Wrong column `id` vs `doctor_id` in UPDATE query
# ═══════════════════════════════════════════════════════════════════════════

def test_bug01_doctor_update_uses_correct_column():
    """
    api_controller.py: The UPDATE query for the doctor profile MUST use
    `WHERE doctor_id=%s`, NOT `WHERE id=%s`.
    A wrong column name causes every PUT /api/doctor/profile call to crash.
    """
    src = _source_of("controllers/api_controller.py")
    # Must NOT contain the broken version
    assert "WHERE id=%s" not in src, (
        "BUG-01 NOT FIXED: 'WHERE id=%s' still in api_controller.py — "
        "doctor profile UPDATE will crash with Unknown column 'id'."
    )
    # Must contain the correct version
    assert "WHERE doctor_id=%s" in src, (
        "BUG-01 REGRESSION: 'WHERE doctor_id=%s' is missing from api_controller.py."
    )


# ═══════════════════════════════════════════════════════════════════════════
# BUG-03 — Duplicate import in patient_model.py
# ═══════════════════════════════════════════════════════════════════════════

def test_bug03_no_duplicate_import_in_patient_model():
    """
    patient_model.py must import `get_connection` exactly once.
    A duplicate import is harmless at runtime but signals copy-paste drift
    and will break static analysis / linting pipelines.
    """
    src = _source_of("models/patient_model.py")
    count = src.count("from database.connection import get_connection")
    assert count == 1, (
        f"BUG-03 NOT FIXED: 'from database.connection import get_connection' "
        f"appears {count} time(s) in patient_model.py — expected exactly 1."
    )


# ═══════════════════════════════════════════════════════════════════════════
# BUG-04 — Hardcoded credentials in config.py
# ═══════════════════════════════════════════════════════════════════════════

def test_bug04_db_password_not_hardcoded():
    """
    config.py must NOT contain the string '\"1234\"' as a password value.
    Credentials must be sourced from environment variables via dotenv.
    """
    src = _source_of("config.py")
    assert '"1234"' not in src, (
        "BUG-04 NOT FIXED: hardcoded password '\"1234\"' still present in config.py."
    )
    assert "load_dotenv" in src, (
        "BUG-04 NOT FIXED: config.py does not call load_dotenv()."
    )
    assert 'os.environ.get("DB_PASSWORD"' in src or "os.environ.get('DB_PASSWORD'" in src, (
        "BUG-04 NOT FIXED: DB_PASSWORD is not read from an environment variable."
    )


def test_bug04_secret_key_not_hardcoded():
    """config.py must read SECRET_KEY from the environment."""
    src = _source_of("config.py")
    # The literal should only exist as a fallback default, not as the sole definition
    assert 'os.environ.get("SECRET_KEY"' in src or "os.environ.get('SECRET_KEY'" in src, (
        "BUG-04 NOT FIXED: SECRET_KEY is not read from an environment variable in config.py."
    )


# ═══════════════════════════════════════════════════════════════════════════
# BUG-05 — Missing ownership check on cancel-appointment
# ═══════════════════════════════════════════════════════════════════════════

def test_bug05_cancel_appointment_has_ownership_check():
    """
    api_controller.py: patient_cancel_appointment() must verify the
    appointment belongs to the requesting patient before allowing cancellation.
    Without this check any authenticated patient can cancel any appointment.
    """
    src = _source_of("controllers/api_controller.py")
    # The fix must fetch the appointment and compare patient_id
    assert "appt.get(\"patient_id\")" in src or "appt.get('patient_id')" in src, (
        "BUG-05 NOT FIXED: No ownership check found in patient_cancel_appointment()."
    )
    assert "403" in src, (
        "BUG-05 NOT FIXED: No 403 response found — ownership rejection is missing."
    )





# ═══════════════════════════════════════════════════════════════════════════
# BUG-07 — Prescription INSERT missing dispense_status default
# ═══════════════════════════════════════════════════════════════════════════

def test_bug07_prescription_insert_includes_dispense_status():
    """
    prescription_model.py create(): the INSERT must explicitly set a
    dispense_status value so new prescriptions have a known initial state.
    Accepted values: 'Pending' (legacy) or 'Created' (new workflow).
    """
    src = _source_of("models/prescription_model.py")
    assert "dispense_status" in src, (
        "BUG-07 NOT FIXED: 'dispense_status' not in prescription INSERT — "
        "new prescriptions will not appear in the pharmacy pending queue."
    )
    has_status = (
        "'Pending'" in src or '"Pending"' in src
        or "'Created'" in src or '"Created"' in src
    )
    assert has_status, (
        "BUG-07 NOT FIXED: Neither 'Pending' nor 'Created' status set in "
        "prescription INSERT — dispense_status column has no explicit value."
    )


# ═══════════════════════════════════════════════════════════════════════════
# BUG-01 extended — api_controller doctor profile UPDATE safely wraps in try/finally
# ═══════════════════════════════════════════════════════════════════════════

def test_bug01_api_controller_doctor_update_has_connection_safety():
    """
    api_controller.py: The doctor profile UPDATE block must also have a
    try/finally so the DB connection is safely closed on error.
    """
    src = _source_of("controllers/api_controller.py")
    # Count occurrences of finally in the file (BUG-06 adds one in doctor_controller; check api_controller)
    assert "finally:" in src, (
        "api_controller.py doctor profile UPDATE block is missing try/finally — "
        "connection will leak on DB error."
    )


# ═══════════════════════════════════════════════════════════════════════════
# Doctor Availability & Double-Booking Tests
# ═══════════════════════════════════════════════════════════════════════════

def test_availability_checking_logic():
    """
    Verify that check_availability correctly verifies doctor schedule slots.
    """
    from unittest.mock import patch
    from models.availability_model import AvailabilityModel
    
    with patch("models.availability_model.get_connection") as mock_conn:
        mock_cur = mock_conn.return_value.cursor.return_value
        mock_cur.fetchone.return_value = {"availability_id": 1}
        
        # Test available
        res = AvailabilityModel.check_availability(1, "Monday", "10:30:00")
        assert res is True
        
        # Test unavailable (mock fetchone as None)
        mock_cur.fetchone.return_value = None
        res = AvailabilityModel.check_availability(1, "Monday", "10:30:00")
        assert res is False

def test_appointment_double_booking_check():
    """
    Verify that is_double_booked correctly flags overlapping slots.
    """
    from unittest.mock import patch
    from models.appointment_model import AppointmentModel
    
    with patch("models.appointment_model.get_connection") as mock_conn:
        mock_cur = mock_conn.return_value.cursor.return_value
        mock_cur.fetchone.return_value = {"appointment_id": 10}
        
        # Double booked
        res = AppointmentModel.is_double_booked(1, "2026-06-22 10:30:00")
        assert res is True
        
        # Verify query incorporates TIMESTAMPDIFF and the 600 second threshold
        args, _ = mock_cur.execute.call_args
        sql = args[0]
        assert "TIMESTAMPDIFF" in sql
        assert "600" in sql
        
        # Not double booked
        mock_cur.fetchone.return_value = None
        res = AppointmentModel.is_double_booked(1, "2026-06-22 10:30:00")
        assert res is False

def test_batch_availability_creation():
    """
    Verify that the doctor availability POST endpoint handles a list of days.
    """
    src = _source_of("controllers/api_controller.py")
    assert "isinstance(day_of_week, list)" in src, (
        "api_controller.py does not check if day_of_week is a list."
    )
    assert "for day in days_to_add:" in src, (
        "api_controller.py does not loop over the list of days to add."
    )

def test_doctor_ratings_and_reviews():
    """
    Verify that ReviewModel is implemented and used in api_controller.py.
    """
    # 1. Verify review_model file exists and compiles
    from models.review_model import ReviewModel
    assert hasattr(ReviewModel, "create")
    assert hasattr(ReviewModel, "get_by_doctor")
    assert hasattr(ReviewModel, "get_average_rating")

    # 2. Check source of api_controller for routes
    src = _source_of("controllers/api_controller.py")
    assert "/patient/appointment/<int:appointment_id>/review" in src, (
        "api_controller.py is missing the POST endpoint to submit reviews."
    )
    assert "/patient/doctor/<int:doctor_id>/reviews" in src, (
        "api_controller.py is missing the GET endpoint to fetch reviews."
    )

def test_appointment_rescheduling():
    """
    Verify that AppointmentModel has rescheduling methods and api_controller has route registered.
    """
    from models.appointment_model import AppointmentModel
    assert hasattr(AppointmentModel, "is_double_booked_exclude")
    assert hasattr(AppointmentModel, "reschedule")

    src = _source_of("controllers/api_controller.py")
    assert "/doctor/appointment/<int:appointment_id>/reschedule" in src, (
        "api_controller.py is missing the PUT endpoint for rescheduling."
    )

