// import important parts of sequelize library
const { Model, DataTypes, FLOAT } = require('sequelize');
// import our database connection from config.js
const sequelize = require('../config/connection');

// Initialize Product model (table) by extending off Sequelize's Model class
class Product extends Model {}

// set up fields and rules for Product model
Product.init(
  {
    // define columns
    id: {
      type: DATATypes.INTEGER,
      allowNull: false,
      primaryKey: true,
      autoIncrement: true,
    },
    product_name: {
      type: DATATypes.STRING,
      allowNull: false,
    },
    price: {
      type: DATATypes.FLOAT,
      allowNull: false,
    },
    stock: {
      type: DATATypes.INTEGER,
      allowNull: false,
    },
    category_id: {
      type: DATATypes.INTEGER,
      references: {
        model: 'category',
        key: 'id',
      },
    },
  },
  {
    sequelize,
    timestamps: false,
    freezeTableName: true,
    underscored: true,
    modelName: 'product',
  }
);

module.exports = Product;
