module.exports = function(sequelize, DataTypes) {
	return sequelize.define('pokemon', {
		encounterId: {
			type: DataTypes.STRING(50),
			allowNull: false,
			primaryKey: true,
			field: 'encounter_id'
		},
		spawnpointId: {
			type: DataTypes.STRING(255),
			allowNull: false,
			field: 'spawnpoint_id'
		},
		pokemonId: {
			type: DataTypes.INTEGER,
			allowNull: false,
			field: 'pokemon_id'
		},
		latitude: {
			type: DataTypes.DOUBLE,
			allowNull: false
		},
		longitude: {
			type: DataTypes.DOUBLE,
			allowNull: false
		},
		disappearTime: {
			type: DataTypes.DATE,
			allowNull: false,
			field: 'disappear_time'
		}
	}, {
		freezeTableName: true,
		timestamps: false,
	});
}