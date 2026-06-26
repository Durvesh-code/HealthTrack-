# models/doctor_model.py
from database.connection import get_connection

class DoctorModel:
    @staticmethod
    def create(name, email, password, specialization, contact):
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO doctor (name, email, password, specialization, contact)
            VALUES (%s, %s, %s, %s, %s)
        """, (name, email, password, specialization, contact))
        conn.commit()
        did = cur.lastrowid
        cur.close()
        conn.close()
        return did

    @staticmethod
    def find_all():
        conn = get_connection()
        cur = conn.cursor(dictionary=True)
        cur.execute("""
            SELECT d.*, 
                   COALESCE(r.avg_rating, 0) AS average_rating,
                   COALESCE(r.total_revs, 0) AS total_reviews
            FROM doctor d
            LEFT JOIN (
                SELECT doctor_id, 
                       AVG(rating) AS avg_rating, 
                       COUNT(review_id) AS total_revs
                FROM doctor_review
                GROUP BY doctor_id
            ) r ON d.doctor_id = r.doctor_id
        """)
        rows = cur.fetchall()
        for row in rows:
            if row.get("average_rating") is not None:
                row["average_rating"] = float(row["average_rating"])
        cur.close()
        conn.close()
        return rows

    @staticmethod
    def find_by_id(doctor_id):
        conn = get_connection()
        cur = conn.cursor(dictionary=True)
        cur.execute("""
            SELECT d.*, 
                   COALESCE(r.avg_rating, 0) AS average_rating,
                   COALESCE(r.total_revs, 0) AS total_reviews
            FROM doctor d
            LEFT JOIN (
                SELECT doctor_id, 
                       AVG(rating) AS avg_rating, 
                       COUNT(review_id) AS total_revs
                FROM doctor_review
                GROUP BY doctor_id
            ) r ON d.doctor_id = r.doctor_id
            WHERE d.doctor_id=%s
        """, (doctor_id,))
        doc = cur.fetchone()
        if doc and doc.get("average_rating") is not None:
            doc["average_rating"] = float(doc["average_rating"])
        cur.close()
        conn.close()
        return doc

    @staticmethod
    def find_by_email(email):
        conn = get_connection()
        cur = conn.cursor(dictionary=True)
        cur.execute("SELECT * FROM doctor WHERE email=%s", (email,))
        doc = cur.fetchone()
        cur.close()
        conn.close()
        return doc

    @staticmethod
    def get_profile(doctor_id):
        """
        Fetch doctor profile information.
        """
        conn = get_connection()
        cur = conn.cursor(dictionary=True)
        cur.execute("""
            SELECT doctor_id, name, email, specialization, contact, profile_img
            FROM doctor
            WHERE doctor_id = %s
        """, (doctor_id,))
        profile = cur.fetchone()
        cur.close()
        conn.close()
        return profile

    @staticmethod
    def get_appointments(doctor_id):
        """
        Fetch appointments assigned to this doctor.
        """
        conn = get_connection()
        cur = conn.cursor(dictionary=True)
        cur.execute("""
            SELECT 
                a.appointment_id,
                a.appointment_datetime,
                a.status,
                a.symptoms,
                p.patient_id,
                p.name AS patient_name
            FROM appointment a
            JOIN patient p ON a.patient_id = p.patient_id
            WHERE a.doctor_id = %s
            ORDER BY a.appointment_datetime DESC
        """, (doctor_id,))
        appointments = cur.fetchall()
        cur.close()
        conn.close()
        return appointments
