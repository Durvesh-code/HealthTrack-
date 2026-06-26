from database.connection import get_connection

class PatientModel:
    # 🧩 1️⃣ Create new patient record
    @staticmethod
    def create(name, email, password, gender, age, contact, address):
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO patient (name, email, password, gender, age, contact, address)
            VALUES (%s,%s,%s,%s,%s,%s,%s)
        """, (name, email, password, gender, age, contact, address))
        conn.commit()
        pid = cur.lastrowid
        cur.close()
        conn.close()
        return pid

    # 🧩 2️⃣ Find patient by email
    @staticmethod
    def find_by_email(email):
        conn = get_connection()
        cur = conn.cursor(dictionary=True)
        cur.execute("SELECT * FROM patient WHERE email=%s", (email,))
        user = cur.fetchone()
        cur.close()
        conn.close()
        return user

    # 🧩 3️⃣ Get patient by ID
    @staticmethod
    def get_by_id(patient_id):
        conn = get_connection()
        cur = conn.cursor(dictionary=True)
        cur.execute("SELECT * FROM patient WHERE patient_id=%s", (patient_id,))
        user = cur.fetchone()
        cur.close()
        conn.close()
        return user

    # 🧩 4️⃣ Get complete patient profile
    @staticmethod
    def get_profile(patient_id):
        conn = get_connection()
        cur = conn.cursor(dictionary=True)
        cur.execute("SELECT * FROM patient WHERE patient_id=%s", (patient_id,))
        profile = cur.fetchone()
        cur.close()
        conn.close()
        return profile

    # 🧩 5️⃣ Update patient profile (with safe conversions + optional photo)
    @staticmethod
    def update_profile(patient_id, data):
        # Convert empty numeric fields to None safely
        def clean_int(value):
            try:
                return int(float(str(value).strip())) if value else None
            except ValueError:
                return None

        conn = get_connection()
        cur = conn.cursor()

        # ✅ Handle optional image
        img_sql = ", profile_img=%s" if data.get('profile_img') else ""
        query = f"""
            UPDATE patient SET
            name=%s, email=%s, gender=%s, age=%s, contact=%s, address=%s,
            blood_group=%s, allergy=%s, medical_history=%s, emergency_contact=%s,
            height_cm=%s, weight_kg=%s, chronic_diseases=%s, medications=%s,
            insurance_provider=%s, insurance_number=%s
            {img_sql}
            WHERE patient_id=%s
        """

        values = [
            data['name'], data['email'], data['gender'], clean_int(data['age']),
            data['contact'], data['address'], data['blood_group'], data['allergy'],
            data['medical_history'], data['emergency_contact'], clean_int(data['height_cm']),
            clean_int(data['weight_kg']), data['chronic_diseases'], data['medications'],
            data['insurance_provider'], data['insurance_number']
        ]
        if data.get('profile_img'):
            values.append(data['profile_img'])
        values.append(patient_id)

        cur.execute(query, values)
        conn.commit()
        cur.close()
        conn.close()

    @staticmethod
    def get_all_for_doctor(doctor_id):
        """
        Fetch distinct patients who have had appointments with this doctor,
        including patient profile image.
        """
        conn = get_connection()
        cur = conn.cursor(dictionary=True)

        query = """
            SELECT
                p.patient_id,
                p.name,
                p.email,
                p.contact,
                p.gender,
                p.age,
                p.blood_group,
                p.profile_img,                 -- ✅ ensure we include the image column
                MAX(a.appointment_datetime) AS last_appointment
            FROM patient p
            JOIN appointment a ON p.patient_id = a.patient_id
            WHERE a.doctor_id = %s
            GROUP BY
                p.patient_id, p.name, p.email, p.contact,
                p.gender, p.age, p.blood_group, p.profile_img
            ORDER BY last_appointment DESC
        """

        cur.execute(query, (doctor_id,))
        patients = cur.fetchall()
        cur.close()
        conn.close()
        return patients
