"""
tests/test_pharmacy_workflow.py
Static source-code regression tests for the pharmacy workflow overhaul.
No database connection required — tests verify file contents only.

Run with:  cd backend && pytest tests/test_pharmacy_workflow.py -v
"""
import os
import sys

import pytest

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)


def _src(rel_path: str) -> str:
    with open(os.path.join(PROJECT_ROOT, rel_path), "r", encoding="utf-8") as f:
        return f.read()


# ──────────────────────────────────────────────────────────────────────────────
# WFLOW-01  InventoryModel must use pharmacy_inventory, not medicine_inventory
# ──────────────────────────────────────────────────────────────────────────────

def test_wflow01_inventory_uses_pharmacy_inventory_table():
    """
    inventory_model.py must query `pharmacy_inventory` (per-store table).
    The old `medicine_inventory` global table should no longer be used.
    """
    src = _src("models/inventory_model.py")
    assert "pharmacy_inventory" in src, (
        "WFLOW-01: 'pharmacy_inventory' not found in inventory_model.py — "
        "store-wise inventory is broken."
    )
    assert "medicine_inventory" not in src, (
        "WFLOW-01: old 'medicine_inventory' table still referenced — "
        "must be removed in favour of pharmacy_inventory."
    )


# ──────────────────────────────────────────────────────────────────────────────
# WFLOW-02  InventoryModel must have get_by_store method
# ──────────────────────────────────────────────────────────────────────────────

def test_wflow02_inventory_has_get_by_store():
    """
    InventoryModel must define get_by_store(pharmacy_id) so the dashboard
    and API return data scoped to one pharmacy store.
    """
    src = _src("models/inventory_model.py")
    assert "def get_by_store" in src, (
        "WFLOW-02: InventoryModel.get_by_store() is not defined — "
        "per-store inventory retrieval is missing."
    )


# ──────────────────────────────────────────────────────────────────────────────
# WFLOW-03  InventoryModel must support search_by_store for doctor suggestions
# ──────────────────────────────────────────────────────────────────────────────

def test_wflow03_inventory_has_search_by_store():
    """
    InventoryModel must define search_by_store(pharmacy_id, query) so the
    doctor's medicine autocomplete only shows the selected store's inventory.
    """
    src = _src("models/inventory_model.py")
    assert "def search_by_store" in src, (
        "WFLOW-03: InventoryModel.search_by_store() is not defined — "
        "doctor medicine suggestions will not be store-specific."
    )


# ──────────────────────────────────────────────────────────────────────────────
# WFLOW-04  PrescriptionModel must have set_pharmacy method
# ──────────────────────────────────────────────────────────────────────────────

def test_wflow04_prescription_has_set_pharmacy():
    """
    PrescriptionModel must define set_pharmacy(prescription_id, pharmacy_id)
    so the patient can select a pharmacy after the doctor creates the prescription.
    """
    src = _src("models/prescription_model.py")
    assert "def set_pharmacy" in src, (
        "WFLOW-04: PrescriptionModel.set_pharmacy() is not defined — "
        "patient cannot select a pharmacy store."
    )


# ──────────────────────────────────────────────────────────────────────────────
# WFLOW-05  PrescriptionModel must support QR transfer
# ──────────────────────────────────────────────────────────────────────────────

def test_wflow05_prescription_has_transfer():
    """
    PrescriptionModel must define transfer() that moves the prescription
    to the new pharmacy and logs it in prescription_transfer.
    """
    src = _src("models/prescription_model.py")
    assert "def transfer" in src, (
        "WFLOW-05: PrescriptionModel.transfer() is not defined — "
        "QR-based pharmacy handover will not work."
    )
    assert "prescription_transfer" in src, (
        "WFLOW-05: prescription_transfer audit table not referenced in transfer() — "
        "transfers will not be logged."
    )


# ──────────────────────────────────────────────────────────────────────────────
# WFLOW-06  PrescriptionModel must have expire_stale for automatic expiry
# ──────────────────────────────────────────────────────────────────────────────

def test_wflow06_prescription_has_expire_stale():
    """
    PrescriptionModel must define expire_stale() to mark overdue Sent
    prescriptions as Expired so they cannot be dispensed.
    """
    src = _src("models/prescription_model.py")
    assert "def expire_stale" in src, (
        "WFLOW-06: PrescriptionModel.expire_stale() is not defined — "
        "expired prescriptions will not be auto-marked."
    )
    assert "reserved_until" in src, (
        "WFLOW-06: 'reserved_until' not used in prescription_model.py — "
        "expiry window check is missing."
    )


# ──────────────────────────────────────────────────────────────────────────────
# WFLOW-07  PrescriptionModel must filter by pharmacy (get_by_store)
# ──────────────────────────────────────────────────────────────────────────────

def test_wflow07_prescription_has_get_by_store():
    """
    PrescriptionModel must define get_by_store(pharmacy_id) so the pharmacist
    dashboard only shows prescriptions assigned to the logged-in store.
    """
    src = _src("models/prescription_model.py")
    assert "def get_by_store" in src, (
        "WFLOW-07: PrescriptionModel.get_by_store() is not defined — "
        "pharmacists will see prescriptions from ALL stores."
    )


