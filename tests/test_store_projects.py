import pytest
from core.store.projects import (
    create_project,
    list_projects,
    get_project,
    update_project,
    delete_project,
    _derive_name,
)


def test_derive_name():
    assert _derive_name("/Users/user/projects/my-app") == "my-app"
    assert _derive_name("/home/user/code/api-server") == "api-server"
    assert _derive_name("/tmp") == "tmp"


def test_derive_name_trailing_slash():
    assert _derive_name("/Users/user/projects/my-app/") == "my-app"


@pytest.mark.asyncio
async def test_create_project(db):
    proj = await create_project(db, path="/tmp/test-project")
    assert proj["id"]
    assert proj["path"] == "/tmp/test-project"
    assert proj["name"] == "test-project"


@pytest.mark.asyncio
async def test_create_project_with_name(db):
    proj = await create_project(db, path="/tmp/proj", name="Custom Name")
    assert proj["name"] == "Custom Name"


@pytest.mark.asyncio
async def test_list_projects(db):
    await create_project(db, path="/tmp/p1")
    await create_project(db, path="/tmp/p2")
    projs = await list_projects(db)
    assert len(projs) >= 2


@pytest.mark.asyncio
async def test_get_project(db):
    proj = await create_project(db, path="/tmp/findme")
    found = await get_project(db, proj["id"])
    assert found is not None
    assert found["path"] == "/tmp/findme"


@pytest.mark.asyncio
async def test_get_project_not_found(db):
    found = await get_project(db, "nonexistent")
    assert found is None


@pytest.mark.asyncio
async def test_update_project(db):
    proj = await create_project(db, path="/tmp/updatable")
    await update_project(db, proj["id"], name="New Name")
    found = await get_project(db, proj["id"])
    assert found["name"] == "New Name"


@pytest.mark.asyncio
async def test_delete_project(db):
    proj = await create_project(db, path="/tmp/deletable")
    await delete_project(db, proj["id"])
    found = await get_project(db, proj["id"])
    assert found is None
