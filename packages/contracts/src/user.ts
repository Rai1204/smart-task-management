// User domain model
export interface User {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
}

// User response (without sensitive data)
export interface UserResponse {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

// JWT payload
export interface JwtPayload {
  userId: string;
  email: string;
  iat?: number;
  exp?: number;
}
