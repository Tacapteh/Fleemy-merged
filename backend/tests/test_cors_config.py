import pytest

import backend.server as server_module


@pytest.mark.parametrize(
    "env_value, expected_first",
    [
        ("", server_module.DEFAULT_ALLOWED_ORIGINS[0]),
        ("https://custom.example", "https://custom.example"),
        (
            "https://custom.example, https://fleemy.vercel.app",
            "https://custom.example",
        ),
    ],
)
def test_parse_allowed_origins_includes_defaults(monkeypatch, env_value, expected_first):
    monkeypatch.setenv("CORS_ORIGINS", env_value)
    origins = server_module._parse_allowed_origins()

    # All defaults should always be present exactly once
    for default in server_module.DEFAULT_ALLOWED_ORIGINS:
        assert origins.count(default) == 1

    # Custom entries should be preserved and placed before defaults when provided
    if env_value:
        for custom in [value.strip() for value in env_value.split(",") if value.strip()]:
            assert origins.count(custom) == 1
    assert origins[0] == expected_first


def test_preview_environment_origin_allowed():
    preview_origin = "https://money-manager-1265.preview.emergentagent.com"
    assert server_module._is_origin_allowed(preview_origin)


def test_unrelated_origin_still_blocked():
    assert not server_module._is_origin_allowed("https://example.preview.other.com")
