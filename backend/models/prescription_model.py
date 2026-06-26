# models/prescription_model.py
from database.connection import get_connection


class PrescriptionModel:

    @staticmethod
    def create(appointment_id, doctor_id, patient_id, pharmacy_id=None):
        """Create a new prescription header. pharmacy_id added later by patient if not provided."""
        conn = get_connection()
        cur = conn.cursor()
        try:
            cur.execute("""
                INSERT INTO prescription
                    (appointment_id, doctor_id, patient_id, pharmacy_id, dispense_status)
                VALUES (%s, %s, %s, %s, 'Created')
            """, (appointment_id, doctor_id, patient_id, pharmacy_id))
            conn.commit()
            return cur.lastrowid
        except Exception as e:
            print(f"PrescriptionModel.create error: {e}")
            return None
        finally:
            cur.close()
            conn.close()

    @staticmethod
    def add_detail(prescription_id, medicine_name, dosage, notes,
                   medicine_id=None, quantity=1, item_source='DoctorManual'):
        """Add a medicine line to a prescription."""
        conn = get_connection()
        cur = conn.cursor()
        try:
            cur.execute("""
                INSERT INTO prescription_detail
                    (prescription_id, medicine_id, medicine_name, dosage, quantity, notes, item_source)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
            """, (prescription_id, medicine_id, medicine_name, dosage, quantity, notes, item_source))
            conn.commit()
        except Exception as e:
            print(f"PrescriptionModel.add_detail error: {e}")
        finally:
            cur.close()
            conn.close()

    @staticmethod
    def set_pharmacy(prescription_id, pharmacy_id, window_hours=2):
        """Patient selects pharmacy — sets pharmacy_id, status→Sent, sets reservation window.
        Uses MySQL DATE_ADD(NOW()) to avoid Python/MySQL timezone mismatch."""
        conn = get_connection()
        cur = conn.cursor()
        try:
            cur.execute("""
                UPDATE prescription
                SET pharmacy_id      = %s,
                    dispense_status  = 'Sent',
                    sent_at          = NOW(),
                    reserved_until   = DATE_ADD(NOW(), INTERVAL %s HOUR)
                WHERE prescription_id = %s
                  AND dispense_status IN ('Created', 'Cancelled')
            """, (pharmacy_id, window_hours, prescription_id))
            conn.commit()
            return cur.rowcount > 0
        except Exception as e:
            print(f"PrescriptionModel.set_pharmacy error: {e}")
            return False
        finally:
            cur.close()
            conn.close()

    @staticmethod
    def change_pharmacy(prescription_id, new_pharmacy_id, window_hours=2):
        """Patient changes pharmacy manually — resets window.
        Uses MySQL DATE_ADD(NOW()) to avoid Python/MySQL timezone mismatch."""
        conn = get_connection()
        cur = conn.cursor()
        try:
            cur.execute("""
                UPDATE prescription
                SET pharmacy_id      = %s,
                    dispense_status  = 'Sent',
                    sent_at          = NOW(),
                    reserved_until   = DATE_ADD(NOW(), INTERVAL %s HOUR)
                WHERE prescription_id = %s
                  AND dispense_status IN ('Created', 'Sent', 'Cancelled', 'Transferred')
            """, (new_pharmacy_id, window_hours, prescription_id))
            conn.commit()
            return cur.rowcount > 0
        except Exception as e:
            print(f"PrescriptionModel.change_pharmacy error: {e}")
            return False
        finally:
            cur.close()
            conn.close()

    @staticmethod
    def transfer(prescription_id, new_pharmacy_id, token, window_hours=2):
        """QR transfer: cancel current store assignment, activate new store.
        Uses MySQL DATE_ADD(NOW()) to avoid Python/MySQL timezone mismatch."""
        conn = get_connection()
        cur = conn.cursor(dictionary=True)
        try:
            # Fetch current pharmacy_id for audit
            cur.execute(
                "SELECT pharmacy_id FROM prescription WHERE prescription_id = %s",
                (prescription_id,)
            )
            row = cur.fetchone()
            old_pharmacy_id = row['pharmacy_id'] if row else None

            # Mark prescription as Transferred → new store
            cur.execute("""
                UPDATE prescription
                SET pharmacy_id      = %s,
                    dispense_status  = 'Sent',
                    sent_at          = NOW(),
                    reserved_until   = DATE_ADD(NOW(), INTERVAL %s HOUR)
                WHERE prescription_id = %s
                  AND dispense_status IN ('Sent', 'Created')
            """, (new_pharmacy_id, window_hours, prescription_id))

            if cur.rowcount > 0:
                # Log the transfer
                cur.execute("""
                    INSERT INTO prescription_transfer
                        (prescription_id, from_pharmacy_id, to_pharmacy_id, transfer_token)
                    VALUES (%s, %s, %s, %s)
                """, (prescription_id, old_pharmacy_id, new_pharmacy_id, token))

            conn.commit()
            return cur.rowcount > 0
        except Exception as e:
            print(f"PrescriptionModel.transfer error: {e}")
            return False
        finally:
            cur.close()
            conn.close()

    @staticmethod
    def expire_stale():
        """Mark all overdue Sent prescriptions as Expired. Call periodically."""
        conn = get_connection()
        cur = conn.cursor()
        try:
            cur.execute("""
                UPDATE prescription
                SET dispense_status = 'Expired'
                WHERE dispense_status = 'Sent'
                  AND reserved_until IS NOT NULL
                  AND reserved_until < NOW()
            """)
            conn.commit()
            return cur.rowcount
        except Exception as e:
            print(f"PrescriptionModel.expire_stale error: {e}")
            return 0
        finally:
            cur.close()
            conn.close()

    @staticmethod
    def get_by_store(pharmacy_id):
        """Get all active (Sent) prescriptions for a specific pharmacy store."""
        conn = get_connection()
        cur = conn.cursor(dictionary=True)
        try:
            # Inline expiry check before fetching
            cur.execute("""
                UPDATE prescription
                SET dispense_status = 'Expired'
                WHERE pharmacy_id = %s
                  AND dispense_status = 'Sent'
                  AND reserved_until IS NOT NULL
                  AND reserved_until < NOW()
            """, (pharmacy_id,))
            conn.commit()

            cur.execute("""
                SELECT
                    pr.prescription_id,
                    pr.patient_id,
                    pr.doctor_id,
                    pr.pharmacy_id,
                    pr.date_issued,
                    pr.sent_at,
                    pr.reserved_until,
                    pr.dispense_status,
                    p.name  AS patient_name,
                    p.contact AS patient_contact,
                    d.name  AS doctor_name,
                    a.appointment_id,
                    a.symptoms
                FROM prescription pr
                LEFT JOIN patient      p ON pr.patient_id  = p.patient_id
                LEFT JOIN doctor       d ON pr.doctor_id   = d.doctor_id
                LEFT JOIN appointment  a ON pr.appointment_id = a.appointment_id
                WHERE pr.pharmacy_id = %s
                  AND pr.dispense_status IN ('Sent')
                ORDER BY pr.sent_at DESC
            """, (pharmacy_id,))
            return cur.fetchall()
        except Exception as e:
            print(f"PrescriptionModel.get_by_store error: {e}")
            return []
        finally:
            cur.close()
            conn.close()

    @staticmethod
    def get_dispensed_by_store(pharmacy_id):
        """Get Dispensed prescriptions for a specific store (history)."""
        conn = get_connection()
        cur = conn.cursor(dictionary=True)
        try:
            cur.execute("""
                SELECT
                    pr.prescription_id,
                    pr.patient_id,
                    pr.doctor_id,
                    pr.date_issued,
                    pr.dispensed_at,
                    pr.dispense_status,
                    p.name  AS patient_name,
                    p.contact AS patient_contact,
                    d.name  AS doctor_name
                FROM prescription pr
                LEFT JOIN patient p ON pr.patient_id  = p.patient_id
                LEFT JOIN doctor  d ON pr.doctor_id   = d.doctor_id
                WHERE pr.pharmacy_id = %s AND pr.dispense_status = 'Dispensed'
                ORDER BY pr.dispensed_at DESC
            """, (pharmacy_id,))
            return cur.fetchall()
        except Exception as e:
            print(f"PrescriptionModel.get_dispensed_by_store error: {e}")
            return []
        finally:
            cur.close()
            conn.close()

    @staticmethod
    def get_by_id(prescription_id):
        """Get single prescription header with related info."""
        conn = get_connection()
        cur = conn.cursor(dictionary=True)
        try:
            cur.execute("""
                SELECT
                    pr.*,
                    p.name  AS patient_name,
                    d.name  AS doctor_name,
                    ps.store_name AS pharmacy_name
                FROM prescription pr
                LEFT JOIN patient        p  ON pr.patient_id  = p.patient_id
                LEFT JOIN doctor         d  ON pr.doctor_id   = d.doctor_id
                LEFT JOIN pharmacy_store ps ON pr.pharmacy_id = ps.pharmacy_id
                WHERE pr.prescription_id = %s
            """, (prescription_id,))
            return cur.fetchone()
        except Exception as e:
            print(f"PrescriptionModel.get_by_id error: {e}")
            return None
        finally:
            cur.close()
            conn.close()

    @staticmethod
    def get_details(prescription_id):
        """Get medicine lines for a prescription."""
        conn = get_connection()
        cur = conn.cursor(dictionary=True)
        try:
            cur.execute("""
                SELECT
                    pd.*,
                    m.generic_name,
                    m.strength,
                    m.form
                FROM prescription_detail pd
                LEFT JOIN medicine m ON pd.medicine_id = m.medicine_id
                WHERE pd.prescription_id = %s
            """, (prescription_id,))
            return cur.fetchall()
        except Exception as e:
            print(f"PrescriptionModel.get_details error: {e}")
            return []
        finally:
            cur.close()
            conn.close()

    @staticmethod
    def get_by_appointment(appointment_id):
        """Get prescription with medicine details for a given appointment."""
        conn = get_connection()
        cur = conn.cursor(dictionary=True)
        try:
            cur.execute("""
                SELECT
                    pr.*,
                    pd.detail_id, pd.medicine_name, pd.dosage, pd.notes, pd.quantity, pd.item_source,
                    p.name   AS patient_name,
                    p.age    AS patient_age,
                    p.gender AS patient_gender,
                    d.name   AS doctor_name,
                    d.specialization AS doctor_specialization,
                    ps.store_name    AS pharmacy_name
                FROM prescription pr
                LEFT JOIN prescription_detail pd ON pr.prescription_id = pd.prescription_id
                LEFT JOIN patient        p  ON pr.patient_id  = p.patient_id
                LEFT JOIN doctor         d  ON pr.doctor_id   = d.doctor_id
                LEFT JOIN pharmacy_store ps ON pr.pharmacy_id = ps.pharmacy_id
                WHERE pr.appointment_id = %s
            """, (appointment_id,))
            return cur.fetchall()
        except Exception as e:
            print(f"PrescriptionModel.get_by_appointment error: {e}")
            return []
        finally:
            cur.close()
            conn.close()

    @staticmethod
    def get_by_patient(patient_id):
        """Get all prescriptions for a patient with pharmacy info."""
        conn = get_connection()
        cur = conn.cursor(dictionary=True)
        try:
            cur.execute("""
                SELECT
                    pr.*,
                    a.appointment_datetime,
                    ps.store_name AS pharmacy_name,
                    ps.address    AS pharmacy_address
                FROM prescription pr
                LEFT JOIN appointment  a  ON pr.appointment_id = a.appointment_id
                LEFT JOIN pharmacy_store ps ON pr.pharmacy_id = ps.pharmacy_id
                WHERE pr.patient_id = %s
                ORDER BY pr.date_issued DESC
            """, (patient_id,))
            return cur.fetchall()
        except Exception as e:
            print(f"PrescriptionModel.get_by_patient error: {e}")
            return []
        finally:
            cur.close()
            conn.close()

    @staticmethod
    def mark_dispensed(prescription_id, pharmacy_id):
        """Mark a prescription as dispensed (store-verified)."""
        conn = get_connection()
        cur = conn.cursor()
        try:
            cur.execute("""
                UPDATE prescription
                SET dispense_status = 'Dispensed',
                    dispensed_at    = NOW()
                WHERE prescription_id = %s
                  AND pharmacy_id     = %s
                  AND dispense_status = 'Sent'
            """, (prescription_id, pharmacy_id))
            conn.commit()
            return cur.rowcount > 0
        except Exception as e:
            print(f"PrescriptionModel.mark_dispensed error: {e}")
            return False
        finally:
            cur.close()
            conn.close()