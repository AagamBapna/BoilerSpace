/**
 * Recalculate aggregated snack scores for a building.
 * cafeScore / vendingScore = percentage of positive reports (0-100).
 */
async function aggregateSnackReports(building) {
    const cafeReports = building.snackReports.filter(r => r.type === 'cafe');
    const vendingReports = building.snackReports.filter(r => r.type === 'vending');

    const cafePositive = cafeReports.filter(r => r.value === true).length;
    const vendingPositive = vendingReports.filter(r => r.value === true).length;

    building.cafeCount = cafeReports.length;
    building.vendingCount = vendingReports.length;
    building.cafeScore = cafeReports.length > 0
        ? Math.round((cafePositive / cafeReports.length) * 100)
        : 0;
    building.vendingScore = vendingReports.length > 0
        ? Math.round((vendingPositive / vendingReports.length) * 100)
        : 0;

    const allDates = building.snackReports.map(r => r.createdAt);
    building.lastSnackReportAt = allDates.length > 0
        ? new Date(Math.max(...allDates.map(d => d.getTime())))
        : null;

    await building.save();
}

module.exports = { aggregateSnackReports };
