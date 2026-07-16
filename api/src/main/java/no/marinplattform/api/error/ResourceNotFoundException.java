package no.marinplattform.api.error;

/** Thrown when a path resource (e.g. a locality by number) does not exist. */
public class ResourceNotFoundException extends RuntimeException {

    public ResourceNotFoundException(String message) {
        super(message);
    }
}
