import { DataTypes, Model } from 'sequelize';

import { USER_ROLE, USER_ROLES } from '../constants/auth.js';

export class User extends Model {
  toJSON() {
    const values = { ...this.get() };
    delete values.passwordHash;
    return values;
  }
}

export const initializeUser = (sequelize) =>
  User.init(
    {
      id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
      name: { type: DataTypes.STRING(150), allowNull: false, validate: { notEmpty: true } },
      email: {
        type: DataTypes.STRING(254),
        allowNull: false,
        unique: 'uq_users_email',
        set(value) {
          this.setDataValue('email', typeof value === 'string' ? value.trim().toLowerCase() : value);
        },
      },
      passwordHash: { type: DataTypes.STRING(255), allowNull: false, field: 'password_hash' },
      role: { type: DataTypes.ENUM(...USER_ROLES), allowNull: false, defaultValue: USER_ROLE.MECHANIC },
      active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    },
    { sequelize, modelName: 'User', tableName: 'users', timestamps: true, underscored: true },
  );
