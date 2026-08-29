from backend import translate


def test_translate_returns_fallback_when_not_configured(monkeypatch):
    monkeypatch.setattr(translate, "TRANSLATION_API_URL", "")
    assert translate.translate_text("Hello") == "Hello"
    assert translate.translate_take_to_en("你好") == ""


def test_translate_uses_configured_endpoint(monkeypatch):
    monkeypatch.setattr(
        translate,
        "TRANSLATION_API_URL",
        "https://translator.example/translate",
    )
    monkeypatch.setattr(translate, "TRANSLATION_API_KEY", "test-key")

    class Response:
        def raise_for_status(self):
            return None

        def json(self):
            return {"translatedText": "你好"}

    def fake_post(url, json, timeout):
        assert url == "https://translator.example/translate"
        assert json["q"] == "Hello"
        assert json["api_key"] == "test-key"
        assert timeout == 30
        return Response()

    monkeypatch.setattr(translate.httpx, "post", fake_post)
    assert translate.translate_text("Hello") == "你好"