# ──────────────────────────────────────────────────────────────────────────────
# WFLOW-08  Pharmacy dashboard API must filter by pharmacy_id
# ──────────────────────────────────────────────────────────────────────────────

def test_wflow08_pharmacy_dashboard_api_is_store_scoped():
    """
    api_controller.py pharmacy_dashboard() must call get_pharmacy_id() and
    use get_by_store() — not a global get_all() or get_pending_prescriptions().
    """
    src = _src("controllers/api_controller.py")
    assert "get_pharmacy_id" in src, (
        "WFLOW-08: get_pharmacy_id() not called in api_controller.py — "
        "pharmacy dashboard is not scoped to a store."
    )
    assert "get_by_store" in src, (
        "WFLOW-08: get_by_store() not used in api_controller.py — "
        "prescriptions returned will be global, not store-wise."
    )


# ──────────────────────────────────────────────────────────────────────────────
# WFLOW-09  Dispense API must check expiry
# ──────────────────────────────────────────────────────────────────────────────

def test_wflow09_dispense_api_checks_expiry():
    """
    api_controller.py pharmacy_dispense() must check that the prescription
    status is not 'Expired' before allowing dispense.
    """
    src = _src("controllers/api_controller.py")
    assert "'Expired'" in src or '"Expired"' in src, (
        "WFLOW-09: 'Expired' status not referenced in api_controller.py — "
        "expired prescriptions can still be dispensed."
    )


# ──────────────────────────────────────────────────────────────────────────────
# WFLOW-10  Patient pharmacy selection API must exist
# ──────────────────────────────────────────────────────────────────────────────

def test_wflow10_patient_select_pharmacy_endpoint_exists():
    """
    api_controller.py must define the /patient/prescription/<id>/select-pharmacy
    endpoint so patients can choose a pharmacy store.
    """
    src = _src("controllers/api_controller.py")
    assert "select-pharmacy" in src, (
        "WFLOW-10: /patient/prescription/<id>/select-pharmacy endpoint not found — "
        "patients cannot select a pharmacy."
    )


# ──────────────────────────────────────────────────────────────────────────────
# WFLOW-11  QR transfer endpoint must exist
# ──────────────────────────────────────────────────────────────────────────────

def test_wflow11_qr_transfer_endpoint_exists():
    """
    api_controller.py must define /pharmacy/transfer/accept to handle QR
    transfer tokens from patients.
    """
    src = _src("controllers/api_controller.py")
    assert "transfer/accept" in src, (
        "WFLOW-11: /pharmacy/transfer/accept endpoint not found — "
        "QR-based pharmacy transfer will not work."
    )


# ──────────────────────────────────────────────────────────────────────────────
# WFLOW-12  Doctor medicine suggestion endpoint must be store-scoped
# ──────────────────────────────────────────────────────────────────────────────

def test_wflow12_medicine_suggest_endpoint_exists():
    """
    api_controller.py must define /doctor/medicine-suggest endpoint
    that accepts a pharmacy_id parameter.
    """
    src = _src("controllers/api_controller.py")
    assert "medicine-suggest" in src, (
        "WFLOW-12: /doctor/medicine-suggest endpoint not found — "
        "doctor cannot get store-specific medicine suggestions."
    )
    assert "search_by_store" in src, (
        "WFLOW-12: search_by_store() not used in medicine-suggest — "
        "suggestions will not be store-specific."
    )


# ──────────────────────────────────────────────────────────────────────────────
# WFLOW-13  PharmacistModel must have get_pharmacy_id helper
# ──────────────────────────────────────────────────────────────────────────────

def test_wflow13_pharmacist_model_has_get_pharmacy_id():
    """
    PharmacistModel must expose get_pharmacy_id(pharmacist_id) so any API
    handler can quickly look up which store the logged-in pharmacist belongs to.
    """
    src = _src("models/pharmacist_model.py")
    assert "def get_pharmacy_id" in src, (
        "WFLOW-13: PharmacistModel.get_pharmacy_id() is not defined — "
        "pharmacist-to-store mapping is not available."
    )


# ──────────────────────────────────────────────────────────────────────────────
# WFLOW-14  mark_dispensed must require pharmacy_id (ownership check)
# ──────────────────────────────────────────────────────────────────────────────

def test_wflow14_mark_dispensed_has_pharmacy_ownership_check():
    """
    PrescriptionModel.mark_dispensed() must filter by pharmacy_id so one
    pharmacy cannot dispense another pharmacy's prescription.
    """
    src = _src("models/prescription_model.py")
    assert "def mark_dispensed" in src, (
        "WFLOW-14: PrescriptionModel.mark_dispensed() not defined — "
        "dispense ownership check is missing."
    )
    # The pharmacy_id parameter must be in the UPDATE WHERE clause
    idx = src.find("def mark_dispensed")
    snippet = src[idx:idx+500]
    assert "pharmacy_id" in snippet, (
        "WFLOW-14: mark_dispensed() does not filter by pharmacy_id — "
        "any pharmacy could mark a foreign prescription as dispensed."
    )
