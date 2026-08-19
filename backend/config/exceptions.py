from rest_framework.views import exception_handler


def structured_exception_handler(exc, context):
    response = exception_handler(exc, context)
    if response is not None and "errors" not in response.data:
        response.data = {"errors": response.data}
    return response
