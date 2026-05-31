from django.contrib.postgres.indexes import GinIndex
from django.contrib.postgres.operations import AddIndexConcurrently
from django.db import migrations


class Migration(migrations.Migration):
    # Concurrent index build so adding the GIN index doesn't take an ACCESS EXCLUSIVE lock
    # on the table. Requires a non-atomic migration.
    atomic = False

    dependencies = [
        ("user_interviews", "0006_userinterview_classifications"),
    ]

    operations = [
        AddIndexConcurrently(
            model_name="userinterview",
            index=GinIndex(fields=["classifications"], name="user_interview_classif_gin"),
        ),
    ]
