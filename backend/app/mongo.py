from typing import Optional
from pymongo import MongoClient, ASCENDING
from pymongo.collection import Collection
from pymongo.errors import OperationFailure, ServerSelectionTimeoutError, ConnectionFailure
from .config import get_mongodb_srv, get_mongodb_db_name
import certifi
import logging

logger = logging.getLogger(__name__)

_client: Optional[MongoClient] = None
_indexes_created = {
    "users": False,
    "user_preferences": False,
    "chat_sessions": False,
}


def get_mongo_client() -> MongoClient:
    global _client
    if _client is not None:
        return _client
    srv = get_mongodb_srv()
    if not srv:
        raise RuntimeError("Missing MongoDB connection string. Set MONGODB_URL (preferred) or MONGODB_SRV.")
    # Use certifi CA bundle to avoid SSL certificate issues on some systems
    # Add server selection timeout and connection timeout
    _client = MongoClient(
        srv,
        tlsCAFile=certifi.where(),
        serverSelectionTimeoutMS=5000,  # 5 second timeout
        connectTimeoutMS=5000,
        socketTimeoutMS=20000,
        retryWrites=True,
    )
    return _client


def get_db():
    client = get_mongo_client()
    db_name = get_mongodb_db_name()
    return client[db_name]


def _ensure_indexes_safely(coll: Collection, collection_name: str, indexes: list):
    """Safely create indexes, only once per collection, with error handling."""
    global _indexes_created
    if _indexes_created.get(collection_name, False):
        return
    
    try:
        for index_spec in indexes:
            coll.create_index(**index_spec)
        _indexes_created[collection_name] = True
    except (OperationFailure, ServerSelectionTimeoutError, ConnectionFailure) as e:
        # Log but don't fail - indexes might already exist or connection might be temporarily unavailable
        logger.warning(f"Could not create indexes for {collection_name}: {e}")
        # Don't mark as created so we'll try again next time
    except Exception as e:
        logger.error(f"Unexpected error creating indexes for {collection_name}: {e}")
        # Don't mark as created so we'll try again next time


def get_users_collection() -> Collection:
    db = get_db()
    coll = db["users"]
    # Ensure unique index on email (used for login) and helpful index on name (non-unique)
    # Only create indexes once, and handle connection errors gracefully
    _ensure_indexes_safely(coll, "users", [
        {"keys": [("email", ASCENDING)], "unique": True, "background": True},
        {"keys": [("name", ASCENDING)], "unique": False, "background": True},
    ])
    return coll


def get_user_preferences_collection() -> Collection:
    db = get_db()
    coll = db["user_preferences"]
    # One preferences document per email
    _ensure_indexes_safely(coll, "user_preferences", [
        {"keys": [("email", ASCENDING)], "unique": True, "background": True},
    ])
    return coll


def get_chat_sessions_collection() -> Collection:
    """
    Chat sessions collection storing lightweight session metadata for history:
    - email: user identifier (lowercased)
    - title: human-friendly title for the chat
    - birds: list of agent ids involved, e.g., ['polly', 'flynn']
    - created_at / updated_at
    """
    db = get_db()
    coll = db["chat_sessions"]
    # Useful indexes: query by user and sort by recency
    _ensure_indexes_safely(coll, "chat_sessions", [
        {"keys": [("email", ASCENDING), ("updated_at", ASCENDING)], "background": True},
    ])
    return coll


