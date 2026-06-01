from posthog.models.user import User

from .models import CodeInviteRedemption


def is_posthog_code_user(user: User) -> bool:
    """A user is a PostHog Code user iff they have redeemed an invite code."""
    if not user or not user.is_authenticated:
        return False
    return CodeInviteRedemption.objects.filter(user=user).exists()
