"""Create the production env file locally on the server; never print credentials."""
import getpass
import os
from pathlib import Path
import re
from urllib.parse import quote


def main():
    destination = Path(__file__).resolve().parent / "app.env"
    if destination.exists():
        raise SystemExit("deploy/app.env already exists. Keep it, or edit it with nano.")
    network = input("Nginx Proxy Manager Docker network: ").strip()
    if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_.-]*", network):
        raise SystemExit("Enter the exact Docker network name from docker inspect.")
    password = getpass.getpass("MongoDB wishlist_app password (not the admin password): ")
    if not password:
        raise SystemExit("Password cannot be empty. Nothing was saved.")
    contents = (
        "MONGODB_URI=mongodb://wishlist_app:"
        + quote(password, safe="")
        + "@mongodb:27017/merry_little_wishes?authSource=merry_little_wishes\n"
        + "MONGODB_DB=merry_little_wishes\n"
        + "MONGODB_DOCKER_NETWORK=wishlist_default\n"
        + f"PROXY_DOCKER_NETWORK={network}\n"
        + "WISHLIST_PORT=3000\n"
        + "WISHLIST_IMAGE_TAG=v1\n"
    )
    descriptor = os.open(destination, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(descriptor, "w", encoding="utf-8", newline="\n") as output:
        output.write(contents)
    print("Created deploy/app.env with owner-only permissions. Credentials were not printed.")


if __name__ == "__main__":
    main()
