# models/inventory_model.py
# Store-wise inventory — queries pharmacy_inventory JOIN medicine
from database.connection import get_connection


class InventoryModel:

    @staticmethod
    def get_by_store(pharmacy_id):
        """Get all medicines stocked in a specific pharmacy store."""
        conn = get_connection()
        cur = conn.cursor(dictionary=True)
        try:
            cur.execute("""
                SELECT
                    pi.inventory_id,
                    pi.medicine_id,
                    m.medicine_name  AS name,
                    m.generic_name,
                    m.manufacturer,
                    m.strength,
                    m.form,
                    pi.stock_quantity,
                    pi.price_per_unit,
                    pi.expiry_date,
                    pi.batch_no,
                    pi.last_updated
                FROM pharmacy_inventory pi
                JOIN medicine m ON pi.medicine_id = m.medicine_id
                WHERE pi.pharmacy_id = %s
                ORDER BY m.medicine_name ASC
            """, (pharmacy_id,))
            return cur.fetchall()
        except Exception as e:
            print(f"InventoryModel.get_by_store error: {e}")
            return []
        finally:
            cur.close()
            conn.close()

    @staticmethod
    def search_by_store(pharmacy_id, query):
        """Search medicines in a specific store by name (for doctor autocomplete)."""
        conn = get_connection()
        cur = conn.cursor(dictionary=True)
        try:
            cur.execute("""
                SELECT
                    pi.inventory_id,
                    pi.medicine_id,
                    m.medicine_name  AS name,
                    m.generic_name,
                    m.strength,
                    m.form,
                    pi.stock_quantity,
                    pi.price_per_unit
                FROM pharmacy_inventory pi
                JOIN medicine m ON pi.medicine_id = m.medicine_id
                WHERE pi.pharmacy_id = %s
                  AND m.medicine_name LIKE %s
                ORDER BY m.medicine_name ASC
                LIMIT 20
            """, (pharmacy_id, f"%{query}%"))
            return cur.fetchall()
        except Exception as e:
            print(f"InventoryModel.search_by_store error: {e}")
            return []
        finally:
            cur.close()
            conn.close()

    @staticmethod
    def get_low_stock(pharmacy_id, threshold=10):
        """Get medicines with stock below threshold for a specific store."""
        conn = get_connection()
        cur = conn.cursor(dictionary=True)
        try:
            cur.execute("""
                SELECT
                    pi.inventory_id,
                    pi.medicine_id,
                    m.medicine_name AS name,
                    pi.stock_quantity,
                    pi.expiry_date
                FROM pharmacy_inventory pi
                JOIN medicine m ON pi.medicine_id = m.medicine_id
                WHERE pi.pharmacy_id = %s AND pi.stock_quantity < %s
                ORDER BY pi.stock_quantity ASC
            """, (pharmacy_id, threshold))
            return cur.fetchall()
        except Exception as e:
            print(f"InventoryModel.get_low_stock error: {e}")
            return []
        finally:
            cur.close()
            conn.close()

    @staticmethod
    def check_stock(medicine_name, pharmacy_id=None):
        """Check stock for a medicine. Scoped to store if pharmacy_id given."""
        conn = get_connection()
        cur = conn.cursor(dictionary=True)
        try:
            if pharmacy_id:
                cur.execute("""
                    SELECT
                        pi.inventory_id,
                        pi.medicine_id,
                        m.medicine_name AS name,
                        pi.stock_quantity,
                        pi.price_per_unit
                    FROM pharmacy_inventory pi
                    JOIN medicine m ON pi.medicine_id = m.medicine_id
                    WHERE pi.pharmacy_id = %s
                      AND m.medicine_name LIKE %s
                    LIMIT 1
                """, (pharmacy_id, f"%{medicine_name}%"))
            else:
                # Fallback: global search (used for backward-compat)
                cur.execute("""
                    SELECT
                        pi.inventory_id,
                        pi.medicine_id,
                        m.medicine_name AS name,
                        pi.stock_quantity,
                        pi.price_per_unit
                    FROM pharmacy_inventory pi
                    JOIN medicine m ON pi.medicine_id = m.medicine_id
                    WHERE m.medicine_name LIKE %s
                    LIMIT 1
                """, (f"%{medicine_name}%",))
            return cur.fetchone()
        except Exception as e:
            print(f"InventoryModel.check_stock error: {e}")
            return None
        finally:
            cur.close()
            conn.close()

    @staticmethod
    def decrease_store_stock(pharmacy_id, medicine_id, amount):
        """Decrease stock for a specific medicine in a specific store."""
        conn = get_connection()
        cur = conn.cursor()
        try:
            cur.execute("""
                UPDATE pharmacy_inventory
                SET stock_quantity = stock_quantity - %s
                WHERE pharmacy_id = %s
                  AND medicine_id = %s
                  AND stock_quantity >= %s
            """, (amount, pharmacy_id, medicine_id, amount))
            conn.commit()
            return cur.rowcount > 0
        except Exception as e:
            print(f"InventoryModel.decrease_store_stock error: {e}")
            return False
        finally:
            cur.close()
            conn.close()

    @staticmethod
    def decrease_stock_by_name(pharmacy_id, medicine_name, amount):
        """Decrease stock by medicine name within a store (for dispense fallback)."""
        conn = get_connection()
        cur = conn.cursor()
        try:
            cur.execute("""
                UPDATE pharmacy_inventory pi
                JOIN medicine m ON pi.medicine_id = m.medicine_id
                SET pi.stock_quantity = pi.stock_quantity - %s
                WHERE pi.pharmacy_id = %s
                  AND m.medicine_name LIKE %s
                  AND pi.stock_quantity >= %s
                LIMIT 1
            """, (amount, pharmacy_id, f"%{medicine_name}%", amount))
            conn.commit()
            return cur.rowcount > 0
        except Exception as e:
            print(f"InventoryModel.decrease_stock_by_name error: {e}")
            return False
        finally:
            cur.close()
            conn.close()

    @staticmethod
    def add_to_store(pharmacy_id, medicine_name, stock_quantity,
                     price_per_unit=None, expiry_date=None, batch_no=None):
        """Add or upsert a medicine into a specific pharmacy store's inventory.
        If medicine_name doesn't exist in master table, creates it first.
        """
        conn = get_connection()
        cur = conn.cursor()
        try:
            # 1. Find or create in medicine master
            cur.execute("SELECT medicine_id FROM medicine WHERE medicine_name = %s", (medicine_name,))
            row = cur.fetchone()
            if row:
                medicine_id = row[0]
            else:
                cur.execute(
                    "INSERT INTO medicine (medicine_name) VALUES (%s)",
                    (medicine_name,)
                )
                conn.commit()
                medicine_id = cur.lastrowid

            # 2. Insert / update store inventory
            cur.execute("""
                INSERT INTO pharmacy_inventory
                    (pharmacy_id, medicine_id, stock_quantity, price_per_unit, expiry_date, batch_no)
                VALUES (%s, %s, %s, %s, %s, %s)
                ON DUPLICATE KEY UPDATE
                    stock_quantity  = stock_quantity + VALUES(stock_quantity),
                    price_per_unit  = COALESCE(VALUES(price_per_unit), price_per_unit),
                    expiry_date     = COALESCE(VALUES(expiry_date), expiry_date)
            """, (pharmacy_id, medicine_id, stock_quantity, price_per_unit, expiry_date, batch_no))
            conn.commit()
            return cur.lastrowid or medicine_id
        except Exception as e:
            print(f"InventoryModel.add_to_store error: {e}")
            return None
        finally:
            cur.close()
            conn.close()

    @staticmethod
    def update_store_stock(pharmacy_id, inventory_id, additional_quantity):
        """Add more stock to an existing inventory row for a store."""
        conn = get_connection()
        cur = conn.cursor()
        try:
            cur.execute("""
                UPDATE pharmacy_inventory
                SET stock_quantity = stock_quantity + %s
                WHERE inventory_id = %s AND pharmacy_id = %s
            """, (additional_quantity, inventory_id, pharmacy_id))
            conn.commit()
            return cur.rowcount > 0
        except Exception as e:
            print(f"InventoryModel.update_store_stock error: {e}")
            return False
        finally:
            cur.close()
            conn.close()

    @staticmethod
    def remove_from_store(pharmacy_id, inventory_id):
        """Remove a medicine from a specific pharmacy store's inventory."""
        conn = get_connection()
        cur = conn.cursor()
        try:
            cur.execute(
                "DELETE FROM pharmacy_inventory WHERE inventory_id = %s AND pharmacy_id = %s",
                (inventory_id, pharmacy_id)
            )
            conn.commit()
            return cur.rowcount > 0
        except Exception as e:
            print(f"InventoryModel.remove_from_store error: {e}")
            return False
        finally:
            cur.close()
            conn.close()

    @staticmethod
    def get_by_id(inventory_id):
        """Get a single inventory record with medicine details."""
        conn = get_connection()
        cur = conn.cursor(dictionary=True)
        try:
            cur.execute("""
                SELECT pi.*, m.medicine_name AS name, m.generic_name, m.strength
                FROM pharmacy_inventory pi
                JOIN medicine m ON pi.medicine_id = m.medicine_id
                WHERE pi.inventory_id = %s
            """, (inventory_id,))
            return cur.fetchone()
        except Exception as e:
            print(f"InventoryModel.get_by_id error: {e}")
            return None
        finally:
            cur.close()
            conn.close()


