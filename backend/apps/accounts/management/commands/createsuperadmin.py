from django.core.management.base import BaseCommand
from apps.accounts.models import User, UserRole

class Command(BaseCommand):
    help = 'Create a secure Administrator user with role=ADMIN and superuser permissions'

    def add_arguments(self, parser):
        parser.add_argument('--username', type=str, help='Admin username')
        parser.add_argument('--email', type=str, help='Admin email address')
        parser.add_argument('--password', type=str, help='Admin password')

    def handle(self, *args, **options):
        username = options.get('username') or 'admin'
        email = options.get('email') or 'admin@multiwork.local'
        password = options.get('password') or 'Admin@12345'

        if User.objects.filter(username=username).exists():
            self.stdout.write(self.style.WARNING(f"User '{username}' already exists. Updating permissions..."))
            user = User.objects.get(username=username)
            user.role = UserRole.ADMIN
            user.is_staff = True
            user.is_superuser = True
            user.set_password(password)
            user.save()
            self.stdout.write(self.style.SUCCESS(f"User '{username}' updated to Administrator role successfully."))
            return

        user = User.objects.create_superuser(
            username=username,
            email=email,
            password=password,
            role=UserRole.ADMIN
        )
        self.stdout.write(self.style.SUCCESS(f"Administrator '{username}' created successfully with role=ADMIN."))
