module.exports = function(sequelize, DataTypes) {
	return sequelize.define('scannedlocation', {
		scannedId: {
			type: DataTypes.STRING(50),
			allowNull: false,
			primaryKey: true,
			field: 'scanned_id'
		},
		latitude: {
			type: DataTypes.DOUBLE,
			allowNull: false
		},
		longitude: {
			type: DataTypes.DOUBLE,
			allowNull: false
		},
		lastModified: {
			type: DataTypes.DATE,
			allowNull: false,
			field: 'last_modified'
		}
	}, {
		freezeTableName: true,
		timestamps: false,
	});
}