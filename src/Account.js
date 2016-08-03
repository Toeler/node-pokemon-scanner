const _ = require('lodash');
const config = require('config');
const when = require('when');
const winston = require('winston');
const Sequelize = require('sequelize');
const LatLon = require('./LatLon');

function getLocationObject(location) {
	return {
		type: (location instanceof LatLon) ? 'coords' : 'name',
		coords: location,
		name: location
	};
}

function retry(operation, delay, times, currentTimes = 0) {
	if (currentTimes === times) {
		return when.reject('Too many retries');
	}
	return operation().catch((reason) => {
		winston.error(reason);
		return when.resolve()
			.delay(delay)
			.then(retry.bind(null, operation, delay * 2, times, currentTimes++))
	});
}

module.exports = class Account {
	constructor(stringInput, fallbackPassword, sequelize) {
		const [, userWithPass, userWithoutPass, pass, provider] = /^(?:(.*)(?::)|(.*))(.*)@(.*)$/.exec(stringInput);
		this.user = userWithPass || userWithoutPass;
		this.pass = userWithPass ? pass : fallbackPassword; 
		this.provider = provider;
		this.sequelize = sequelize;
		this.stepDelay = config.get('stepDelay');
	}

	init(initialLocation) {
		this.lastLoginTime = new Date();
		return retry(this.api.init.bind(null, this.user, this.pass, getLocationObject(initialLocation), this.provider), 5000, 5);
	}

	/**
	 * Sets the account's location within the PokemonGO profile
	 */
	setLocation(location) {
		return this.api.SetLocation(getLocationObject(location));
	}

	getLocation() {
		return this.api.GetLocationCoords();
	}

	getData() {
		return this.api.Heartbeat()
			.timeout(30000, `${this.user}: Timeout getting data from API`);
	}

	parsePokemon(data) {
		return data.map((p) => ({
			encounterId: new Buffer(p.EncounterId.toString()).toString('base64'),
			spawnpointId: p.SpawnPointId,
			pokemonId: p.PokedexTypeId,
			latitude: parseFloat(p.Latitude),
			longitude: parseFloat(p.Longitude),
			disappearTime: new Date(p.ExpirationTimeMs.toNumber())
		}));
	}

	parseForts(data) {
		return when.resolve([]);
	}

	parseData(data) {
		const pokemon = [];
		const forts = [];
		data.cells.forEach((cell) => {
			pokemon.push(this.parsePokemon(cell.MapPokemon));
			forts.push(this.parseForts(cell.Fort));
		});
		return {
			pokemon: pokemon.reduce((flat, value) => flat.concat(value), []),
			pokestops: [],
			gyms: []
		};
	}

	storePokemon(transaction, pokemon) {
		return when.all(
			when.map(pokemon, p => this.sequelize.Pokemon.upsert(p, { transaction: transaction }))
		);
	}

	storePokestops(transaction, pokestops) {
		return when.resolve();
	}

	storeGyms(transaction, gyms) {
		return when.resolve();
	}

	storeScannedLocation(transaction, location) {
		return this.sequelize.ScannedLocation.upsert({
			scannedId: `${location.lat},${location.lon}`,
			latitude: location.lat,
			longitude: location.lon,
			lastModified: new Date()
		}, { transaction: transaction });
	}

	storeData(data, location) {
		return this.sequelize.transaction({ isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.READ_COMMITTED}, (t) =>
			when.join(
				this.storePokemon(t, data.pokemon),
				this.storePokestops(t, data.pokestops),
				this.storeGyms(t, data.gyms),
				this.storeScannedLocation(t, location)
			)
		).tap(() => winston.info(`${this.user}: Upserted ${data.pokemon.length} Pokemon, ${data.pokestops.length} Pokestops and ${data.gyms.length} Gyms`));
	}

	getDataForLocation(location) {
		winston.info(`Requesting data for ${location.toString()}`);
		return this.setLocation(location)
			.then((d) => this.getData(d))
			.then((d) => this.parseData(d))
			.then((d) => this.storeData(d, location))
			/*.then(data => {
				const pokemons = [];

				data.cells.forEach((cell) => {
					cell.Fort.forEach((fort) => {
						if (!fort.fortType || fort.fortType === 0) {
							//console.log('Gym:');
							//console.log(fort);
						} else if (fort.fortType === 1) {
							//console.log('Pokestop:');
							//console.log(fort);
						} else {
							console.log('Unknown Fort Type:');
							console.log(fort);
						}
					});

					cell.MapPokemon.forEach((pokemon) => {
						console.log('Pokemon:');
						console.log(pokemon);
						pokemons.push(pokemon);
					});
					
					//console.log(`Found ${cell.MapPokemon.length} pokemon in cell ${cell.S2CellId.toString()}`);
				});

				if (pokemons.length > 0) {
					return sequelize.transaction((t) => {
						return when.all(when.map(pokemons, (p) => Pokemon.upsert({
							encounterId: new Buffer(p.EncounterId.toString()).toString('base64'),
							spawnpointId: p.SpawnPointId,
							pokemonId: p.PokedexTypeId,
							latitude: parseFloat(p.Latitude),
							longitude: parseFloat(p.Longitude),
							disappearTime: new Date(p.ExpirationTimeMs.toNumber())
						})));
					});
				} else {
					return when.resolve();
				}
			})*/
			.delay(this.stepDelay) // Niantic are rate limiting the requests so each client needs to ensure it doesn't get run immediately after. We've already upserted into the DB so we can wait now;
	}
}