import { AppError } from "../errors/AppError.js";

export const MAX_GPS_ACCURACY_METERS = 100;
const EARTH_RADIUS_METERS = 6_371_000;

function requireFiniteNumber(value, fieldName) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
        throw new AppError(400, `${fieldName} must be a finite number.`);
    }

    return value;
}

export function validateLocationPayload({ latitude, longitude, accuracy } = {}) {
    const validatedLatitude = requireFiniteNumber(latitude, "latitude");
    const validatedLongitude = requireFiniteNumber(longitude, "longitude");
    const validatedAccuracy = requireFiniteNumber(accuracy, "accuracy");

    if (validatedLatitude < -90 || validatedLatitude > 90) {
        throw new AppError(400, "latitude must be between -90 and 90.");
    }

    if (validatedLongitude < -180 || validatedLongitude > 180) {
        throw new AppError(400, "longitude must be between -180 and 180.");
    }

    // A reading less accurate than 100 m is too imprecise for a 200 m visit radius.
    if (validatedAccuracy < 0 || validatedAccuracy > MAX_GPS_ACCURACY_METERS) {
        throw new AppError(400, `accuracy must be between 0 and ${MAX_GPS_ACCURACY_METERS} metres.`);
    }

    return {
        latitude: validatedLatitude,
        longitude: validatedLongitude,
        accuracy: validatedAccuracy,
    };
}

export function calculateHaversineDistanceMeters(latitudeA, longitudeA, latitudeB, longitudeB) {
    const toRadians = (degrees) => (degrees * Math.PI) / 180;
    const latitudeDelta = toRadians(latitudeB - latitudeA);
    const longitudeDelta = toRadians(longitudeB - longitudeA);
    const latitudeARadians = toRadians(latitudeA);
    const latitudeBRadians = toRadians(latitudeB);
    const haversine = Math.sin(latitudeDelta / 2) ** 2
        + Math.cos(latitudeARadians) * Math.cos(latitudeBRadians) * Math.sin(longitudeDelta / 2) ** 2;

    return 2 * EARTH_RADIUS_METERS * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}
