import os
import httpx
from datetime import datetime, timedelta

# These will be injected via your k8s deployment later
HEADSCALE_API_URL = os.getenv("HEADSCALE_API_URL", "http://headscale.headscale.svc.cluster.local:8080/api/v1")
HEADSCALE_API_KEY = os.getenv("HEADSCALE_API_KEY", "")

def get_headers():
    return {
        "Authorization": f"Bearer {HEADSCALE_API_KEY}",
        "Content-Type": "application/json"
    }

async def get_nodes():
    async with httpx.AsyncClient() as client:
        response = await client.get(f"{HEADSCALE_API_URL}/node", headers=get_headers())
        response.raise_for_status()
        return response.json()

async def get_user_id(username: str) -> int:
    """Helper function to fetch the numeric ID of a Headscale user by their string name."""
    async with httpx.AsyncClient() as client:
        # Fetch all users from Headscale
        response = await client.get(f"{HEADSCALE_API_URL}/user", headers=get_headers())
        response.raise_for_status()
        
        # Search for our specific user and grab their integer ID
        users = response.json().get("users", [])
        for u in users:
            if u.get("name") == username:
                return int(u.get("id"))
                
        raise Exception(f"User '{username}' not found in Headscale database.")

async def create_preauth_key(user: str, expiration_hours: int = 24):
    # 1. Convert the string username ("myvpn") into the numeric ID
    user_id = await get_user_id(user)
    
    expiry_time = datetime.utcnow() + timedelta(hours=expiration_hours)
    formatted_time = expiry_time.isoformat() + "Z"

    payload = {
        "user": user_id,  # <--- THE FIX: Send the integer ID, not the string!
        "reusable": False,
        "ephemeral": False,
        "expiration": formatted_time
    }

    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{HEADSCALE_API_URL}/preauthkey", 
            headers=get_headers(), 
            json=payload
        )
        response.raise_for_status()
        return response.json()