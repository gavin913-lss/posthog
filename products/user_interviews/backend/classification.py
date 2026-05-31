import re

from .models import UserInterviewClassification

# A transcript at or below this many words (and with at least one user turn) is "short";
# at or above the long threshold it is "long". Between the two it gets no length classification.
SHORT_WORD_THRESHOLD = 120
LONG_WORD_THRESHOLD = 1200

# Vapi voice-interview transcripts are newline-delimited `AI:` / `User:` turns. Keep the
# speaker vocabulary in sync with frontend/parseTranscript.ts (TURN_SPLIT_RE) — both sides
# parse the same Vapi format independently.
_USER_TURN_RE = re.compile(
    r"(?:^|\n)\s*(?:User|Interviewee):\s+(.+?)(?=\n\s*(?:AI|Assistant|Interviewer|User|Interviewee):|$)",
    re.IGNORECASE | re.DOTALL,
)
_AI_TURN_RE = re.compile(r"(?:^|\n)\s*(?:AI|Assistant|Interviewer):\s+", re.IGNORECASE)


def _user_turns(transcript: str) -> list[str]:
    return [t.strip() for t in _USER_TURN_RE.findall(transcript) if t.strip()]


def derive_auto_classifications(transcript: str) -> list[str]:
    """Derive the mechanical classifications for a Vapi voice-interview transcript.

    `abandoned` when the AI spoke but the interviewee never meaningfully did, otherwise
    `short` / `long` by total word count. `off-topic` is never auto-derived — it needs
    human judgement.

    Only the `AI:` / `User:` turn format (Vapi) is recognised. Transcripts in other formats
    (e.g. the audio-upload path's `#### Speaker N` headings) have no parseable turns, so we
    return no classifications rather than mislabel them `abandoned`.
    """
    if not _user_turns(transcript):
        # No interviewee turns. Only call it `abandoned` when the AI clearly spoke (a real
        # voice interview the interviewee dropped); an unrecognised format gets left untagged.
        return [UserInterviewClassification.ABANDONED] if _AI_TURN_RE.search(transcript) else []

    word_count = len(transcript.split())
    if word_count >= LONG_WORD_THRESHOLD:
        return [UserInterviewClassification.LONG]
    if word_count <= SHORT_WORD_THRESHOLD:
        return [UserInterviewClassification.SHORT]
    return []
