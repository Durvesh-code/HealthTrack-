"""
📁 database/connection.py
Provides a connection-pooled MySQL connection for the entire project.
All models and controllers should import it as:
    from database.connection import get_connection
"""

from mysql.connector.pooling import MySQLConnectionPool
from mysql.connector import Error
from config import DB_CONFIG


# ──────────────────────────────────────────────────────────
#  Singleton connection pool — created once at import time
# ──────────────────────────────────────────────────────────
_pool = MySQLConnectionPool(
    pool_name="healthtrack_pool",
    pool_size=10,              # max concurrent connections (tune for your load)
    pool_reset_session=True,   # reset session vars when returned to pool
    host=DB_CONFIG.get("host"),
    user=DB_CONFIG.get("user"),
    password=DB_CONFIG.get("password"),
    database=DB_CONFIG.get("database"),
    port=DB_CONFIG.get("port", 3306),
    auth_plugin="mysql_native_password",
)


def get_connection():
    """
    Return a connection from the pool.
    The caller MUST call conn.close() when done — this returns the
    connection back to the pool (it does NOT destroy it).
    """
    try:
        conn = _pool.get_connection()
        if conn.is_connected():
            return conn
        raise ConnectionError("⚠️ Pooled connection is not connected.")
    except Error as err:
        print(f"❌ MySQL Pool Error: {err}")
        raise


# Alias for backward compatibility
get_db_connection = get_connection
