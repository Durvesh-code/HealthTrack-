# models/review_model.py
from database.connection import get_connection

class ReviewModel:
    @staticmethod
    def create(appointment_id, doctor_id, patient_id, rating, review_text):
        conn = get_connection()
        cur = conn.cursor()
        try:
            cur.execute("""
                INSERT INTO doctor_review (appointment_id, doctor_id, patient_id, rating, review_text)
                VALUES (%s, %s, %s, %s, %s)
            """, (appointment_id, doctor_id, patient_id, rating, review_text))
            conn.commit()
            rid = cur.lastrowid
            return rid
        except Exception as e:
            print(f"ReviewModel.create error: {e}")
            return None
        finally:
            cur.close()
            conn.close()

    @staticmethod
    def get_by_doctor(doctor_id):
        conn = get_connection()
        cur = conn.cursor(dictionary=True)
        try:
            cur.execute("""
                SELECT r.*, p.name AS patient_name FROM doctor_review r
                LEFT JOIN patient p ON r.patient_id = p.patient_id
                WHERE r.doctor_id = %s
                ORDER BY r.created_at DESC
            """, (doctor_id,))
            rows = cur.fetchall()
            return rows
        except Exception as e:
            print(f"ReviewModel.get_by_doctor error: {e}")
            return []
        finally:
            cur.close()
            conn.close()

    @staticmethod
    def get_average_rating(doctor_id):
        conn = get_connection()
        cur = conn.cursor(dictionary=True)
        try:
            cur.execute("""
                SELECT COALESCE(AVG(rating), 0) AS average_rating, COUNT(review_id) AS total_reviews
                FROM doctor_review
                WHERE doctor_id = %s
            """, (doctor_id,))
            row = cur.fetchone()
            return row or {"average_rating": 0, "total_reviews": 0}
        except Exception as e:
            print(f"ReviewModel.get_average_rating error: {e}")
            return {"average_rating": 0, "total_reviews": 0}
        finally:
            cur.close()
            conn.close()
