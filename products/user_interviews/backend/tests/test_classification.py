from django.test import SimpleTestCase

from parameterized import parameterized

from products.user_interviews.backend.classification import derive_auto_classifications
from products.user_interviews.backend.models import UserInterviewClassification

_SHORT_RESPONSE = "AI: How was onboarding?\nUser: Fine, no complaints."
_LONG_RESPONSE = "AI: Tell me everything.\nUser: " + " ".join(["word"] * 1300)
_MEDIUM_RESPONSE = "AI: Walk me through your week.\nUser: " + " ".join(["word"] * 400)


class TestDeriveAutoClassifications(SimpleTestCase):
    @parameterized.expand(
        [
            ("empty transcript", "", [UserInterviewClassification.ABANDONED]),
            ("ai only, no user turn", "AI: Hi there, are you free?\n", [UserInterviewClassification.ABANDONED]),
            ("ai only multi line", "AI: Hi.\nAI: Still there?\n", [UserInterviewClassification.ABANDONED]),
            ("blank user turn is not a real turn", "AI: Hello.\nUser:   \n", [UserInterviewClassification.ABANDONED]),
            ("short response", _SHORT_RESPONSE, [UserInterviewClassification.SHORT]),
            ("long response", _LONG_RESPONSE, [UserInterviewClassification.LONG]),
            ("medium response gets no length classification", _MEDIUM_RESPONSE, []),
            (
                "lowercase speaker prefixes still parse",
                "ai: how are you?\nuser: pretty good thanks",
                [UserInterviewClassification.SHORT],
            ),
        ]
    )
    def test_derive_auto_classifications(self, _name: str, transcript: str, expected: list[str]):
        assert derive_auto_classifications(transcript) == expected
