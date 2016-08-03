const _ = require('lodash');
const when = require('when');
const Sequelize = require('sequelize');
const config = require('config');
const winston = require('winston');
winston.level = config.get('logLevel');
require('./utils');
const LatLon = require('./LatLon');
const Account = require('./Account');
const search = require('./search');
const login = require('./login');

require('pg').types.setTypeParser(1114, function(stringValue) {
	return new Date(stringValue + "+0000"); // Ensure that Dates get saved as UTC
});

function buildAccounts(sequelize) {
	const accounts = config.get('accounts');
	return accounts.users.map((account) => new Account(account, accounts.pass, sequelize));
}

function parseLocations(locations) {
	return locations.map((location) => {
		const match = /^(\-?\d+\.\d+)?,\s*(\-?\d+\.\d+?)$/.exec(location);
		if (match) {
			return new LatLon(match[1], match[2]);
		} else {
			return location;
		}
	});
}

function chunkify(array, numChunks) {
	if (numChunks < 2) {
        return [array];
	}

    const len = array.length;
    const out = [];
    let i = 0;

    if (len % numChunks === 0) {
        const size = Math.floor(len / numChunks);
        while (i < len) {
            out.push(array.slice(i, i += size));
        }
    } else {
        while (i < len) {
            const size = Math.ceil((len - i) / n--);
            out.push(array.slice(i, i += size));
        }
    }

    return out;
}

module.exports = function start() {
	const sequelize = new Sequelize(config.get('db'), { logging: winston.debug });
	sequelize.Pokemon = sequelize.import('./models/pokemon');
	sequelize.ScannedLocation = sequelize.import('./models/scannedLocation');

	const locations = parseLocations(config.get('locations'));
	
	const connectedToDatabase = sequelize.authenticate();
	const steps = config.get('steps');
	const stepDelay = config.get('stepDelay');
	const _buildAccounts = _.bind(buildAccounts, _, sequelize);
	const iterateIninitely = _.bind(when.iterate, _, _, () => false, () => null, 0);
	
	return when(connectedToDatabase)
		.then(_buildAccounts)
		.then((accounts) => {
			const accountsForEachLocation = chunkify(accounts, locations.length);

			return when.all(
				locations.map((location, i) => {
					const searchAroundLocation = _.bind(search, _, _, location, steps);

					return iterateIninitely(() => {
						return login(accountsForEachLocation[i], location)
							.then(searchAroundLocation);
					});
				})
			);
		})
		.catch(error => {
			winston.error('Critical Error occurred:');
			winston.error(error);
			process.exit(1);
		})
		.then(() => process.exit(0));
}