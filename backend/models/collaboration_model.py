# models/collaboration_model.py
from database.connection import get_connection


class CollaborationModel:

    @staticmethod
    def request_collaboration(pharmacy_id, doctor_id):
        """Pharmacy sends a collaboration request to a doctor."""
        conn = get_connection()
        cur = conn.cursor()
        try:
            cur.execute("""
                INSERT INTO doctor_pharmacy_collaboration
                    (doctor_id, pharmacy_id, status, requested_by)
                VALUES (%s, %s, 'Pending', 'Pharmacy')
                ON DUPLICATE KEY UPDATE
                    status       = IF(status='Rejected','Pending',status),
                    requested_at = IF(status='Rejected', NOW(), requested_at)
            """, (doctor_id, pharmacy_id))
            conn.commit()
            return cur.lastrowid or True
        except Exception as e:
            print(f"CollaborationModel.request_collaboration error: {e}")
            return None
        finally:
            cur.close()
            conn.close()

    @staticmethod
    def respond(collab_id, doctor_id, status):
        """Doctor accepts or rejects a collaboration request (ownership-verified)."""
        if status not in ("Accepted", "Rejected"):
            return False
        conn = get_connection()
        cur = conn.cursor()
        try:
            cur.execute("""
                UPDATE doctor_pharmacy_collaboration
                SET status = %s, responded_at = NOW()
                WHERE collab_id = %s
                  AND doctor_id = %s
                  AND status    = 'Pending'
            """, (status, collab_id, doctor_id))
            conn.commit()
            return cur.rowcount > 0
        except Exception as e:
            print(f"CollaborationModel.respond error: {e}")
            return False
        finally:
            cur.close()
            conn.close()

    @staticmethod
    def get_for_doctor(doctor_id):
        """Get all collaboration records for a doctor — any status."""
        conn = get_connection()
        cur = conn.cursor(dictionary=True)
        try:
            cur.execute("""
                SELECT
                    c.collab_id,
                    c.status,
                    c.requested_at,
                    c.responded_at,
                    ps.pharmacy_id,
                    ps.store_name,
                    ps.address    AS store_address,
                    ps.contact    AS store_contact,
                    ps.store_type
                FROM doctor_pharmacy_collaboration c
                JOIN pharmacy_store ps ON c.pharmacy_id = ps.pharmacy_id
                WHERE c.doctor_id = %s
                ORDER BY c.requested_at DESC
            """, (doctor_id,))
            return cur.fetchall()
        except Exception as e:
            print(f"CollaborationModel.get_for_doctor error: {e}")
            return []
        finally:
            cur.close()
            conn.close()

    @staticmethod
    def get_for_pharmacy(pharmacy_id):
        """Get all collaboration records sent by a pharmacy — any status."""
        conn = get_connection()
        cur = conn.cursor(dictionary=True)
        try:
            cur.execute("""
                SELECT
                    c.collab_id,
                    c.status,
                    c.requested_at,
                    c.responded_at,
                    d.doctor_id,
                    d.name          AS doctor_name,
                    d.specialization,
                    d.contact       AS doctor_contact,
                    d.email         AS doctor_email,
                    d.profile_img
                FROM doctor_pharmacy_collaboration c
                JOIN doctor d ON c.doctor_id = d.doctor_id
                WHERE c.pharmacy_id = %s
                ORDER BY c.requested_at DESC
            """, (pharmacy_id,))
            return cur.fetchall()
        except Exception as e:
            print(f"CollaborationModel.get_for_pharmacy error: {e}")
            return []
        finally:
            cur.close()
            conn.close()

    @staticmethod
    def get_accepted_pharmacies_for_doctor(doctor_id):
        """Return accepted pharmacy stores for a doctor (used in prescription form)."""
        conn = get_connection()
        cur = conn.cursor(dictionary=True)
        try:
            cur.execute("""
                SELECT
                    ps.pharmacy_id,
                    ps.store_name,
                    ps.address,
                    ps.contact,
                    ps.store_type
                FROM doctor_pharmacy_collaboration c
                JOIN pharmacy_store ps ON c.pharmacy_id = ps.pharmacy_id
                WHERE c.doctor_id = %s AND c.status = 'Accepted'
                ORDER BY ps.store_name
            """, (doctor_id,))
            return cur.fetchall()
        except Exception as e:
            print(f"CollaborationModel.get_accepted_pharmacies_for_doctor error: {e}")
            return []
        finally:
            cur.close()
            conn.close()

    @staticmethod
    def get_accepted_doctors_for_pharmacy(pharmacy_id):
        """Return doctors who have accepted collaboration with a pharmacy."""
        conn = get_connection()
        cur = conn.cursor(dictionary=True)
        try:
            cur.execute("""
                SELECT
                    d.doctor_id,
                    d.name,
                    d.specialization,
                    d.contact,
                    d.profile_img
                FROM doctor_pharmacy_collaboration c
                JOIN doctor d ON c.doctor_id = d.doctor_id
                WHERE c.pharmacy_id = %s AND c.status = 'Accepted'
                ORDER BY d.name
            """, (pharmacy_id,))
            return cur.fetchall()
        except Exception as e:
            print(f"CollaborationModel.get_accepted_doctors_for_pharmacy error: {e}")
            return []
        finally:
            cur.close()
            conn.close()

    @staticmethod
    def get_pending_count_for_doctor(doctor_id):
        """Return count of pending requests for badge notification."""
        conn = get_connection()
        cur = conn.cursor()
        try:
            cur.execute("""
                SELECT COUNT(*) FROM doctor_pharmacy_collaboration
                WHERE doctor_id = %s AND status = 'Pending'
            """, (doctor_id,))
            row = cur.fetchone()
            return row[0] if row else 0
        except Exception as e:
            print(f"CollaborationModel.get_pending_count_for_doctor error: {e}")
            return 0
        finally:
            cur.close()
            conn.close()
