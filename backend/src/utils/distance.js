function haversineDistance(lat1, lon1, lat2, lon2) {
    const earthRadius = 3958.8;
    const latDistance = (lat2 - lat1) * Math.PI / 180;
    const lonDistance = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(latDistance / 2) ** 2 +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(lonDistance / 2) ** 2;
    return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
module.exports = { haversineDistance };