from typing import Optional
from pymongo import MongoClient, ASCENDING
from pymongo.collection import Collection
from .config import get_mongodb_srv, get_mongodb_db_name
import certifi

_client: Optional[MongoClient] = None


def get_mongo_client() -> MongoClient:
    global _client
    if _client is not None:
        return _client
    srv = get_mongodb_srv()
    if not srv:
        raise RuntimeError("Missing MongoDB connection string. Set MONGODB_URL (preferred) or MONGODB_SRV.")
    # Use certifi CA bundle to avoid SSL certificate issues on some systems
    _client = MongoClient(srv, tlsCAFile=certifi.where())
    return _client


def get_db():
    client = get_mongo_client()
    db_name = get_mongodb_db_name()
    return client[db_name]


def get_users_collection() -> Collection:
    db = get_db()
    coll = db["users"]
    # Ensure unique index on email (used for login) and helpful index on name (non-unique)
    coll.create_index([("email", ASCENDING)], unique=True, background=True)
    coll.create_index([("name", ASCENDING)], unique=False, background=True)
    return coll


def get_user_preferences_collection() -> Collection:
    db = get_db()
    coll = db["user_preferences"]
    # One preferences document per email
    coll.create_index([("email", ASCENDING)], unique=True, background=True)
    return coll


