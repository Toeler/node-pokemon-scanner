const _ = require('lodash');
const when = require('when');
const config = require('config');
const LatLon = require('./LatLon');

function getNewCoordinates(location, distance, bearing) {
	const radius = 6378.1;
	bearing = Math.radians(bearing);
	
	const coordinates = new LatLon(Math.radians(location.latitude), Math.radians(location.longitude));
	
	const newLat = Math.asin(
		Math.sin(coordinates.lat)*Math.cos(distance/radius) +
		Math.cos(coordinates.lat)*Math.sin(distance/radius)*Math.cos(bearing)
	);
	
	const newLon = coordinates.lon + Math.atan2(
		Math.sin(bearing)*Math.sin(distance/radius)*Math.cos(coordinates.lat),
		Math.cos(distance/radius) - Math.sin(coordinates.lat)*Math.sin(newLat)
	);
	
	return new LatLon(Math.degrees(newLat), Math.degrees(newLon));
}

function generateSearchLocations(initialLocation, steps) {
	const NORTH = 0, EAST = 90, SOUTH = 180, WEST = 270;
	const radius = config.get('scanRadius'); // km that the heartbeat scans
	const xDist = Math.sqrt(3)*radius;
	const yDist = 3*(radius/2);

	const locations = [new LatLon(initialLocation.lat, initialLocation.lon, 0)];

	let ring = 1;
	let location = initialLocation;
	while (ring < steps) {
		location = getNewCoordinates(location, yDist, NORTH);
		location = getNewCoordinates(location, xDist/2, WEST);

		for (let direction = 0; direction < 6; direction++) {
			for (let i = 0; i < ring; i++) {
				switch (direction) {
					case 0: {
						location = getNewCoordinates(location, xDist, EAST);
						break;
					}
					case 1: {
						location = getNewCoordinates(location, yDist, SOUTH);
						location = getNewCoordinates(location, xDist/2, EAST);
						break;
					}
					case 2: {
						location = getNewCoordinates(location, yDist, SOUTH);
						location = getNewCoordinates(location, xDist/2, WEST);
						break;
					}
					case 3: {
						location = getNewCoordinates(location, xDist, WEST);
						break;
					}
					case 4: {
						location = getNewCoordinates(location, yDist, NORTH);
						location = getNewCoordinates(location, xDist/2, WEST);
						break;
					}
					case 5: {
						location = getNewCoordinates(location, yDist, NORTH);
						location = getNewCoordinates(location, xDist/2, EAST);
						break;
					}
				}
				locations.push(location);
			}
		}

		ring++;
	}

	return locations;
}

function searchAllLocations(accounts, locations) {
	function enqueueWorkIfExists(account, locations) {
		const location = locations.shift();
		if (!_.isNil(location)) {
			return account.getDataForLocation(location)
				.catch((error) => {
					if (error == 'No Result') {
						locations.unshift(location); // Retry
					} else {
						console.error('TODO: Handle this error in search.js', error);
					}
				})
				.then(() => enqueueWorkIfExists(account, locations));
		}
		return when.resolve();
	}

	return when.map(accounts, account => enqueueWorkIfExists(account, locations));
}

module.exports = function search(accounts, initialLocation, steps) {
	if (!(initialLocation instanceof LatLon)) {
		const coords = accounts[0].getLocation();
		initialLocation = new LatLon(coords.latitude, coords.longitude);
	}

	const searchLocations = generateSearchLocations(initialLocation, steps);
	return searchAllLocations(accounts, searchLocations);
}