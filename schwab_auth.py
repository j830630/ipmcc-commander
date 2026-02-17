"""
Schwab Token Exchange - Interactive Version
Run this, then paste your code when prompted!
"""

import asyncio
import sys
import os

# Fix the path
backend_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'backend')
sys.path.insert(0, backend_path)
os.chdir(backend_path)

from app.services.schwab_service import schwab_service


async def exchange_token(code):
    try:
        await schwab_service.exchange_code_for_tokens(code)
        return True
    except Exception as e:
        print(f"\nERROR: {e}")
        return False


if __name__ == "__main__":
    print("=" * 50)
    print("Schwab Token Exchange")
    print("=" * 50)
    print(f"App Key: {'OK' if schwab_service.app_key else 'MISSING'}")
    print(f"App Secret: {'OK' if schwab_service.app_secret else 'MISSING'}")
    print()
    print("1. Open browser and get auth code")
    print("2. Paste the FULL URL or just the code below")
    print("3. Press Enter")
    print()
    
    raw_input = input("Paste here: ").strip()
    
    # Extract code from URL if full URL was pasted
    if "code=" in raw_input:
        # Extract between code= and &
        start = raw_input.find("code=") + 5
        end = raw_input.find("&", start)
        if end == -1:
            code = raw_input[start:]
        else:
            code = raw_input[start:end]
    else:
        code = raw_input
    
    # URL decode %40 to @
    code = code.replace("%40", "@")
    
    print(f"\nUsing code: {code[:50]}...")
    print("Exchanging...")
    
    success = asyncio.run(exchange_token(code))
    
    if success:
        print("\n" + "=" * 50)
        print("SUCCESS! Schwab authenticated!")
        print(f"Expires: {schwab_service.token_expires_at}")
        print("=" * 50)
    else:
        print("\nFailed - code may have expired. Try again!")