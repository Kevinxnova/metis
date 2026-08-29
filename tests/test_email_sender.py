from backend.email.sender import compose_email


def test_compose_email_escapes_user_controlled_html():
    issue = {
        "issue_number": 1,
        "title": "<b>Unsafe</b>",
        "tools": [
            {
                "title": "<script>alert(1)</script>",
                "url": "javascript:alert(1)",
                "take": "<img src=x onerror=alert(1)>",
            }
        ],
    }

    subject, body = compose_email(issue)

    assert subject == "<b>Unsafe</b>"
    assert "<script>" not in body
    assert "<img" not in body
    assert 'href="#"' in body
    assert "&lt;b&gt;Unsafe&lt;/b&gt;" in body
