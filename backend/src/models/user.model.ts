import mongoose, { Schema, Document } from 'mongoose';
import { User } from '@smart-task/contracts';

export interface UserDocument extends Omit<User, 'id'>, Document {}

const userSchema = new Schema<UserDocument>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Note: email field already has an index via unique: true
// No need for explicit index here

export const UserModel = mongoose.model<UserDocument>('User', userSchema);
