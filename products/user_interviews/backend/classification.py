import re

from .models import UserInterviewClassification

# A transcript at or below this many words (and with at least one user turn) is "short";
# at or above the long threshold it is "long". Between the two it gets no length classification.
SHORT_WORD_THRESHOLD = 120
LONG_WORD_THRESHOLD = 1200

_USER_TURN_RE = re.compile(
    r"(?:^|\n)\s*(?:User|Interviewee):\s+(.+?)(?=\n\s*(?:AI|Assistant|Interviewer|User|Interviewee):|$)",
    re.IGNORECASE | re.DOTALL,
)


def _user_turns(transcript: str) -> list[str]:
    return [t.strip() for t in _USER_TURN_RE.findall(transcript) if t.strip()]


def derive_auto_classifications(transcript: str) -> list[str]:
    """Derive the mechanical classifications for an interview transcript.

    `abandoned` when the interviewee never meaningfully spoke, otherwise `short` / `long`
    by total word count. `off-topic` is never auto-derived — it needs human judgement.
    """
    if not _user_turns(transcript):
        return [UserInterviewClassification.ABANDONED]

    word_count = len(transcript.split())
    if word_count >= LONG_WORD_THRESHOLD:
        return [UserInterviewClassification.LONG]
    if word_count <= SHORT_WORD_THRESHOLD:
        return [UserInterviewClassification.SHORT]
    return []
