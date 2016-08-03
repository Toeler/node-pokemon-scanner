const _ = require('lodash');
const config = require('config');
const when = require('when');
const nodeFn = require('when/node');
const PokemonGO = require('pokemon-go-node-api');

/**
 * Creates a new interface to the PokemonGO API for each account, logs into it then returns the account
 * @param {Account} account - The Account object containing the login details
 * @param {LatLon} initialLocation - The location to start the account on (Doesn't serve much purpose as it will be overridden during processing)
 * @returns {Promise<Account>} The account object.
 */
function loginWithAccount(account, initialLocation) {
	if (!account.api) {
		const api = new PokemonGO.Pokeio();
		account.api = nodeFn.liftAll(api);
		//promisedApi.getDataForLocation = getDataForLocation.bind(null, promisedApi);
		// Undo known endpoints that aren't callback based
		account.api.GetLocationCoords = api.GetLocationCoords;
	}
	
	if (!account.lastLoginTime || (new Date() - account.lastLoginTime) > config.get('sessionDuration')) {
		return account.init(initialLocation)
			.yield(account);
	}
	return account;
}

/**
 * Logs the provided accounts into the PokemonGO API
 * @param {Array<Account>} accounts - The Account objects to log in
 * @param {LatLon} initialLocation - The location to start each account on (Doesn't serve much purpose as it will be overridden during processing)
 * @returns {Promise<Array<Account>>} The Account objects after logging in and setting up the API methods on each one.
 */
module.exports = function loginToAllAccounts(accounts, initialLocation) {
	const areLoggedIn = _.bind(loginWithAccount, _, _, initialLocation);
	
	return when.all(when.map(accounts, areLoggedIn));
}