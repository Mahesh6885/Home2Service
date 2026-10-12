from django.core.management import call_command
from django.core.management.base import BaseCommand

class Command(BaseCommand):
    help = 'Alias for seed_service_catalog'

    def handle(self, *args, **options):
        call_command('seed_service_catalog', *args, **options)
