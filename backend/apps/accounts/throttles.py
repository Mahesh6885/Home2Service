from rest_framework.throttling import AnonRateThrottle

class LoginRateThrottle(AnonRateThrottle):
    """
    Dedicated rate throttle for login attempts to prevent brute-force credential stuffing.
    Configured at 10 requests per minute per IP address.
    """
    scope = 'login'

    def get_cache_key(self, request, view):
        # Throttle by client IP
        ident = self.get_ident(request)
        return self.cache_format % {
            'scope': self.scope,
            'ident': ident
        }
