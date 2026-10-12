from django.core.management.base import BaseCommand
from apps.bookings.services.dispatch import expire_stale_offers

class Command(BaseCommand):
    help = 'Sweeps expired worker offers and updates booking state if timeout exceeded.'

    def handle(self, *args, **options):
        count = expire_stale_offers()
        self.stdout.write(self.style.SUCCESS(f"Successfully processed and expired {count} overdue offers."))
