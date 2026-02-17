"""
Supabase Auth JWT validation for Flask backend.
"""
import os
import sys
import json
from functools import wraps
from typing import Optional, Dict, Any
from flask import request, jsonify
import requests

# Configuration
SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_KEY')

# Fallback to Auth0 variables if needed, or remove them
# AUTH0_DOMAIN = os.getenv('AUTH0_DOMAIN') 

def verify_token(token: str) -> Optional[Dict[str, Any]]:
    """
    Verify Supabase JWT token by calling Supabase Auth API.
    
    Returns:
        Decoded token payload (user info) if valid, None otherwise.
    """
    if not token:
        return None

    # Remove 'Bearer ' prefix if present
    if token.startswith('Bearer '):
        token = token[7:]

    if not SUPABASE_URL or not SUPABASE_KEY:
        print("ERROR: SUPABASE_URL or SUPABASE_KEY not set in environment", file=sys.stderr)
        return None

    try:
        # Verify token by fetching user profile from Supabase
        # This acts as a session validation
        response = requests.get(
            f"{SUPABASE_URL}/auth/v1/user",
            headers={
                "Authorization": f"Bearer {token}",
                "ApiKey": SUPABASE_KEY,
            },
            timeout=5
        )

        if response.status_code == 200:
            user_data = response.json()
            # Map Supabase user structure to a flat payload for potential backward compatibility
            # Supabase returns: { "id": "...", "aud": "authenticated", "role": "authenticated", "email": "...", ... }
            return {
                "sub": user_data.get("id"),
                "email": user_data.get("email"),
                "role": user_data.get("role"),
                "aud": user_data.get("aud"),
                "exp": float('inf'), # Session is valid now
                "data": user_data
            }
        else:
            print(f"Supabase auth check failed: {response.status_code} {response.text}", file=sys.stderr)
            return None

    except Exception as e:
        print(f"Token verification error: {e}", file=sys.stderr)
        return None


def get_token_from_request() -> Optional[str]:
    """Extract JWT token from request headers."""
    auth_header = request.headers.get('Authorization')
    if auth_header and auth_header.startswith('Bearer '):
        return auth_header[7:]
    return None


def require_auth(f):
    """
    Decorator to require valid Supabase JWT token for a route.
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        token = get_token_from_request()
        if not token:
            return jsonify({'error': 'Missing or invalid authorization token'}), 401
        
        payload = verify_token(token)
        if not payload:
            return jsonify({'error': 'Invalid or expired token'}), 401
        
        # Attach payload to request
        request.auth_payload = payload
        request.user_id = payload.get('sub')
        request.user_email = payload.get('email')
        request.user_role = payload.get('role')
        request.current_user = payload.get('data') # Full Supabase user object
        
        return f(*args, **kwargs)
    return decorated_function


def optional_auth(f):
    """
    Decorator to optionally validate Supabase JWT token.
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        token = get_token_from_request()
        if token:
            payload = verify_token(token)
            if payload:
                request.auth_payload = payload
                request.user_id = payload.get('sub')
                request.user_email = payload.get('email')
                request.user_role = payload.get('role')
                request.current_user = payload.get('data')
        return f(*args, **kwargs)
    return decorated_function

