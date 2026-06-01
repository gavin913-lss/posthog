from unittest.mock import MagicMock, patch

from parameterized import parameterized

from posthog.temporal.subscriptions.ai_subscription.prompts import resolve_prompt

_P = "posthog.temporal.subscriptions.ai_subscription.prompts"


@patch(f"{_P}.is_cloud", return_value=False)
@patch(f"{_P}.get_prompt_by_name_from_cache", return_value={"prompt": "managed body"})
def test_resolve_prompt_uses_managed_prompt_when_present(_mock_cache: MagicMock, _cloud: MagicMock) -> None:
    assert resolve_prompt(MagicMock(), "ai-subscription-planner", "code default") == "managed body"


class TestResolvePromptFallback:
    @parameterized.expand(
        [
            ("missing", None),
            ("empty_string", {"prompt": ""}),
            ("whitespace_only", {"prompt": "   "}),
            ("non_string", {"prompt": 123}),
        ]
    )
    @patch(f"{_P}.is_cloud", return_value=False)
    @patch(f"{_P}.get_prompt_by_name_from_cache")
    def test_falls_back_to_default(self, _name: str, cached: object, mock_cache: MagicMock, _cloud: MagicMock) -> None:
        mock_cache.return_value = cached
        assert resolve_prompt(MagicMock(), "ai-subscription-planner", "code default") == "code default"

    @patch(f"{_P}.is_cloud", return_value=False)
    @patch(f"{_P}.get_prompt_by_name_from_cache", side_effect=RuntimeError("cache down"))
    def test_falls_back_on_lookup_error(self, _mock_cache: MagicMock, _cloud: MagicMock) -> None:
        assert resolve_prompt(MagicMock(), "ai-subscription-planner", "code default") == "code default"


@parameterized.expand(
    [
        ("managed", {"prompt": "managed body"}, "managed"),
        ("fallback", None, "fallback"),
    ]
)
@patch(f"{_P}.ph_scoped_capture")
@patch(f"{_P}.is_cloud", return_value=True)
@patch(f"{_P}.get_prompt_by_name_from_cache")
def test_resolve_prompt_captures_source_event_on_cloud(
    _name: str,
    cached: object,
    expected_source: str,
    mock_cache: MagicMock,
    _cloud: MagicMock,
    mock_scoped: MagicMock,
) -> None:
    mock_cache.return_value = cached
    capture = MagicMock()
    mock_scoped.return_value.__enter__.return_value = capture
    team = MagicMock()
    team.uuid = "team-uuid"
    team.id = 7

    resolve_prompt(team, "ai-subscription-synthesis", "code default")

    capture.assert_called_once()
    call = capture.call_args.kwargs
    assert call["event"] == "ai_subscription_prompt_resolved"
    assert call["distinct_id"] == "team-uuid"
    assert call["properties"] == {
        "feature": "ai_subscription",
        "prompt_name": "ai-subscription-synthesis",
        "source": expected_source,
        "team_id": 7,
        "$process_person_profile": False,
    }


@patch(f"{_P}.ph_scoped_capture")
@patch(f"{_P}.is_cloud", return_value=False)
@patch(f"{_P}.get_prompt_by_name_from_cache", return_value=None)
def test_resolve_prompt_does_not_capture_off_cloud(
    _mock_cache: MagicMock, _cloud: MagicMock, mock_scoped: MagicMock
) -> None:
    resolve_prompt(MagicMock(), "ai-subscription-planner", "code default")
    mock_scoped.assert_not_called()
