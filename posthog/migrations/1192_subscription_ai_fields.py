# Generated manually

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("posthog", "1191_delete_relationless_subscriptions")]

    operations = [
        migrations.AddField(
            model_name="subscription",
            name="prompt",
            field=models.TextField(blank=True, null=True),
        ),
    ]
