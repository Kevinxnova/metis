from backend.security import bearer_matches, secret_is_configured, secret_matches


def test_secret_matching_fails_closed_when_missing(monkeypatch):
    monkeypatch.delenv("ADMIN_PASSWORD", raising=False)
    assert not secret_is_configured("ADMIN_PASSWORD")
    assert not secret_matches("", "ADMIN_PASSWORD")
    assert not secret_matches("anything", "ADMIN_PASSWORD")


def test_secret_matching_accepts_only_exact_value(monkeypatch):
    monkeypatch.setenv("ADMIN_PASSWORD", "a-long-admin-password")
    assert secret_is_configured("ADMIN_PASSWORD")
    assert secret_matches("a-long-admin-password", "ADMIN_PASSWORD")
    assert not secret_matches("wrong", "ADMIN_PASSWORD")


def test_bearer_matching_fails_closed_when_missing(monkeypatch):
    monkeypatch.delenv("CRON_SECRET", raising=False)
    assert not bearer_matches(None)
    assert not bearer_matches("Bearer anything")


def test_bearer_matching_accepts_only_exact_header(monkeypatch):
    monkeypatch.setenv("CRON_SECRET", "a-long-cron-secret")
    assert bearer_matches("Bearer a-long-cron-secret")
    assert not bearer_matches("a-long-cron-secret")
    assert not bearer_matches("Bearer wrong")
