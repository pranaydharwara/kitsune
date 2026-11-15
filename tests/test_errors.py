from core.context.errors import ErrorCollector, get_collector, clear_collector


def test_error_collector_initially_empty():
    ec = ErrorCollector()
    assert not ec.has_errors()
    assert ec.get_recent() == []


def test_record_tool_error():
    ec = ErrorCollector()
    ec.record_tool_error("read_file", {"path": "/foo"}, "File not found")
    assert ec.has_errors()
    recent = ec.get_recent()
    assert len(recent) == 1
    assert "read_file" in recent[0]


def test_record_command_error():
    ec = ErrorCollector()
    ec.record_command_error("ls /nonexistent", 2, "No such file or directory")
    assert ec.has_errors()
    recent = ec.get_recent()
    assert len(recent) == 1
    assert "ls" in recent[0]


def test_get_recent_limits():
    ec = ErrorCollector()
    for i in range(10):
        ec.record_tool_error("tool", {}, f"error {i}")
    assert len(ec.get_recent(5)) == 5
    assert len(ec.get_recent(3)) == 3


def test_clear():
    ec = ErrorCollector()
    ec.record_tool_error("tool", {}, "err")
    ec.clear()
    assert not ec.has_errors()
    assert ec.get_recent() == []


def test_get_collector():
    c1 = get_collector("conv-1")
    c2 = get_collector("conv-1")
    assert c1 is c2


def test_get_collector_different_ids():
    c1 = get_collector("conv-a")
    c2 = get_collector("conv-b")
    assert c1 is not c2


def test_clear_collector():
    c = get_collector("conv-clear")
    c.record_tool_error("t", {}, "e")
    clear_collector("conv-clear")
    c2 = get_collector("conv-clear")
    assert not c2.has_errors()
