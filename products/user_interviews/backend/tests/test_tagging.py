from django.test import SimpleTestCase

from parameterized import parameterized

from products.user_interviews.backend.models import UserInterviewTag
from products.user_interviews.backend.tagging import derive_auto_tags

_SHORT_RESPONSE = "AI: How was onboarding?\nUser: Fine, no complaints."
_LONG_RESPONSE = "AI: Tell me everything.\nUser: " + " ".join(["word"] * 1300)
_MEDIUM_RESPONSE = "AI: Walk me through your week.\nUser: " + " ".join(["word"] * 400)


class TestDeriveAutoTags(SimpleTestCase):
    @parameterized.expand(
        [
            ("empty transcript", "", [UserInterviewTag.ABANDONED]),
            ("ai only, no user turn", "AI: Hi there, are you free?\n", [UserInterviewTag.ABANDONED]),
            ("ai only multi line", "AI: Hi.\nAI: Still there?\n", [UserInterviewTag.ABANDONED]),
            ("blank user turn is not a real turn", "AI: Hello.\nUser:   \n", [UserInterviewTag.ABANDONED]),
            ("short response", _SHORT_RESPONSE, [UserInterviewTag.SHORT]),
            ("long response", _LONG_RESPONSE, [UserInterviewTag.LONG]),
            ("medium response gets no length tag", _MEDIUM_RESPONSE, []),
            (
                "lowercase speaker prefixes still parse",
                "ai: how are you?\nuser: pretty good thanks",
                [UserInterviewTag.SHORT],
            ),
        ]
    )
    def test_derive_auto_tags(self, _name: str, transcript: str, expected: list[str]):
        assert derive_auto_tags(transcript) == expected
