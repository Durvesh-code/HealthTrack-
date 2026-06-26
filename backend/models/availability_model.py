# models/availability_model.py
from database.connection import get_connection

class AvailabilityModel:

    @staticmethod
    def get_by_doctor(doctor_id):
        conn = get_connection()
        cur = conn.cursor(dictionary=True)
        try:
            cur.execute("""
                SELECT availability_id, doctor_id, day_of_week, 
                       DATE_FORMAT(start_time, '%H:%i') AS start_time,
                       DATE_FORMAT(end_time, '%H:%i') AS end_time
                FROM doctor_availability
                WHERE doctor_id = %s
                ORDER BY FIELD(day_of_week, 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'), start_time ASC
            """, (doctor_id,))
            return cur.fetchall()
        except Exception as e:
            print(f"AvailabilityModel.get_by_doctor error: {e}")
            return []
        finally:
            cur.close()
            conn.close()

    @staticmethod
    def add(doctor_id, day_of_week, start_time, end_time):
        conn = get_connection()
        cur = conn.cursor()
        try:
            cur.execute("""
                INSERT INTO doctor_availability (doctor_id, day_of_week, start_time, end_time)
                VALUES (%s, %s, %s, %s)
            """, (doctor_id, day_of_week, start_time, end_time))
            conn.commit()
            return cur.lastrowid
        except Exception as e:
            print(f"AvailabilityModel.add error: {e}")
            return None
        finally:
            cur.close()
            conn.close()

    @staticmethod
    def delete(availability_id, doctor_id):
        conn = get_connection()
        cur = conn.cursor()
        try:
            cur.execute("""
                DELETE FROM doctor_availability
                WHERE availability_id = %s AND doctor_id = %s
            """, (availability_id, doctor_id))
            conn.commit()
            return cur.rowcount > 0
        except Exception as e:
            print(f"AvailabilityModel.delete error: {e}")
            return False
        finally:
            cur.close()
            conn.close()

    @staticmethod
    def check_availability(doctor_id, day_of_week, time_val):
        """
        Check if the doctor is available on a day_of_week at time_val.
        time_val should be a string in 'HH:MM' or 'HH:MM:SS' format.
        """
        conn = get_connection()
        cur = conn.cursor(dictionary=True)
        try:
            # We check if time_val falls BETWEEN start_time and end_time (inclusive)
            cur.execute("""
                SELECT * FROM doctor_availability
                WHERE doctor_id = %s
                  AND day_of_week = %s
                  AND %s >= start_time AND %s <= end_time
            """, (doctor_id, day_of_week, time_val, time_val))
            row = cur.fetchone()
            return row is not None
        except Exception as e:
            print(f"AvailabilityModel.check_availability error: {e}")
            return False
        finally:
            cur.close()
            conn.close()
