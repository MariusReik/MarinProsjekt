package no.marinplattform.api.error;

/** Thrown for query params that are individually valid but semantically wrong (e.g. from > to). */
public class InvalidQueryException extends RuntimeException {

    public InvalidQueryException(String message) {
        super(message);
    }
}
