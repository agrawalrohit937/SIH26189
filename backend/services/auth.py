import hmac
import hashlib
import base64
import json
import time
from typing import Optional, Dict, Any
from fastapi import Header, HTTPException, status

SECRET_KEY = "sih26189_national_crime_intelligence_grid_secret_key"

# Demo seeded users with distinct RBAC roles
DEMO_USERS = {
    "investigator": {
        "username": "investigator",
        "password": "investigator123",
        "role": "Investigator",
        "full_name": "SI Rajesh Sharma (Investigating Officer)"
    },
    "supervisor": {
        "supervisor": "supervisor",
        "username": "supervisor",
        "password": "supervisor123",
        "role": "Supervisor",
        "full_name": "ACP Priya Nair (Supervising Officer)"
    },
    "admin": {
        "username": "admin",
        "password": "admin123",
        "role": "Admin",
        "full_name": "System Administrator (Command Lead)"
    }
}


def base64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("utf-8")


def base64url_decode(data: str) -> bytes:
    padding = "=" * (4 - (len(data) % 4)) if len(data) % 4 != 0 else ""
    return base64.urlsafe_b64decode(data + padding)


def create_access_token(username: str, role: str, expires_in_seconds: int = 86400) -> str:
    """Generates a signed, tamper-evident JWT-compatible token."""
    header = {"alg": "HS256", "typ": "JWT"}
    payload = {
        "sub": username,
        "role": role,
        "exp": int(time.time()) + expires_in_seconds,
        "iat": int(time.time())
    }
    
    header_b64 = base64url_encode(json.dumps(header).encode("utf-8"))
    payload_b64 = base64url_encode(json.dumps(payload).encode("utf-8"))
    signing_input = f"{header_b64}.{payload_b64}".encode("utf-8")
    
    signature = hmac.new(SECRET_KEY.encode("utf-8"), signing_input, hashlib.sha256).digest()
    signature_b64 = base64url_encode(signature)
    
    return f"{header_b64}.{payload_b64}.{signature_b64}"


def verify_token(token: str) -> Optional[Dict[str, Any]]:
    """Verifies HMAC signature and expiration of JWT token."""
    try:
        parts = token.split(".")
        if len(parts) != 3:
            return None
        header_b64, payload_b64, signature_b64 = parts
        signing_input = f"{header_b64}.{payload_b64}".encode("utf-8")
        
        expected_sig = hmac.new(SECRET_KEY.encode("utf-8"), signing_input, hashlib.sha256).digest()
        provided_sig = base64url_decode(signature_b64)
        
        if not hmac.compare_digest(expected_sig, provided_sig):
            return None
            
        payload = json.loads(base64url_decode(payload_b64).decode("utf-8"))
        if payload.get("exp") and time.time() > payload["exp"]:
            return None
            
        return payload
    except Exception:
        return None


def get_current_user(
    authorization: Optional[str] = Header(None),
    x_api_role: Optional[str] = Header(None)
) -> Dict[str, Any]:
    """
    FastAPI dependency extracting current user from Bearer JWT token or X-API-Role fallback.
    Default role for unauthenticated requests is Supervisor (for presentation ease).
    """
    if authorization and authorization.startswith("Bearer "):
        token = authorization[7:].strip()
        payload = verify_token(token)
        if payload:
            username = payload.get("sub", "investigator")
            role = payload.get("role", "Investigator")
            return {
                "username": username,
                "role": role,
                "actor": f"{role}: {username}"
            }
        else:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired authentication token."
            )
            
    # Support explicit header override for fast testing
    if x_api_role and x_api_role in ["Investigator", "Supervisor", "Admin"]:
        return {
            "username": x_api_role.lower(),
            "role": x_api_role,
            "actor": f"{x_api_role}: {x_api_role.lower()}"
        }

    # Default fallback role
    return {
        "username": "supervisor_default",
        "role": "Supervisor",
        "actor": "Supervisor: officer_nair"
    }


def require_admin(user: Dict[str, Any]) -> None:
    """Guards endpoints that require Admin role (e.g. database purge)."""
    if user.get("role") != "Admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access Denied: Administrative privileges required. Current role: '{user.get('role')}'."
        )


def mask_pii_if_investigator(val: str, role: str) -> str:
    """Masks phone and account numbers for Investigator role (showing only last 4 digits)."""
    if role in ["Supervisor", "Admin"]:
        return val
    if not val or len(val) < 5:
        return val
    return f"XXXX-XXXX-{val[-4:]}"
