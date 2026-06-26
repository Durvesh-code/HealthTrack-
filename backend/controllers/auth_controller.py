from flask import Blueprint, request, jsonify
from werkzeug.security import generate_password_hash, check_password_hash
from flask_jwt_extended import create_access_token
from database.connection import get_db_connection
from models.patient_model import PatientModel
from models.doctor_model import DoctorModel
from models.pharmacist_model import PharmacistModel

auth_bp = Blueprint('auth', __name__)


# =====================================================
# LOGIN
# =====================================================
@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json(silent=True)

    if not data:
        return jsonify({"error": "Invalid JSON data"}), 400

    email = data.get('email')
    password = data.get('password')
    role = data.get('role')

    if not all([email, password, role]):
        return jsonify({"error": "Email, password, and role are required"}), 400

    # Role → Table mapping
    table_map = {
        "patient": "patient",
        "doctor": "doctor",
        "pharmacist": "pharmacist"
    }

    if role not in table_map:
        return jsonify({"error": "Invalid role"}), 400

    # DB Connection
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    try:
        query = f"SELECT * FROM {table_map[role]} WHERE email = %s"
        cursor.execute(query, (email,))
        user = cursor.fetchone()

    finally:
        cursor.close()
        conn.close()

    if not user:
        return jsonify({"error": "Invalid credentials"}), 401

    # -----------------------------
    # Password Validation
    # -----------------------------
    db_password = user.get("password")
    password_is_valid = False

    # Hashed password (recommended)
    if db_password and db_password.startswith(("pbkdf2:", "scrypt:")):
        password_is_valid = check_password_hash(db_password, password)



    if not password_is_valid:
        return jsonify({"error": "Invalid credentials"}), 401

    # -----------------------------
    # JWT Token Creation
    # -----------------------------
    user_id = user.get(f"{role}_id") or user.get("id")

    access_token = create_access_token(
        identity=str(user_id),
        additional_claims={"role": role}
    )

    return jsonify({
        "status": "success",
        "token": access_token,
        "role": role,
        "user_name": user.get("name") or "User",
        "id": str(user_id)
    }), 200


# =====================================================
# PATIENT REGISTRATION
# =====================================================
@auth_bp.route('/register/patient', methods=['POST'])
def register_patient():
    data = request.get_json(silent=True) or {}

    name = data.get("name")
    email = data.get("email")
    password = data.get("password")
    gender = data.get("gender")
    age = data.get("age")
    contact = data.get("contact")
    address = data.get("address")

    if not all([name, email, password]):
        return jsonify({"success": False, "message": "Name, email, and password are required"}), 400

    if PatientModel.find_by_email(email):
        return jsonify({"success": False, "message": "Email already registered"}), 400

    try:
        hashed_password = generate_password_hash(password)
        PatientModel.create(
            name, email, hashed_password,
            gender, age, contact, address
        )
        return jsonify({"success": True, "message": "Patient registered successfully"}), 201

    except Exception as e:
        print("Patient Register Error:", e)
        return jsonify({"success": False, "message": "Database error"}), 500


# =====================================================
# DOCTOR REGISTRATION
# =====================================================
@auth_bp.route('/register/doctor', methods=['POST'])
def register_doctor():
    data = request.get_json(silent=True) or {}

    name = data.get("name")
    email = data.get("email")
    password = data.get("password")
    specialization = data.get("specialization")
    contact = data.get("contact")

    if not all([name, email, password]):
        return jsonify({"success": False, "message": "Name, email, and password are required"}), 400

    if DoctorModel.find_by_email(email):
        return jsonify({"success": False, "message": "Email already registered"}), 400

    try:
        hashed_password = generate_password_hash(password)
        DoctorModel.create(
            name, email, hashed_password,
            specialization, contact
        )
        return jsonify({"success": True, "message": "Doctor registered successfully"}), 201

    except Exception as e:
        print("Doctor Register Error:", e)
        return jsonify({"success": False, "message": "Database error"}), 500


# =====================================================
# PHARMACIST REGISTRATION
# =====================================================
@auth_bp.route('/register/pharmacist', methods=['POST'])
def register_pharmacist():
    data = request.get_json(silent=True) or {}

    name          = data.get("name")
    email         = data.get("email")
    password      = data.get("password")
    contact       = data.get("contact")
    license_no    = data.get("license_no")
    pharmacy_name = data.get("pharmacy_name")   # sent by RegisterPharmacist.jsx
    address       = data.get("address")         # sent by RegisterPharmacist.jsx

    if not all([name, email, password]):
        return jsonify({"success": False, "message": "Name, email, and password are required"}), 400

    if PharmacistModel.find_by_email(email):
        return jsonify({"success": False, "message": "Email already registered"}), 400

    try:
        hashed_password = generate_password_hash(password)
        PharmacistModel.create(name, email, hashed_password, contact, license_no)

        # Auto-create and link pharmacy store if a name was provided at signup
        if pharmacy_name and pharmacy_name.strip():
            conn = get_db_connection()
            cur  = conn.cursor(dictionary=True)
            try:
                # Get the newly created pharmacist
                cur.execute("SELECT pharmacist_id FROM pharmacist WHERE email = %s", (email,))
                pharma = cur.fetchone()
                if pharma:
                    pid = pharma['pharmacist_id']
                    # Create the store
                    cur.execute("""
                        INSERT INTO pharmacy_store (store_name, address, contact, store_type, status)
                        VALUES (%s, %s, %s, 'Collaborator', 'Active')
                    """, (pharmacy_name.strip(), address or None, contact or None))
                    store_id = cur.lastrowid
                    # Link pharmacist → store
                    cur.execute(
                        "UPDATE pharmacist SET pharmacy_id = %s WHERE pharmacist_id = %s",
                        (store_id, pid)
                    )
                    conn.commit()
            finally:
                cur.close()
                conn.close()

        return jsonify({"success": True, "message": "Pharmacist registered successfully"}), 201

    except Exception as e:
        if 'conn' in locals() and conn.is_connected():
            conn.rollback()
        print("Pharmacist Register Error:", e)
        return jsonify({"success": False, "message": "Database error"}), 500




