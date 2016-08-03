module.exports = class LatLon {
	constructor(latitude, longitude, altitude) {
		this.latitude = parseFloat(latitude);
		this.longitude = parseFloat(longitude);
		this.altitude = parseFloat(altitude) || 0;
	}

	get lat() {
		return this.latitude;
	}
	
	get lon() {
		return this.longitude;
	}

	get alt() {
		return this.alt;
	}

	toString() {
		return `{${this.lat}, ${this.lon}}`;
	}
}