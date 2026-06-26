# models/appointment_model.py
from database.connection import get_connection


class AppointmentModel:

    @staticmethod
    def create(patient_id, doctor_id, appointment_datetime, symptoms, report_path):
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO appointment (patient_id, doctor_id, appointment_datetime, symptoms, report_path)
            VALUES (%s,%s,%s,%s,%s)
        """, (patient_id, doctor_id, appointment_datetime, symptoms, report_path))
        conn.commit()
        aid = cur.lastrowid
        cur.close()
        conn.close()
        return aid

    @staticmethod
    def get_by_patient(patient_id):
        conn = get_connection()
        cur = conn.cursor(dictionary=True)
        cur.execute("""
            SELECT a.*, d.name AS doctor_name, r.review_id, r.rating AS review_rating
            FROM appointment a
            LEFT JOIN doctor d ON a.doctor_id = d.doctor_id
            LEFT JOIN doctor_review r ON a.appointment_id = r.appointment_id
            WHERE a.patient_id=%s ORDER BY a.appointment_datetime DESC
        """, (patient_id,))
        rows = cur.fetchall()
        cur.close()
        conn.close()
        return rows

    @staticmethod
    def get_by_doctor(doctor_id, status=None):
        conn = get_connection()
        cur = conn.cursor(dictionary=True)
        if status:
            cur.execute("""
                SELECT a.*, p.name AS patient_name FROM appointment a
                LEFT JOIN patient p ON a.patient_id = p.patient_id
                WHERE a.doctor_id=%s AND a.status=%s ORDER BY a.appointment_datetime
            """, (doctor_id, status))
        else:
            cur.execute("""
                SELECT a.*, p.name AS patient_name FROM appointment a
                LEFT JOIN patient p ON a.patient_id = p.patient_id
                WHERE a.doctor_id=%s ORDER BY a.appointment_datetime
            """, (doctor_id,))
        rows = cur.fetchall()
        cur.close()
        conn.close()
        return rows

    @staticmethod
    def get_by_id(appointment_id):
        conn = get_connection()
        cur = conn.cursor(dictionary=True)
        cur.execute("""
            SELECT a.*, p.name as patient_name, p.email as patient_email, p.contact as patient_contact,
                   d.name as doctor_name, d.specialization as doctor_specialization
            FROM appointment a
            LEFT JOIN patient p ON a.patient_id = p.patient_id
            LEFT JOIN doctor d ON a.doctor_id = d.doctor_id
            WHERE a.appointment_id=%s
        """, (appointment_id,))
        row = cur.fetchone()
        cur.close()
        conn.close()
        return row

    @staticmethod
    def update_status(appointment_id, status):
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("UPDATE appointment SET status=%s WHERE appointment_id=%s", (status, appointment_id))
        conn.commit()
        cur.close()
        conn.close()

    # ------------------- Doctor Statistics -------------------
    @staticmethod
    def get_statistics(doctor_id):
        """
        Fetch appointment statistics for a doctor:
        - Total appointments
        - Completed, Pending, Cancelled counts
        - Most common symptoms
        - Appointments per month
        """
        conn = get_connection()
        cur = conn.cursor(dictionary=True)

        # Total, completed, pending, cancelled
        cur.execute("""
            SELECT
                COUNT(*) AS total,
                SUM(status='Completed') AS completed,
                SUM(status='Pending') AS pending,
                SUM(status='Cancelled') AS cancelled
            FROM appointment
            WHERE doctor_id = %s
        """, (doctor_id,))
        summary = cur.fetchone()

        # Top symptoms
        cur.execute("""
            SELECT symptoms, COUNT(*) AS count
            FROM appointment
            WHERE doctor_id = %s AND symptoms IS NOT NULL AND symptoms != ''
            GROUP BY symptoms
            ORDER BY count DESC
            LIMIT 5
        """, (doctor_id,))
        top_symptoms = cur.fetchall()

        # Monthly breakdown
        cur.execute("""
            SELECT
                DATE_FORMAT(appointment_datetime, '%b %Y') AS month,
                COUNT(*) AS total
            FROM appointment
            WHERE doctor_id = %s
            GROUP BY month
            ORDER BY MIN(appointment_datetime)
        """, (doctor_id,))
        monthly = cur.fetchall()

        cur.close()
        conn.close()

        return {
            "summary": summary or {},
            "top_symptoms": top_symptoms or [],
            "monthly": monthly or []
        }

    @classmethod
    def cancel_appointment(cls, appointment_id):
        conn = get_connection()
        cur = conn.cursor()
        try:
            query = """
                UPDATE appointment
                SET status = 'Cancelled'
                WHERE appointment_id = %s
                AND status NOT IN ('Cancelled', 'Completed')
            """
            cur.execute(query, (appointment_id,))
            conn.commit()
            return cur.rowcount > 0
        except Exception as e:
            print(f"[ERROR cancel_appointment]: {e}")
            return False
        finally:
            cur.close()
            conn.close()

    @staticmethod
    def get_by_report_path(report_path):
        conn = get_connection()
        cur = conn.cursor(dictionary=True)
        cur.execute("SELECT * FROM appointment WHERE report_path=%s", (report_path,))
        row = cur.fetchone()
        cur.close()
        conn.close()
        return row

    @staticmethod
    def is_double_booked(doctor_id, appointment_datetime):
        conn = get_connection()
        cur = conn.cursor(dictionary=True)
        try:
            cur.execute("""
                SELECT * FROM appointment
                WHERE doctor_id = %s
                  AND status != 'Cancelled'
                  AND ABS(TIMESTAMPDIFF(SECOND, appointment_datetime, %s)) < 600
            """, (doctor_id, appointment_datetime))
            row = cur.fetchone()
            return row is not None
        except Exception as e:
            print(f"AppointmentModel.is_double_booked error: {e}")
            return False
        finally:
            cur.close()
            conn.close()

    @staticmethod
    def is_double_booked_exclude(doctor_id, appointment_datetime, exclude_appointment_id):
        conn = get_connection()
        cur = conn.cursor(dictionary=True)
        try:
            cur.execute("""
                SELECT * FROM appointment
                WHERE doctor_id = %s
                  AND appointment_id != %s
                  AND status != 'Cancelled'
                  AND ABS(TIMESTAMPDIFF(SECOND, appointment_datetime, %s)) < 600
            """, (doctor_id, exclude_appointment_id, appointment_datetime))
            row = cur.fetchone()
            return row is not None
        except Exception as e:
            print(f"AppointmentModel.is_double_booked_exclude error: {e}")
            return False
        finally:
            cur.close()
            conn.close()

    @staticmethod
    def reschedule(appointment_id, appointment_datetime):
        conn = get_connection()
        cur = conn.cursor()
        try:
            cur.execute("""
                UPDATE appointment
                SET appointment_datetime = %s
                WHERE appointment_id = %s
            """, (appointment_datetime, appointment_id))
            conn.commit()
            return cur.rowcount > 0
        except Exception as e:
            print(f"AppointmentModel.reschedule error: {e}")
            return False
        finally:
            cur.close()
            conn.close()
