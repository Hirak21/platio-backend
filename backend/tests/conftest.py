import os
import sys
import tempfile
import shutil
import pytest


@pytest.fixture(scope="function")
def c():
    tmp = tempfile.mkdtemp()
    os.environ["PLATIO_DATA_DIR"] = tmp
    os.environ["PLATIO_NO_DEMO"] = "1"
    os.environ["PLATIO_SECRET"] = "test-secret"
    for m in list(sys.modules):
        if m in ("app", "db", "auth", "seed", "config", "calc", "finance", "audit", "models", "audit_routes") or m.startswith("routes"):
            del sys.modules[m]
    import app as appmod
    from fastapi.testclient import TestClient

    with TestClient(appmod.app) as c:
        yield c
    shutil.rmtree(tmp, ignore_errors=True)
