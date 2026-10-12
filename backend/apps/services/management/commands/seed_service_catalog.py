from django.core.management.base import BaseCommand
from apps.services.models import ServiceCategory, Service

INITIAL_CATALOG = [
    {
        "category": "Plumbing",
        "slug": "plumbing",
        "icon": "wrench",
        "description": "Expert water piping, leakage repairs, and sanitary fitting services across Coimbatore.",
        "services": [
            {
                "name": "Tap and faucet repair",
                "slug": "tap-and-faucet-repair",
                "description": "Repair, washer replacement, and leak stoppage for kitchen and bathroom faucets."
            },
            {
                "name": "Pipe leakage repair",
                "slug": "pipe-leakage-repair",
                "description": "Concealed and external PVC/CPVC pipeline leak detection, joint replacement, and sealing."
            },
            {
                "name": "Bathroom plumbing",
                "slug": "bathroom-plumbing",
                "description": "Shower, western commode, wash basin, flush tank fitting, and drainage clearance."
            },
            {
                "name": "Water tank and pipe maintenance",
                "slug": "water-tank-and-pipe-maintenance",
                "description": "Overhead tank inlet/outlet valve maintenance, pressure check, and motor connection piping."
            }
        ]
    },
    {
        "category": "Electrical",
        "slug": "electrical",
        "icon": "zap",
        "description": "Certified domestic and commercial electrical repairs, installation, and safety checks.",
        "services": [
            {
                "name": "Switch and socket repair",
                "slug": "switch-and-socket-repair",
                "description": "Modular switchboard replacement, burnt socket repair, and fuse/MCB diagnostic fix."
            },
            {
                "name": "Fan installation and repair",
                "slug": "fan-installation-and-repair",
                "description": "Ceiling fan installation, capacitor replacement, motor rewiring, and regulator fitting."
            },
            {
                "name": "Lighting installation",
                "slug": "lighting-installation",
                "description": "LED panel lights, decorative lighting, spotlights, and tube fixture installation."
            },
            {
                "name": "Basic electrical troubleshooting",
                "slug": "basic-electrical-troubleshooting",
                "description": "Short circuit diagnostics, earthing inspection, and phase imbalance troubleshooting."
            }
        ]
    },
    {
        "category": "Vehicle mechanics",
        "slug": "vehicle-mechanics",
        "icon": "truck",
        "description": "Doorstep breakdown assistance and periodic maintenance for two-wheelers and four-wheelers.",
        "services": [
            {
                "name": "Two-wheeler repair",
                "slug": "two-wheeler-repair",
                "description": "Motorcycle and scooter general service, brake pad replacement, and carburetor cleaning."
            },
            {
                "name": "Car mechanic service",
                "slug": "car-mechanic-service",
                "description": "Periodic inspection, engine oil change, coolant top-up, and mechanical fault fixing."
            },
            {
                "name": "Battery assistance",
                "slug": "battery-assistance",
                "description": "Doorstep jump start, terminal corrosion cleaning, and battery health diagnostics."
            },
            {
                "name": "Basic vehicle inspection",
                "slug": "basic-vehicle-inspection",
                "description": "Pre-travel safety inspection, fluid check, tyre wear analysis, and electrical function test."
            }
        ]
    },
    {
        "category": "Appliance repair",
        "slug": "appliance-repair",
        "icon": "cpu",
        "description": "Specialized diagnosis and component-level repair for household electronic appliances.",
        "services": [
            {
                "name": "Washing machine repair",
                "slug": "washing-machine-repair",
                "description": "Front-load and top-load drum diagnostics, drainage motor fix, and vibration repair."
            },
            {
                "name": "Refrigerator repair",
                "slug": "refrigerator-repair",
                "description": "Cooling issues, compressor diagnostics, thermostat change, and defrosting fixes."
            },
            {
                "name": "Air conditioner servicing",
                "slug": "air-conditioner-servicing",
                "description": "Filter jet wash, cooling coil inspection, gas pressure check, and indoor/outdoor unit fix."
            },
            {
                "name": "Water purifier servicing",
                "slug": "water-purifier-servicing",
                "description": "RO membrane replacement, carbon/sediment filter renewal, and TDS calibration."
            }
        ]
    },
    {
        "category": "Home services",
        "slug": "home-services",
        "icon": "home",
        "description": "General home improvement, deep hygiene cleaning, carpentry, and aesthetic painting.",
        "services": [
            {
                "name": "House cleaning",
                "slug": "house-cleaning",
                "description": "Complete floor scrubbing, kitchen chimney degreasing, bathroom descaling, and dusting."
            },
            {
                "name": "Carpentry",
                "slug": "carpentry",
                "description": "Door lock repairs, hinge alignment, custom wooden shelf fixing, and furniture assembly."
            },
            {
                "name": "Painting",
                "slug": "painting",
                "description": "Interior touch-ups, wall putty preparation, waterproof primer application, and repainting."
            }
        ]
    }
]

class Command(BaseCommand):
    help = 'Seeds initial Coimbatore service categories and specific service offerings idempotently.'

    def handle(self, *args, **options):
        categories_created = 0
        categories_updated = 0
        services_created = 0
        services_updated = 0

        for cat_data in INITIAL_CATALOG:
            category, created = ServiceCategory.objects.get_or_create(
                slug=cat_data["slug"],
                defaults={
                    "name": cat_data["category"],
                    "icon": cat_data["icon"],
                    "description": cat_data["description"],
                    "is_active": True,
                }
            )
            if created:
                categories_created += 1
            else:
                categories_updated += 1

            for s_data in cat_data["services"]:
                service, s_created = Service.objects.get_or_create(
                    category=category,
                    slug=s_data["slug"],
                    defaults={
                        "name": s_data["name"],
                        "description": s_data["description"],
                        "is_active": True,
                    }
                )
                if s_created:
                    services_created += 1
                else:
                    services_updated += 1

        self.stdout.write(self.style.SUCCESS(
            f"Successfully processed catalog:\n"
            f"  Categories: {categories_created} created, {categories_updated} preserved\n"
            f"  Services:   {services_created} created, {services_updated} preserved"
        ))
