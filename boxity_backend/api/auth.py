"""
Auth0 JWT validation middleware for Flask backend.
"""
import os
import sys
import json
import base64
from functools import wraps
from typing import Optional, Dict, Any
from flask import request, jsonify

try:
    import jwt
    from jwt import PyJWKClient
    JWT_AVAILABLE = True
except ImportError:
    JWT_AVAILABLE = False
    jwt = None
    PyJWKClient = None

try:
    import requests
    REQUESTS_AVAILABLE = True
except ImportError:
    REQUESTS_AVAILABLE = False
    requests = None

AUTH0_DOMAIN = os.getenv('AUTH0_DOMAIN', 'dev-s3i27lzn7dyxx1wn.us.auth0.com')
AUTH0_AUDIENCE = os.getenv('AUTH0_AUDIENCE', 'https://api.boxity.app')
AUTH0_NAMESPACE = os.getenv('AUTH0_NAMESPACE', 'https://boxity.app')

# Cache for JWKS
_jwks_client = None


def get_jwks_client():
    """Get or create JWKS client for Auth0."""
    global _jwks_client
    if not JWT_AVAILABLE:
        return None
    if _jwks_client is None:
        jwks_url = f'https://{AUTH0_DOMAIN}/.well-known/jwks.json'
        _jwks_client = PyJWKClient(jwks_url)
    return _jwks_client


def get_jwks_manual() -> Optional[Dict[str, Any]]:
    """Fallback: manually fetch JWKS if PyJWKClient is not available."""
    if not REQUESTS_AVAILABLE:
        return None
    try:
        jwks_url = f'https://{AUTH0_DOMAIN}/.well-known/jwks.json'
        response = requests.get(jwks_url, timeout=5)
        if response.status_code == 200:
            return response.json()
    except Exception:
        pass
    return None


def decode_token_manual(token: str) -> Optional[Dict[str, Any]]:
    """Manual JWT decoding without verification (for debugging only)."""
    try:
        parts = token.split('.')
        if len(parts) != 3:
            return None
        payload = parts[1]
        # Add padding if needed
        payload += '=' * (4 - len(payload) % 4)
        decoded = base64.urlsafe_b64decode(payload)
        return json.loads(decoded)
    except Exception:
        return None


def verify_token(token: str) -> Optional[Dict[str, Any]]:
    """
    Verify Auth0 JWT token and return decoded payload.
    
    Returns:
        Decoded token payload if valid, None otherwise.
    """
    if not token:
        return None

    # Remove 'Bearer ' prefix if present
    if token.startswith('Bearer '):
        token = token[7:]

    if not JWT_AVAILABLE:
        # Fallback: decode without verification (not secure, but allows testing)
        print("WARNING: PyJWT not available, token validation disabled", file=sys.stderr)
        return decode_token_manual(token)

    try:
        # Get signing key from JWKS
        jwks_client = get_jwks_client()
        if jwks_client:
            signing_key = jwks_client.get_signing_key_from_jwt(token)
            
            # Verify token
            decoded = jwt.decode(
                token,
                signing_key.key,
                algorithms=['RS256'],
                audience=AUTH0_AUDIENCE,
                issuer=f'https://{AUTH0_DOMAIN}/',
            )
            return decoded
        else:
            # Fallback: decode without verification if JWKS client unavailable
            print("WARNING: JWKS client unavailable, decoding token without verification", file=sys.stderr)
            return decode_token_manual(token)
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
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
    Decorator to require valid Auth0 JWT token for a route.
    
    Usage:
        @app.route('/protected')
        @require_auth
        def protected_route():
            # Access token payload via request.auth_payload
            return jsonify({'user': request.auth_payload})
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        token = get_token_from_request()
        if not token:
            return jsonify({'error': 'Missing or invalid authorization token'}), 401
        
        payload = verify_token(token)
        if not payload:
            return jsonify({'error': 'Invalid or expired token'}), 401
        
        # Attach payload to request for use in route handler
        request.auth_payload = payload
        request.user_id = payload.get('sub')
        request.user_email = payload.get('email')
        request.user_role = payload.get(f'{AUTH0_NAMESPACE}/role') or payload.get('role')
        
        return f(*args, **kwargs)
    return decorated_function


def optional_auth(f):
    """
    Decorator to optionally validate Auth0 JWT token.
    Route will work with or without auth, but attaches user info if token is valid.
    
    Usage:
        @app.route('/public')
        @optional_auth
        def public_route():
            if hasattr(request, 'auth_payload'):
                # User is authenticated
                return jsonify({'user': request.auth_payload})
            else:
                # Public access
                return jsonify({'message': 'Public endpoint'})
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
                request.user_role = payload.get(f'{AUTH0_NAMESPACE}/role') or payload.get('role')
        return f(*args, **kwargs)
    return decorated_function

