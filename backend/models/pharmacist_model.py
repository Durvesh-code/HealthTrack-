# models/pharmacist_model.py
from database.connection import get_connection


class PharmacistModel:

    @staticmethod
    def create(name, email, password, contact=None, license_no=None, pharmacy_id=None):
        """Register a new pharmacist"""
        conn = get_connection()
        cur = conn.cursor()
        try:
            cur.execute("""
                INSERT INTO pharmacist (name, email, password, contact, license_no, pharmacy_id)
                VALUES (%s, %s, %s, %s, %s, %s)
            """, (name, email, password, contact, license_no, pharmacy_id))
            conn.commit()
            return cur.lastrowid
        except Exception as e:
            print(f"PharmacistModel.create error: {e}")
            return None
        finally:
            cur.close()
            conn.close()

    @staticmethod
    def find_by_email(email):
        """Find pharmacist by email for login"""
        conn = get_connection()
        cur = conn.cursor(dictionary=True)
        try:
            cur.execute("SELECT * FROM pharmacist WHERE email=%s", (email,))
            return cur.fetchone()
        except Exception as e:
            print(f"PharmacistModel.find_by_email error: {e}")
            return None
        finally:
            cur.close()
            conn.close()

    @staticmethod
    def get_profile(pharmacist_id):
        """Get pharmacist profile with linked store info"""
        conn = get_connection()
        cur = conn.cursor(dictionary=True)
        try:
            cur.execute("""
                SELECT ph.*, ps.store_name, ps.address AS store_address,
                       ps.store_type, ps.status AS store_status
                FROM pharmacist ph
                LEFT JOIN pharmacy_store ps ON ph.pharmacy_id = ps.pharmacy_id
                WHERE ph.pharmacist_id = %s
            """, (pharmacist_id,))
            return cur.fetchone()
        except Exception as e:
            print(f"PharmacistModel.get_profile error: {e}")
            return None
        finally:
            cur.close()
            conn.close()

    @staticmethod
    def get_pharmacy_id(pharmacist_id):
        """Return the pharmacy_store.pharmacy_id for this pharmacist."""
        conn = get_connection()
        cur = conn.cursor()
        try:
            cur.execute(
                "SELECT pharmacy_id FROM pharmacist WHERE pharmacist_id = %s",
                (pharmacist_id,)
            )
            row = cur.fetchone()
            return row[0] if row else None
        except Exception as e:
            print(f"PharmacistModel.get_pharmacy_id error: {e}")
            return None
        finally:
            cur.close()
            conn.close()
